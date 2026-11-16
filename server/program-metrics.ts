import type { Metrics, ProgramFilters, RiskStatus } from "./contracts.js";

export interface PblRow {
  month: string;
  school_code: string;
  district: string;
  block: string;
  participated: boolean;
  evidence: boolean;
  classes: number[];
  subjects: string[];
  enrollment: number[];
  math_attendance: number[];
  science_attendance: number[];
}

export const riskOrder: Record<RiskStatus, number> = {
  Critical: 0,
  "At Risk": 1,
  Behind: 2,
  "On Track": 3,
  "No data": 4,
};

export function classify(rate: number | null): RiskStatus {
  if (rate === null || !Number.isFinite(rate)) return "No data";
  if (rate >= 0.75) return "On Track";
  if (rate >= 0.6) return "Behind";
  if (rate >= 0.35) return "At Risk";
  return "Critical";
}

export function filterProgramRows(
  rows: PblRow[],
  filters: ProgramFilters,
  ignoreGeography = false,
): PblRow[] {
  return rows.filter((row) => {
    if (!ignoreGeography && filters.district !== "all" && row.district !== filters.district) return false;
    if (!ignoreGeography && filters.block !== "all" && row.block !== filters.block) return false;
    if (filters.grade !== "all" && !row.enrollment[Number(filters.grade) - 6]) return false;
    if (filters.subject !== "all" && !row.subjects.includes(filters.subject)) return false;
    return true;
  });
}

export function aggregateProgramRows(rows: PblRow[], filters: ProgramFilters): Metrics {
  const schoolCodes = new Set(rows.map((row) => row.school_code));
  const gradeIndexes = filters.grade === "all" ? [0, 1, 2] : [Number(filters.grade) - 6];
  const completed = rows.filter((row) =>
    row.participated && (filters.grade === "all" || row.classes.includes(Number(filters.grade))),
  );
  const evidenceCount = completed.filter((row) => row.evidence).length;
  let enrollment = 0;
  let attendance = 0;
  let attendanceCapacity = 0;

  rows.forEach((row) => {
    enrollment += gradeIndexes.reduce((sum, index) => sum + (row.enrollment[index] || 0), 0);
    if (!row.participated) return;
    gradeIndexes.forEach((index) => {
      if (!row.classes.includes(index + 6)) return;
      const subjects = filters.subject === "all"
        ? row.subjects
        : row.subjects.includes(filters.subject) ? [filters.subject] : [];
      subjects.forEach((subject) => {
        attendance += subject === "Math"
          ? row.math_attendance[index]
          : row.science_attendance[index];
        attendanceCapacity += row.enrollment[index] || 0;
      });
    });
  });

  return {
    schools: schoolCodes.size,
    participants: completed.length,
    participationRate: schoolCodes.size ? completed.length / schoolCodes.size : null,
    evidenceCount,
    evidenceRate: completed.length ? evidenceCount / completed.length : null,
    enrollment,
    attendance,
    attendanceCapacity,
    attendanceRate: attendanceCapacity ? attendance / attendanceCapacity : null,
  };
}

export function worstStatus(rates: Array<number | null>): RiskStatus {
  return rates.map(classify).sort((a, b) => riskOrder[a] - riskOrder[b])[0] ?? "No data";
}
