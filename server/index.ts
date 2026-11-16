import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import path from "node:path";
import { z } from "zod";
import { pool } from "./db.js";
import type { FilterOptions, FollowUpRecord, ProgramFilters } from "./contracts.js";
import { getGrantReport } from "./grant-service.js";
import { getProgramDashboard, getSchoolRecords } from "./program-service.js";
import { HttpError } from "./errors.js";
import {
  clearSessionCookie,
  ensureInitialAdmin,
  hashPassword,
  newSessionToken,
  requireRole,
  requireUser,
  sessionHash,
  setSessionCookie,
  verifyPassword,
  type AuthUser,
  type UserRole,
} from "./auth.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Month must use YYYY-MM format.");
const queryString = z.string().trim().max(120);
const dashboardQuery = z.object({
  month: monthSchema,
  district: queryString.default("all"),
  block: queryString.default("all"),
  grade: z.enum(["all", "6", "7", "8"]).default("all"),
  subject: z.enum(["all", "Math", "Science"]).default("all"),
  groupBy: z.enum(["district", "block"]).optional(),
});

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: "1mb" }));

const publicUser = (user: AuthUser) => ({ id: String(user.id), name: user.name, email: user.email, role: user.role, active: user.active });
const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});
const roleSchema = z.enum(["admin", "analyst", "viewer"]);
const followUpStatusSchema = z.enum(["Draft", "In Progress", "Complete"]);
const followUpDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Due date must be a real date in YYYY-MM-DD format.");

app.get("/api/auth/setup", async (_request, response, next) => {
  try {
    const { rows } = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM auth_users");
    response.json({ setupRequired: Number(rows[0]?.count) === 0 });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", async (request, response, next) => {
  try {
    const input = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(256) }).safeParse(request.body);
    if (!input.success) throw new HttpError(400, "Enter a valid email and password.");
    const { rows } = await pool.query<AuthUser & { password_hash: string }>(
      "SELECT id, name, email, role, active, password_hash FROM auth_users WHERE email = $1",
      [input.data.email.toLowerCase()],
    );
    const user = rows[0];
    if (!user?.active || !await verifyPassword(input.data.password, user?.password_hash ?? "")) {
      throw new HttpError(401, "Email or password is incorrect.");
    }
    const token = newSessionToken();
    await pool.query("DELETE FROM auth_sessions WHERE expires_at <= now()");
    await pool.query("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '12 hours')", [sessionHash(token), user.id]);
    setSessionCookie(response, token);
    response.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.get("/api/auth/me", requireUser, (_request, response) => {
  response.json({ user: publicUser(response.locals.user as AuthUser) });
});

app.post("/api/auth/logout", async (request, response, next) => {
  try {
    const token = request.headers.cookie?.split(";").map((part) => part.trim())
      .find((part) => part.startsWith("fieldnotes_session="))?.slice("fieldnotes_session=".length);
    if (token) await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [sessionHash(token)]);
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) { next(error); }
});

app.patch("/api/auth/profile", requireUser, async (request, response, next) => {
  try {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Profile details are invalid.");
    const user = response.locals.user as AuthUser;
    const { rows } = await pool.query<AuthUser>(
      "UPDATE auth_users SET name = $1, email = $2, updated_at = now() WHERE id = $3 RETURNING id, name, email, role, active",
      [parsed.data.name, parsed.data.email, user.id],
    );
    response.json({ user: publicUser(rows[0]!) });
  } catch (error) { next(error); }
});

app.post("/api/auth/password", requireUser, async (request, response, next) => {
  try {
    const input = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(12).max(256) }).safeParse(request.body);
    if (!input.success) throw new HttpError(400, "Use your current password and a new password with at least 12 characters.");
    const user = response.locals.user as AuthUser;
    const { rows } = await pool.query<{ password_hash: string }>("SELECT password_hash FROM auth_users WHERE id = $1", [user.id]);
    if (!rows[0] || !await verifyPassword(input.data.currentPassword, rows[0].password_hash)) {
      throw new HttpError(400, "Current password is incorrect.");
    }
    await pool.query("UPDATE auth_users SET password_hash = $1, updated_at = now() WHERE id = $2", [await hashPassword(input.data.newPassword), user.id]);
    await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [user.id]);
    const token = newSessionToken();
    await pool.query("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '12 hours')", [sessionHash(token), user.id]);
    setSessionCookie(response, token);
    response.json({ message: "Password updated." });
  } catch (error) { next(error); }
});

app.get("/api/admin/users", requireUser, requireRole("admin"), async (_request, response, next) => {
  try {
    const { rows } = await pool.query<AuthUser>("SELECT id, name, email, role, active FROM auth_users ORDER BY name, email");
    response.json(rows.map(publicUser));
  } catch (error) { next(error); }
});

app.post("/api/admin/users", requireUser, requireRole("admin"), async (request, response, next) => {
  try {
    const input = z.object({
      ...profileSchema.shape,
      role: roleSchema,
      password: z.string().min(12).max(256),
    }).safeParse(request.body);
    if (!input.success) throw new HttpError(400, input.error.issues[0]?.message ?? "User details are invalid.");
    const { rows } = await pool.query<AuthUser>(
      "INSERT INTO auth_users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active",
      [input.data.name, input.data.email, await hashPassword(input.data.password), input.data.role],
    );
    response.status(201).json(publicUser(rows[0]!));
  } catch (error) { next(error); }
});

app.patch("/api/admin/users/:id", requireUser, requireRole("admin"), async (request, response, next) => {
  try {
    const id = z.coerce.number().int().positive().safeParse(request.params.id);
    const input = z.object({ role: roleSchema, active: z.boolean() }).partial().refine((data) => Object.keys(data).length > 0).safeParse(request.body);
    if (!id.success || !input.success) throw new HttpError(400, "User update is invalid.");
    const actor = response.locals.user as AuthUser;
    if (String(id.data) === actor.id && (input.data.active === false || input.data.role && input.data.role !== "admin")) {
      throw new HttpError(400, "You cannot remove your own administrator access.");
    }
    const { rows: currentRows } = await pool.query<AuthUser>("SELECT id, name, email, role, active FROM auth_users WHERE id = $1", [id.data]);
    const current = currentRows[0];
    if (!current) throw new HttpError(404, "User account was not found.");
    const nextRole = input.data.role ?? current.role;
    const nextActive = input.data.active ?? current.active;
    if (current.role === "admin" && current.active && (nextRole !== "admin" || !nextActive)) {
      const { rows: admins } = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM auth_users WHERE role = 'admin' AND active = true");
      if (Number(admins[0]?.count) <= 1) throw new HttpError(400, "At least one active administrator must remain.");
    }
    const { rows } = await pool.query<AuthUser>(
      "UPDATE auth_users SET role = $1, active = $2, updated_at = now() WHERE id = $3 RETURNING id, name, email, role, active",
      [nextRole, nextActive, id.data],
    );
    if (!nextActive) await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [id.data]);
    response.json(publicUser(rows[0]!));
  } catch (error) { next(error); }
});

app.get("/api/health", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.use("/api", requireUser);

app.get("/api/follow-ups", async (request, response, next) => {
  try {
    const query = z.object({ month: monthSchema }).safeParse(request.query);
    if (!query.success) throw new HttpError(400, query.error.issues[0]?.message ?? "Choose a valid reporting month.");
    const { rows } = await pool.query<FollowUpRecord>(
      `SELECT id::text, month, district, block, title, detail, owner, priority, metric,
              due_date::text AS due, status
         FROM follow_up_actions
        WHERE month = $1
        ORDER BY (status = 'Complete') ASC, due_date ASC, id ASC`,
      [query.data.month],
    );
    response.json(rows);
  } catch (error) { next(error); }
});

app.post("/api/follow-ups", requireRole("admin", "analyst"), async (request, response, next) => {
  try {
    const input = z.object({
      month: monthSchema,
      district: queryString.default("all"),
      block: queryString.default("all"),
      title: z.string().trim().min(1).max(160),
      detail: z.string().trim().min(1).max(1200),
      owner: z.string().trim().min(1).max(120),
      priority: z.enum(["On Track", "Behind", "At Risk", "Critical", "No data"]),
      metric: z.string().trim().min(1).max(160),
      due: followUpDateSchema,
    }).safeParse(request.body);
    if (!input.success) throw new HttpError(400, input.error.issues[0]?.message ?? "Follow-up details are invalid.");
    const user = response.locals.user as AuthUser;
    const { rows } = await pool.query<FollowUpRecord>(
      `INSERT INTO follow_up_actions
         (month, district, block, title, detail, owner, priority, metric, due_date, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id::text, month, district, block, title, detail, owner, priority, metric,
                 due_date::text AS due, status`,
      [input.data.month, input.data.district, input.data.block, input.data.title, input.data.detail,
        input.data.owner, input.data.priority, input.data.metric, input.data.due, user.id],
    );
    response.status(201).json(rows[0]);
  } catch (error) { next(error); }
});

app.patch("/api/follow-ups/:id", requireRole("admin", "analyst"), async (request, response, next) => {
  try {
    const id = z.coerce.number().int().positive().safeParse(request.params.id);
    const input = z.object({
      owner: z.string().trim().min(1).max(120).optional(),
      due: followUpDateSchema.optional(),
      status: followUpStatusSchema.optional(),
    }).refine((data) => Object.keys(data).length > 0, "Provide an owner, due date, or status to update.").safeParse(request.body);
    if (!id.success || !input.success) throw new HttpError(400, input.success ? "Follow-up id is invalid." : input.error.issues[0]?.message ?? "Follow-up update is invalid.");
    const user = response.locals.user as AuthUser;
    const { rows } = await pool.query<FollowUpRecord>(
      `UPDATE follow_up_actions
          SET owner = COALESCE($1, owner), due_date = COALESCE($2::date, due_date),
              status = COALESCE($3, status), updated_by = $4, updated_at = now()
        WHERE id = $5
        RETURNING id::text, month, district, block, title, detail, owner, priority, metric,
                  due_date::text AS due, status`,
      [input.data.owner ?? null, input.data.due ?? null, input.data.status ?? null, user.id, id.data],
    );
    if (!rows[0]) throw new HttpError(404, "Follow-up action was not found.");
    response.json(rows[0]);
  } catch (error) { next(error); }
});

app.get("/api/filters", async (request, response, next) => {
  try {
    const parsedDistrict = queryString.safeParse(request.query.district ?? "all");
    if (!parsedDistrict.success) throw new HttpError(400, "District filter is too long or invalid.");
    const district = parsedDistrict.data;
    const [months, districts, blocks] = await Promise.all([
      pool.query<{ month: string }>("SELECT DISTINCT month FROM pbl_responses ORDER BY month"),
      pool.query<{ district: string }>("SELECT DISTINCT district FROM pbl_responses ORDER BY district"),
      district === "all"
        ? pool.query<{ block: string }>("SELECT DISTINCT block FROM pbl_responses ORDER BY block")
        : pool.query<{ block: string }>(
          "SELECT DISTINCT block FROM pbl_responses WHERE district = $1 ORDER BY block",
          [district],
        ),
    ]);
    const options: FilterOptions = {
      months: months.rows.map((row) => row.month),
      districts: districts.rows.map((row) => row.district),
      blocks: blocks.rows.map((row) => row.block),
      grades: [6, 7, 8],
      subjects: ["Math", "Science"],
    };
    response.json(options);
  } catch (error) {
    next(error);
  }
});

app.get("/api/program/dashboard", async (request, response, next) => {
  try {
    const parsed = dashboardQuery.safeParse(request.query);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid dashboard filters.");
    const { groupBy, ...filters } = parsed.data;
    response.json(await getProgramDashboard(filters as ProgramFilters, groupBy));
  } catch (error) {
    next(error);
  }
});

app.get("/api/program/schools", async (request, response, next) => {
  try {
    const parsed = dashboardQuery.safeParse(request.query);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid school filters.");
    response.json(await getSchoolRecords(parsed.data as ProgramFilters));
  } catch (error) {
    next(error);
  }
});

app.get("/api/grants", async (_request, response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT grant_id AS "grantId", donor, grant_name AS "grantName"
         FROM grants ORDER BY donor, grant_name`,
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/grants/report", async (request, response, next) => {
  try {
    const query = z.object({
      grantId: z.string().trim().min(1).max(100),
      month: monthSchema,
    }).safeParse(request.query);
    if (!query.success) throw new HttpError(400, query.error.issues[0]?.message ?? "Invalid grant selection.");
    response.json(await getGrantReport(query.data.grantId, query.data.month));
  } catch (error) {
    next(error);
  }
});

app.use("/api", (_request, _response, next) => {
  next(new HttpError(404, "API endpoint not found."));
});

app.use("/evidence", requireUser);
app.use("/evidence", express.static(path.join(process.cwd(), "public", "evidence"), {
  fallthrough: false,
  maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
}));

const clientPath = path.join(process.cwd(), "dist", "client");
app.use(express.static(clientPath, { index: false }));
app.get(/.*/, (_request, response, next) => {
  response.sendFile(path.join(clientPath, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      response.status(409).json({ error: "That email address is already used by another account." });
      return;
    }
  console.error("Request failed:", error);
  response.status(500).json({ error: "The request could not be completed. Check the server logs." });
});

async function start(): Promise<void> {
  await pool.query("SELECT 1");
  await ensureInitialAdmin();
  app.listen(port, host, () => {
    console.log(`Fieldnotes API listening on http://127.0.0.1:${port}`);
  });
}

start().catch(async (error: unknown) => {
  console.error("Server startup failed. Check DATABASE_URL and PostgreSQL availability.", error);
  await pool.end();
  process.exitCode = 1;
});
