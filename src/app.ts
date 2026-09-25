import { Hono } from "hono";
import { cors } from "hono/cors";
import { join } from "node:path";
import { DATA_DIR } from "./config";
import { handleTelegramCron } from "./telegram/cron";
import { handleTelegramWebhook } from "./telegram/webhook";
import { httpLogger } from "./utils/logger";
import { notifyAdmin } from "./utils/notifier";
import { sanitizePath } from "./utils/security";

const app = new Hono();

/**
 * Global Error Handler: Logs unexpected 500 exceptions and dispatches direct alert to Telegram admin.
 */
app.onError(async (err, c) => {
  const method = c.req.method.toUpperCase();
  const path = c.req.path;
  const ip =
    c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || undefined;

  httpLogger.error(
    { err, method, path, ip },
    `[HTTP Exception] Unhandled server error on ${method} ${path}: ${err.message}`
  );

  notifyAdmin({
    title: `HTTP 500 Error: ${method} ${path}`,
    message: err.message || "Unhandled exception in request handler",
    level: "ERROR",
    error: err,
    context: {
      method,
      path,
      ip,
      userAgent: c.req.header("user-agent"),
    },
  }).catch(() => {});

  return c.json(
    {
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    },
    500
  );
});

/**
 * Structured HTTP Request Logger Middleware using Pino.
 */
app.use("*", async (c, next) => {
  const start = performance.now();
  const method = c.req.method.toUpperCase();
  const path = c.req.path;
  const ip =
    c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || undefined;

  await next();

  const durationMs = Math.round((performance.now() - start) * 100) / 100;
  const status = c.res.status;

  const meta = {
    method,
    path,
    status,
    durationMs,
    ip,
  };

  if (status >= 500) {
    httpLogger.error(meta, `${method} ${path} -> ${status} (${durationMs}ms)`);
  } else if (status >= 400) {
    httpLogger.warn(meta, `${method} ${path} -> ${status} (${durationMs}ms)`);
  } else {
    httpLogger.info(meta, `${method} ${path} -> ${status} (${durationMs}ms)`);
  }
});

/**
 * CORS Middleware configuration.
 */
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "HEAD", "OPTIONS", "POST"],
    allowHeaders: ["*"],
    maxAge: 86400,
  })
);

/**
 * Telegram Bot Webhook endpoint.
 */
app.post("/api/telegram/webhook", handleTelegramWebhook);

/**
 * Vercel Cron trigger endpoint.
 */
app.get("/api/telegram/cron", handleTelegramCron);
app.post("/api/telegram/cron", handleTelegramCron);

/**
 * Method Guard Middleware: Allow mutating methods only for Telegram API endpoints.
 */
app.use("*", async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    !c.req.path.startsWith("/api/telegram/")
  ) {
    return c.text("Method Not Allowed", 405);
  }
  await next();
});

/**
 * Root health and status check endpoints.
 */
app.get("/", (c) => c.text("Hello World"));
app.get("/health", (c) => c.json({ status: "ok" }));

/**
 * Serves root catalog manifest.json.
 */
app.get("/manifest.json", async (c) => {
  const filePath = join(DATA_DIR, "manifest.json");
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return c.json({ error: "File Not Found" }, 404);
  }

  if (c.req.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const json = await file.json();
  return c.json(json);
});

/**
 * Fallback static file route for nested files in ./data.
 */
app.all("*", async (c) => {
  const reqPath = c.req.path;
  const { targetPath, isValid } = sanitizePath(reqPath, DATA_DIR);

  if (!isValid) {
    return c.json({ error: "Forbidden: Invalid path" }, 403);
  }

  const file = Bun.file(targetPath);

  if (!(await file.exists())) {
    return c.json({ error: "File Not Found" }, 404);
  }

  if (c.req.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": targetPath.endsWith(".json")
          ? "application/json"
          : "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const json = await file.json();
  return c.json(json);
});

export default app;
