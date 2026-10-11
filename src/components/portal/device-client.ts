"use client";

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";

/**
 * Browser side of passkey / authenticator sign-in (src/lib/device-auth.ts).
 * Every call returns { ok, data } and never throws, so pages just show
 * data.error on failure.
 */

export type ApiResult = { ok: boolean; status: number; data: Record<string, unknown> & { error?: string } };

export async function postJson(url: string, body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Something went wrong. Please try again." } };
  }
}

export const passkeysSupported = () => typeof window !== "undefined" && browserSupportsWebAuthn();

function passkeyError(err: unknown): ApiResult {
  const name = err instanceof Error ? err.name : "";
  const error =
    name === "NotAllowedError" || name === "AbortError"
      ? "The passkey prompt was closed or timed out. Please try again."
      : name === "InvalidStateError"
        ? "This device already has a passkey for your account."
        : "Your device couldn't complete the passkey. Please try again, or use an authenticator app.";
  return { ok: false, status: 0, data: { error } };
}

/** Adds a passkey to the account being set up (or the signed-in one). */
export async function createPasskey(): Promise<ApiResult> {
  const opts = await postJson("/api/auth/device/passkey/register-options");
  if (!opts.ok) return opts;
  let response;
  try {
    response = await startRegistration({ optionsJSON: opts.data.options as Parameters<typeof startRegistration>[0]["optionsJSON"] });
  } catch (err) {
    return passkeyError(err);
  }
  return postJson("/api/auth/device/passkey/register-verify", { response });
}

/** Signs in with a passkey — alone, or as the step after the password. */
export async function signInWithPasskey(): Promise<ApiResult> {
  const opts = await postJson("/api/auth/device/passkey/login-options");
  if (!opts.ok) return opts;
  let response;
  try {
    response = await startAuthentication({ optionsJSON: opts.data.options as Parameters<typeof startAuthentication>[0]["optionsJSON"] });
  } catch (err) {
    return passkeyError(err);
  }
  return postJson("/api/auth/device/passkey/login-verify", { response });
}
