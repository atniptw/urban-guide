/**
 * Simple logging utility for the workflow engine
 * Provides structured logging with levels and formatting
 */
/* eslint-disable no-console */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Console-based logger implementation
 */
export class ConsoleLogger implements Logger {
  constructor(private minLevel: LogLevel = LogLevel.INFO) {}

  debug(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

/**
 * Silent logger for testing or when logging is disabled
 */
export class SilentLogger implements Logger {
  debug(_message: string, ..._args: unknown[]): void {
    // No-op
  }

  info(_message: string, ..._args: unknown[]): void {
    // No-op
  }

  warn(_message: string, ..._args: unknown[]): void {
    // No-op
  }

  error(_message: string, ..._args: unknown[]): void {
    // No-op
  }
}

// Default logger instance
export const logger: Logger = new ConsoleLogger(LogLevel.INFO);
