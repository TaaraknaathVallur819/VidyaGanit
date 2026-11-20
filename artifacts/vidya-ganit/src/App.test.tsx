import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

// A component that calls useLanguage() but is mounted outside <LanguageProvider>
// throws on the very first render and turns the whole site into a blank page.
// Neither typechecking nor the unit tests can see that, so render the real App.

const saved: Record<string, unknown> = {};
const stubs: Record<string, unknown> = {
  localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  sessionStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  location: { pathname: "/", search: "", hash: "", href: "http://localhost/", origin: "http://localhost" },
  matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => true,
};

beforeAll(() => {
  for (const [k, v] of Object.entries(stubs)) {
    saved[k] = (globalThis as Record<string, unknown>)[k];
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  }
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true, writable: true });
});

afterAll(() => {
  for (const k of Object.keys(stubs)) {
    Object.defineProperty(globalThis, k, { value: saved[k], configurable: true, writable: true });
  }
});

describe("the whole app", () => {
  it("renders on first load without throwing (every useLanguage() consumer is inside its provider)", async () => {
    const { default: App } = await import("./App");
    let html = "";
    expect(() => {
      html = renderToString(<App />);
    }).not.toThrow();
    // Not a blank page: the shared header renders.
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("VidyaGanit");
  }, 90_000);
});
