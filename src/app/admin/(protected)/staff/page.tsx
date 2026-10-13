import { requireAdmin } from "@/lib/admin-auth";
import { listStaff } from "@/lib/admin-staff";
import StaffManager from "@/components/admin/StaffManager";

export const dynamic = "force-dynamic";

// Authorization is enforced here, not only in the (protected) layout
// (SECURITY-AUDIT.md, SEC-001).
export default async function AdminStaffPage() {
  const admin = await requireAdmin();
  const { staff, invites } = await listStaff();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Staff</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Everyone who uses this admin panel gets their own login, so the audit log shows who did what. Add someone to
          get a one-time setup link: they choose their own password and set up their authenticator app. Never share a
          login.
        </p>
      </div>
      <StaffManager staff={staff} invites={invites} currentId={admin.id} />
    </div>
  );
}
