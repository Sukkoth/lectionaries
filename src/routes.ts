import { CORS_HEADERS } from "./config";
import { handleHealthRequest } from "./handlers/health";
import { handleStaticFileRequest } from "./handlers/static";

/**
 * Main request fetch handler (suitable for serverless function entry points).
 */
export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/") {
    return new Response("Hello World", {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  if (url.pathname === "/health") {
    return handleHealthRequest();
  }

  return handleStaticFileRequest(req);
}

/**
 * Native Bun routes object for Bun.serve
 */
export const routes = {
  "/": new Response("Hello World", {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
    },
  }),
  "/health": handleHealthRequest,
};
