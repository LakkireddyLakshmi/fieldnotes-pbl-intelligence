import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { pool } from "./db.js";
import { HttpError } from "./errors.js";

const scrypt = promisify(scryptCallback);
const cookieName = "fieldnotes_session";
const sessionLifetimeMs = 1000 * 60 * 60 * 12;
const keyLength = 64;
const saltLength = 16;

export type UserRole = "admin" | "analyst" | "viewer";
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export function sessionHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(saltLength);
  const derived = await scrypt(password, salt, keyLength) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = stored.split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionLifetimeMs,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(cookieName, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/" });
}

function readSessionCookie(request: Request): string | undefined {
  return request.headers.cookie?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
}

export async function requireUser(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const token = readSessionCookie(request);
    if (!token || token.length > 200) throw new HttpError(401, "Please sign in to continue.");
    const { rows } = await pool.query<AuthUser>(
      `SELECT u.id, u.name, u.email, u.role, u.active
         FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true`,
      [sessionHash(token)],
    );
    if (!rows[0]) throw new HttpError(401, "Your session has expired. Please sign in again.");
    response.locals.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    const user = response.locals.user as AuthUser | undefined;
    if (!user || !roles.includes(user.role)) {
      next(new HttpError(403, "Your account does not have permission to do that."));
      return;
    }
    next();
  };
}

export async function ensureInitialAdmin(): Promise<void> {
  const { rows } = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM auth_users");
  if (Number(rows[0]?.count) > 0) return;
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.INITIAL_ADMIN_NAME?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !name || !password || password.length < 12) {
    throw new Error("No user accounts exist. Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and a unique INITIAL_ADMIN_PASSWORD (12+ characters) to create the first administrator.");
  }
  await pool.query(
    "INSERT INTO auth_users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
    [name, email, await hashPassword(password)],
  );
  console.log(`Created the initial administrator account for ${email}.`);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
