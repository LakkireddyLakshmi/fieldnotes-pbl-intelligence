import {
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  Download,
  FileCheck2,
  GraduationCap,
  LoaderCircle,
  Percent,
  RotateCcw,
  School,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FilterOptions, Metrics, ProgramDashboard, ProgramFilters } from "../types";
import { PeakChart } from "./ui/peak-chart";
import { Badge, Button, Card, formatNumber, formatPercent, monthLabel, SectionHeading, SelectField } from "./ui";

interface Props {
  dashboard: ProgramDashboard;
  filters: ProgramFilters;
  filterOptions: FilterOptions;
  busy: boolean;
  canExport: boolean;
  geographyLevel: "district" | "block";
  onGeographyLevelChange: (level: "district" | "block") => void;
  onChange: (field: keyof ProgramFilters, value: string) => void;
  onReset: () => void;
  onSelectGeography: (dashboard: ProgramDashboard, name: string) => void;
  onDownload: () => void;
}

function TrendDelta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return <span className="text-xs text-quiet">No prior month</span>;
  const delta = (current - previous) * 100;
  const Icon = delta >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold tabular-nums ${delta >= 0 ? "trend-pill-positive" : "trend-pill-negative"}`}>
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.7} />{delta >= 0 ? "+" : "−"}{Math.abs(delta).toFixed(1)} pp
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
    <Card className="group min-h-32 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-gold/25 hover:bg-gold/5 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="metric-label text-xs font-semibold">{label}</p>
        <span className="metric-icon grid size-8 place-items-center rounded-lg border">
          <Icon aria-hidden="true" className="size-4" strokeWidth={2.5} />
        </span>
      </div>
      <p className="metric-value mt-4 font-display text-2xl font-bold tracking-tight sm:text-[27px]">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="metric-note truncate text-[11px] font-medium">{note}</p>
        {status && <TrendDelta current={status.current} previous={status.previous} />}
      </div>
    </Card>
  );
}

function StatCards({ metrics, previous }: { metrics: Metrics; previous: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      <MetricCard label="Schools in slice" value={formatNumber(metrics.schools)} note="Unique responding schools" icon={School} />
      <MetricCard label="PBL completed" value={formatNumber(metrics.participants)} note={`${formatPercent(metrics.participationRate)} participation`} icon={ClipboardCheck} status={{ current: metrics.participationRate, previous: previous.participationRate }} />
      <MetricCard label="Evidence submitted" value={formatPercent(metrics.evidenceRate)} note={`${formatNumber(metrics.evidenceCount)} of completed schools`} icon={FileCheck2} />
      <MetricCard label="Total enrollment" value={formatNumber(metrics.enrollment)} note="Unique pupils in selected grades" icon={GraduationCap} />
      <MetricCard label="Session attendance" value={formatNumber(metrics.attendance)} note="Across selected PBL sessions" icon={CalendarCheck} />
      <MetricCard label="Attendance rate" value={formatPercent(metrics.attendanceRate)} note={`${formatNumber(metrics.attendanceCapacity)} session places`} icon={Percent} status={{ current: metrics.attendanceRate, previous: previous.attendanceRate }} />
    </div>
  );
}

function RateTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2.5 text-xs shadow-panel">
      <p className="mb-2 font-semibold text-slate-900">{label}</p>
      {payload.map((item) => <p key={item.name} className="mt-1 text-muted"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}: {item.value.toFixed(1)}%</p>)}
    </div>
  );
}

function ParticipationDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: { Participation?: number } }) {
  if (cx === undefined || cy === undefined || payload?.Participation === undefined) return null;
  const value = payload.Participation;
  const placeLeft = value >= 70;
  return (
    <g className="geography-dot">
      <circle className="geography-dot-mark" cx={cx} cy={cy} r={4.5} />
      <text className="geography-dot-label" x={cx + (placeLeft ? -9 : 9)} y={cy + 4} textAnchor={placeLeft ? "end" : "start"} fontSize={10} fontWeight={600}>{value.toFixed(1)}%</text>
    </g>
  );
}

function TrendPanel({ dashboard, onChange }: { dashboard: ProgramDashboard; onChange: Props["onChange"] }) {
  const trend = dashboard.monthlyTrend.filter((point) => point.participationRate !== null);
  const selected = trend.find((point) => point.month === dashboard.filters.month);
  if (!selected || selected.participationRate === null) {
    return <Card className="grid min-h-[460px] place-items-center p-6 text-sm text-muted">No participation history is available for these filters.</Card>;
  }

  const periods = trend.map((point) => ({ month: point.month, label: monthLabel(point.month) }));
  const prior = dashboard.previousMetrics.participationRate;
  const trendDirection = prior === null ? "none" : selected.participationRate >= prior ? "up" : "down";
  return (
    <div className="flex min-h-[470px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-panel p-3 shadow-panel sm:p-4">
      <PeakChart
        data={trend.map((point) => (point.participationRate ?? 0) * 100)}
        labels={trend.map((point) => monthLabel(point.month))}
        value={selected.participationRate * 100}
        valueSuffix="%"
        decimals={1}
        title="PBL participation"
        caption="Responding schools that completed PBL"
        updatedText="Program performance"
        trend={trendDirection}
        periods={periods.map((point) => point.label)}
        period={monthLabel(dashboard.filters.month)}
        onPeriodChange={(label) => {
          const month = periods.find((point) => point.label === label)?.month;
          if (month) onChange("month", month);
        }}
        accent="#668fe8"
        width={300}
        loop={0}
      />
    </div>
  );
}
function GeographyPanel({ dashboard, onSelect, level, onLevelChange }: { dashboard: ProgramDashboard; onSelect: Props["onSelectGeography"]; level: Props["geographyLevel"]; onLevelChange: Props["onGeographyLevelChange"] }) {
  const chartData = [...dashboard.geographies]
    .filter((item) => item.metrics.schools > 0 && item.metrics.participationRate !== null)
    .sort((a, b) => (a.metrics.participationRate ?? 1) - (b.metrics.participationRate ?? 1))
    .slice(0, 8)
    .map((item, rank) => ({
      name: item.name,
      Participation: Number(((item.metrics.participationRate ?? 0) * 100).toFixed(1)),
      rank,
    }));
  const withParticipation = dashboard.geographies.filter((item) => item.metrics.schools > 0 && item.metrics.participationRate !== null);
  const sortedByParticipation = [...withParticipation].sort(
    (a, b) => (a.metrics.participationRate ?? 0) - (b.metrics.participationRate ?? 0),
  );
  const lowest = sortedByParticipation[0];
  const highest = sortedByParticipation.at(-1);

  return (
    <Card className="p-5">
      <SectionHeading
        eyebrow="Geographic performance"
        title={`${dashboard.groupBy === "district" ? "District" : "Block"} comparison`}
        detail="Lower participation rates appear first. The dashed marker shows the 75% on-track threshold."
        action={<div className="inline-flex rounded-lg border border-line bg-raised p-1" role="group" aria-label="Geography table level">
          {(["district", "block"] as const).map((item) => <button key={item} type="button" aria-pressed={level === item} onClick={() => onLevelChange(item)} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${level === item ? "bg-[#3158c9] text-white" : "text-muted hover:bg-panel hover:text-slate-900"}`}>{item === "district" ? "Districts" : "Blocks"}</button>)}
        </div>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-raised/50 p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-quiet">First follow-up</p>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">{lowest ? `${lowest.name} · ${formatPercent(lowest.metrics.participationRate)}` : "No eligible geography"}</p>
        </div>
        <div className="rounded-xl border border-line bg-raised/50 p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-quiet">Highest participation</p>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">{highest ? `${highest.name} · ${formatPercent(highest.metrics.participationRate)}` : "No eligible geography"}</p>
        </div>
      </div>
      <div className="mb-5 h-[340px] w-full">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={chartData} margin={{ left: 8, right: 36, top: 16, bottom: 6 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical horizontal={false} />
              <XAxis type="number" dataKey="Participation" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${value}%`} />
              <YAxis type="number" dataKey="rank" domain={[0, Math.max(1, chartData.length - 1)]} ticks={chartData.map((item) => item.rank)} reversed tickFormatter={(value: number) => chartData[value]?.name ?? ""} width={142} tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
              <ReferenceLine x={75} stroke="#d29436" strokeDasharray="4 4" label={{ value: "75% target", fill: "#9a681c", fontSize: 10, position: "insideTopRight" }} />
              <Tooltip content={<RateTooltip />} />
              <Scatter dataKey="Participation" name="PBL participation" fill="#3158c9" shape={<ParticipationDot />} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : <div className="grid h-full place-items-center text-sm text-quiet">No geography records match these filters.</div>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[690px] border-collapse text-left text-xs">
          <thead className="bg-raised/70">
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-quiet">
              <th className="px-3 py-3 font-medium">Geography</th>
              <th className="px-3 py-3 text-right font-medium">Schools</th>
              <th className="px-3 py-3 text-right font-medium">Participation</th>
              <th className="px-3 py-3 text-right font-medium">Evidence</th>
              <th className="px-3 py-3 text-right font-medium">Attendance</th>
              <th className="px-3 py-3 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.geographies.slice(0, 16).map((item) => (
              <tr key={item.name} className="border-b border-line/70 text-muted transition odd:bg-panel even:bg-raised/30 hover:bg-gold/5">
                <td className="px-3 py-3 font-medium text-slate-800">
                  <button className="text-left text-slate-800 hover:text-gold" onClick={() => onSelect(dashboard, item.name)}>{item.name}</button>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{formatNumber(item.metrics.schools)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatPercent(item.metrics.participationRate)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatPercent(item.metrics.evidenceRate)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatPercent(item.metrics.attendanceRate)}</td>
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
  canExport,
  geographyLevel,
  onGeographyLevelChange,
  onChange,
  onReset,
  onSelectGeography,
  onDownload,
}: Props) {
  return (
    <div className="space-y-5" aria-busy={busy}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Program overview</p>
          <h2 className="heading-accent font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Monthly performance</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-muted">{monthLabel(filters.month)} · {formatNumber(dashboard.metrics.schools)} schools in this slice</p>
            {busy && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300" role="status" aria-live="polite"><LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />Updating figures</span>}
          </div>
        </div>
        {canExport && <Button variant="outline" onClick={onDownload}><Download aria-hidden="true" className="size-4" />Export review brief</Button>}
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><BarChart3 aria-hidden="true" className="size-4 text-gold" />Filters</div>
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
        <TrendPanel dashboard={dashboard} onChange={onChange} />
        <Card className="p-5">
          <SectionHeading eyebrow="Performance indicators" title="Areas to monitor" detail="Status labels are calculated from the selected figures and published thresholds." />
          <div className="space-y-2.5">
            {dashboard.risks.map((risk) => (
              <div key={risk.name} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised/50 p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{risk.name}</p>
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

      <GeographyPanel dashboard={dashboard} onSelect={onSelectGeography} level={geographyLevel} onLevelChange={onGeographyLevelChange} />
    </div>
  );
}
