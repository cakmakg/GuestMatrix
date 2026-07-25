import 'server-only'

/* eslint-disable no-console */

type Level = 'info' | 'warn' | 'error'

type LogMeta = Record<string, unknown>

function log(level: Level, message: string, meta?: LogMeta): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  }

  if (process.env.NODE_ENV === 'production') {
    // Strukturiertes JSON für Log-Aggregatoren (Vercel, Datadog, etc.)
    const output = JSON.stringify(entry)
    if (level === 'error') console.error(output)
    else if (level === 'warn') console.warn(output)
    else console.log(output)
  } else {
    const prefix = `[${level.toUpperCase()}]`
    if (level === 'error') console.error(prefix, message, meta ?? '')
    else if (level === 'warn') console.warn(prefix, message, meta ?? '')
    else console.log(prefix, message, meta ?? '')
  }
}

export const logger = {
  info: (message: string, meta?: LogMeta): void => log('info', message, meta),
  warn: (message: string, meta?: LogMeta): void => log('warn', message, meta),
  error: (message: string, meta?: LogMeta): void => log('error', message, meta),
}
