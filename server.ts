import app from "./src/app";
import { PORT, TELEGRAM_BOT_TOKEN } from "./src/config";
import { startTelegramPoller } from "./src/telegram/poll";
import { httpLogger } from "./src/utils/logger";
import { notifyAdmin } from "./src/utils/notifier";

export const handleRequest = app.fetch;

/**
 * Global process level exception catching to alert admin of unexpected backend crashes.
 */
process.on("unhandledRejection", (reason) => {
  httpLogger.error({ reason }, "[Process Error] Unhandled promise rejection");
  notifyAdmin({
    title: "Unhandled Promise Rejection",
    message: String(reason),
    level: "CRITICAL",
    error: reason,
  }).catch(() => {});
});

process.on("uncaughtException", (error) => {
  httpLogger.error({ error }, "[Process Error] Uncaught runtime exception");
  notifyAdmin({
    title: "Uncaught Runtime Exception",
    message: error.message,
    level: "CRITICAL",
    error,
  }).catch(() => {});
});

const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

httpLogger.info(
  { port: server.port, url: `http://localhost:${server.port}` },
  "Started development server"
);

if (process.env.NODE_ENV !== "production" && TELEGRAM_BOT_TOKEN) {
  startTelegramPoller();
}

export default server;

