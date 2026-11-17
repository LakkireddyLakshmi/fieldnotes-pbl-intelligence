import { useState, type FormEvent } from "react";
import { Globe2, KeyRound, LockKeyhole, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
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

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-md p-7 sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#3158c9] text-white"><Globe2 aria-hidden="true" className="size-6" strokeWidth={2.3} /></span>
          <div><p className="font-display text-lg font-bold text-slate-900">PBL Review Hub</p><p className="text-xs text-muted">Program review and grant reporting</p></div>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Secure workspace</p>
        <h1 className="heading-accent mt-1 font-display text-2xl font-semibold text-slate-900">Sign in to continue</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">Use the account provided by your workspace administrator.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="grid gap-2 text-xs font-medium text-muted">Email address
            <input required autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-xl border border-line bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-gold focus:ring-2 focus:ring-gold/15" />
          </label>
          <label className="grid gap-2 text-xs font-medium text-muted">Password
            <input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-xl border border-line bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-gold focus:ring-2 focus:ring-gold/15" />
          </label>
          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}><LockKeyhole aria-hidden="true" className="size-4" />{busy ? "Signing in…" : "Sign in"}</Button>
        </form>
        <p className="mt-6 border-t border-line pt-4 text-[11px] leading-relaxed text-quiet">Accounts and permissions are managed by your administrator.</p>
      </Card>
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
