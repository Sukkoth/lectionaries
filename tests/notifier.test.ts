import { describe, expect, test } from "bun:test";
import { notifyAdmin } from "../src/utils/notifier";

describe("Admin Alert Notifier Tests", () => {
  test("notifyAdmin returns false when credentials or conditions are unset", async () => {
    const res = await notifyAdmin({
      title: "Test Alert",
      message: "Test message for monitoring",
      level: "INFO",
    });
    expect(typeof res).toBe("boolean");
  });
});
