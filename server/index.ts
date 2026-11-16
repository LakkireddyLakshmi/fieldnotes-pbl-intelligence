import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import path from "node:path";
import { z } from "zod";
import { pool } from "./db.js";
import type { FilterOptions, ProgramFilters } from "./contracts.js";
import { getGrantReport } from "./grant-service.js";
import { getProgramDashboard } from "./program-service.js";
import { HttpError } from "./errors.js";

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

app.get("/api/health", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
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
    const filters = parsed.data as ProgramFilters;
    response.json(await getProgramDashboard(filters));
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
  console.error("Request failed:", error);
  response.status(500).json({ error: "The request could not be completed. Check the server logs." });
});

async function start(): Promise<void> {
  await pool.query("SELECT 1");
  app.listen(port, host, () => {
    console.log(`Fieldnotes API listening on http://127.0.0.1:${port}`);
  });
}

start().catch(async (error: unknown) => {
  console.error("Server startup failed. Check DATABASE_URL and PostgreSQL availability.", error);
  await pool.end();
  process.exitCode = 1;
});
