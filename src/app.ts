import { Hono } from "hono";
import { cors } from "hono/cors";
import { join } from "node:path";
import { DATA_DIR } from "./config";
import { sanitizePath } from "./utils/security";

const app = new Hono();

// Structured JSON Logger Middleware
app.use("*", async (c, next) => {
  const start = performance.now();
  const method = c.req.method.toUpperCase();
  const path = c.req.path;
  const userAgent = c.req.header("user-agent") || undefined;
  const ip =
    c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || undefined;

  await next();

  const durationMs = Math.round((performance.now() - start) * 100) / 100;
  const status = c.res.status;

  const logPayload = {
    timestamp: new Date().toISOString(),
    level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    method,
    path,
    status,
    durationMs,
    userAgent,
    ip,
  };

  console.log(JSON.stringify(logPayload));
});

// CORS Middleware
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "HEAD", "OPTIONS"],
    allowHeaders: ["*"],
    maxAge: 86400,
  })
);

// Method Guard Middleware: Only allow GET, HEAD, and OPTIONS
app.use("*", async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    return c.text("Method Not Allowed", 405);
  }
  await next();
});

// GET / -> Plain text "Hello World"
app.get("/", (c) => c.text("Hello World"));

// GET /health -> JSON { status: "ok" }
app.get("/health", (c) => c.json({ status: "ok" }));

// GET /manifest.json -> Serves root data/manifest.json
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

// Fallback static file route for nested files in ./data
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
