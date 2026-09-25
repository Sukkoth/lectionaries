import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Global structured logger instance powered by Pino.
 * Emits raw JSON lines for high performance and clean piping to jq in development.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: undefined,
});

/**
 * Dedicated child loggers for subsystems.
 */
export const httpLogger = logger.child({ module: "http" });
export const botLogger = logger.child({ module: "bot" });
export const cronLogger = logger.child({ module: "cron" });
export const dbLogger = logger.child({ module: "db" });
