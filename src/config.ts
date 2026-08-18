import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const PORT = Number.parseInt(process.env.PORT || "3000", 10);

const resolveDataDir = (): string => {
  if (process.env.DATA_DIR) {
    return resolve(process.env.DATA_DIR);
  }

  // 1. Check relative to current file execution directory (e.g. dist/data when bundled)
  const metaDirData = resolve(import.meta.dir || "", "data");
  if (existsSync(metaDirData)) {
    return metaDirData;
  }

  // 2. Check process.cwd()/dist/data
  const rootDistData = resolve(process.cwd(), "dist/data");
  if (existsSync(rootDistData)) {
    return rootDistData;
  }

  // 3. Fallback to process.cwd()/data
  return resolve(process.cwd(), "data");
};

export const DATA_DIR = resolveDataDir();

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export const CACHE_CONTROL =
  process.env.CACHE_CONTROL || "public, max-age=3600";
