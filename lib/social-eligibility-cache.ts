const PREFIX = "h21-social-elig-v1:";
const CACHE_MS = 5 * 60 * 1000;

export const SOCIAL_ELIGIBILITY_CHANGED = "h21-social-eligibility-changed";

export function readCachedEligibility(pageId: number): { fb: boolean; ig: boolean } | null {
  if (typeof window === "undefined" || !pageId) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(PREFIX + pageId);
    if (!raw) {
      return null;
    }
    const p = JSON.parse(raw) as { fb?: boolean; ig?: boolean; t?: number };
    if (typeof p.fb !== "boolean" || typeof p.ig !== "boolean" || typeof p.t !== "number") {
      return null;
    }
    if (Date.now() - p.t > CACHE_MS) {
      return null;
    }
    return { fb: p.fb, ig: p.ig };
  } catch {
    return null;
  }
}

export function writeCachedEligibility(pageId: number, fb: boolean, ig: boolean): void {
  if (typeof window === "undefined" || !pageId) {
    return;
  }
  try {
    sessionStorage.setItem(PREFIX + pageId, JSON.stringify({ fb, ig, t: Date.now() }));
  } catch {
    /* private mode / quota */
  }
}

export function notifySocialEligibilityChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(SOCIAL_ELIGIBILITY_CHANGED));
}
