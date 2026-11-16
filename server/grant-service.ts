import { pool } from "./db.js";
import { HttpError } from "./errors.js";
import { classify } from "./program-metrics.js";
import type { GrantMedia, GrantReport, RiskStatus } from "./contracts.js";

interface GrantPerformanceRow {
  grant_id: string;
  donor: string;
  grant_name: string;
  month: string;
  report_due: string;
  report_status: string;
  sampled: number;
  completed: number;
  completion_rate: string;
  evidence_count: number;
  evidence_rate: string;
  enrollment: number;
  attendance: number;
  attendance_rate: string;
  source_risk: string;
  milestones: string;
}

interface FinanceRow {
  approved_budget: string;
  monthly_utilized: string;
  cumulative_utilized: string;
  finance_note: string;
}

interface MediaRow {
  record_id: string;
  record_type: string;
  district: string;
  title: string;
  caption: string;
  file_name: string;
  relative_path: string;
  usage_note: string;
}

const number = (value: string | number): number => Number(value);
const percent = (value: number | null): string => value === null ? "No data" : `${(value * 100).toFixed(1)}%`;
const amount = (value: number): string => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

function parseMilestones(value: string): string[] {
  return value.split("|").map((part) => part.trim()).filter(Boolean);
}

export async function getGrantReport(grantId: string, month: string): Promise<GrantReport> {
  const { rows: performanceRows } = await pool.query<GrantPerformanceRow>(
    `SELECT g.grant_id, g.donor, g.grant_name, p.month, p.report_due, p.report_status,
            p.sampled, p.completed, p.completion_rate, p.evidence_count, p.evidence_rate,
            p.enrollment, p.attendance, p.attendance_rate, p.source_risk, p.milestones
       FROM grant_performance p
       JOIN grants g ON g.grant_id = p.grant_id
      WHERE p.grant_id = $1 AND p.month = $2`,
    [grantId, month],
  );
  const performance = performanceRows[0];
  if (!performance) throw new HttpError(404, "No grant performance report is available for that grant and month.");

  const [{ rows: finance }, { rows: mediaRows }] = await Promise.all([
    pool.query<FinanceRow>(
      `SELECT approved_budget, monthly_utilized, cumulative_utilized, finance_note
         FROM grant_finance WHERE grant_id = $1 AND month = $2 ORDER BY budget_line`,
      [grantId, month],
    ),
    pool.query<MediaRow>(
      `SELECT record_id, record_type, district, title, caption, file_name, relative_path, usage_note
         FROM grant_media WHERE grant_id = $1 AND month = $2 ORDER BY record_id`,
      [grantId, month],
    ),
  ]);
  if (finance.length === 0) throw new HttpError(404, "No finance rows are available for that grant and month.");

  const budget = finance.reduce((sum, row) => sum + number(row.approved_budget), 0);
  const monthlySpend = finance.reduce((sum, row) => sum + number(row.monthly_utilized), 0);
  const cumulativeSpend = finance.reduce((sum, row) => sum + number(row.cumulative_utilized), 0);
  const utilization = budget ? cumulativeSpend / budget : null;
  const completionRate = number(performance.completion_rate);
  const evidenceRate = number(performance.evidence_rate);
  const attendanceRate = number(performance.attendance_rate);
  const computedRisk = [completionRate, evidenceRate, attendanceRate]
    .map(classify)
    .sort((a, b) => riskOrder(a) - riskOrder(b))[0] ?? "No data";
  const milestones = parseMilestones(performance.milestones);
  const evidence: GrantMedia[] = mediaRows.map((row) => ({
    id: row.record_id,
    type: row.record_type,
    district: row.district,
    title: row.title,
    caption: row.caption,
    fileName: row.file_name,
    path: `/${row.relative_path.replace(/^\/+/, "")}`,
    usage: row.usage_note,
  }));
  const facts = [
    { label: "Grant", value: `${performance.donor} / ${performance.grant_name}` },
    { label: "Reporting month", value: month },
    { label: "PBL completions", value: `${performance.completed} / ${performance.sampled} (${percent(completionRate)})` },
    { label: "Evidence submissions", value: `${performance.evidence_count} (${percent(evidenceRate)})` },
    { label: "Reported attendance", value: amount(performance.attendance) },
    { label: "Reported enrollment", value: amount(performance.enrollment) },
    { label: "Attendance rate (source)", value: percent(attendanceRate) },
    { label: "Finance", value: `${amount(monthlySpend)} monthly; ${amount(cumulativeSpend)} cumulative / ${amount(budget)} approved units (${percent(utilization)})` },
    { label: "Source-reported risk", value: performance.source_risk },
    { label: "Computed indicator signal", value: computedRisk },
    { label: "Indexed evidence", value: evidence.length ? evidence.map((item) => item.id).join(", ") : "No indexed records for this month" },
    { label: "Report status / due", value: `${performance.report_status} / ${performance.report_due}` },
  ];

  const mediaText = evidence.length
    ? `Linked synthetic evidence records: ${evidence.map((item) => `${item.id} (${item.title}; ${item.district}; ${item.fileName})`).join("; ")}. These are assessment-only records, not real field evidence.`
    : "No evidence or media records are indexed for this grant and reporting month. Do not infer that activity did not occur.";
  const narrative = [
    `${performance.donor} — ${performance.grant_name}`,
    `Reporting period: ${month}`,
    "",
    `In this reporting month, ${performance.completed} of ${performance.sampled} sampled school records reported a completed PBL project (${percent(completionRate)}). ${performance.evidence_count} schools reported evidence (${percent(evidenceRate)}). The grant-performance source separately reports ${amount(performance.attendance)} attendance, ${amount(performance.enrollment)} enrollment, and an attendance rate of ${percent(attendanceRate)}. These source-reported values are shown as supplied; the rate is not recalculated from the counts.`,
    "",
    `Finance rows list ${amount(monthlySpend)} units utilized this month and ${amount(cumulativeSpend)} cumulative units against ${amount(budget)} approved units (${percent(utilization)} cumulative utilization). Finance note: "${finance[0].finance_note}".`,
    "",
    `Source milestones: ${milestones.join(" | ") || "No milestone text was supplied."} Source report status: "${performance.report_status}", with source risk "${performance.source_risk}". The application threshold rules classify the worst of completion, evidence, and attendance as "${computedRisk}".`,
    "",
    mediaText,
    "",
    "Review prompt: confirm an owner and due date for the lowest reported indicator and any milestone marked At Risk.",
  ].join("\n");

  return {
    grant: {
      grantId: performance.grant_id,
      donor: performance.donor,
      grantName: performance.grant_name,
    },
    month,
    performance: {
      sampled: performance.sampled,
      completed: performance.completed,
      completionRate,
      evidenceCount: performance.evidence_count,
      evidenceRate,
      enrollment: performance.enrollment,
      attendance: performance.attendance,
      attendanceRate,
      sourceRisk: performance.source_risk,
      computedRisk,
      reportStatus: performance.report_status,
      reportDue: performance.report_due,
      milestones,
    },
    finance: {
      monthlySpend,
      cumulativeSpend,
      budget,
      utilization,
      note: finance[0].finance_note,
    },
    evidence,
    facts,
    narrative,
  };
}

function riskOrder(status: RiskStatus): number {
  return { Critical: 0, "At Risk": 1, Behind: 2, "On Track": 3, "No data": 4 }[status];
}
