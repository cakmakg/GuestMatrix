import 'server-only'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import { RateLimitError } from '@/lib/auth/errors'

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

if (!redis && process.env.NODE_ENV === 'production') {
  throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.')
}

// When Redis is absent (development), all requests pass through — rate limiting is a no-op.
const MOCK_LIMITER = {
  limit: async () => ({ success: true, reset: Date.now() + 60_000 }),
} as unknown as Ratelimit

function makeLimiter(
  limiterFn: ConstructorParameters<typeof Ratelimit>[0]['limiter'],
  prefix: string,
): Ratelimit {
  if (!redis) return MOCK_LIMITER
  return new Ratelimit({ redis, limiter: limiterFn, prefix, analytics: true })
}

export const rateLimiters = {
  /** 5 attempts per 15 minutes per IP — tenant login brute-force protection */
  login: makeLimiter(Ratelimit.fixedWindow(5, '15m'), 'rl:login'),

  /** 5 sign-ups per hour per IP — self-service registration abuse prevention */
  signup: makeLimiter(Ratelimit.fixedWindow(5, '1h'), 'rl:signup'),

  /** 3 requests per hour per IP — password reset enumeration prevention */
  forgotPassword: makeLimiter(Ratelimit.fixedWindow(3, '1h'), 'rl:forgot-password'),

  /** 10 sessions per hour per IP — anonymous guest auth flood prevention */
  anonSession: makeLimiter(Ratelimit.fixedWindow(10, '1h'), 'rl:anon-session'),

  /** 20 requests per minute per user — presigned URL generation */
  presign: makeLimiter(Ratelimit.slidingWindow(20, '1m'), 'rl:presign'),

  /** 60 requests per minute per IP — gallery polling */
  gallery: makeLimiter(Ratelimit.slidingWindow(60, '1m'), 'rl:gallery'),

  /** 200 requests per minute per IP — general API DoS protection */
  api: makeLimiter(Ratelimit.slidingWindow(200, '1m'), 'rl:api'),
} as const

/**
 * Checks the rate limiter for the given identifier.
 * Throws RateLimitError (HTTP 429) when the limit is exceeded.
 * Fails open when Redis is unavailable to prevent rate limiting from causing outages.
 */
export async function checkRateLimit(limiter: Ratelimit, identifier: string): Promise<void> {
  try {
    const { success, reset } = await limiter.limit(identifier)
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
      throw new RateLimitError(retryAfter)
    }
  } catch (error) {
    if (error instanceof RateLimitError) throw error
    // Redis unreachable: fail open, do not block the request
    console.warn('[rate_limit_unavailable]', error)
  }
}
