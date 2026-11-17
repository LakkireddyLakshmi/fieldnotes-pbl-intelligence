import { useState, type FormEvent } from "react";
import { BarChart3, ClipboardCheck, Globe2, KeyRound, Landmark, LockKeyhole, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import type { AuthUser } from "../types";
import { Button, Card, SectionHeading } from "./ui";

export function SignInView({ onSignIn, error, busy }: {
  onSignIn: (email: string, password: string) => Promise<void>;
  error: string;
  busy: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSignIn(email, password);
  };

  const features = [
    { icon: BarChart3, title: "Program overview", detail: "Review participation, evidence, attendance, and monthly trends." },
    { icon: Globe2, title: "District and block comparison", detail: "Find priority locations and compare reported performance." },
    { icon: Landmark, title: "Grant reporting", detail: "Bring outcomes, finance, milestones, and evidence into one report." },
  ];

  return (
    <main className="pbl-landing min-h-screen bg-canvas px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-7xl flex-col">
        <header className="flex items-center justify-between border-b border-line/80 pb-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[#3158c9] text-white shadow-sm"><Globe2 aria-hidden="true" className="size-6" strokeWidth={2.3} /></span>
            <div><p className="font-display text-lg font-bold tracking-tight text-slate-900">PBL Review Hub</p><p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">Program intelligence</p></div>
          </div>
          <span className="hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-xs font-semibold text-muted sm:inline-flex"><ShieldCheck aria-hidden="true" className="size-4 text-blue-700" />Secure workspace</span>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-14">
          <section className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-blue-800"><span className="size-2 rounded-full bg-[#3158c9]" />PBL program intelligence</p>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">A clearer view of <span className="landing-brand-accent">program progress.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">Review school participation, compare districts and blocks, and prepare grant reports from the selected reporting records.</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {features.map(({ icon: Icon, title, detail }) => (
                <article key={title} className="rounded-2xl border border-line bg-panel p-4 shadow-sm">
                  <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-[#3158c9]"><Icon aria-hidden="true" className="size-5" strokeWidth={2} /></span>
                  <h2 className="mt-4 text-sm font-bold leading-5 text-slate-900">{title}</h2>
                  <p className="mt-1.5 text-xs leading-5 text-muted">{detail}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs font-medium text-muted"><ClipboardCheck aria-hidden="true" className="size-4 text-blue-700" />Figures stay linked to their reporting records.</p>
          </section>

          <section aria-labelledby="signin-heading" className="mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
            <Card className="p-6 shadow-panel sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">Welcome back</p><h2 id="signin-heading" className="heading-accent mt-2 font-display text-2xl font-bold text-slate-900">Sign in to continue</h2></div>
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-raised text-[#3158c9]"><LockKeyhole aria-hidden="true" className="size-5" /></span>
              </div>
              <p className="text-sm leading-6 text-muted">Use the account provided by your workspace administrator.</p>
              <form className="mt-6 space-y-4" onSubmit={submit}>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Email address
                  <input required autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-xl border border-line bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Password
                  <input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-xl border border-line bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
                </label>
                {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
                <Button type="submit" className="mt-2 w-full justify-center py-3 text-sm" disabled={busy}><LockKeyhole aria-hidden="true" className="size-4" />{busy ? "Signing in…" : "Sign in to workspace"}</Button>
              </form>
              <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted">Accounts and permissions are managed by your administrator.</p>
            </Card>
            <p className="mt-4 text-center text-xs text-quiet">PBL Review Hub · Program review and grant reporting</p>
          </section>
        </div>
      </div>
    </main>
  );
}

type Props = {
  user: AuthUser;
  users: AuthUser[];
  onSaveProfile: (name: string, email: string) => Promise<void>;
  onChangePassword: (current: string, next: string) => Promise<void>;
  onCreateUser: (input: { name: string; email: string; role: AuthUser["role"]; password: string }) => Promise<void>;
  onUpdateUser: (id: string, update: { role?: AuthUser["role"]; active?: boolean }) => Promise<void>;
};

export default function AccessViews({ user, users, onSaveProfile, onChangePassword, onCreateUser, onUpdateUser }: Props) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AuthUser["role"]>("viewer");
  const [initialPassword, setInitialPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The change could not be saved."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Workspace access" title="Account and permissions" detail="Update your profile, secure your account, and review access for this workspace." />
      {(notice || error) && <p className={`rounded-xl border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"}`} role={error ? "alert" : "status"}>{error || notice}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <SectionHeading eyebrow="Personal details" title="Your profile" />
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void run(() => onSaveProfile(name, email), "Profile updated."); }}>
            <label className="grid gap-2 text-xs font-medium text-muted">Display name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm text-slate-800" /></label>
            <label className="grid gap-2 text-xs font-medium text-muted">Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm text-slate-800" /></label>
            <div className="flex items-center gap-2 rounded-xl bg-raised/70 p-3 text-xs text-muted"><ShieldCheck className="size-4 text-gold" />Role: <strong className="capitalize text-slate-800">{user.role}</strong></div>
            <Button type="submit" disabled={busy}>Save profile</Button>
          </form>
        </Card>

        <Card className="p-5">
          <SectionHeading eyebrow="Account security" title="Change password" />
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void run(async () => { await onChangePassword(currentPassword, newPassword); setCurrentPassword(""); setNewPassword(""); }, "Password changed. Other sessions have been signed out."); }}>
            <label className="grid gap-2 text-xs font-medium text-muted">Current password<input required autoComplete="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm text-slate-800" /></label>
            <label className="grid gap-2 text-xs font-medium text-muted">New password (at least 12 characters)<input required minLength={12} autoComplete="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm text-slate-800" /></label>
            <p className="text-[11px] leading-relaxed text-quiet">Changing your password signs out your other active sessions.</p>
            <Button type="submit" variant="outline" disabled={busy}><KeyRound aria-hidden="true" className="size-4" />Update password</Button>
          </form>
        </Card>
      </div>

      {user.role === "admin" && <>
        <Card className="p-5">
          <SectionHeading eyebrow="Administrator" title="Add a workspace account" detail="Create accounts for colleagues and give each person only the access they need." action={<UsersRound className="size-5 text-gold" />} />
          <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" onSubmit={(event) => { event.preventDefault(); void run(async () => { await onCreateUser({ name: newName, email: newEmail, role: newRole, password: initialPassword }); setNewName(""); setNewEmail(""); setInitialPassword(""); }, "Account created."); }}>
            <input aria-label="Name" required placeholder="Full name" value={newName} onChange={(event) => setNewName(event.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm text-slate-800" />
            <input aria-label="Email" required type="email" placeholder="Email address" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm text-slate-800" />
            <select aria-label="Role" value={newRole} onChange={(event) => setNewRole(event.target.value as AuthUser["role"])} className="h-11 rounded-xl border border-line bg-white px-3 text-sm text-slate-800"><option value="viewer">Viewer</option><option value="analyst">Analyst</option><option value="admin">Administrator</option></select>
            <input aria-label="Temporary password" required minLength={12} type="password" placeholder="Initial password (12+ chars)" value={initialPassword} onChange={(event) => setInitialPassword(event.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm text-slate-800" />
            <Button type="submit" disabled={busy}><UserPlus aria-hidden="true" className="size-4" />Create account</Button>
          </form>
          <p className="mt-3 text-[11px] text-quiet">Share initial passwords securely. Users can change them from their account page.</p>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">Access management</p><h3 className="heading-accent mt-1 font-display text-lg font-semibold text-slate-900">Workspace users</h3></div>
          <div className="divide-y divide-line">
            {users.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-[180px]"><p className="text-sm font-semibold text-slate-900">{account.name}{account.id === user.id && <span className="ml-2 text-[10px] font-normal text-quiet">You</span>}</p><p className="mt-0.5 text-xs text-muted">{account.email}</p></div>
              <div className="flex items-center gap-2">
                <select aria-label={`Role for ${account.name}`} value={account.role} disabled={busy} onChange={(event) => void run(() => onUpdateUser(account.id, { role: event.target.value as AuthUser["role"] }), "Permissions updated.")} className="h-9 rounded-lg border border-line bg-white px-2 text-xs text-slate-800"><option value="viewer">Viewer</option><option value="analyst">Analyst</option><option value="admin">Administrator</option></select>
                <Button variant="outline" disabled={busy || account.id === user.id} onClick={() => void run(() => onUpdateUser(account.id, { active: !account.active }), account.active ? "Account deactivated." : "Account reactivated.")}>{account.active ? "Active" : "Inactive"}</Button>
              </div>
            </div>)}
          </div>
          <div className="border-t border-line bg-raised/50 px-5 py-4 text-xs leading-relaxed text-muted"><strong className="text-slate-800">Viewer</strong> can view and filter reports and saved follow-ups. <strong className="text-slate-800">Analyst</strong> can export reports and create or update follow-up actions. <strong className="text-slate-800">Administrator</strong> can do both and manage workspace accounts. All roles currently see the same reporting records.</div>
        </Card>
      </>}
    </div>
  );
}
