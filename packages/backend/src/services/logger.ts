/** Logger service — Pino-based structured logging with file and stdout streams. */
import pino from 'pino'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
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

  // Ensure log directory exists
  if (logFile) {
    const logDir = dirname(logFile)
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
  }

  // Base configuration
  const options: pino.LoggerOptions = {
    level: logLevel,
  }

  const usePretty = logFormat === 'pretty'

  // Configure transport for pretty printing and/or file output
  if (usePretty && logFile) {
    // Both pretty printing and file output: use multiple targets in transport
    options.transport = {
      targets: [
        {
          target: 'pino-pretty',
          level: logLevel,
          options: {
            destination: 1, // stdout
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
        {
          target: 'pino/file',
          level: logLevel,
          options: {
            destination: logFile,
          },
        },
      ],
    }
  } else if (usePretty) {
    // Pretty printing only (stdout)
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
  } else if (logFile) {
    // File output only (JSON format): use multistream
    const streams: pino.StreamEntry[] = [
      { stream: process.stdout },
      { stream: pino.destination(logFile) },
    ]
    return pino(options, pino.multistream(streams))
  }

  return pino(options)
}

export const logger = createLogger()
