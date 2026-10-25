import { describe, expect, it, vi } from "vitest";
import {
  createWithAvailableVidyaId,
  isUsernameConflict,
  VidyaIdUnavailable,
} from "./registration";
describe("safe registration", () => {
  it("retries an ID collision without changing its role prefix", async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 1 });
    expect(await createWithAvailableVidyaId("parent", insert)).toEqual({
      id: 1,
    });
    expect(insert).toHaveBeenCalledTimes(2);
    for (const [id] of insert.mock.calls) expect(id).toMatch(/^VG-PAR-\d{5}$/);
  });
  it("bounds retries rather than hanging", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    await expect(
      createWithAvailableVidyaId("student", insert),
    ).rejects.toBeInstanceOf(VidyaIdUnavailable);
    expect(insert).toHaveBeenCalledTimes(5);
  });
  it("does not retry unrelated database failures", async () => {
    const error = new Error("offline");
    const insert = vi.fn().mockRejectedValue(error);
    await expect(createWithAvailableVidyaId("tutor", insert)).rejects.toBe(
      error,
    );
    expect(insert).toHaveBeenCalledTimes(1);
  });
  it("recognises wrapped username conflicts without hiding other constraint failures", () => {
    expect(
      isUsernameConflict({
        cause: { code: "23505", constraint: "users_name_unique" },
      }),
    ).toBe(true);
    expect(
      isUsernameConflict({
        code: "23505",
        constraint: "users_vidya_id_unique",
      }),
    ).toBe(false);
    expect(isUsernameConflict(null)).toBe(false);
  });
});
