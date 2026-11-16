import { AlertTriangle, ArrowRight, CalendarClock, CircleHelp, Download, Lightbulb, ShieldCheck } from "lucide-react";
import type { ProgramDashboard } from "../types";
import { Badge, Button, Card, SectionHeading } from "./ui";

export default function ReviewBriefView({
  dashboard,
  onDownload,
}: {
  dashboard: ProgramDashboard;
  onDownload: () => void;
}) {
  const sections = [
    { icon: Lightbulb, label: "Achievement", text: dashboard.summary.achievement },
    { icon: ArrowRight, label: "Month-over-month movement", text: dashboard.summary.movement },
    { icon: AlertTriangle, label: "Priority geography", text: dashboard.summary.priority },
    { icon: ShieldCheck, label: "Risk signals", text: dashboard.summary.risk },
    { icon: CircleHelp, label: "Discussion prompt", text: dashboard.summary.discussionPrompt },
  ];

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Leadership meeting prep"
        title="Monthly review brief"
        detail={`A deterministic summary for ${dashboard.filters.month}, assembled from the current program filters.`}
        action={<Button onClick={onDownload}><Download aria-hidden="true" className="size-4" />Download brief</Button>}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map(({ icon: Icon, label, text }, index) => (
          <Card key={label} className={`p-5 ${index === 4 ? "lg:col-span-2" : ""}`}>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/5 text-gold">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">{label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{text}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">Follow-up planning</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-white">Suggested next actions</h3>
          <p className="mt-1 text-xs text-quiet">Draft prompts generated from measured gaps; confirm ownership and dates in the review.</p>
        </div>
        <div className="divide-y divide-line">
          {dashboard.actions.length ? dashboard.actions.map((action) => (
            <article key={action.title} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">{action.title}</h4>
                  <Badge status={action.priority}>{action.priority}</Badge>
                </div>
                <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-muted">{action.detail}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-[10px] sm:min-w-[250px]">
                <span><span className="block text-quiet">Owner</span><strong className="mt-1 block font-medium text-slate-200">{action.owner}</strong></span>
                <span><span className="block text-quiet">Metric</span><strong className="mt-1 block font-medium text-slate-200">{action.metric}</strong></span>
                <span><span className="block text-quiet">Due · status</span><strong className="mt-1 flex items-center gap-1 font-medium text-slate-200"><CalendarClock aria-hidden="true" className="size-3 text-gold" />{action.due} · {action.status}</strong></span>
              </div>
            </article>
          )) : <p className="p-5 text-sm text-quiet">No eligible records support a follow-up action for this filter selection.</p>}
        </div>
      </Card>

      <p className="rounded-xl border border-line bg-panel p-4 text-xs leading-relaxed text-muted">
        All figures and classifications above are deterministic. AI is not used for metrics, risk status, or this summary. The generated narrative is a template over selected facts, not a causal explanation.
      </p>
    </div>
  );
}
