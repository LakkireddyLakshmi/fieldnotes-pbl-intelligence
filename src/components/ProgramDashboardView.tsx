import { useMemo } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Download,
  Gauge,
  GraduationCap,
  Layers3,
  RotateCcw,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FilterOptions, Metrics, ProgramDashboard, ProgramFilters } from "../types";
import { Badge, Button, Card, formatNumber, formatPercent, monthLabel, SectionHeading, SelectField } from "./ui";

interface Props {
  dashboard: ProgramDashboard;
  filters: ProgramFilters;
  filterOptions: FilterOptions;
  busy: boolean;
  onChange: (field: keyof ProgramFilters, value: string) => void;
  onReset: () => void;
  onSelectGeography: (dashboard: ProgramDashboard, name: string) => void;
  onDownload: () => void;
}

function TrendDelta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return <span className="text-xs text-quiet">No prior month</span>;
  const delta = (current - previous) * 100;
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
      <Icon aria-hidden="true" className="size-3.5" />{Math.abs(delta).toFixed(1)} pp
    </span>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  status,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof UsersRound;
  status?: { current: number | null; previous: number | null };
}) {
  return (
    <Card className="group min-h-32 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-gold/25 hover:bg-[#1b1e24] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className="grid size-8 place-items-center rounded-lg border border-line bg-raised text-gold">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className="mt-4 font-display text-2xl font-semibold tracking-tight text-white sm:text-[27px]">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] text-quiet">{note}</p>
        {status && <TrendDelta current={status.current} previous={status.previous} />}
      </div>
    </Card>
  );
}

function StatCards({ metrics, previous }: { metrics: Metrics; previous: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
      <MetricCard label="Schools in slice" value={formatNumber(metrics.schools)} note="Unique responding schools" icon={UsersRound} />
      <MetricCard label="PBL completed" value={formatNumber(metrics.participants)} note={`${formatPercent(metrics.participationRate)} participation`} icon={BookOpenCheck} status={{ current: metrics.participationRate, previous: previous.participationRate }} />
      <MetricCard label="Evidence submitted" value={formatPercent(metrics.evidenceRate)} note={`${formatNumber(metrics.evidenceCount)} of completed schools`} icon={Layers3} />
      <MetricCard label="Total enrollment" value={formatNumber(metrics.enrollment)} note="Unique pupils in selected grades" icon={GraduationCap} />
      <MetricCard label="Session attendance" value={formatNumber(metrics.attendance)} note="Across selected PBL sessions" icon={Activity} />
      <MetricCard label="Attendance rate" value={formatPercent(metrics.attendanceRate)} note={`${formatNumber(metrics.attendanceCapacity)} session places`} icon={Gauge} status={{ current: metrics.attendanceRate, previous: previous.attendanceRate }} />
    </div>
  );
}

function RateTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-[#202329] px-3 py-2.5 text-xs shadow-panel">
      <p className="mb-2 font-semibold text-white">{label}</p>
      {payload.map((item) => <p key={item.name} className="mt-1 text-muted"><span style={{ color: item.color }}>●</span> {item.name}: {item.value.toFixed(1)}%</p>)}
    </div>
  );
}

function TrendPanel({ dashboard }: { dashboard: ProgramDashboard }) {
  const data = useMemo(() => {
    const points: Array<{ month: string; Participation: number; "Session attendance": number }> = [];
    if (dashboard.previousMonth) {
      points.push({
        month: monthLabel(dashboard.previousMonth).split(" ")[0].slice(0, 3),
        Participation: (dashboard.previousMetrics.participationRate ?? 0) * 100,
        "Session attendance": (dashboard.previousMetrics.attendanceRate ?? 0) * 100,
      });
    }
    points.push({
      month: monthLabel(dashboard.filters.month).split(" ")[0].slice(0, 3),
      Participation: (dashboard.metrics.participationRate ?? 0) * 100,
      "Session attendance": (dashboard.metrics.attendanceRate ?? 0) * 100,
    });
    return points;
  }, [dashboard]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">Movement</p>
          <h3 className="mt-1 font-display text-base font-semibold text-white">Month over month</h3>
        </div>
        <span className="rounded-lg border border-line bg-raised px-2.5 py-1.5 font-mono text-[10px] text-muted">
          {dashboard.previousMonth ? `${monthLabel(dashboard.previousMonth)} → ${monthLabel(dashboard.filters.month)}` : "First available month"}
        </span>
      </div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#2b2e35" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "#858b95", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "#858b95", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${value}%`} />
            <Tooltip content={<RateTooltip />} />
            <Legend wrapperStyle={{ color: "#a2a7b0", fontSize: 11, paddingTop: 10 }} />
            <Line dataKey="Participation" type="monotone" stroke="#e6b75a" strokeWidth={2.5} dot={{ r: 4, fill: "#e6b75a", stroke: "#17191e", strokeWidth: 2 }} activeDot={{ r: 6 }} />
            <Line dataKey="Session attendance" type="monotone" stroke="#77a6d8" strokeWidth={2} dot={{ r: 4, fill: "#77a6d8", stroke: "#17191e", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-quiet">Rates use the same selected month, geography, grade, and subject filters.</p>
    </Card>
  );
}

function GeographyPanel({ dashboard, onSelect }: { dashboard: ProgramDashboard; onSelect: Props["onSelectGeography"] }) {
  const chartData = dashboard.geographies.slice(0, 10).map((item) => ({
    name: item.name,
    Participation: Number(((item.metrics.participationRate ?? 0) * 100).toFixed(1)),
    Evidence: Number(((item.metrics.evidenceRate ?? 0) * 100).toFixed(1)),
    Attendance: Number(((item.metrics.attendanceRate ?? 0) * 100).toFixed(1)),
  }));
  const sortedByParticipation = [...dashboard.geographies].sort(
    (a, b) => (a.metrics.participationRate ?? -1) - (b.metrics.participationRate ?? -1),
  );
  const lowest = sortedByParticipation.find((item) => item.metrics.schools > 0);
  const highest = [...dashboard.geographies].sort(
    (a, b) => (b.metrics.participationRate ?? -1) - (a.metrics.participationRate ?? -1),
  ).find((item) => item.metrics.schools > 0);

  return (
    <Card className="p-5">
      <SectionHeading eyebrow="Where to focus" title={`${dashboard.groupBy === "district" ? "District" : "Block"} performance`} detail="Ranked from deterministic participation, evidence, and attendance rates." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-[#13151a] p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-quiet">First follow-up</p>
          <p className="mt-1.5 text-sm font-semibold text-white">{lowest ? `${lowest.name} · ${formatPercent(lowest.metrics.participationRate)}` : "No eligible geography"}</p>
        </div>
        <div className="rounded-xl border border-line bg-[#13151a] p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-quiet">Highest participation</p>
          <p className="mt-1.5 text-sm font-semibold text-white">{highest ? `${highest.name} · ${formatPercent(highest.metrics.participationRate)}` : "No eligible geography"}</p>
        </div>
      </div>
      <div className="mb-5 h-[290px] w-full">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 18, right: 10, top: 4, bottom: 4 }} barCategoryGap={10}>
              <CartesianGrid stroke="#2b2e35" strokeDasharray="3 5" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#858b95", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${value}%`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#a2a7b0", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<RateTooltip />} />
              <Legend wrapperStyle={{ color: "#a2a7b0", fontSize: 10 }} />
              <Bar dataKey="Participation" fill="#e6b75a" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Evidence" fill="#77a6d8" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Attendance" fill="#9a83cb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="grid h-full place-items-center text-sm text-quiet">No geography records match these filters.</div>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[690px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-quiet">
              <th className="px-3 py-3 font-medium">Geography</th>
              <th className="px-3 py-3 font-medium">Schools</th>
              <th className="px-3 py-3 font-medium">Participation</th>
              <th className="px-3 py-3 font-medium">Evidence</th>
              <th className="px-3 py-3 font-medium">Attendance</th>
              <th className="px-3 py-3 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.geographies.slice(0, 16).map((item) => (
              <tr key={item.name} className="border-b border-line/70 text-muted transition hover:bg-raised/50">
                <td className="px-3 py-3 font-medium text-slate-100">
                  <button className="text-left hover:text-gold" onClick={() => onSelect(dashboard, item.name)}>{item.name}</button>
                </td>
                <td className="px-3 py-3">{formatNumber(item.metrics.schools)}</td>
                <td className="px-3 py-3">{formatPercent(item.metrics.participationRate)}</td>
                <td className="px-3 py-3">{formatPercent(item.metrics.evidenceRate)}</td>
                <td className="px-3 py-3">{formatPercent(item.metrics.attendanceRate)}</td>
                <td className="px-3 py-3"><Badge status={item.signal}>{item.signal}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-quiet">Click a geography to drill into its filters. Risk bands: On Track ≥75%; Behind 60–&lt;75%; At Risk 35–&lt;60%; Critical &lt;35%.</p>
    </Card>
  );
}

export default function ProgramDashboardView({
  dashboard,
  filters,
  filterOptions,
  busy,
  onChange,
  onReset,
  onSelectGeography,
  onDownload,
}: Props) {
  return (
    <div className={busy ? "space-y-5 opacity-70 transition-opacity" : "space-y-5 transition-opacity"}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Monthly snapshot</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">Program pulse</h2>
          <p className="mt-1.5 text-sm text-muted">{monthLabel(filters.month)} · {formatNumber(dashboard.metrics.schools)} schools in this slice</p>
        </div>
        <Button variant="outline" onClick={onDownload}><Download aria-hidden="true" className="size-4" />Export review brief</Button>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart3 aria-hidden="true" className="size-4 text-gold" />Review context</div>
          <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={onReset}><RotateCcw aria-hidden="true" className="size-3.5" />Reset</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SelectField label="Reporting month" value={filters.month} options={filterOptions.months.map((month) => ({ value: month, label: monthLabel(month) }))} onChange={(value) => onChange("month", value)} />
          <SelectField label="District" value={filters.district} options={[{ value: "all", label: "All districts" }, ...filterOptions.districts.map((district) => ({ value: district, label: district }))]} onChange={(value) => onChange("district", value)} />
          <SelectField label="Block" value={filters.block} options={[{ value: "all", label: "All blocks" }, ...filterOptions.blocks.map((block) => ({ value: block, label: block }))]} onChange={(value) => onChange("block", value)} />
          <SelectField label="Grade" value={filters.grade} options={[{ value: "all", label: "All grades" }, ...filterOptions.grades.map((grade) => ({ value: String(grade), label: `Class ${grade}` }))]} onChange={(value) => onChange("grade", value)} />
          <SelectField label="Subject" value={filters.subject} options={[{ value: "all", label: "All subjects" }, ...filterOptions.subjects.map((subject) => ({ value: subject, label: subject }))]} onChange={(value) => onChange("subject", value)} />
        </div>
        <p className="mt-3 text-[10px] text-quiet">Filters update all metrics, trends, geography ranks, and review recommendations.</p>
      </Card>

      <StatCards metrics={dashboard.metrics} previous={dashboard.previousMetrics} />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <TrendPanel dashboard={dashboard} />
        <Card className="p-5">
          <SectionHeading eyebrow="Deterministic signals" title="What needs attention" detail="Computed in code; no AI is used to classify risks." />
          <div className="space-y-2.5">
            {dashboard.risks.map((risk) => (
              <div key={risk.name} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[#13151a] p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{risk.name}</p>
                  <p className="mt-1 text-[11px] text-quiet">{risk.explanation}</p>
                </div>
                <Badge status={risk.status}>{risk.status}</Badge>
              </div>
            ))}
            <div className="rounded-xl border border-gold/15 bg-gold/5 p-3.5 text-xs leading-relaxed text-muted">
              <span className="font-semibold text-gold">{dashboard.geographies.filter((item) => item.signal === "At Risk" || item.signal === "Critical").length}</span> of {dashboard.geographies.length} selected geographies are At Risk or Critical.
            </div>
          </div>
        </Card>
      </div>

      <GeographyPanel dashboard={dashboard} onSelect={onSelectGeography} />
    </div>
  );
}
