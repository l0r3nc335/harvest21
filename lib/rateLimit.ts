import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { ipAddress } from "@vercel/functions";

const IS_PROD = process.env.NODE_ENV === "production";
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

const isUpstashConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

function assertUpstashConfiguredAtRuntime(): void {
  if (IS_PROD && !IS_BUILD && !isUpstashConfigured) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production"
    );
  }
}

type Category = "auth" | "email" | "payment" | "general";

const FAIL_CLOSED_CATEGORIES: ReadonlySet<Category> = new Set([
  "auth",
  "email",
  "payment",
]);

function createLimiter(
  requests: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`
): Ratelimit {
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: "h21:rl",
  });
}

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function checkInMemory(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

const limiters = isUpstashConfigured
  ? {
      auth: createLimiter(5, "60 s"),
      email: createLimiter(3, "60 s"),
      payment: createLimiter(10, "60 s"),
      general: createLimiter(30, "60 s"),
    }
  : null;

const LIMITS: Record<Category, { limit: number; windowMs: number }> = {
  auth: { limit: 5, windowMs: 60_000 },
  email: { limit: 3, windowMs: 60_000 },
  payment: { limit: 10, windowMs: 60_000 },
  general: { limit: 30, windowMs: 60_000 },
};

export function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + "::/64";
  }
  const v4 = ip.split(".");
  if (v4.length === 4) {
    return `${v4[0]}.${v4[1]}.${v4[2]}.0/24`;
  }
  return "unknown";
}

export function getClientIp(request: NextRequest): string {
  const vercelIp = ipAddress(request);
  if (vercelIp) return vercelIp;

  if (!IS_PROD) {
    return (
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"
    );
  }

  return "unknown";
}

export async function rateLimitCheck(
  identifier: string,
  category: Category = "general"
): Promise<{ success: boolean; remaining: number }> {
  assertUpstashConfiguredAtRuntime();
  if (limiters) {
    try {
      const limiter = limiters[category];
      const { success, remaining } = await limiter.limit(
        `${category}:${identifier}`
      );
      return { success, remaining };
    } catch (error) {
      if (FAIL_CLOSED_CATEGORIES.has(category)) {
        console.error(
          `[rateLimit] Upstash failure for category "${category}" — failing closed`,
          error
        );
        return { success: false, remaining: 0 };
      }
      console.error(
        `[rateLimit] Upstash failure for category "${category}" — falling back to in-memory`,
        error
      );
    }
  }

  const cfg = LIMITS[category];
  return checkInMemory(`${category}:${identifier}`, cfg.limit, cfg.windowMs);
}
