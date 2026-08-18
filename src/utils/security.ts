import { normalize, resolve } from "node:path";

export interface PathSanitizationResult {
  targetPath: string;
  isValid: boolean;
}

/**
 * Decodes, normalizes, and verifies that the requested pathname
 * stays strictly within the specified base directory (DATA_DIR).
 */
export function sanitizePath(
  pathname: string,
  baseDir: string
): PathSanitizationResult {
  try {
    const decodedPath = decodeURIComponent(pathname);

    // Explicitly reject paths with parent directory traversal segments ("..")
    const hasTraversal = decodedPath
      .split(/[\/\\]/)
      .some((segment) => segment === "..");

    const absoluteBase = resolve(baseDir);
    const normalizedPath = normalize(decodedPath);
    const targetPath = resolve(
      absoluteBase,
      `.${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`
    );

    const isValid =
      !hasTraversal &&
      (targetPath === absoluteBase ||
        targetPath.startsWith(absoluteBase + "/"));

    return { targetPath, isValid };
  } catch {
    return { targetPath: "", isValid: false };
  }
}
