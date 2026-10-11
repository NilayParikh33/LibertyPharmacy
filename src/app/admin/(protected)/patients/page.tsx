import { requireAdmin } from "@/lib/admin-auth";
import { audit, getDb } from "@/lib/db";
import { decryptPHI } from "@/lib/crypto";
import { isDeviceMode } from "@/lib/device-auth";
import ResetSignInButton from "@/components/admin/ResetSignInButton";

export const dynamic = "force-dynamic";

/**
 * Admin → Patients: find a portal account by email and, for a patient who
 * has lost their phone/passkey and recovery codes, reset their sign-in
 * (src/lib/device-auth.ts). Names and dates of birth are shown so staff can
 * confirm the caller; each search is audited.
 */

interface Row {
  id: number;
  email: string;
  created_at: string;
  locked_until: string | null;
  must_change_password: number;
  totp: number;
  passkeys: string | number;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
}

export default async function AdminPatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdmin();
  const q = ((await searchParams).q ?? "").trim().toLowerCase().slice(0, 254);
  const db = await getDb();

  const select = `SELECT a.id, a.email, a.created_at, a.locked_until, a.must_change_password,
      CASE WHEN a.totp_secret IS NULL THEN 0 ELSE 1 END AS totp,
      (SELECT COUNT(*) FROM webauthn_credentials w WHERE w.account_id = a.id) AS passkeys,
      p.first_name, p.last_name, p.date_of_birth
    FROM accounts a LEFT JOIN patients p ON p.account_id = a.id`;
  const rows = q
    ? await db
        .prepare(`${select} WHERE a.email LIKE ? ESCAPE '\\' ORDER BY a.id DESC LIMIT 20`)
        .all<Row>(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
    : await db.prepare(`${select} ORDER BY a.id DESC LIMIT 20`).all<Row>();

  await audit({
    actor: `admin:${admin.username}`,
    action: "admin.patient.search",
    outcome: "success",
    detail: `${rows.length} result(s)${q ? ", by email" : ", latest"}`,
  });

  const dec = (v: string | null) => (v ? decryptPHI(v) : "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Patients</h1>
        <p className="mt-1 text-sm text-slate-600">
          Portal accounts. Use <strong>Reset sign-in</strong> only for a patient who has lost their phone or passkey
          and their recovery codes, after confirming who they are.
          {!isDeviceMode() && " (Patients currently sign in with emailed codes — PATIENT_AUTH_MODE is not \"device\".)"}
        </p>
      </div>

      <form className="flex max-w-lg gap-3" method="get">
        <input name="q" type="search" defaultValue={q} placeholder="Search by email" className="input-field" aria-label="Search by email" />
        <button type="submit" className="btn-primary btn-sm">
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No accounts found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Signs in with</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const passkeys = Number(r.passkeys);
                const ways = [passkeys ? `${passkeys} passkey${passkeys > 1 ? "s" : ""}` : "", r.totp ? "authenticator app" : ""].filter(Boolean);
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">
                        {dec(r.first_name)} {dec(r.last_name)}
                      </span>
                      <span className="block text-xs text-slate-500">DOB {dec(r.date_of_birth)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.email}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.must_change_password ? "Reset — waiting for patient" : ways.length ? ways.join(", ") : "Nothing set up yet"}
                      {r.locked_until && new Date(r.locked_until) > new Date() && (
                        <span className="block text-xs text-red-700">Locked after failed attempts</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ResetSignInButton accountId={r.id} email={r.email} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
