import { pool } from "./db.js";
import type {
  GeographyMetric,
  Metrics,
  ProgramDashboard,
  ProgramFilters,
} from "./contracts.js";
import {
  aggregateProgramRows,
  classify,
  filterProgramRows,
  riskOrder,
  worstStatus,
  type PblRow,
} from "./program-metrics.js";

function blankMetrics(): Metrics {
  return {
    schools: 0,
    participants: 0,
    participationRate: null,
    evidenceCount: 0,
    evidenceRate: null,
    enrollment: 0,
    attendance: 0,
    attendanceCapacity: 0,
    attendanceRate: null,
  };
}

function formatPercent(rate: number | null): string {
  return rate === null ? "No data" : `${(rate * 100).toFixed(1)}%`;
}

function movement(label: string, current: number | null, previous: number | null): string {
  if (current === null || previous === null) return `${label}: no comparable rate is available for both months.`;
  const delta = (current - previous) * 100;
  return `${label} ${delta >= 0 ? "increased" : "decreased"} by ${Math.abs(delta).toFixed(1)} percentage points`;
}

function dateAfter(days: number): string {
  const due = new Date();
  due.setDate(due.getDate() + days);
  return due.toISOString().slice(0, 10);
}

function buildActions(metrics: Metrics, geographies: GeographyMetric[]) {
  const actions: ProgramDashboard["actions"] = [];
  const firstPriority = [...geographies]
    .filter((item) => item.metrics.schools > 0)
    .sort((a, b) => (a.metrics.participationRate ?? 1) - (b.metrics.participationRate ?? 1))[0];

  if (metrics.attendanceRate !== null && metrics.attendanceRate < 0.75) {
    actions.push({
      title: "Check attendance barriers",
      detail: `${metrics.attendanceCapacity - metrics.attendance} session places were not attended across reported PBL sessions.`,
      owner: "Block coordinator",
      priority: classify(metrics.attendanceRate),
      metric: "Session attendance",
      due: dateAfter(7),
      status: "Draft",
    });
  }
  if (metrics.evidenceRate !== null && metrics.evidenceRate < 0.75) {
    actions.push({
      title: "Close the evidence gap",
      detail: `${metrics.participants - metrics.evidenceCount} completed PBL records do not have evidence marked as submitted.`,
      owner: "M&E lead",
      priority: classify(metrics.evidenceRate),
      metric: "Evidence submission",
      due: dateAfter(10),
      status: "Draft",
    });
  }
  if (firstPriority && (firstPriority.metrics.participationRate ?? 1) < 0.75) {
    actions.push({
      title: `Review support in ${firstPriority.name}`,
      detail: `Participation is ${formatPercent(firstPriority.metrics.participationRate)} in the lowest-ranked selected geography.`,
      owner: "Program manager",
      priority: classify(firstPriority.metrics.participationRate),
      metric: `${firstPriority.name} participation`,
      due: dateAfter(14),
      status: "Draft",
    });
  }
  if (actions.length === 0 && firstPriority) {
    actions.push({
      title: "Recognize and share effective practice",
      detail: `Validate what is working in ${firstPriority.name} before sharing it with peer teams.`,
      owner: "Review chair",
      priority: "On Track",
      metric: "Peer learning",
      due: dateAfter(14),
      status: "Draft",
    });
  }
  return actions.slice(0, 3);
}

export async function getProgramDashboard(filters: ProgramFilters): Promise<ProgramDashboard> {
  const { rows: monthsResult } = await pool.query<{ month: string }>(
    "SELECT DISTINCT month FROM pbl_responses ORDER BY month",
  );
  const months = monthsResult.map((row) => row.month);
  if (!months.includes(filters.month)) throw new Error(`Unknown reporting month: ${filters.month}`);

  const monthIndex = months.indexOf(filters.month);
  const previousMonth = monthIndex > 0 ? months[monthIndex - 1] : null;
  const monthList = previousMonth ? [filters.month, previousMonth] : [filters.month];
  const { rows } = await pool.query<PblRow>(
    `SELECT month, school_code, district, block, participated, evidence, classes, subjects,
            enrollment, math_attendance, science_attendance
       FROM pbl_responses
      WHERE month = ANY($1::text[])`,
    [monthList],
  );
  const currentRows = rows.filter((row) => row.month === filters.month);
  const previousRows = previousMonth
    ? rows.filter((row) => row.month === previousMonth)
    : [];
  const current = filterProgramRows(currentRows, filters);
  const prior = previousMonth ? filterProgramRows(previousRows, filters) : [];
  const metrics = aggregateProgramRows(current, filters);
  const previousMetrics = previousMonth ? aggregateProgramRows(prior, filters) : blankMetrics();

  const geographicBase = filterProgramRows(currentRows, filters, true)
    .filter((row) => filters.district === "all" || row.district === filters.district)
    .filter((row) => filters.block === "all" || row.block === filters.block);
  const groupBy = filters.district === "all" && filters.block === "all" ? "district" : "block";
  const groups = new Map<string, PblRow[]>();
  for (const row of geographicBase) {
    const name = row[groupBy];
    const values = groups.get(name) ?? [];
    values.push(row);
    groups.set(name, values);
  }
  const geographies: GeographyMetric[] = [...groups.entries()].map(([name, groupRows]) => {
    const groupMetrics = aggregateProgramRows(groupRows, filters);
    return {
      name,
      metrics: groupMetrics,
      signal: worstStatus([
        groupMetrics.participationRate,
        groupMetrics.evidenceRate,
        groupMetrics.attendanceRate,
      ]),
    };
  }).sort((a, b) =>
    riskOrder[a.signal] - riskOrder[b.signal]
    || (a.metrics.participationRate ?? 1) - (b.metrics.participationRate ?? 1),
  );

  const risks = [
    { name: "PBL participation", status: classify(metrics.participationRate), value: formatPercent(metrics.participationRate) },
    { name: "Evidence submission", status: classify(metrics.evidenceRate), value: formatPercent(metrics.evidenceRate) },
    { name: "Session attendance", status: classify(metrics.attendanceRate), value: formatPercent(metrics.attendanceRate) },
  ].sort((a, b) => riskOrder[a.status] - riskOrder[b.status])
    .map((item) => ({
      ...item,
      explanation: `${item.value} against the selected-slice threshold.`,
    }));

  const lowest = [...geographies]
    .filter((item) => item.metrics.schools > 0)
    .sort((a, b) => (a.metrics.participationRate ?? 1) - (b.metrics.participationRate ?? 1))[0];
  const highest = [...geographies]
    .filter((item) => item.metrics.schools > 0)
    .sort((a, b) => (b.metrics.participationRate ?? -1) - (a.metrics.participationRate ?? -1))[0];
  const movementText = previousMonth
    ? `${movement("PBL participation", metrics.participationRate, previousMetrics.participationRate)}; ${movement("Session attendance", metrics.attendanceRate, previousMetrics.attendanceRate)}. Compared with ${previousMonth}.`
    : "No prior month is available for comparison.";
  const actions = buildActions(metrics, geographies);

  return {
    filters,
    metrics,
    previousMetrics,
    previousMonth,
    groupBy,
    geographies,
    risks,
    summary: {
      achievement: `${metrics.participants} of ${metrics.schools} responding schools completed PBL (${formatPercent(metrics.participationRate)}). ${metrics.evidenceCount} completed schools reported evidence (${formatPercent(metrics.evidenceRate)}).`,
      movement: movementText,
      priority: lowest
        ? `${lowest.name} is the first follow-up priority (${formatPercent(lowest.metrics.participationRate)} participation). ${highest?.name ?? "No geography"} has the highest selected-slice participation (${formatPercent(highest?.metrics.participationRate ?? null)}).`
        : "No geography has eligible records for the selected filters.",
      risk: `Participation is ${classify(metrics.participationRate)} at ${formatPercent(metrics.participationRate)}; evidence is ${classify(metrics.evidenceRate)} at ${formatPercent(metrics.evidenceRate)}; session attendance is ${classify(metrics.attendanceRate)} at ${formatPercent(metrics.attendanceRate)}.`,
      discussionPrompt: "What practical support would close the largest participation, evidence, or attendance gap before the next reporting cycle? Confirm ownership and timing for each follow-up.",
    },
    actions,
  };
}
