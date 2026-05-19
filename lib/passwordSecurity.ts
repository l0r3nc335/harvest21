/**
 * Password strength + breach checks (server-oriented).
 *
 * - isPasswordPwned() uses the HIBP k-anonymity API.
 * - zxcvbn (0-4). We require >= 3.
 * - Composition rules live in passwordPolicy.ts (shared with client).
 */

import zxcvbn from "zxcvbn";
import {
  getPasswordCompositionFailure,
  PASSWORD_MIN_LENGTH,
} from "@/lib/passwordPolicy";

export type {
  PasswordCheckResult,
  PasswordCheckReason,
  PasswordCompositionReason,
} from "@/lib/passwordPolicy";

export {
  getPasswordCompositionFailure,
  passwordStrengthMessage,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_TEXT,
} from "@/lib/passwordPolicy";

import type { PasswordCheckResult } from "@/lib/passwordPolicy";

const HIBP_URL = "https://api.pwnedpasswords.com/range/";
const HIBP_TIMEOUT_MS = 3500;

const MIN_SCORE = 3;

async function sha1Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  const view = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out.toUpperCase();
}

export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);

    const res = await fetch(HIBP_URL + prefix, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return false;
    const body = await res.text();
    return body
      .split("\n")
      .some((line) => line.toUpperCase().startsWith(suffix));
  } catch {
    return false;
  }
}

export async function checkPassword(
  password: string,
  userInputs: string[] = []
): Promise<PasswordCheckResult> {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: "too_short" };
  }

  const composition = getPasswordCompositionFailure(password);
  if (composition) {
    return { ok: false, reason: composition };
  }

  const result = zxcvbn(password, userInputs);
  if (result.score < MIN_SCORE) {
    return { ok: false, reason: "low_entropy", score: result.score };
  }

  const pwned = await isPasswordPwned(password);
  if (pwned) {
    return { ok: false, reason: "pwned", score: result.score };
  }

  return { ok: true, score: result.score };
}

export { MIN_SCORE as PASSWORD_MIN_SCORE };
