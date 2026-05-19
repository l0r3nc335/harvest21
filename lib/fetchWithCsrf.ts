"use client";

/**
 * Drop-in fetch wrapper that attaches the CSRF header from the
 * `h21_csrf` cookie on every mutating request. Non-browser callers
 * (SSR, unit tests) skip the header safely.
 */

const CSRF_COOKIE = "h21_csrf";
const CSRF_HEADER = "x-csrf-token";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function isMutating(method: string | undefined): boolean {
  if (!method) return false;
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

export async function fetchWithCsrf(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const method = init.method;
  if (!isMutating(method)) {
    return fetch(input, init);
  }

  const token = readCookie(CSRF_COOKIE);
  const headers = new Headers(init.headers ?? {});
  if (!headers.has(CSRF_HEADER)) {
    if (!token) {
      throw new Error(
        "CSRF token missing. Refresh the page to obtain a new session."
      );
    }
    headers.set(CSRF_HEADER, token);
  }

  return fetch(input, { ...init, headers, credentials: init.credentials ?? "same-origin" });
}
