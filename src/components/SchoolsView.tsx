import { useEffect, useMemo, useState } from "react";
import { Download, Search, School as SchoolIcon, UsersRound, ClipboardCheck } from "lucide-react";
import { getSchools } from "../api";
import type { FilterOptions, ProgramFilters, RiskStatus, SchoolRecord } from "../types";
import { Badge, Button, Card, ErrorState, formatNumber, LoadingState, SectionHeading, SelectField } from "./ui";

interface Props {
  filters: ProgramFilters;
  options: FilterOptions;
  canExport: boolean;
  onChange: (field: keyof ProgramFilters, value: string) => void;
}

const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function SchoolsView({ filters, options, canExport, onChange }: Props) {
  const [rows, setRows] = useState<SchoolRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    getSchools(filters, controller.signal).then(setRows).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load school records.");
    }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [filters]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return rows.filter((row) => !term || [row.schoolName, row.schoolCode, row.district, row.block].some((value) => value.toLocaleLowerCase().includes(term)));
  }, [rows, search]);
  const participating = rows.filter((row) => row.participated).length;
  const evidenceCount = rows.filter((row) => row.evidence).length;
  const exportCsv = () => {
    const header = ["School", "School code", "District", "Block", "Enrollment", "Attendance rate", "PBL", "Evidence", "Signal"];
    const body = visibleRows.map((row) => [row.schoolName, row.schoolCode, row.district, row.block, row.enrollment, percent(row.attendanceRate), row.evidence ? "Submitted" : "Missing", row.participated ? "Yes" : "No", row.signal]
      .map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([[header.map(csvCell).join(","), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `schools-${filters.month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="School records" title="Schools" detail={`School-level reporting for ${filters.month}. Use filters to narrow the list and review each school's reported status.`} />
        {canExport && <Button variant="outline" onClick={exportCsv} disabled={!visibleRows.length}><Download aria-hidden="true" className="size-4" />Export CSV</Button>}
      </div>

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.4fr_auto] xl:items-end">
          <SelectField label="Reporting month" value={filters.month} onChange={(value) => onChange("month", value)} options={options.months.map((month) => ({ value: month, label: month }))} />
          <SelectField label="District" value={filters.district} onChange={(value) => onChange("district", value)} options={[{ value: "all", label: "All districts" }, ...options.districts.map((district) => ({ value: district, label: district }))]} />
          <SelectField label="Block" value={filters.block} onChange={(value) => onChange("block", value)} options={[{ value: "all", label: "All blocks" }, ...options.blocks.map((block) => ({ value: block, label: block }))]} />
          <label className="grid gap-2 text-xs font-medium text-muted">Search schools
            <span className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-quiet" /><input className="h-11 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-gold/70 focus:ring-2 focus:ring-gold/15" placeholder="Name, code, district, or block" value={search} onChange={(event) => setSearch(event.target.value)} /></span>
          </label>
          <p className="text-xs text-quiet xl:pb-3">{filters.grade === "all" ? "All grades" : `Grade ${filters.grade}`} · {filters.subject === "all" ? "All subjects" : filters.subject}</p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="school-summary-card min-h-36 p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><p className="school-summary-label text-xs font-bold uppercase tracking-[0.08em]">Total schools</p><SchoolIcon aria-hidden="true" className="school-summary-icon size-5" /></div><p className="school-summary-value mt-8 font-display text-3xl font-bold tracking-tight">{formatNumber(rows.length)}</p></Card>
        <Card className="school-summary-card min-h-36 p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><p className="school-summary-label text-xs font-bold uppercase tracking-[0.08em]">Participating schools</p><UsersRound aria-hidden="true" className="school-summary-icon size-5" /></div><div className="mt-5 flex flex-wrap items-center gap-2"><p className="school-summary-value font-display text-3xl font-bold tracking-tight">{formatNumber(participating)}</p><span className="participation-pill rounded-full px-3 py-1 text-xs font-bold">{rows.length ? `${(participating / rows.length * 100).toFixed(1)}%` : "—"}</span></div><p className="school-summary-support mt-1 text-sm font-semibold">of {formatNumber(rows.length)} schools</p></Card>
        <Card className="school-summary-card min-h-36 p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><p className="school-summary-label text-xs font-bold uppercase tracking-[0.08em]">Evidence submission</p><ClipboardCheck aria-hidden="true" className="school-summary-icon size-5" /></div><div className="mt-5 flex flex-wrap items-center gap-2"><p className="school-summary-value font-display text-3xl font-bold tracking-tight">{rows.length ? `${(evidenceCount / rows.length * 100).toFixed(1)}%` : "—"}</p><span className="school-summary-support text-xs font-semibold">{formatNumber(evidenceCount)} submitted</span></div><p className="school-summary-support mt-1 text-sm font-semibold">of {formatNumber(rows.length)} schools</p></Card>
      </div>

      {error ? <ErrorState message={error} /> : busy && !rows.length ? <LoadingState label="Loading school records…" /> : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
            <div><h3 className="text-sm font-semibold text-slate-900">School reporting list</h3><p className="mt-0.5 text-xs text-quiet">{formatNumber(visibleRows.length)} records · attendance uses the selected grade and subject filters</p></div>
            {busy && <span className="text-xs text-quiet">Updating…</span>}
          </div>
          {visibleRows.length ? <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-raised/70 text-[10px] uppercase tracking-wider text-quiet"><tr>
                <th className="px-4 py-3 font-semibold sm:px-5">School</th><th className="px-3 py-3 font-semibold">District / block</th><th className="px-3 py-3 text-right font-semibold">Enrollment</th><th className="px-3 py-3 text-right font-semibold">Attendance</th><th className="px-3 py-3 font-semibold">PBL</th><th className="px-3 py-3 font-semibold">Evidence</th><th className="px-4 py-3 font-semibold sm:px-5">Signal</th>
              </tr></thead>
              <tbody>{visibleRows.map((row) => <tr key={`${row.schoolCode}-${filters.month}`} className="odd:bg-panel even:bg-raised/25 hover:bg-blue-50/60 dark:hover:bg-blue-900/20">
                <td className="px-4 py-3 sm:px-5"><span className="school-table-primary block font-semibold">{row.schoolName}</span><span className="school-table-secondary mt-0.5 block text-[11px]">{row.schoolCode}</span></td>
                <td className="px-3 py-3"><span className="school-table-primary block font-medium">{row.district}</span><span className="school-table-secondary mt-0.5 block text-[11px]">{row.block}</span></td>
                <td className="school-table-primary px-3 py-3 text-right font-semibold tabular-nums">{formatNumber(row.enrollment)}</td>
                <td className="school-table-primary px-3 py-3 text-right font-semibold tabular-nums">{percent(row.attendanceRate)}</td>
                <td className="px-3 py-3"><span className={row.participated ? "school-table-positive" : "school-table-secondary"}>{row.participated ? "Completed" : "Not completed"}</span></td>
                <td className="px-3 py-3"><span className={row.evidence ? "school-table-positive" : "school-table-secondary"}>{row.evidence ? "Submitted" : "Missing"}</span></td>
                <td className="px-4 py-3 sm:px-5"><Badge className="school-table-badge" status={row.signal as RiskStatus}>{row.signal}</Badge></td>
              </tr>)}</tbody>
            </table>
          </div> : <div className="px-5 py-12 text-center"><p className="text-sm font-medium text-slate-900">No matching school records</p><p className="mt-1 text-xs text-quiet">Try another month, district, block, or search term.</p></div>}
        </Card>
      )}
      <p className="text-xs leading-relaxed text-quiet">Signals combine selected-slice PBL completion, evidence submission, and reported session attendance using the dashboard risk bands. A dash means attendance was not reported for the selected slice.</p>
    </div>
  );
}
