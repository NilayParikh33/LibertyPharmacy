import { NextResponse, after } from "next/server";
import { z } from "zod";
import { getSessionAccountId } from "@/lib/auth";
import { createRxRequest, getPatientIdForAccount, type RxRequestInput } from "@/lib/rx-requests";
import { sendRxRequestEmail } from "@/lib/mail";
import { forwardRefillToDrx } from "@/lib/drx-refills";
import { syncDrxTodosSoon } from "@/lib/drx-todos";
import { isDrxEnabled } from "@/lib/drx";
import { getClientIp } from "@/lib/request";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * Refill and prescription-transfer requests from the patient portal.
 *
 * Signed-in patients only. Who is asking comes from the session cookie; the
 * body carries what is being asked for and nothing about who is asking, so a
 * request cannot be filed for someone else. The request is stored encrypted
 * (src/lib/rx-requests.ts) and the pharmacy is told with a content-free
 * email. Responses never echo what was submitted.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

// Prescription numbers are printed on the bottle label: digits, sometimes with
// a letter prefix or dash. Anything else is a typo, or not a Rx number.
const rxNumber = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{3,20}$/, "Enter the prescription number exactly as printed on your label");

const refillSchema = z.object({
  kind: z.literal("refill"),
  items: z
    .array(z.object({ rxNumber, drugName: optionalText(100) }))
    .min(1, "Add at least one prescription")
    .max(10, "You can request up to 10 prescriptions at a time"),
  deliveryMethod: z.enum(["pickup", "delivery", "mail"]),
  note: optionalText(500),
});

const transferSchema = z.object({
  kind: z.literal("transfer"),
  fromPharmacyName: z.string().trim().min(2, "Enter the name of your current pharmacy").max(150),
  fromPharmacyPhone: z
    .string()
    .trim()
    .regex(/^[\d\s().+-]{10,20}$/, "Enter your current pharmacy's phone number"),
  fromPharmacyCity: optionalText(100),
  medications: z.string().trim().min(2, "List the medications you want transferred").max(1000),
  note: optionalText(500),
  // A transfer is us contacting another pharmacy about the patient's records,
  // so the patient has to say they want that.
  authorize: z.literal(true, {
    errorMap: () => ({ message: "Please confirm that you want us to contact your current pharmacy" }),
  }),
});

const requestSchema = z.discriminatedUnion("kind", [refillSchema, transferSchema]);

// Per client address, then per account: the address limit slows a script
// before it costs a database lookup, the account limit covers a patient
// behind a shared address (a family, a clinic) without punishing the others.
const ipLimiter = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });
const accountLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (ipLimiter.hit(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }

  const accountId = await getSessionAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "Please sign in to send a request." }, { status: 401 });
  }
  if (accountLimiter.hit(`account:${accountId}`)) {
    return NextResponse.json(
      { error: "You've sent several requests in the last hour. Please call the pharmacy if something is urgent." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Please check the form and try again.", field: first?.path?.join(".") },
      { status: 400 }
    );
  }

  const patientId = await getPatientIdForAccount(accountId);
  if (!patientId) {
    return NextResponse.json({ error: "We couldn't find your patient record. Please call the pharmacy." }, { status: 404 });
  }

  const d = parsed.data;
  const input: RxRequestInput =
    d.kind === "refill"
      ? {
          kind: "refill",
          details: {
            items: d.items.map((i) => ({ rxNumber: i.rxNumber, ...(i.drugName ? { drugName: i.drugName } : {}) })),
            deliveryMethod: d.deliveryMethod,
            ...(d.note ? { note: d.note } : {}),
          },
        }
      : {
          kind: "transfer",
          details: {
            fromPharmacyName: d.fromPharmacyName,
            fromPharmacyPhone: d.fromPharmacyPhone,
            ...(d.fromPharmacyCity ? { fromPharmacyCity: d.fromPharmacyCity } : {}),
            medications: d.medications,
            ...(d.note ? { note: d.note } : {}),
          },
        };

  const result = await createRxRequest(accountId, patientId, input, ip);
  if (!result.ok) {
    return NextResponse.json(
      { error: "You already have several open requests. Please call the pharmacy to add more." },
      { status: 409 }
    );
  }

  // After the response, so a slow or failing mail transport can neither delay
  // nor fail a request that is already safely stored. The queue in the admin
  // panel is the reliable path; the email is only a nudge.
  if (isDrxEnabled()) {
    // Staff work in DRX, so that is where this goes: refills straight into
    // DRX's queue, and whatever needs a person (transfers, refills DRX did not
    // accept) as a DRX To-Do. After the response: the request is already
    // stored, so DRX being slow or down only delays it (the sync retries).
    // Neither call throws.
    after(async () => {
      if (input.kind === "refill") await forwardRefillToDrx(result.id);
      await syncDrxTodosSoon();
    });
  } else {
    // DRX off: the content-free email points staff at the admin queue.
    after(() =>
      sendRxRequestEmail(input.kind).catch((err) =>
        console.error("rx request: staff notification failed", err instanceof Error ? err.message : err)
      )
    );
  }

  return NextResponse.json({ ok: true, id: result.id });
}
