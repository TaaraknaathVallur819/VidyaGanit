import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
vi.mock("@workspace/db", () => ({ db: {}, usersTable: {} }));
vi.mock("../lib/session", () => ({
  SESSION_COOKIE: "vg_session",
  SESSION_MAX_AGE_MS: 2592000000,
  signSession: () => "",
}));
vi.mock("../lib/email", () => ({ sendPasswordResetEmail: vi.fn() }));
import auth from "./auth";
describe("logout", () => {
  it("expires the login cookie and is idempotent", async () => {
    const app = express();
    app.use("/api", auth);
    for (let i = 0; i < 2; i++) {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", "vg_session=test");
      expect(res.status).toBe(204);
      const cookie = String(res.headers["set-cookie"]);
      expect(cookie).toContain("vg_session=;");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
    }
  });
});
