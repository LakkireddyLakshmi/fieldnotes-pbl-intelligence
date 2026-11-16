import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  FileImage,
  FileText,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import type { GrantOption, GrantReport } from "../types";
import { Badge, Button, Card, formatNumber, formatPercent, LoadingState, SectionHeading, SelectField } from "./ui";

interface Props {
  grants: GrantOption[];
  months: string[];
  grantId: string;
  month: string;
  report: GrantReport | null;
  busy: boolean;
  onGrantChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onCopy: () => void;
  onDownload: () => void;
}

export default function GrantReportView({
  grants,
  months,
  grantId,
  month,
  report,
  busy,
  onGrantChange,
  onMonthChange,
  onCopy,
  onDownload,
}: Props) {
  if (busy && !report) return <LoadingState label="Loading grant facts and linked evidence…" />;

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Grant reporting assistant"
        title="Build a traceable report section"
        detail="Finance, outcomes, risks, milestones, and media are assembled from the selected grant-month records."
        action={<span className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-xs font-medium text-gold"><ShieldCheck aria-hidden="true" className="size-3.5" />Deterministic templates · AI optional</span>}
      />

      <Card className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <SelectField
          label="Grant"
          value={grantId}
          options={grants.map((grant) => ({ value: grant.grantId, label: `${grant.donor} / ${grant.grantName}` }))}
          onChange={onGrantChange}
        />
        <SelectField
          label="Reporting month"
          value={month}
          options={months.map((value) => ({ value, label: value }))}
          onChange={onMonthChange}
        />
        <p className="text-xs leading-relaxed text-quiet sm:col-span-2">
          Grant performance and finance come from their dedicated reporting files. They are intentionally not joined to the school-level dashboard sample.
        </p>
      </Card>

      {report ? (
        <div className={busy ? "space-y-5 opacity-70 transition-opacity" : "space-y-5 transition-opacity"}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FactCard icon={CheckCircle2} label="PBL completion" value={formatPercent(report.performance.completionRate)} note={`${formatNumber(report.performance.completed)} / ${formatNumber(report.performance.sampled)} sampled`} />
            <FactCard icon={FileText} label="Evidence submission" value={formatPercent(report.performance.evidenceRate)} note={`${formatNumber(report.performance.evidenceCount)} schools reported`} />
            <FactCard icon={CalendarDays} label="Attendance rate (reported)" value={formatPercent(report.performance.attendanceRate)} note="Source-reported; counts are listed separately" />
            <FactCard icon={BadgeDollarSign} label="Budget utilization" value={formatPercent(report.finance.utilization)} note={`${formatNumber(report.finance.cumulativeSpend)} / ${formatNumber(report.finance.budget)} units`} />
            <Card className="flex min-h-[122px] flex-col justify-between p-4">
              <span className="flex items-center justify-between text-xs text-muted"><span>Indicator risk</span><ShieldCheck aria-hidden="true" className="size-4 text-gold" /></span>
              <Badge status={report.performance.computedRisk}>{report.performance.computedRisk}</Badge>
              <p className="text-[10px] text-quiet">Source status: {report.performance.sourceRisk}</p>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="p-5">
              <SectionHeading eyebrow="Delivery status" title="Milestones & risks" />
              <div className="space-y-2">
                {report.performance.milestones.length ? report.performance.milestones.map((milestone, index) => {
                  const atRisk = /at risk|delayed|behind/i.test(milestone);
                  const done = /completed/i.test(milestone);
                  return (
                    <div key={`${milestone}-${index}`} className="flex items-start gap-3 rounded-xl border border-line bg-[#13151a] p-3.5">
                      <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${done ? "bg-emerald-500/10 text-emerald-300" : atRisk ? "bg-amber-500/10 text-amber-300" : "bg-raised text-muted"}`}>
                        <CheckCircle2 aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs leading-relaxed text-slate-200">{milestone}</p>
                        {atRisk && <Badge status="At Risk">At Risk</Badge>}
                      </div>
                    </div>
                  );
                }) : <p className="rounded-xl border border-dashed border-line p-4 text-xs text-quiet">No milestone text was supplied for this period.</p>}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised/50 p-3.5 text-xs">
                  <span className="flex items-center gap-2 text-muted"><Landmark aria-hidden="true" className="size-4 text-gold" />Report status and due date</span>
                  <span className="text-right font-medium text-slate-100">{report.performance.reportStatus}<br /><span className="text-quiet">{report.performance.reportDue}</span></span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeading eyebrow="Source evidence" title="Linked media records" detail={`${report.evidence.length} indexed record${report.evidence.length === 1 ? "" : "s"} for this month.`} />
              {report.evidence.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {report.evidence.map((item) => (
                    <a
                      key={item.id}
                      href={item.path}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-xl border border-line bg-[#13151a] transition hover:border-gold/40"
                    >
                      <img src={item.path} alt={item.title} loading="lazy" className="h-32 w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold leading-relaxed text-slate-100">{item.title}</p>
                          {item.type === "image" ? <FileImage aria-hidden="true" className="size-4 shrink-0 text-gold" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-gold" />}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-quiet">{item.caption}</p>
                        <p className="mt-2 flex items-center justify-between gap-2 font-mono text-[9px] text-muted">
                          <span>{item.id} · {item.district}</span>
                          <ArrowUpRight aria-hidden="true" className="size-3 shrink-0 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold" />
                        </p>
                        <p className="mt-1.5 text-[9px] leading-relaxed text-quiet">{item.usage}</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line bg-[#13151a] p-5 text-sm leading-relaxed text-muted">
                  No evidence or media records are indexed for this grant and reporting month. This is a data gap, not evidence that no program activity occurred.
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-gold">Report preview</p>
                <h3 className="mt-1 font-display text-base font-semibold text-white">{report.grant.donor} · {report.grant.grantName}</h3>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onCopy}><Copy aria-hidden="true" className="size-3.5" />Copy</Button>
                <Button onClick={onDownload}><Download aria-hidden="true" className="size-3.5" />Download</Button>
              </div>
            </div>
            <div className="grid gap-0 xl:grid-cols-[1.2fr_0.8fr]">
              <pre className="whitespace-pre-wrap break-words border-b border-line p-5 font-sans text-xs leading-7 text-slate-300 xl:border-b-0 xl:border-r">{report.narrative}</pre>
              <div className="p-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Facts and sources used</p>
                <dl className="space-y-2.5">
                  {report.facts.map((fact) => (
                    <div key={fact.label} className="grid grid-cols-[110px_1fr] gap-3 border-b border-line/70 pb-2.5 last:border-0">
                      <dt className="text-[10px] text-quiet">{fact.label}</dt>
                      <dd className="break-words text-[10px] font-medium leading-relaxed text-slate-200">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 rounded-lg bg-gold/5 p-3 text-[10px] leading-relaxed text-muted">
                  The narrative is a JavaScript template over computed and source-reported facts. No AI call is required, and no achievement or evidence is invented.
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : <LoadingState label="No report facts are loaded for this selection." />}
    </div>
  );
}

function FactCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card className="min-h-[122px] p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        {label}<Icon aria-hidden="true" className="size-4 text-gold" />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-[10px] text-quiet">{note}</p>
    </Card>
  );
}
