import "dotenv/config";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import type { Pool, PoolClient } from "pg";

type CsvRow = Record<string, string>;

let poolForCleanup: Pool | undefined;
const root = process.cwd();
const enrollmentColumns = [
  "Total number of students enrolled in Class 6, including all sections",
  "Total number of students enrolled in Class 7, including all sections",
  "Total number of students enrolled in Class 8, including all sections",
];
const mathColumns = [
  "Average student attendance during the Class 6 PBL Math session. If you did not teach Math in Class 6, enter 0.",
  "Average student attendance during the Class 7 PBL Math session. If you did not teach Math in Class 7, enter 0.",
  "Average student attendance during the Class 8 PBL Math session. If you did not teach Math in Class 8, enter 0.",
];
const scienceColumns = [
  "Average student attendance during the Class 6 PBL Science session. If you did not teach Science in Class 6, enter 0.",
  "Average student attendance during the Class 7 PBL Science session. If you did not teach Science in Class 7, enter 0.",
  "Average student attendance during the Class 8 PBL Science session. If you did not teach Science in Class 8, enter 0.",
];

function required(row: CsvRow, field: string, file: string): string {
  const value = row[field]?.trim();
  if (!value) throw new Error(`Missing "${field}" in ${file}.`);
  return value;
}

function numberValue(value: string | undefined, field: string, file: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid non-negative number for "${field}" in ${file}: ${value}.`);
  }
  return parsed;
}

function rateValue(value: string | undefined, field: string, file: string): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Invalid rate for "${field}" in ${file}: ${value}. Expected a fraction from 0 to 1.`);
  }
  return parsed;
}

async function parseCsv(filePath: string): Promise<CsvRow[]> {
  const contents = await readFile(filePath, "utf8");
  const parsed = Papa.parse<CsvRow>(contents, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.length) {
    const first = parsed.errors[0];
    throw new Error(`Could not parse ${path.basename(filePath)} at row ${first.row ?? "?"}: ${first.message}`);
  }
  if (!parsed.meta.fields?.length) throw new Error(`CSV has no headers: ${filePath}`);
  return parsed.data;
}

async function insertRows(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][],
  conflict: string,
): Promise<void> {
  const batchSize = 250;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values: unknown[] = [];
    const tuples = batch.map((row) => {
      const placeholders = row.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${tuples.join(", ")} ${conflict}`,
      values,
    );
  }
}

async function seed(): Promise<void> {
  const pblFiles = [
    "PBL_School_Response_Data_July_2025.csv",
    "PBL_School_Response_Data_August_2025.csv",
    "PBL_School_Response_Data_September_2025.csv",
  ];
  const pblRows = (await Promise.all(
    pblFiles.map((file) => parseCsv(path.join(root, "data", "raw", "pbl", file))),
  )).flat();
  const financeRows = await parseCsv(path.join(root, "data", "raw", "grant", "01_Grant_Profile_and_Finance.csv"));
  const performanceRows = await parseCsv(path.join(root, "data", "raw", "grant", "02_Grant_Performance_and_Report_Material.csv"));
  const mediaRows = await parseCsv(path.join(root, "data", "raw", "grant", "03_Evidence_and_Media_Index.csv"));

  if (pblRows.length !== 6900 || financeRows.length !== 45 || performanceRows.length !== 9 || mediaRows.length !== 9) {
    throw new Error(
      `Unexpected CSV record counts: PBL ${pblRows.length}, finance ${financeRows.length}, performance ${performanceRows.length}, media ${mediaRows.length}.`,
    );
  }

  const normalizedPbl = pblRows.map((row) => {
    const file = "PBL school responses";
    const classes = [...new Set((row["In which class/classes did you conduct the PBL project?"] ?? "")
      .match(/\b[678]\b/g)?.map(Number) ?? [])];
    const subjectText = row["Which subject do you teach?"] ?? "";
    const subjects = ["Math", "Science"].filter((subject) => subjectText.includes(subject));
    const month = required(row, "Reporting Month", file).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Invalid reporting month "${month}".`);
    return [
      month,
      required(row, "What is your school's synthetic school code?", file),
      required(row, "What is the name of your school?", file),
      required(row, "What is the name of your district?", file),
      required(row, "Block Details", file),
      row["Was the PBL project conducted in your school this month?"] === "Yes",
      row["Was evidence submitted for the completed PBL project?"] === "Yes",
      classes,
      subjects,
      enrollmentColumns.map((column) => numberValue(row[column], column, file)),
      mathColumns.map((column) => numberValue(row[column], column, file)),
      scienceColumns.map((column) => numberValue(row[column], column, file)),
    ];
  });

  const grants = new Map<string, unknown[]>();
  for (const row of financeRows) {
    const id = required(row, "grant_id", "grant reporting CSV");
    grants.set(id, [
      id,
      required(row, "donor", "grant reporting CSV"),
      required(row, "grant_name", "grant reporting CSV"),
      row.period_start ?? null,
      row.period_end ?? null,
      row.covered_districts ?? null,
    ]);
  }

  const normalizedFinance = financeRows.map((row) => [
    required(row, "grant_id", "finance CSV"),
    required(row, "reporting_month", "finance CSV").slice(0, 7),
    required(row, "budget_line", "finance CSV"),
    numberValue(row.approved_budget_units, "approved_budget_units", "finance CSV"),
    numberValue(row.monthly_utilized_units, "monthly_utilized_units", "finance CSV"),
    numberValue(row.cumulative_utilized_units, "cumulative_utilized_units", "finance CSV"),
    rateValue(row.cumulative_utilization_rate, "cumulative_utilization_rate", "finance CSV"),
    row.finance_note ?? "",
  ]);
  const normalizedPerformance = performanceRows.map((row) => [
    required(row, "grant_id", "grant performance CSV"),
    required(row, "reporting_month", "grant performance CSV").slice(0, 7),
    row.period_end_date ?? null,
    row.report_due_date ?? null,
    row.report_status ?? "",
    numberValue(row.sampled_school_records, "sampled_school_records", "grant performance CSV"),
    numberValue(row.schools_completed_pbl, "schools_completed_pbl", "grant performance CSV"),
    rateValue(row.pbl_completion_rate, "pbl_completion_rate", "grant performance CSV"),
    numberValue(row.schools_with_evidence, "schools_with_evidence", "grant performance CSV"),
    rateValue(row.evidence_submission_rate, "evidence_submission_rate", "grant performance CSV"),
    numberValue(row.total_enrollment, "total_enrollment", "grant performance CSV"),
    numberValue(row.total_attendance, "total_attendance", "grant performance CSV"),
    rateValue(row.attendance_rate, "attendance_rate", "grant performance CSV"),
    row.risk_status ?? "Not reported",
    row.milestone_summary ?? "",
    row.draft_report_text ?? "",
  ]);
  const normalizedMedia = mediaRows.map((row) => {
    const fileName = required(row, "file_name", "media index CSV");
    const assetPath = path.join(root, "public", "evidence", fileName);
    return [
      required(row, "record_id", "media index CSV"),
      required(row, "grant_id", "media index CSV"),
      required(row, "reporting_month", "media index CSV").slice(0, 7),
      row.record_type ?? "media",
      row.district ?? "",
      row.title ?? fileName,
      row.summary_or_caption ?? "",
      fileName,
      `evidence/${fileName}`,
      row.usage_note ?? "",
      assetPath,
    ];
  });

  for (const row of normalizedMedia) {
    const assetPath = row[row.length - 1];
    if (typeof assetPath !== "string") throw new Error("Missing local path for a media asset.");
    await access(assetPath);
  }

  if (process.argv.includes("--validate-only")) {
    console.log(
      `CSV validation passed: ${normalizedPbl.length} PBL rows, ${normalizedFinance.length} finance rows, ${normalizedPerformance.length} grant reports, and ${normalizedMedia.length} linked evidence records.`,
    );
    return;
  }

  const { pool } = await import("./db.js");
  poolForCleanup = pool;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await insertRows(
      client,
      "grants",
      ["grant_id", "donor", "grant_name", "period_start", "period_end", "covered_districts"],
      [...grants.values()],
      "ON CONFLICT (grant_id) DO UPDATE SET donor = EXCLUDED.donor, grant_name = EXCLUDED.grant_name, period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end, covered_districts = EXCLUDED.covered_districts",
    );
    await insertRows(
      client,
      "pbl_responses",
      ["month", "school_code", "school_name", "district", "block", "participated", "evidence", "classes", "subjects", "enrollment", "math_attendance", "science_attendance"],
      normalizedPbl,
      "ON CONFLICT (month, school_code) DO UPDATE SET school_name = EXCLUDED.school_name, district = EXCLUDED.district, block = EXCLUDED.block, participated = EXCLUDED.participated, evidence = EXCLUDED.evidence, classes = EXCLUDED.classes, subjects = EXCLUDED.subjects, enrollment = EXCLUDED.enrollment, math_attendance = EXCLUDED.math_attendance, science_attendance = EXCLUDED.science_attendance",
    );
    await insertRows(
      client,
      "grant_finance",
      ["grant_id", "month", "budget_line", "approved_budget", "monthly_utilized", "cumulative_utilized", "source_utilization_rate", "finance_note"],
      normalizedFinance,
      "ON CONFLICT (grant_id, month, budget_line) DO UPDATE SET approved_budget = EXCLUDED.approved_budget, monthly_utilized = EXCLUDED.monthly_utilized, cumulative_utilized = EXCLUDED.cumulative_utilized, source_utilization_rate = EXCLUDED.source_utilization_rate, finance_note = EXCLUDED.finance_note",
    );
    await insertRows(
      client,
      "grant_performance",
      ["grant_id", "month", "period_end", "report_due", "report_status", "sampled", "completed", "completion_rate", "evidence_count", "evidence_rate", "enrollment", "attendance", "attendance_rate", "source_risk", "milestones", "draft_report"],
      normalizedPerformance,
      "ON CONFLICT (grant_id, month) DO UPDATE SET period_end = EXCLUDED.period_end, report_due = EXCLUDED.report_due, report_status = EXCLUDED.report_status, sampled = EXCLUDED.sampled, completed = EXCLUDED.completed, completion_rate = EXCLUDED.completion_rate, evidence_count = EXCLUDED.evidence_count, evidence_rate = EXCLUDED.evidence_rate, enrollment = EXCLUDED.enrollment, attendance = EXCLUDED.attendance, attendance_rate = EXCLUDED.attendance_rate, source_risk = EXCLUDED.source_risk, milestones = EXCLUDED.milestones, draft_report = EXCLUDED.draft_report",
    );
    await insertRows(
      client,
      "grant_media",
      ["record_id", "grant_id", "month", "record_type", "district", "title", "caption", "file_name", "relative_path", "usage_note"],
      normalizedMedia.map((row) => row.slice(0, 10)),
      "ON CONFLICT (record_id) DO UPDATE SET grant_id = EXCLUDED.grant_id, month = EXCLUDED.month, record_type = EXCLUDED.record_type, district = EXCLUDED.district, title = EXCLUDED.title, caption = EXCLUDED.caption, file_name = EXCLUDED.file_name, relative_path = EXCLUDED.relative_path, usage_note = EXCLUDED.usage_note",
    );
    await client.query("COMMIT");
    console.log(
      `Seeded ${normalizedPbl.length} PBL rows, ${normalizedFinance.length} finance rows, ${normalizedPerformance.length} grant reports, and ${normalizedMedia.length} evidence records.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(async (error: unknown) => {
  console.error("Database seed failed:", error);
  if (poolForCleanup) await poolForCleanup.end();
  process.exitCode = 1;
});
