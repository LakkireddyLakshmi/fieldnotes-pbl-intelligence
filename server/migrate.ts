import "dotenv/config";
import { readFile } from "node:fs/promises";
import { pool } from "./db.js";

async function migrate(): Promise<void> {
  try {
    const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
    await pool.query(schema);
    console.log("Database schema is up to date.");
  } finally {
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
