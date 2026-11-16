import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertCircle, Check, ChevronDown, LoaderCircle } from "lucide-react";
import type { RiskStatus } from "../types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-panel shadow-panel ${className}`}>{children}</section>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" }) {
  const styles = {
    primary: "border-gold bg-gold text-[#17140d] hover:bg-gold-hover",
    outline: "border-line bg-transparent text-slate-200 hover:border-gold/60 hover:text-gold",
    ghost: "border-transparent bg-transparent text-muted hover:bg-raised hover:text-white",
  };
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`grid min-w-0 gap-2 text-xs font-medium text-muted ${className}`}>
      {label}
      <span className="relative">
        <select
          className="h-11 w-full appearance-none rounded-xl border border-line bg-[#13151a] px-3.5 pr-9 text-sm text-slate-100 outline-none transition focus:border-gold/70 focus:ring-2 focus:ring-gold/15"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-quiet" />
      </span>
    </label>
  );
}

export function Badge({ children, status }: { children: ReactNode; status: RiskStatus | "Draft" | "Submitted" }) {
  const key = String(status).toLowerCase().replaceAll(" ", "-");
  return <span className={`status-badge status-${key}`}>{children}</span>;
}

export function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">{eyebrow}</p>
        <h2 className="font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
        {detail && <p className="mt-1.5 max-w-2xl text-sm text-muted">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading report data…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-panel px-5 py-14 text-sm text-muted">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-gold" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-500/25 bg-red-950/20 p-5 text-sm text-red-100 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2"><AlertCircle aria-hidden="true" className="size-4 shrink-0" />{message}</span>
      {onRetry && <Button variant="outline" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Toast({ message, kind = "success" }: { message: string; kind?: "success" | "error" }) {
  if (!message) return null;
  const Icon = kind === "success" ? Check : AlertCircle;
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-panel ${kind === "success" ? "border-gold/30 bg-raised text-white" : "border-red-500/40 bg-red-950/90 text-red-100"}`} role="status" aria-live="polite">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-gold" />
      {message}
    </div>
  );
}

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);

export const formatPercent = (value: number | null): string =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

export const monthLabel = (month: string): string => {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};
