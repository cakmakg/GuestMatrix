import 'server-only'

import { logger } from '@/lib/logger'

export class AppError extends Error {
  readonly code: string
  readonly httpStatus: number

  constructor(code: string, message: string, httpStatus: number) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400)
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', `${resource} not found.`, 404)
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super('RATE_LIMITED', 'Too many requests. Please try again later.', 429)
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class UploadError extends AppError {
  constructor(message: string) {
    super('UPLOAD_ERROR', message, 422)
  }
}

export class StorageDeletionError extends AppError {
  constructor() {
    super('STORAGE_DELETE_ERROR', 'Löschung fehlgeschlagen, bitte erneut versuchen.', 500)
  }
}

/**
 * Maps any thrown error to a consistent JSON Response.
 * Unknown errors are logged server-side; the client receives a generic message.
 */
export function handleRouteError(error: unknown): Response {
  if (error instanceof RateLimitError) {
    return Response.json(
      { error: error.message },
      {
        status: 429,
        headers: { 'Retry-After': String(error.retryAfterSeconds) },
      },
    )
  }

  if (error instanceof AppError) {
    return Response.json({ error: error.message }, { status: error.httpStatus })
  }

  logger.error('[unhandled_exception]', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
  return Response.json({ error: 'Something went wrong.' }, { status: 500 })
}
