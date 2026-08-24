import Link from "next/link";
import { getDb } from "@/lib/db";
import { getPosts } from "@/lib/posts";

export default async function AdminDashboardPage() {
  const db = await getDb();
  const newMessages = await db
    .prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'new'")
    .get<{ n: number }>();
  const totalMessages = await db.prepare("SELECT COUNT(*) AS n FROM contact_messages").get<{ n: number }>();
  const posts = await getPosts();

  const cards = [
    { label: "New Messages", value: newMessages?.n ?? 0, href: "/admin/messages" },
    { label: "Total Messages", value: totalMessages?.n ?? 0, href: "/admin/messages" },
    { label: "Blog Posts", value: posts.length, href: "/admin/posts" },
  ];

  return (
    <div>
      <h1 className="section-title">Dashboard</h1>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card block transition hover:border-navy-300">
            <p className="text-sm font-medium text-slate-500">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-navy-900">{c.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
