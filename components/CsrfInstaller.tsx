"use client";

import { useEffect } from "react";

const CSRF_COOKIE = "h21_csrf";
const CSRF_HEADER = "x-csrf-token";

function readCookie(name: string): string | null {
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

function isSameOrigin(input: RequestInfo | URL): boolean {
  try {
    let url: URL;
    if (typeof input === "string") {
      if (input.startsWith("/")) return true;
      url = new URL(input, window.location.origin);
    } else if (input instanceof URL) {
      url = input;
    } else {
      url = new URL(input.url, window.location.origin);
    }
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    __h21CsrfInstalled?: boolean;
  }
}

/**
 * One-time monkey-patch of window.fetch to automatically attach the CSRF
 * header on same-origin mutating requests. Keeps call-sites unchanged.
 */
export function CsrfInstaller() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__h21CsrfInstalled) return;
    window.__h21CsrfInstalled = true;

    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const method =
        init?.method ??
        (typeof input !== "string" && !(input instanceof URL)
          ? (input as Request).method
          : undefined);

      if (!isMutating(method) || !isSameOrigin(input)) {
        return original(input, init);
      }

      const token = readCookie(CSRF_COOKIE);
      if (!token) return original(input, init);

      const headers = new Headers(init?.headers ?? {});
      if (
        !headers.has(CSRF_HEADER) &&
        typeof input !== "string" &&
        !(input instanceof URL)
      ) {
        const reqHeaders = (input as Request).headers;
        reqHeaders.forEach((v, k) => {
          if (!headers.has(k)) headers.set(k, v);
        });
      }
      if (!headers.has(CSRF_HEADER)) {
        headers.set(CSRF_HEADER, token);
      }

      return original(input, { ...(init ?? {}), headers });
    };
  }, []);

  return null;
}
