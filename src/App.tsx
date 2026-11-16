import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  FileBarChart2,
  Landmark,
  LayoutDashboard,
  LogOut,
  Moon,
  School,
  Sun,
  UserRound,
} from "lucide-react";
import {
  changePassword,
  createUser,
  getCurrentUser,
  getDashboard,
  getFilterOptions,
  getGrantReport,
  getGrants,
  getUsers,
  signIn,
  signOut,
  updateProfile,
  updateUser,
} from "./api";
import AccessViews, { SignInView } from "./components/AccessViews";
import GrantReportView from "./components/GrantReportView";
import ProgramDashboardView from "./components/ProgramDashboardView";
import ReviewBriefView from "./components/ReviewBriefView";
import SchoolsView from "./components/SchoolsView";
import { ErrorState, LoadingState, Toast } from "./components/ui";
import type {
  FilterOptions,
  GrantOption,
  GrantReport,
  ProgramDashboard,
  ProgramFilters,
  AuthUser,
} from "./types";

type View = "program" | "schools" | "grant" | "brief" | "account";
type Theme = "light" | "dark";
type PageTemplate = "classic" | "compact" | "editorial";
type ToastState = { message: string; kind: "success" | "error" };

const initialFilters: ProgramFilters = {
  month: "2025-09",
  district: "all",
  block: "all",
  grade: "all",
  subject: "all",
};

const navigation: Array<{ id: View; label: string; description: string; icon: typeof LayoutDashboard }> = [
  { id: "program", label: "Overview", description: "Program performance", icon: LayoutDashboard },
  { id: "schools", label: "Schools", description: "School-level records", icon: School },
  { id: "grant", label: "Grant reports", description: "Finance and outcomes", icon: Landmark },
  { id: "brief", label: "Meeting brief", description: "Review and follow-up", icon: FileBarChart2 },
  { id: "account", label: "Account & access", description: "Profile and permissions", icon: UserRound },
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
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem("fieldnotes-theme");
    return saved === "light" || saved === "dark" ? saved : "light";
  });
  const [pageTemplate, setPageTemplate] = useState<PageTemplate>(() => {
    const saved = window.localStorage.getItem("fieldnotes-template");
    return saved === "compact" || saved === "editorial" ? saved : "classic";
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [view, setView] = useState<View>("program");
  const [geographyLevel, setGeographyLevel] = useState<"district" | "block">("district");
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

  useEffect(() => {
    getCurrentUser().then(({ user: current }) => setUser(current)).catch(() => setUser(null)).finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    try { window.localStorage.setItem("fieldnotes-theme", theme); } catch { /* Theme still works for this session. */ }
  }, [theme]);

  useEffect(() => {
    try { window.localStorage.setItem("fieldnotes-template", pageTemplate); } catch { /* Template still works for this session. */ }
  }, [pageTemplate]);

  const showToast = useCallback((message: string, kind: ToastState["kind"] = "success") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!user) return;
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
  }, [filters.district, user?.id]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setDashboardBusy(true);
    setDashboardError("");
    getDashboard(filters, controller.signal, geographyLevel)
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
  }, [filters, geographyLevel, user?.id]);

  useEffect(() => {
    if (!user) return;
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
  }, [user?.id]);

  useEffect(() => {
    if (!user || !grantId) return;
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
  }, [grantId, grantMonth, user?.id]);

  useEffect(() => {
    if (!user || user.role !== "admin" || view !== "account") return;
    getUsers().then(setUsers).catch((error: unknown) => showToast(error instanceof Error ? error.message : "Could not load workspace users.", "error"));
  }, [user?.id, user?.role, view, showToast]);

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
      setGeographyLevel("block");
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

  const handleSignIn = useCallback(async (email: string, password: string) => {
    setAuthBusy(true); setAuthError("");
    try { const result = await signIn(email, password); setUser(result.user); }
    catch (error) { setAuthError(error instanceof Error ? error.message : "Sign in failed."); }
    finally { setAuthBusy(false); }
  }, []);

  const handleSignOut = useCallback(async () => {
    try { await signOut(); } finally { setUser(null); setView("program"); setUsers([]); }
  }, []);

  const handleSaveProfile = useCallback(async (name: string, email: string) => {
    const result = await updateProfile(name, email);
    setUser(result.user);
  }, []);

  const handleChangePassword = useCallback(async (current: string, next: string) => {
    await changePassword(current, next);
  }, []);

  const handleCreateUser = useCallback(async (input: { name: string; email: string; role: AuthUser["role"]; password: string }) => {
    const created = await createUser(input);
    setUsers((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const handleUpdateUser = useCallback(async (id: string, update: { role?: AuthUser["role"]; active?: boolean }) => {
    const updated = await updateUser(id, update);
    setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
  }, []);

  if (authLoading) return <main className="grid min-h-screen place-items-center bg-canvas"><LoadingState label="Checking workspace access…" /></main>;
  if (!user) return <SignInView onSignIn={handleSignIn} error={authError} busy={authBusy} />;

  const pageMeta = navigation.find((item) => item.id === view)!;
  const canExport = user.role === "admin" || user.role === "analyst";
  return (
    <div className="min-h-screen bg-canvas text-slate-900">

      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[76px] max-w-[1680px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-3 sm:px-7">
            <a href="#" className="flex shrink-0 items-center gap-3 text-slate-900" aria-label="Fieldnotes home">
              <span className="grid size-10 place-items-center rounded-xl bg-[#3158c9] text-white"><BookOpenCheck aria-hidden="true" className="size-5" strokeWidth={2.3} /></span>
              <span>
                <span className="block font-display text-base font-bold tracking-tight text-slate-900">Fieldnotes<span className="text-gold">.</span></span>
                <span className="mt-0.5 block text-[9px] uppercase tracking-[0.16em] text-quiet">{pageMeta.label}</span>
              </span>
            </a>

            <nav className="order-3 mx-auto flex w-full max-w-full justify-center gap-1 overflow-x-auto border-t border-line px-2 py-2 sm:px-7" aria-label="Workspace sections">
              {navigation.map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  title={description}
                  aria-current={view === id ? "page" : undefined}
                  onClick={() => setView(id)}
                  className={`workspace-tab inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors sm:px-4 ${view === id ? "workspace-tab-active" : ""}`}
                >
                  <Icon aria-hidden="true" className="size-4" strokeWidth={2.3} />
                  <span>{label === "Grant reports" ? "Grants" : label === "Meeting brief" ? "Meeting brief" : label === "Account & access" ? "Account" : label}</span>
                </button>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-2.5 text-xs text-muted">
                <span className="hidden sm:inline">Layout</span>
                <select aria-label="Page template" value={pageTemplate} onChange={(event) => setPageTemplate(event.target.value as PageTemplate)} className="max-w-[106px] bg-transparent text-xs text-slate-800 outline-none">
                  <option value="classic">Classic</option>
                  <option value="compact">Compact</option>
                  <option value="editorial">Editorial</option>
                </select>
              </label>
              <div aria-label="Color theme" role="group" className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-line bg-white p-1">
                <button type="button" aria-label="Light theme" title="Light theme" aria-pressed={theme === "light"} onClick={() => setTheme("light")} className={`grid size-7 place-items-center rounded-md transition ${theme === "light" ? "bg-[#3158c9] text-white" : "text-muted hover:bg-raised"}`}><Sun aria-hidden="true" className="size-3.5" /></button>
                <button type="button" aria-label="Dark theme" title="Dark theme" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} className={`grid size-7 place-items-center rounded-md transition ${theme === "dark" ? "bg-[#3158c9] text-white" : "text-muted hover:bg-raised"}`}><Moon aria-hidden="true" className="size-3.5" /></button>
              </div>
              <button onClick={() => void handleSignOut()} className="grid size-9 place-items-center rounded-lg border border-line bg-white text-muted hover:bg-raised sm:hidden" aria-label="Sign out" title="Sign out"><LogOut aria-hidden="true" className="size-4" /></button>
              <span className="hidden items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-medium text-muted xl:inline-flex">
                <span className="size-1.5 rounded-full bg-blue-500" />July – September 2025
              </span>
              <div className="hidden items-center gap-2 sm:flex">
                <button onClick={() => setView("account")} className="rounded-lg px-2 py-1 text-right hover:bg-raised" aria-label="Open account and access settings">
                  <span className="block text-[11px] font-semibold text-slate-900">{user.name}</span>
                  <span className="block text-[9px] capitalize text-quiet">{user.role}</span>
                </button>
                <button onClick={() => void handleSignOut()} className="rounded-lg border border-line bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-raised">Sign out</button>
              </div>
            </div>
          </div>
        </header>

        <main data-template={pageTemplate} className="mx-auto max-w-[1560px] px-4 py-6 sm:px-7 sm:py-8">
          {view === "account" && <AccessViews user={user} users={users} onSaveProfile={handleSaveProfile} onChangePassword={handleChangePassword} onCreateUser={handleCreateUser} onUpdateUser={handleUpdateUser} />}
          {view === "schools" && <SchoolsView filters={filters} options={filterOptions} canExport={canExport} onChange={updateFilter} />}
          {view !== "account" && view !== "schools" && dashboardError && !dashboard && <ErrorState message={dashboardError} onRetry={() => setFilters((current) => ({ ...current }))} />}
          {view !== "account" && view !== "schools" && !dashboard && !dashboardError && <LoadingState label="Loading program data…" />}
          {dashboard && view === "program" && (
            <ProgramDashboardView
              dashboard={dashboard}
              filters={filters}
              filterOptions={filterOptions}
              busy={dashboardBusy}
              canExport={canExport}
              onChange={updateFilter}
              onReset={resetFilters}
              onSelectGeography={selectGeography}
              geographyLevel={geographyLevel}
              onGeographyLevelChange={setGeographyLevel}
              onDownload={() => {
                downloadText(`pbl-review-${filters.month}.txt`, programText);
                showToast("Review brief downloaded.");
              }}
            />
          )}
          {dashboard && view === "brief" && (
            <ReviewBriefView
              dashboard={dashboard}
              canExport={canExport}
              canManageActions={user.role === "admin" || user.role === "analyst"}
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
              canExport={canExport}
              busy={grantBusy}
              onGrantChange={setGrantId}
              onMonthChange={setGrantMonth}
              onCopy={copyGrantReport}
              onDownload={downloadGrantReport}
            />
          )}


        </main>
      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </div>
  );
}
