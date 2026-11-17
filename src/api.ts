import type { AuthUser, FilterOptions, FollowUpRecord, GrantOption, GrantReport, ProgramDashboard, ProgramFilters, SchoolRecord } from "./types";

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

export function getDashboard(filters: ProgramFilters, signal?: AbortSignal, groupBy?: "district" | "block"): Promise<ProgramDashboard> {
  const query = new URLSearchParams({
    month: filters.month,
    district: filters.district,
    block: filters.block,
    grade: filters.grade,
    subject: filters.subject,
  });
  if (groupBy) query.set("groupBy", groupBy);
  return request(`/api/program/dashboard?${query}`, signal);
}

export function getSchools(filters: ProgramFilters, signal?: AbortSignal): Promise<SchoolRecord[]> {
  const query = new URLSearchParams({
    month: filters.month,
    district: filters.district,
    block: filters.block,
    grade: filters.grade,
    subject: filters.subject,
  });
  return request(`/api/program/schools?${query}`, signal);
}

export function getFollowUps(month: string, signal?: AbortSignal): Promise<FollowUpRecord[]> {
  return request(`/api/follow-ups?${new URLSearchParams({ month })}`, signal);
}

export function createFollowUp(input: Omit<FollowUpRecord, "id" | "status">): Promise<FollowUpRecord> {
  return send("/api/follow-ups", "POST", input);
}

export function updateFollowUp(
  id: string,
  update: Partial<Pick<FollowUpRecord, "owner" | "due" | "status">>,
): Promise<FollowUpRecord> {
  return send(`/api/follow-ups/${encodeURIComponent(id)}`, "PATCH", update);
}

export function getGrants(signal?: AbortSignal): Promise<GrantOption[]> {
  return request("/api/grants", signal);
}

export function getGrantReport(grantId: string, month: string, signal?: AbortSignal): Promise<GrantReport> {
  const query = new URLSearchParams({ grantId, month });
  return request(`/api/grants/report?${query}`, signal);
}

export function getGrantNarrativeStatus(): Promise<{ enabled: boolean }> {
  return request("/api/grants/report/narrative-status");
}

export function generateGrantNarrative(grantId: string, month: string): Promise<{ narrative: string }> {
  return send("/api/grants/report/narrative", "POST", { grantId, month });
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(result?.error || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getCurrentUser(): Promise<{ user: AuthUser }> {
  return request("/api/auth/me");
}

export function signIn(email: string, password: string): Promise<{ user: AuthUser }> {
  return send("/api/auth/login", "POST", { email, password });
}

export function signOut(): Promise<void> {
  return send("/api/auth/logout", "POST");
}

export function updateProfile(name: string, email: string): Promise<{ user: AuthUser }> {
  return send("/api/auth/profile", "PATCH", { name, email });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return send("/api/auth/password", "POST", { currentPassword, newPassword });
}

export function getUsers(): Promise<AuthUser[]> {
  return request("/api/admin/users");
}

export function createUser(input: { name: string; email: string; role: AuthUser["role"]; password: string }): Promise<AuthUser> {
  return send("/api/admin/users", "POST", input);
}

export function updateUser(id: string, update: { role?: AuthUser["role"]; active?: boolean }): Promise<AuthUser> {
  return send(`/api/admin/users/${encodeURIComponent(id)}`, "PATCH", update);
}
