import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, Check, CircleHelp, Download, Lightbulb, LoaderCircle, Plus, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { createFollowUp, getFollowUps, updateFollowUp } from "../api";
import type { FollowUpRecord, FollowUpStatus, ProgramDashboard, ReviewAction } from "../types";
import { Badge, Button, Card, SectionHeading } from "./ui";

export default function ReviewBriefView({
  dashboard,
  onDownload,
  canExport,
  canManageActions,
}: {
  dashboard: ProgramDashboard;
  onDownload: () => void;
  canExport: boolean;
  canManageActions: boolean;
}) {
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [addingTitle, setAddingTitle] = useState("");
  const [saveError, setSaveError] = useState("");

  const loadFollowUps = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError("");
    try {
      const items = await getFollowUps(dashboard.filters.month, signal);
      if (!signal?.aborted) setFollowUps(items);
    } catch (error) {
      if (!signal?.aborted) setLoadError(error instanceof Error ? error.message : "Could not load the action tracker.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadFollowUps(controller.signal);
    return () => controller.abort();
  }, [dashboard.filters.month]);

  const addToTracker = async (action: ReviewAction) => {
    setAddingTitle(action.title);
    setSaveError("");
    try {
      const created = await createFollowUp({
        month: dashboard.filters.month,
        district: dashboard.filters.district,
        block: dashboard.filters.block,
        title: action.title,
        detail: action.detail,
        owner: action.owner,
        priority: action.priority,
        metric: action.metric,
        due: action.due,
      });
      setFollowUps((current) => [...current, created].sort((a, b) => a.due.localeCompare(b.due)));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not add this follow-up.");
    } finally {
      setAddingTitle("");
    }
  };

  const saveChange = async (record: FollowUpRecord, update: Partial<Pick<FollowUpRecord, "owner" | "due" | "status">>) => {
    setSavingId(record.id);
    setSaveError("");
    try {
      const saved = await updateFollowUp(record.id, update);
      setFollowUps((current) => current.map((item) => item.id === saved.id ? saved : item));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the follow-up.");
      void loadFollowUps();
    } finally {
      setSavingId("");
    }
  };

  const alreadyTracked = (action: ReviewAction) => followUps.some((item) =>
    item.title === action.title
    && item.metric === action.metric
    && item.district === dashboard.filters.district
    && item.block === dashboard.filters.block,
  );

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
        detail={`A meeting-ready summary for ${dashboard.filters.month}, based on the current program filters.`}
        action={canExport ? <Button onClick={onDownload}><Download aria-hidden="true" className="size-4" />Download brief</Button> : undefined}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map(({ icon: Icon, label, text }, index) => (
          <Card key={label} className={`p-5 ${index === 4 ? "lg:col-span-2" : ""}`}>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/5 text-gold"><Icon aria-hidden="true" className="size-4" /></span>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">{label}</p><p className="mt-2 text-sm leading-6 text-slate-700">{text}</p></div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">Follow-up planning · {dashboard.filters.month}</p>
          <h3 className="heading-accent mt-1 font-display text-lg font-semibold text-slate-900">Action tracker</h3>
          <p className="mt-1 text-xs text-quiet">Saved actions stay in the database when you change filters or leave this page.</p>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          {saveError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">{saveError}</p>}
          {loadError ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{loadError}</span><Button variant="outline" onClick={() => void loadFollowUps()}><RefreshCw aria-hidden="true" className="size-4" />Retry</Button></div>
            : loading && !followUps.length ? <div className="flex items-center gap-2 p-5 text-sm text-muted"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Loading saved actions…</div>
              : followUps.length ? followUps.map((item) => <FollowUpCard key={item.id} item={item} canManage={canManageActions} saving={savingId === item.id} onSave={saveChange} />)
                : <p className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">No actions saved for this month yet. Add a recommendation below to start tracking follow-up.</p>}
          {!canManageActions && <p className="text-xs text-quiet">You can view saved actions. An analyst or administrator can edit them.</p>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">Measured gaps</p>
          <h3 className="heading-accent mt-1 font-display text-lg font-semibold text-slate-900">Suggested follow-ups</h3>
          <p className="mt-1 text-xs text-quiet">Suggestions are based on the current filters. Add relevant ones to the tracker, then confirm ownership and timing.</p>
        </div>
        <div className="divide-y divide-line">
          {dashboard.actions.length ? dashboard.actions.map((action) => {
            const saved = alreadyTracked(action);
            return <article key={action.title} className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h4 className="heading-accent text-sm font-semibold text-slate-900">{action.title}</h4><Badge status={action.priority}>{action.priority}</Badge></div>
                <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-muted">{action.detail}</p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-quiet"><span className="inline-flex items-center gap-1"><UserRound aria-hidden="true" className="size-3.5" />Suggested owner: {action.owner}</span><span>{action.metric}</span></p>
              </div>
              {canManageActions && <Button variant={saved ? "outline" : "primary"} disabled={saved || addingTitle === action.title} onClick={() => void addToTracker(action)}>
                {addingTitle === action.title ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : saved ? <Check aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
                {saved ? "Added to tracker" : addingTitle === action.title ? "Adding…" : "Add to tracker"}
              </Button>}
            </article>;
          }) : <p className="p-5 text-sm text-quiet">No eligible records support a follow-up suggestion for these filters.</p>}
          {!canManageActions && <p className="p-5 text-xs text-quiet">Only analysts and administrators can add or update actions.</p>}
        </div>
      </Card>

      <p className="rounded-xl border border-line bg-white p-4 text-xs leading-relaxed text-muted">Figures and status labels are calculated from the selected records. Suggested actions need human review before assignment.</p>
    </div>
  );
}

function FollowUpCard({
  item,
  canManage,
  saving,
  onSave,
}: {
  item: FollowUpRecord;
  canManage: boolean;
  saving: boolean;
  onSave: (item: FollowUpRecord, update: Partial<Pick<FollowUpRecord, "owner" | "due" | "status">>) => void;
}) {
  const [owner, setOwner] = useState(item.owner);
  useEffect(() => setOwner(item.owner), [item.owner]);
  return <article className="rounded-xl border border-line bg-panel p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-bold text-slate-900">{item.title}</h4><Badge status={item.priority}>{item.priority}</Badge><span className={`followup-state-chip followup-state-${item.status.toLowerCase().replaceAll(" ", "-")}`}>{item.status}</span></div>
        <p className="mt-2 text-sm leading-relaxed text-muted">{item.detail}</p>
        <p className="mt-2 text-xs text-quiet">{item.district === "all" ? "All districts" : item.district}{item.block !== "all" ? ` · ${item.block}` : ""} · {item.metric}</p>
      </div>
      {saving && <span className="inline-flex items-center gap-1.5 text-xs text-muted" role="status"><LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />Saving</span>}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1.5 text-xs font-semibold text-muted"><span className="inline-flex items-center gap-1"><UserRound aria-hidden="true" className="size-3.5" />Owner</span><input aria-label={`Owner for ${item.title}`} value={owner} disabled={!canManage || saving} onChange={(event) => setOwner(event.target.value)} onBlur={() => { if (owner.trim() && owner.trim() !== item.owner) onSave(item, { owner: owner.trim() }); }} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-slate-900 disabled:opacity-75" /></label>
      <label className="grid gap-1.5 text-xs font-semibold text-muted"><span className="inline-flex items-center gap-1"><CalendarClock aria-hidden="true" className="size-3.5" />Due date</span><input aria-label={`Due date for ${item.title}`} type="date" value={item.due} disabled={!canManage || saving} onChange={(event) => { if (event.target.value) onSave(item, { due: event.target.value }); }} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-slate-900 disabled:opacity-75" /></label>
      <label className="grid gap-1.5 text-xs font-semibold text-muted"><span>Status</span><select aria-label={`Status for ${item.title}`} value={item.status} disabled={!canManage || saving} onChange={(event) => onSave(item, { status: event.target.value as FollowUpStatus })} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-slate-900 disabled:opacity-75"><option>Draft</option><option>In Progress</option><option>Complete</option></select></label>
    </div>
  </article>;
}
