import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  ChevronRight,
  CircleHelp,
  FileBarChart2,
  Landmark,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  getDashboard,
  getFilterOptions,
  getGrantReport,
  getGrants,
} from "./api";
import GrantReportView from "./components/GrantReportView";
import ProgramDashboardView from "./components/ProgramDashboardView";
import ReviewBriefView from "./components/ReviewBriefView";
import { ErrorState, LoadingState, Toast } from "./components/ui";
import type {
  FilterOptions,
  GrantOption,
  GrantReport,
  ProgramDashboard,
  ProgramFilters,
} from "./types";

type View = "program" | "grant" | "brief";
type ToastState = { message: string; kind: "success" | "error" };

const initialFilters: ProgramFilters = {
  month: "2025-09",
  district: "all",
  block: "all",
  grade: "all",
  subject: "all",
};

const navigation: Array<{ id: View; label: string; description: string; icon: typeof LayoutDashboard }> = [
  { id: "program", label: "Program review", description: "Monthly intelligence", icon: LayoutDashboard },
  { id: "grant", label: "Grant reporting", description: "Facts to report", icon: Landmark },
  { id: "brief", label: "Review brief", description: "Meeting preparation", icon: FileBarChart2 },
];

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [view, setView] = useState<View>("program");
  const [filters, setFilters] = useState<ProgramFilters>(initialFilters);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    months: [],
    districts: [],
    blocks: [],
    grades: [6, 7, 8],
    subjects: ["Math", "Science"],
  });
  const [dashboard, setDashboard] = useState<ProgramDashboard | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardBusy, setDashboardBusy] = useState(true);
  const [grants, setGrants] = useState<GrantOption[]>([]);
  const [grantId, setGrantId] = useState("");
  const [grantMonth, setGrantMonth] = useState("2025-09");
  const [grantReport, setGrantReport] = useState<GrantReport | null>(null);
  const [grantError, setGrantError] = useState("");
  const [grantBusy, setGrantBusy] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, kind: ToastState["kind"] = "success") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getFilterOptions(filters.district, controller.signal)
      .then((options) => {
        setFilterOptions(options);
        setFilters((current) => ({
          ...current,
          month: options.months.includes(current.month) ? current.month : options.months.at(-1) ?? current.month,
          block: current.block === "all" || options.blocks.includes(current.block) ? current.block : "all",
        }));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDashboardError(error instanceof Error ? error.message : "Could not load filter options.");
        }
      });
    return () => controller.abort();
  }, [filters.district]);

  useEffect(() => {
    const controller = new AbortController();
    setDashboardBusy(true);
    setDashboardError("");
    getDashboard(filters, controller.signal)
      .then(setDashboard)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDashboardError(error instanceof Error ? error.message : "Could not load program metrics.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDashboardBusy(false);
      });
    return () => controller.abort();
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    getGrants(controller.signal)
      .then((items) => {
        setGrants(items);
        setGrantId((current) => current && items.some((item) => item.grantId === current)
          ? current
          : items[0]?.grantId ?? "");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setGrantError(error instanceof Error ? error.message : "Could not load grant options.");
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!grantId) return;
    const controller = new AbortController();
    setGrantBusy(true);
    setGrantError("");
    getGrantReport(grantId, grantMonth, controller.signal)
      .then(setGrantReport)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setGrantReport(null);
          setGrantError(error instanceof Error ? error.message : "Could not load the grant report.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setGrantBusy(false);
      });
    return () => controller.abort();
  }, [grantId, grantMonth]);

  const programText = useMemo(() => {
    if (!dashboard) return "";
    return [
      `PROGRAM REVIEW — ${dashboard.filters.month}`,
      `Filters: district ${dashboard.filters.district}; block ${dashboard.filters.block}; grade ${dashboard.filters.grade}; subject ${dashboard.filters.subject}`,
      "",
      "Achievements",
      dashboard.summary.achievement,
      "",
      "Month-over-month movement",
      dashboard.summary.movement,
      "",
      "Priority geography",
      dashboard.summary.priority,
      "",
      "Risk signals",
      dashboard.summary.risk,
      "",
      "Discussion prompt",
      dashboard.summary.discussionPrompt,
      "",
      "Draft follow-up actions",
      ...dashboard.actions.map((action) => `- ${action.title}: ${action.detail} Owner: ${action.owner}; priority: ${action.priority}; due: ${action.due}; status: ${action.status}; metric: ${action.metric}.`),
      "",
      "Computed deterministically from synthetic records. Validate and assign draft actions in the review meeting.",
    ].join("\n");
  }, [dashboard]);

  const updateFilter = useCallback((field: keyof ProgramFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      ...(field === "district" ? { block: "all" } : {}),
    }));
  }, []);

  const resetFilters = useCallback(() => setFilters(initialFilters), []);

  const selectGeography = useCallback((data: ProgramDashboard, name: string) => {
    if (data.groupBy === "district") {
      setFilters((current) => ({ ...current, district: name, block: "all" }));
    } else {
      setFilters((current) => ({ ...current, block: name }));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const copyGrantReport = useCallback(async () => {
    if (!grantReport) return;
    try {
      await navigator.clipboard.writeText(grantReport.narrative);
      showToast("Grant report copied.");
    } catch (error) {
      console.error("Could not copy the grant report:", error);
      showToast("Clipboard access was denied. Use Download instead.", "error");
    }
  }, [grantReport, showToast]);

  const downloadGrantReport = useCallback(() => {
    if (!grantReport) return;
    downloadText(`grant-report-${grantId}-${grantMonth}.txt`, grantReport.narrative);
    showToast("Grant section downloaded.");
  }, [grantId, grantMonth, grantReport, showToast]);

  const pageMeta = navigation.find((item) => item.id === view)!;

  return (
    <div className="min-h-screen bg-canvas text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-[#13151a] px-4 py-5 lg:flex">
        <a href="#" className="flex items-center gap-3 px-2 text-white" aria-label="Fieldnotes home">
          <span className="grid size-10 place-items-center rounded-xl bg-gold font-display text-lg font-bold text-[#17140d]">F</span>
          <span>
            <span className="block font-display text-base font-bold tracking-tight">fieldnotes<span className="text-gold">.</span></span>
            <span className="mt-0.5 block text-[9px] uppercase tracking-[0.16em] text-quiet">Program intelligence</span>
          </span>
        </a>

        <div className="mb-2 mt-10 px-3 text-[9px] font-bold uppercase tracking-[0.17em] text-quiet">Workspace</div>
        <nav className="space-y-1" aria-label="Workspace sections">
          {navigation.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${view === id ? "border border-gold/15 bg-gold/5 text-white" : "text-muted hover:bg-raised hover:text-white"}`}
              aria-current={view === id ? "page" : undefined}
            >
              <span className={`grid size-9 place-items-center rounded-lg ${view === id ? "bg-gold/10 text-gold" : "bg-raised text-quiet group-hover:text-slate-200"}`}>
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">{label}</span>
                <span className="mt-1 block text-[10px] text-quiet">{description}</span>
              </span>
              {view === id && <ChevronRight aria-hidden="true" className="size-3.5 text-gold" />}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-gold/15 bg-gold/5 p-3.5">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-gold"><ShieldCheck aria-hidden="true" className="size-3.5" />Synthetic assessment data</div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">All school, grant, geography, and evidence records are synthetic.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-panel p-3">
            <div className="grid size-8 place-items-center rounded-full bg-raised text-[10px] font-bold text-gold">PT</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-slate-200">Program team</p>
              <p className="mt-0.5 text-[9px] text-quiet">Review workspace</p>
            </div>
            <CircleHelp aria-hidden="true" className="size-4 text-quiet" />
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-xl">
          <div className="flex min-h-[68px] items-center justify-between gap-4 px-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold font-display font-bold text-[#17140d] lg:hidden">F</span>
              <div>
                <p className="truncate text-xs font-semibold text-white">{pageMeta.label}</p>
                <p className="mt-1 hidden text-[10px] text-quiet sm:block">{pageMeta.description} <span className="px-1.5 text-line">/</span> July–September 2025</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[10px] font-medium text-muted sm:inline-flex">
                <span className="size-1.5 rounded-full bg-emerald-400" />Deterministic core
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/15 bg-gold/5 px-2.5 py-1.5 text-[9px] font-semibold text-gold sm:px-3 sm:text-[10px]">
                <Sparkles aria-hidden="true" className="size-3" />AI optional
              </span>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:hidden" aria-label="Workspace sections">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setView(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold ${view === id ? "bg-gold/10 text-gold" : "text-muted hover:bg-raised"}`}>
                <Icon aria-hidden="true" className="size-3.5" />{label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-[1560px] px-4 py-6 sm:px-7 sm:py-8">
          {dashboardError && !dashboard && <ErrorState message={dashboardError} onRetry={() => setFilters((current) => ({ ...current }))} />}
          {!dashboard && !dashboardError && <LoadingState label="Connecting to program data…" />}
          {dashboard && view === "program" && (
            <ProgramDashboardView
              dashboard={dashboard}
              filters={filters}
              filterOptions={filterOptions}
              busy={dashboardBusy}
              onChange={updateFilter}
              onReset={resetFilters}
              onSelectGeography={selectGeography}
              onDownload={() => {
                downloadText(`pbl-review-${filters.month}.txt`, programText);
                showToast("Review brief downloaded.");
              }}
            />
          )}
          {dashboard && view === "brief" && (
            <ReviewBriefView
              dashboard={dashboard}
              onDownload={() => {
                downloadText(`pbl-review-brief-${filters.month}.txt`, programText);
                showToast("Meeting brief downloaded.");
              }}
            />
          )}
          {view === "grant" && grantError && <ErrorState message={grantError} />}
          {view === "grant" && !grantError && (
            <GrantReportView
              grants={grants}
              months={filterOptions.months}
              grantId={grantId}
              month={grantMonth}
              report={grantReport}
              busy={grantBusy}
              onGrantChange={setGrantId}
              onMonthChange={setGrantMonth}
              onCopy={copyGrantReport}
              onDownload={downloadGrantReport}
            />
          )}

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[10px] text-quiet">
            <span className="inline-flex items-center gap-1.5"><Activity aria-hidden="true" className="size-3.5 text-gold" />Built for a synthetic assessment dataset</span>
            <span>Source facts stay separate from generated explanation.</span>
          </footer>
        </main>
      </div>
      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </div>
  );
}
