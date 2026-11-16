export type RiskStatus = "On Track" | "Behind" | "At Risk" | "Critical" | "No data";

export interface ProgramFilters {
  month: string;
  district: string;
  block: string;
  grade: string;
  subject: string;
}

export interface Metrics {
  schools: number;
  participants: number;
  participationRate: number | null;
  evidenceCount: number;
  evidenceRate: number | null;
  enrollment: number;
  attendance: number;
  attendanceCapacity: number;
  attendanceRate: number | null;
}

export interface GeographyMetric {
  name: string;
  metrics: Metrics;
  signal: RiskStatus;
}

export interface ReviewAction {
  title: string;
  detail: string;
  owner: string;
  priority: RiskStatus;
  metric: string;
  due: string;
  status: "Draft";
}

export interface RiskInsight {
  name: string;
  status: RiskStatus;
  value: string;
  explanation: string;
}

export interface ProgramDashboard {
  filters: ProgramFilters;
  metrics: Metrics;
  previousMetrics: Metrics;
  previousMonth: string | null;
  groupBy: "district" | "block";
  geographies: GeographyMetric[];
  risks: RiskInsight[];
  summary: {
    achievement: string;
    movement: string;
    priority: string;
    risk: string;
    discussionPrompt: string;
  };
  actions: ReviewAction[];
}

export interface FilterOptions {
  months: string[];
  districts: string[];
  blocks: string[];
  grades: number[];
  subjects: string[];
}

export interface GrantOption {
  grantId: string;
  donor: string;
  grantName: string;
}

export interface GrantMedia {
  id: string;
  type: string;
  district: string;
  title: string;
  caption: string;
  fileName: string;
  path: string;
  usage: string;
}

export interface GrantReport {
  grant: GrantOption;
  month: string;
  performance: {
    sampled: number;
    completed: number;
    completionRate: number;
    evidenceCount: number;
    evidenceRate: number;
    enrollment: number;
    attendance: number;
    attendanceRate: number;
    sourceRisk: string;
    computedRisk: RiskStatus;
    reportStatus: string;
    reportDue: string;
    milestones: string[];
  };
  finance: {
    monthlySpend: number;
    cumulativeSpend: number;
    budget: number;
    utilization: number | null;
    note: string;
  };
  evidence: GrantMedia[];
  facts: Array<{ label: string; value: string }>;
  narrative: string;
}
