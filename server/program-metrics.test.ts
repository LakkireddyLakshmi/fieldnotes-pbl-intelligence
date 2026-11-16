import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProgramFilters } from "./contracts.js";
import { aggregateProgramRows, classify, filterProgramRows } from "./program-metrics.js";
import type { PblRow } from "./program-metrics.js";

const filters: ProgramFilters = {
  month: "2025-09",
  district: "all",
  block: "all",
  grade: "all",
  subject: "all",
};

const rows: PblRow[] = [
  {
    month: "2025-09",
    school_code: "S-001",
    district: "District A",
    block: "Block 1",
    participated: true,
    evidence: true,
    classes: [6],
    subjects: ["Math", "Science"],
    enrollment: [10, 0, 0],
    math_attendance: [8, 0, 0],
    science_attendance: [7, 0, 0],
  },
  {
    month: "2025-09",
    school_code: "S-002",
    district: "District A",
    block: "Block 1",
    participated: false,
    evidence: false,
    classes: [],
    subjects: ["Math"],
    enrollment: [5, 0, 0],
    math_attendance: [0, 0, 0],
    science_attendance: [0, 0, 0],
  },
];

describe("deterministic risk classification", () => {
  it("uses the inclusive risk boundaries and treats missing rates as no data", () => {
    assert.equal(classify(0.75), "On Track");
    assert.equal(classify(0.6), "Behind");
    assert.equal(classify(0.35), "At Risk");
    assert.equal(classify(0.3499), "Critical");
    assert.equal(classify(null), "No data");
    assert.equal(classify(Number.NaN), "No data");
  });
});

describe("program metric aggregation", () => {
  it("counts enrollment once while attendance capacity follows completed subject sessions", () => {
    const result = aggregateProgramRows(rows, filters);

    assert.deepEqual(result, {
      schools: 2,
      participants: 1,
      participationRate: 0.5,
      evidenceCount: 1,
      evidenceRate: 1,
      enrollment: 15,
      attendance: 15,
      attendanceCapacity: 20,
      attendanceRate: 0.75,
    });
  });

  it("keeps all-grade enrollment while applying a selected subject to session attendance", () => {
    const mathFilters = { ...filters, subject: "Math" };
    const result = aggregateProgramRows(filterProgramRows(rows, mathFilters), mathFilters);

    assert.equal(result.enrollment, 15);
    assert.equal(result.attendance, 8);
    assert.equal(result.attendanceCapacity, 10);
    assert.equal(result.attendanceRate, 0.8);
  });
});
