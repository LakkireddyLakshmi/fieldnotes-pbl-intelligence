import type { FilterOptions, GrantOption, GrantReport, ProgramDashboard, ProgramFilters } from "./types";

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function getFilterOptions(district = "all", signal?: AbortSignal): Promise<FilterOptions> {
  const query = new URLSearchParams({ district });
  return request(`/api/filters?${query}`, signal);
}

export function getDashboard(filters: ProgramFilters, signal?: AbortSignal): Promise<ProgramDashboard> {
  const query = new URLSearchParams({
    month: filters.month,
    district: filters.district,
    block: filters.block,
    grade: filters.grade,
    subject: filters.subject,
  });
  return request(`/api/program/dashboard?${query}`, signal);
}

export function getGrants(signal?: AbortSignal): Promise<GrantOption[]> {
  return request("/api/grants", signal);
}

export function getGrantReport(grantId: string, month: string, signal?: AbortSignal): Promise<GrantReport> {
  const query = new URLSearchParams({ grantId, month });
  return request(`/api/grants/report?${query}`, signal);
}
