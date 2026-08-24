import { getSiteSettings } from "@/lib/site";
import SettingsForm from "@/components/admin/SettingsForm";

export default async function AdminSettingsPage() {
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
