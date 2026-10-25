import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@workspace/db", () => ({ db: { execute } }));
afterEach(() => {
  vi.restoreAllMocks();
});
async function setup() {
  vi.resetModules();
  execute.mockReset().mockResolvedValue({ rows: [{ result: 1 }] });
  const { default: health } = await import("./health");
  const app = express();
  app.use("/api", health);
  return app;
}
describe("readiness", () => {
  it("prepares the database without authentication and caches success briefly", async () => {
    const app = await setup();
    const clock = vi.spyOn(Date, "now").mockReturnValue(100_000);
    for (let i = 0; i < 2; i++) {
      const result = await request(app).get("/api/readyz");
      expect(result.status).toBe(204);
      expect(result.headers["cache-control"]).toBe("no-store");
    }
    expect(execute).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(131_000);
    expect((await request(app).get("/api/readyz")).status).toBe(204);
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it("returns a generic failure and retries without exposing database errors", async () => {
    const app = await setup();
    execute.mockRejectedValueOnce(new Error("secret connection details"));
    const result = await request(app).get("/api/readyz");
    expect(result.status).toBe(503);
    expect(result.text).not.toContain("secret");
    expect((await request(app).get("/api/readyz")).status).toBe(204);
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it("keeps the liveness check independent of the database", async () => {
    const app = await setup();
    expect((await request(app).get("/api/healthz")).status).toBe(200);
    expect(execute).not.toHaveBeenCalled();
  });
});
