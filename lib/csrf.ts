/**
 * Double-submit-cookie CSRF protection.
 *
 * Token layout: `<random>.<hmac>` where hmac is HMAC-SHA256(secret, random).
 * The same token is stored in a readable cookie (`h21_csrf`) and must be
 * echoed by the browser in the `x-csrf-token` header on every mutating
 * request. Same-site cookies alone are not sufficient (LAX allows top-
 * level POSTs), so we require header+cookie equality plus HMAC integrity.
 */

import type { NextRequest, NextResponse } from "next/server";

export const CSRF_COOKIE = "h21_csrf";
export const CSRF_HEADER = "x-csrf-token";

const TOKEN_TTL_SEC = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  const secret = process.env.CSRF_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CSRF_SECRET (or SUPABASE_JWT_SECRET fallback) must be set to a value >= 32 chars in production"
    );
  }
  // Dev-only fallback; never used in production due to the guard above.
  return "h21-local-dev-csrf-secret-do-not-use-in-production-environment";
}

function bytesToHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function hmac(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToHex(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function issueCsrfToken(): Promise<string> {
  const random = crypto.randomUUID().replace(/-/g, "");
  const sig = await hmac(random);
  return `${random}.${sig}`;
}

export async function isValidCsrfToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [random, sig] = token.split(".");
  if (!random || !sig || random.length < 16 || sig.length < 16) return false;
  const expected = await hmac(random);
  return timingSafeEqual(sig, expected);
}

const EXEMPT_PREFIXES = [
  "/api/webhooks/",
  "/api/auth/meta/complete",
  "/api/auth/callback",
  "/auth/callback",
];

export function isCsrfExempt(path: string): boolean {
  return EXEMPT_PREFIXES.some((p) => path.startsWith(p));
}

export function isMutatingMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

export async function verifyCsrf(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(CSRF_COOKIE)?.value;
  const header = req.headers.get(CSRF_HEADER);
  if (!cookie || !header) return false;
  if (!timingSafeEqual(cookie, header)) return false;
  return isValidCsrfToken(cookie);
}

export async function attachCsrfCookieIfMissing(
  req: NextRequest,
  res: NextResponse
): Promise<void> {
  const existing = req.cookies.get(CSRF_COOKIE)?.value;
  if (existing) {
    const valid = await isValidCsrfToken(existing);
    if (valid) return;
  }
  const token = await issueCsrfToken();
  res.cookies.set({
    name: CSRF_COOKIE,
    value: token,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TOKEN_TTL_SEC,
  });
}
