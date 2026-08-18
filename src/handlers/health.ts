import { CORS_HEADERS } from "../config";

/**
 * Handles /health readiness and liveness probe requests.
 */
export function handleHealthRequest(): Response {
  return new Response(
    JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}
