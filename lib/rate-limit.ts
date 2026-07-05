import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Shared rate limiter backed by Upstash Redis.
 *
 * Used to throttle public/unauthenticated endpoints (e.g. the launch handoff
 * exchange). Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in
 * production; when unset (local dev) limiting is disabled and requests are
 * allowed, with a one-time warning logged in production.
 */

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  // Fail open on misconfiguration: a malformed URL (e.g. a token pasted into
  // the URL var) must not take down every rate-limited endpoint. This exact
  // mistake once broke the launch handoff exchange in production.
  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }
  if (!url.startsWith("https://")) {
    console.error(
      "[rate-limit] UPSTASH_REDIS_REST_URL is not an https URL — rate limiting DISABLED. Check the Vercel env vars (URL and TOKEN may be swapped)."
    );
    redisClient = null;
    return redisClient;
  }
  try {
    redisClient = new Redis({ url, token });
  } catch (error) {
    console.error("[rate-limit] failed to construct Redis client — rate limiting DISABLED", error);
    redisClient = null;
  }
  return redisClient;
}

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, limit: number, windowSeconds: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) {
    return null;
  }
  const cacheKey = `${name}:${limit}:${windowSeconds}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `rl:${name}`,
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

/**
 * Best-effort client IP. Prefers Vercel's `x-real-ip`, then the LAST hop of
 * `x-forwarded-for` (client-prepended values sit to the left and must not be
 * trusted).
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (hops.length > 0) {
      return hops[hops.length - 1];
    }
  }
  return "unknown";
}

let warnedMissingConfig = false;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  reset: number;
};

/**
 * Check (and consume) a request against a named limiter. Fails open (allows the
 * request) when Upstash is unconfigured or errors, so a limiter outage can't
 * take down the app.
 */
export async function checkRateLimit(options: {
  name: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const limiter = getLimiter(options.name, options.limit, options.windowSeconds);
  if (!limiter) {
    if (!warnedMissingConfig && process.env.NODE_ENV === "production") {
      warnedMissingConfig = true;
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set — rate limiting is DISABLED"
      );
    }
    return { ok: true, remaining: options.limit, reset: 0 };
  }
  try {
    const result = await limiter.limit(options.identifier);
    return { ok: result.success, remaining: result.remaining, reset: result.reset };
  } catch (error) {
    console.error("[rate-limit] limiter error, allowing request", error);
    return { ok: true, remaining: options.limit, reset: 0 };
  }
}
