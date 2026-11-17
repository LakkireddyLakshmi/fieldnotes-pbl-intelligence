import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  LoaderCircle,
  FileImage,
  FileText,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import type { GrantOption, GrantReport } from "../types";
import { generateGrantNarrative, getGrantNarrativeStatus } from "../api";
import { Badge, Button, Card, formatNumber, formatPercent, LoadingState, SectionHeading, SelectField } from "./ui";

interface Props {
  grants: GrantOption[];
  months: string[];
  grantId: string;
  month: string;
  report: GrantReport | null;
  canExport: boolean;
  busy: boolean;
  onGrantChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onCopy: (text?: string) => void;
  onDownload: (text?: string) => void;
}

export default function GrantReportView({
  grants,
  months,
  grantId,
  month,
  report,
  canExport,
  busy,
  onGrantChange,
  onMonthChange,
  onCopy,
  onDownload,
}: Props) {
  const [narrative, setNarrative] = useState("");
  const [narrativeBusy, setNarrativeBusy] = useState(false);
  const [narrativeError, setNarrativeError] = useState("");
  const [narrativeEnabled, setNarrativeEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    getGrantNarrativeStatus().then(({ enabled }) => { if (active) setNarrativeEnabled(enabled); }).catch(() => { if (active) setNarrativeEnabled(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { setNarrative(""); setNarrativeError(""); }, [grantId, month]);

  async function createNarrative() {
    setNarrativeBusy(true);
    setNarrativeError("");
    try { setNarrative((await generateGrantNarrative(grantId, month)).narrative); }
    catch (error) { setNarrativeError(error instanceof Error ? error.message : "Could not generate the report narrative."); }
    finally { setNarrativeBusy(false); }
  }

  if (busy && !report) return <LoadingState label="Loading grant facts and linked evidence…" />;

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Grant reporting"
        title="Grant performance and finance"
        detail="Review reported outcomes, spending, milestones, and supporting evidence for one grant period."
        action={<span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-muted"><ShieldCheck aria-hidden="true" className="size-3.5 text-gold" />Source-linked report</span>}
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
        <p className="rounded-xl bg-raised/70 p-3 text-xs leading-relaxed text-muted sm:col-span-2">
          Grant results use the grant reporting files. School dashboard records are a separate dataset and are not combined here.
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

          <div className="grid items-start gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="p-5">
              <SectionHeading eyebrow="Delivery status" title="Milestones & risks" />
              <div className="space-y-3">
                {report.performance.milestones.length ? report.performance.milestones.map((milestone, index) => {
                  const atRisk = /at risk|delayed|behind/i.test(milestone);
                  const done = /completed/i.test(milestone);
                  return (
                    <div key={`${milestone}-${index}`} className="flex items-start gap-3 rounded-xl border border-line bg-raised/50 p-3.5">
                      <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${done ? "bg-blue-100 text-blue-700" : atRisk ? "bg-amber-100 text-amber-700" : "bg-raised text-muted"}`}>
                        <CheckCircle2 aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs leading-relaxed text-slate-700">{milestone}</p>
                        {atRisk && <Badge status="At Risk">At Risk</Badge>}
                      </div>
                    </div>
                  );
                }) : <p className="rounded-xl border border-dashed border-line p-4 text-xs text-quiet">No milestone text was supplied for this period.</p>}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised/50 p-3.5 text-xs">
                  <span className="flex items-center gap-2 text-muted"><Landmark aria-hidden="true" className="size-4 text-gold" />Report status and due date</span>
                  <span className="text-right font-medium text-slate-800">{report.performance.reportStatus}<br /><span className="text-quiet">{report.performance.reportDue}</span></span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeading eyebrow="Source evidence" title="Linked media records" detail={`${report.evidence.length} indexed record${report.evidence.length === 1 ? "" : "s"} for this month.`} />
              {report.evidence.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {report.evidence.map((item) => (
                    <a
                      key={item.id}
                      href={item.path}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-xl border border-line bg-white transition hover:border-gold/40"
                    >
                      <img src={item.path} alt={item.title} loading="lazy" className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.01]" />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold leading-relaxed text-slate-800">{item.title}</p>
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
                <div className="rounded-xl border border-dashed border-line bg-raised/50 p-5 text-sm leading-relaxed text-muted">
                  No evidence or media records are indexed for this grant and reporting month. This is a data gap, not evidence that no program activity occurred.
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-gold">Report preview</p>
                <h3 className="heading-accent mt-1 font-display text-base font-semibold text-slate-900">{report.grant.donor} · {report.grant.grantName}</h3>
              </div>
              {canExport && <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={createNarrative} disabled={!narrativeEnabled || narrativeBusy || busy} title={narrativeEnabled ? "Draft narrative from the selected source facts" : "Configure OPENROUTER_API_KEY on the server to enable this"}>
                  {narrativeBusy && <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />}
                  {narrativeBusy ? "Generating…" : "Generate narrative"}
                </Button>
                <Button variant="outline" onClick={() => onCopy(narrative || report.narrative)}><Copy aria-hidden="true" className="size-3.5" />Copy</Button>
                <Button onClick={() => onDownload(narrative || report.narrative)}><Download aria-hidden="true" className="size-3.5" />Download</Button>
              </div>}
            </div>
            <div className="grid gap-0 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="border-b border-line p-5 xl:border-b-0 xl:border-r">
                {narrative && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">OpenRouter generated draft · review before use</p>}
                <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-7 text-slate-700">{narrative || report.narrative}</pre>
                {narrativeError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">{narrativeError}</p>}
                {canExport && <p className="mt-3 text-xs font-medium text-muted">{narrativeEnabled ? "Generating a draft sends this selected grant period’s facts to OpenRouter. Review all figures and wording before sharing." : "Configure the OpenRouter key in the server environment to enable generated drafts. The source-based report remains available."}</p>}
              </div>
              <div className="p-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Facts and sources used</p>
                <dl className="space-y-2.5">
                  {report.facts.map((fact) => (
                    <div key={fact.label} className="grid grid-cols-[110px_1fr] gap-3 border-b border-line/70 pb-2.5 last:border-0">
                      <dt className="text-[10px] text-quiet">{fact.label}</dt>
                      <dd className="break-words text-[10px] font-medium leading-relaxed text-slate-700">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 rounded-lg bg-gold/5 p-3 text-[10px] leading-relaxed text-muted">
                  The draft is assembled from the selected reporting records. Review the figures and evidence before sharing.
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
      <p className="mt-3 font-display text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-[10px] text-quiet">{note}</p>
    </Card>
  );
}
