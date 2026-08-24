import { getDb } from "@/lib/db";
import MessageStatusControl from "@/components/admin/MessageStatusControl";

interface MessageRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: "new" | "read" | "replied";
  created_at: string;
}

const subjectLabels: Record<string, string> = {
  hours: "Store hours & directions",
  products: "Product availability",
  services: "Services offered",
  billing: "General billing question",
  other: "Other",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminMessagesPage() {
  const db = await getDb();
  const messages = await db
    .prepare("SELECT * FROM contact_messages ORDER BY created_at DESC")
    .all<MessageRow>();

  return (
    <div>
      <h1 className="section-title">Contact Messages</h1>
      <p className="mt-2 text-sm text-slate-600">General inquiries submitted through the website&apos;s Get In Touch form.</p>

      {messages.length === 0 ? (
        <p className="card mt-6 text-sm text-slate-600">No messages yet.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-navy-900">
                    {m.first_name} {m.last_name}{" "}
                    <span className="font-normal text-slate-500">— {m.email}</span>
                    {m.phone && <span className="font-normal text-slate-500"> · {m.phone}</span>}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-liberty-red">
                    {subjectLabels[m.subject] ?? m.subject} · {formatDate(m.created_at)}
                  </p>
                </div>
                <MessageStatusControl id={m.id} status={m.status} />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
