import { describe, it, expect } from "vitest";
import {
  GAME_CATALOG,
  gamesForClass,
  makeQuestion,
  clampClass,
} from "./games";

const CLASSES = [4, 5, 6, 7];

describe("games catalog", () => {
  it("has unique game ids", () => {
    const ids = GAME_CATALOG.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every game declares a valid class range within 4..7", () => {
    for (const g of GAME_CATALOG) {
      expect(g.minClass).toBeGreaterThanOrEqual(4);
      expect(g.maxClass).toBeLessThanOrEqual(7);
      expect(g.minClass).toBeLessThanOrEqual(g.maxClass);
    }
  });
});

describe("gamesForClass", () => {
  it("returns only games appropriate for the given class", () => {
    for (const c of CLASSES) {
      const list = gamesForClass(c);
      expect(list.length).toBeGreaterThan(0);
      for (const g of list) {
        expect(c).toBeGreaterThanOrEqual(g.minClass);
        expect(c).toBeLessThanOrEqual(g.maxClass);
      }
    }
  });

  it("returns the full catalog when class is unknown", () => {
    expect(gamesForClass(null).length).toBe(GAME_CATALOG.length);
    expect(gamesForClass(undefined).length).toBe(GAME_CATALOG.length);
  });

  it("clamps out-of-range classes into 4..7", () => {
    expect(gamesForClass(2).length).toBe(gamesForClass(4).length);
    expect(gamesForClass(9).length).toBe(gamesForClass(7).length);
    expect(clampClass(2)).toBe(4);
    expect(clampClass(9)).toBe(7);
  });
});

describe("question generators", () => {
  it("produce valid questions for every game across all classes (many samples)", () => {
    for (const g of GAME_CATALOG) {
      for (const c of CLASSES) {
        for (let i = 0; i < 200; i++) {
          const q = makeQuestion(g.id, c);
          // Prompt present
          expect(typeof q.prompt).toBe("string");
          expect(q.prompt.length).toBeGreaterThan(0);
          // Exactly the expected number of options
          const expectedLen = g.kind === "truefalse" ? 2 : 4;
          expect(q.options.length).toBe(expectedLen);
          // Options are unique
          expect(new Set(q.options).size).toBe(q.options.length);
          // Answer index is valid and in range
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
        }
      }
    }
  });
});
