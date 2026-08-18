import { describe, expect, test } from "bun:test";
import { handleRequest } from "../index";
import { sanitizePath } from "../src/utils/security";

describe("Bun Static File Server - Integration Tests", () => {
  test("GET /health returns 200 OK", async () => {
    const req = new Request("http://localhost/health");
    const res = await handleRequest(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe("ok");
  });

  test("GET / returns Hello World", async () => {
    const req = new Request("http://localhost/");
    const res = await handleRequest(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toBe("Hello World");
  });

  test("GET /manifest.json serves manifest.json file", async () => {
    const req = new Request("http://localhost/manifest.json");
    const res = await handleRequest(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test("GET /2019/English/day-info.json serves nested file", async () => {
    const req = new Request("http://localhost/2019/English/day-info.json");
    const res = await handleRequest(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test("GET non-existent file returns 404", async () => {
    const req = new Request("http://localhost/does-not-exist.json");
    const res = await handleRequest(req);
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("File Not Found");
  });

  test("GET path traversal /../package.json is forbidden (403 or 404)", async () => {
    const req = new Request("http://localhost/../package.json");
    const res = await handleRequest(req);
    expect([403, 404]).toContain(res.status);
  });

  test("HEAD request returns headers without body", async () => {
    const req = new Request("http://localhost/manifest.json", {
      method: "HEAD",
    });
    const res = await handleRequest(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBeDefined();
    const text = await res.text();
    expect(text).toBe("");
  });

  test("OPTIONS request handles CORS preflight", async () => {
    const req = new Request("http://localhost/manifest.json", {
      method: "OPTIONS",
    });
    const res = await handleRequest(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("POST request returns 405 Method Not Allowed", async () => {
    const req = new Request("http://localhost/manifest.json", {
      method: "POST",
    });
    const res = await handleRequest(req);
    expect(res.status).toBe(405);
  });
});

describe("Security Utils - Unit Tests", () => {
  test("sanitizePath rejects directory traversal attempts", () => {
    const baseDir = "/app/data";
    const result = sanitizePath("/../package.json", baseDir);
    expect(result.isValid).toBe(false);
  });

  test("sanitizePath validates normal path within directory", () => {
    const baseDir = "/app/data";
    const result = sanitizePath("/2019/manifest.json", baseDir);
    expect(result.isValid).toBe(true);
    expect(result.targetPath).toBe("/app/data/2019/manifest.json");
  });
});
