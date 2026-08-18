import { resolve } from "node:path";

export const PORT = Number.parseInt(process.env.PORT || "3000", 10);
export const DATA_DIR = resolve(process.env.DATA_DIR || "./data");

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export const CACHE_CONTROL =
  process.env.CACHE_CONTROL || "public, max-age=3600";
