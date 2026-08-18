import { join } from "node:path";
import { CACHE_CONTROL, CORS_HEADERS, DATA_DIR } from "../config";
import { sanitizePath } from "../utils/security";

/**
 * Serves static files dynamically from DATA_DIR.
 * Performs zero-copy streaming, security validation, and supports GET/HEAD/OPTIONS.
 */
export async function handleStaticFileRequest(req: Request): Promise<Response> {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only GET and HEAD methods allowed
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        Allow: "GET, HEAD, OPTIONS",
      },
    });
  }

  const url = new URL(req.url);

  // Sanitize path and verify security boundaries
  const { targetPath, isValid } = sanitizePath(url.pathname, DATA_DIR);
  if (!isValid) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  }

  let file = Bun.file(targetPath);
  let exists = await file.exists();

  // If path target is a directory, look for index.json inside
  if (!exists) {
    const indexPath = join(targetPath, "index.json");
    const indexFile = Bun.file(indexPath);
    if (await indexFile.exists()) {
      file = indexFile;
      exists = true;
    }
  }

  if (!exists) {
    return new Response(
      JSON.stringify({ error: "File Not Found", path: url.pathname }),
      {
        status: 404,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
      }
    );
  }

  const headers = new Headers(CORS_HEADERS);
  headers.set("Cache-Control", CACHE_CONTROL);

  // HEAD requests return headers only
  if (req.method === "HEAD") {
    headers.set("Content-Type", file.type || "application/octet-stream");
    headers.set("Content-Length", String(file.size));
    return new Response(null, { status: 200, headers });
  }

  // Zero-copy file response
  return new Response(file, {
    status: 200,
    headers,
  });
}
