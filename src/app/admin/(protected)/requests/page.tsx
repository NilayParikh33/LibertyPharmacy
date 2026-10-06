import Link from "next/link";
import { audit } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import {
  listRxRequestsForAdmin,
  type RefillDetails,
  type RxQueueFilter,
  type RxStatus,
  type TransferDetails,
} from "@/lib/rx-requests";
import RxRequestControl from "@/components/admin/RxRequestControl";
import DrxResendButton from "@/components/admin/DrxResendButton";
import DrxLinkControl from "@/components/admin/DrxLinkControl";
import { drxHeartbeat, isDrxApiConfigured, isDrxEnabled } from "@/lib/drx";
import type { DrxRefillStatus } from "@/lib/drx-refills";

const filters: { key: RxQueueFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "completed", label: "Closed" },
  { key: "all", label: "All" },
];

const statusBadge: Record<RxStatus, { text: string; cls: string }> = {
  new: { text: "New", cls: "bg-navy-50 text-navy-800" },
  in_progress: { text: "In progress", cls: "bg-amber-50 text-amber-800" },
  completed: { text: "Completed", cls: "bg-green-50 text-green-800" },
  cancelled: { text: "Cancelled", cls: "bg-slate-100 text-slate-600" },
};

const deliveryLabel: Record<string, string> = {
  pickup: "Pick up at the pharmacy",
  delivery: "Local delivery",
  mail: "Mail",
};

const drxBadge: Record<DrxRefillStatus, { text: string; cls: string }> = {
  sent: { text: "DRX accepted all", cls: "text-green-800" },
  partial: { text: "DRX accepted some", cls: "text-amber-800" },
  rejected: { text: "DRX did not accept", cls: "text-red-700" },
  error: { text: "Could not reach DRX", cls: "text-red-700" },
  no_match: { text: "No matching DRX patient", cls: "text-amber-800" },
};

/** One line on the DRX connection, from GET /heartbeat (no PHI involved). */
async function DrxConnection() {
  if (!isDrxApiConfigured()) {
    return (
      <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        DRX: not connected (no API key set). Requests stay here for staff.
      </p>
    );
  }
  const beat = await drxHeartbeat();
  const sending = isDrxEnabled();
  return (
    <p
      className={`mt-4 rounded-lg px-4 py-3 text-sm ${
        beat.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
      }`}
    >
      {beat.ok ? "DRX: connected. " : `DRX: connection failed (${beat.reason}). `}
      {sending
        ? "Refills go straight into DRX, and anything that needs a person (transfers, refills DRX did not accept, contact messages) is sent to DRX as a To-Do."
        : "Patient data exchange is switched off (DRX_ENABLED), so nothing is sent to or read from DRX."}
    </p>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-slate-800">{children}</dd>
    </div>
  );
}

// Authorization is enforced here, not only in the (protected) layout (SEC-001).
export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const admin = await requireAdmin();
  const { show } = await searchParams;
  const filter: RxQueueFilter = show === "completed" || show === "all" ? show : "open";
  const requests = await listRxRequestsForAdmin(filter);

  // Staff are reading patients' names, birth dates and prescriptions: an
  // access event for the audit trail (§164.312(b)), recorded by request id.
  await audit({
    actor: `admin:${admin.username}`,
    action: "admin.rx_requests.list",
    outcome: "success",
    detail: `filter=${filter} count=${requests.length} ids=${requests.map((r) => r.id).join(",")}`,
  });

  return (
    <div>
      <h1 className="section-title">Refill &amp; Transfer Requests</h1>
      <p className="mt-2 text-sm text-slate-600">
        Requests patients sent from the portal. Fill or transfer each one in your dispensing system, then mark it here so
        the patient can see its progress.
      </p>
      <DrxConnection />

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Request filter">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "open" ? "/admin/requests" : `/admin/requests?show=${f.key}`}
            aria-current={f.key === filter ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              f.key === filter ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-navy-700"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <p className="card mt-6 text-sm text-slate-600">
          {filter === "open" ? "Nothing waiting — the queue is clear." : "No requests here yet."}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {requests.map((r) => {
            const badge = statusBadge[r.status];
            const refill = r.kind === "refill" ? (r.details as RefillDetails | null) : null;
            const transfer = r.kind === "transfer" ? (r.details as TransferDetails | null) : null;
            return (
              <div key={r.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-liberty-red">
                      {r.kind === "refill" ? "Refill" : "Transfer"} #{r.id} · {formatDate(r.createdAt)}
                    </p>
                    <p className="mt-1 font-semibold text-navy-900">{r.patient.name}</p>
                    <p className="text-sm text-slate-600">
                      DOB {r.patient.dateOfBirth} · {r.patient.cellPhone} · {r.patient.email}
                    </p>
                    {isDrxEnabled() && <DrxLinkControl patientId={r.patient.id} drxPatientId={r.patient.drxPatientId} />}
                    {isDrxEnabled() && r.kind === "transfer" && r.patient.drxPatientId === null && (
                      <p className="mt-1 max-w-xl text-xs text-slate-500">
                        Optional: patients connect themselves with the Rx number on their first label. Only link here if
                        one calls for help (they&apos;ll get an email that they can refill online).
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
                </div>

                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  {refill && (
                    <>
                      <Detail label="Prescriptions">
                        {refill.items.map((i) => (i.drugName ? `Rx ${i.rxNumber} — ${i.drugName}` : `Rx ${i.rxNumber}`)).join("\n")}
                      </Detail>
                      <Detail label="Get it by">{deliveryLabel[refill.deliveryMethod] ?? refill.deliveryMethod}</Detail>
                      {refill.note && <Detail label="Patient note">{refill.note}</Detail>}
                    </>
                  )}
                  {transfer && (
                    <>
                      <Detail label="Transfer from">
                        {transfer.fromPharmacyName}
                        {transfer.fromPharmacyCity ? `, ${transfer.fromPharmacyCity}` : ""}
                        {"\n"}
                        {transfer.fromPharmacyPhone}
                      </Detail>
                      <Detail label="Medications">{transfer.medications}</Detail>
                      {transfer.note && <Detail label="Patient note">{transfer.note}</Detail>}
                    </>
                  )}
                  {!refill && !transfer && (
                    <Detail label="Details">The request details could not be read. Please contact the patient.</Detail>
                  )}
                </dl>

                {r.kind === "refill" && r.drx.status && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className={`font-semibold ${drxBadge[r.drx.status].cls}`}>
                      {drxBadge[r.drx.status].text}
                      {r.drx.at ? <span className="font-normal text-slate-500"> · {formatDate(r.drx.at)}</span> : null}
                    </p>
                    {r.drx.outcomes.length > 0 && (
                      <ul className="mt-2 space-y-1 text-slate-700">
                        {r.drx.outcomes.map((o, i) => (
                          <li key={i}>
                            {o.ok ? "✓" : "✗"} Rx {o.rxNumber}
                            {o.itemName ? ` (${o.itemName})` : ""}: {o.message}
                            {o.estimatedPickupTime ? ` · est. pickup ${formatDate(o.estimatedPickupTime)}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.drx.status === "no_match" && (
                      <p className="mt-2 text-slate-600">
                        DRX found no single patient with this name and Rx number and a matching date of birth. Call the
                        patient to confirm who they are, use &ldquo;Link by hand&rdquo; above with their DRX patient ID,
                        then send again, or fill it by hand.
                      </p>
                    )}
                    {r.drx.status !== "sent" && isDrxEnabled() && (
                      <div className="mt-3">
                        <DrxResendButton id={r.id} />
                      </div>
                    )}
                  </div>
                )}

                {r.drx.todoId !== null && (
                  <p className="mt-3 text-xs font-medium text-navy-700">
                    In DRX as To-Do #{r.drx.todoId}: staff work it there; ticking it done there completes it here.
                  </p>
                )}

                {r.handledBy && (
                  <p className="mt-3 text-xs text-slate-500">
                    Last updated by {r.handledBy} · {formatDate(r.updatedAt)}
                  </p>
                )}
                <RxRequestControl id={r.id} status={r.status} staffNote={r.staffNote} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
