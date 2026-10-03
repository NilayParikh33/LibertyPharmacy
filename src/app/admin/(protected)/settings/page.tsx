import { getSiteSettings } from "@/lib/site";
import SettingsForm from "@/components/admin/SettingsForm";
import { requireAdmin } from "@/lib/admin-auth";

// Authorization is enforced here, not only in the (protected) layout: with
// partial rendering a soft navigation re-renders just this page segment, so a
// layout-level check alone can be skipped (see SECURITY-AUDIT.md, SEC-001).
export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSiteSettings();

  return (
    <div>
      <h1 className="section-title">Site Settings</h1>
      <div className="mt-6 max-w-2xl">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
