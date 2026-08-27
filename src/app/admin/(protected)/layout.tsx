import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import AdminLogoutButton from "@/components/AdminLogoutButton";

export const dynamic = "force-dynamic";

const links = [
  { label: "Dashboard", href: "/admin" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Blog Posts", href: "/admin/posts" },
  { label: "Site Settings", href: "/admin/settings" },
];

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <section className="py-10">
      <div className="container-site">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <nav className="flex flex-wrap gap-2" aria-label="Admin navigation">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-navy-700"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{admin.username}</span>
            </span>
            <AdminLogoutButton />
          </div>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
