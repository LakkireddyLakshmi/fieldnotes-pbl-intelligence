import { pool } from "./db.js";
import type {
  GeographyMetric,
  Metrics,
  ProgramDashboard,
  ProgramFilters,
  SchoolRecord,
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

export async function getProgramDashboard(filters: ProgramFilters, requestedGroupBy?: "district" | "block"): Promise<ProgramDashboard> {
  const { rows: monthsResult } = await pool.query<{ month: string }>(
    "SELECT DISTINCT month FROM pbl_responses ORDER BY month",
  );
  const months = monthsResult.map((row) => row.month);
  if (!months.includes(filters.month)) throw new Error(`Unknown reporting month: ${filters.month}`);

  const monthIndex = months.indexOf(filters.month);
  const previousMonth = monthIndex > 0 ? months[monthIndex - 1] : null;
  const monthList = months.slice(Math.max(0, monthIndex - 11), monthIndex + 1);
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
  const monthlyTrend = monthList.map((month) => {
    const monthRows = rows.filter((row) => row.month === month);
    const values = aggregateProgramRows(filterProgramRows(monthRows, filters), filters);
    return { month, participationRate: values.participationRate, evidenceRate: values.evidenceRate, attendanceRate: values.attendanceRate };
  });

  const geographicBase = filterProgramRows(currentRows, filters, true)
    .filter((row) => filters.district === "all" || row.district === filters.district)
    .filter((row) => filters.block === "all" || row.block === filters.block);
  const groupBy = requestedGroupBy ?? (filters.district === "all" && filters.block === "all" ? "district" : "block");
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
    monthlyTrend,
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

export async function getSchoolRecords(filters: ProgramFilters): Promise<SchoolRecord[]> {
  const { rows } = await pool.query<PblRow & { school_name: string }>(
    `SELECT month, school_code, school_name, district, block, participated, evidence,
            classes, subjects, enrollment, math_attendance, science_attendance
       FROM pbl_responses
      WHERE month = $1
        AND ($2 = 'all' OR district = $2)
        AND ($3 = 'all' OR block = $3)
      ORDER BY district, block, school_name, school_code`,
    [filters.month, filters.district, filters.block],
  );

  const gradeIndexes = filters.grade === "all" ? [0, 1, 2] : [Number(filters.grade) - 6];
  const filteredRows = filterProgramRows(rows, filters) as Array<PblRow & { school_name: string }>;
  return filteredRows.map((row) => {
    const enrollment = gradeIndexes.reduce((sum, index) => sum + (row.enrollment[index] || 0), 0);
    const participated = row.participated && (filters.grade === "all" || row.classes.includes(Number(filters.grade)));
    const selectedSubjects = filters.subject === "all"
      ? row.subjects
      : row.subjects.includes(filters.subject) ? [filters.subject] : [];
    let attended = 0;
    let capacity = 0;
    if (participated) {
      gradeIndexes.forEach((index) => {
        if (!row.classes.includes(index + 6)) return;
        selectedSubjects.forEach((subject) => {
          attended += subject === "Math" ? row.math_attendance[index] : row.science_attendance[index];
          capacity += row.enrollment[index] || 0;
        });
      });
    }
    const attendanceRate = capacity > 0 ? attended / capacity : null;
    const signal = worstStatus([
      participated ? 1 : 0,
      participated ? (row.evidence ? 1 : 0) : null,
      attendanceRate,
    ]);
    return {
      schoolCode: row.school_code,
      schoolName: row.school_name,
      district: row.district,
      block: row.block,
      enrollment,
      attendanceRate,
      evidence: participated && row.evidence,
      participated,
      signal,
    };
  }).filter((row) => row.enrollment > 0);
}
