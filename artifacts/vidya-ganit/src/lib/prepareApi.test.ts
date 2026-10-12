import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function setup() {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "");
  const fetcher = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetcher);
  const { prepareApi } = await import("./prepareApi");
  return { prepareApi, fetcher };
}
describe("API preparation", () => {
  it("shares one request across simultaneous page mounts and later navigation", async () => {
    const { prepareApi, fetcher } = await setup();
    const first = prepareApi();
    expect(prepareApi()).toBe(first);
    await first;
    await prepareApi();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/readyz",
      expect.objectContaining({ cache: "no-store", credentials: "include" }),
    );
  });
  it("does not make recurring requests and prepares again only on navigation after five minutes", async () => {
    vi.useFakeTimers();
    const { prepareApi, fetcher } = await setup();
    await prepareApi();
    await vi.advanceTimersByTimeAsync(6 * 60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await prepareApi();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("swallows network failures and allows a subsequent attempt", async () => {
    const { prepareApi, fetcher } = await setup();
    fetcher.mockRejectedValueOnce(new Error("offline"));
    await expect(prepareApi()).resolves.toBeUndefined();
    await prepareApi();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not cache a failed readiness response", async () => {
    const { prepareApi, fetcher } = await setup();
    fetcher.mockResolvedValueOnce({ ok: false });
    await prepareApi();
    await prepareApi();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("uses the same configured API origin as account requests", async () => {
    const { prepareApi, fetcher } = await setup();
    vi.stubEnv("VITE_API_URL", "https://api.example.test/");
    await prepareApi();
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.example.test/api/readyz",
    );
  });
});
