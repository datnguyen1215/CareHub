/** Logger service — Pino-based structured logging with file and stdout streams. */
import pino from 'pino'
import { env } from '../config/env'

/**
 * Creates a configured pino logger instance.
 * @returns {pino.Logger} Configured pino logger
 */
export function createLogger(): pino.Logger {
  const isDev = env.NODE_ENV === 'development'
  const logLevel = env.LOG_LEVEL
  const logFormat = env.LOG_FORMAT
  const logFile = env.LOG_FILE

  // Base configuration
  const options: pino.LoggerOptions = {
    level: logLevel,
  }

  // In development with pretty format, or when explicitly requested
  if ((isDev && logFormat === 'pretty') || logFormat === 'pretty') {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
  }

  // If log file is specified, use multistream
  if (logFile) {
    const streams: pino.StreamEntry[] = [
      { stream: process.stdout },
      { stream: pino.destination(logFile) },
    ]

    return pino(options, pino.multistream(streams))
  }

  return pino(options)
}

export const logger = createLogger()
