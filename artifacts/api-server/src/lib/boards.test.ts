import { describe, expect, it } from "vitest";
import {
  BOARD_CATEGORY_ORDER,
  boardsByCategory,
  INDIA_BOARDS,
  summarizeBoardsForPrompt,
} from "@workspace/india-boards";

describe("INDIA_BOARDS catalog", () => {
  it("has unique, non-empty values and labels", () => {
    const values = new Set<string>();
    for (const b of INDIA_BOARDS) {
      expect(b.value.trim()).not.toBe("");
      expect(b.label.trim()).not.toBe("");
      expect(values.has(b.value)).toBe(false);
      values.add(b.value);
    }
  });

  it("covers every category and all 28 Indian states", () => {
    const cats = new Set(INDIA_BOARDS.map((b) => b.category));
    for (const c of BOARD_CATEGORY_ORDER) expect(cats.has(c)).toBe(true);
    const stateRegions = new Set(
      INDIA_BOARDS.filter((b) => b.category === "state").map((b) => b.region),
    );
    expect(stateRegions.size).toBe(28);
  });

  it("covers all 8 Union Territory boards", () => {
    const utRegions = new Set(
      INDIA_BOARDS.filter((b) => b.category === "ut").map((b) => b.region),
    );
    for (const ut of [
      "Jammu & Kashmir",
      "Delhi",
      "Puducherry",
      "Chandigarh",
      "Andaman & Nicobar Islands",
      "Dadra & Nagar Haveli and Daman & Diu",
      "Lakshadweep",
      "Ladakh",
    ]) {
      expect(utRegions.has(ut)).toBe(true);
    }
    expect(utRegions.size).toBe(8);
  });

  it("keeps backward-compatible values for previously stored boards", () => {
    const values = new Set(INDIA_BOARDS.map((b) => b.value));
    for (const legacy of [
      "CBSE",
      "ICSE",
      "Maharashtra State Board",
      "Tamil Nadu State Board",
      "UP Board (UPMSP)",
      "West Bengal Board",
      "Bihar Board (BSEB)",
      "MP Board (MPBSE)",
      "Other",
    ]) {
      expect(values.has(legacy)).toBe(true);
    }
  });
});

describe("boardsByCategory", () => {
  it("groups boards in display order, no empty groups, excludes Other", () => {
    const groups = boardsByCategory();
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.boards.length).toBeGreaterThan(0);
    expect(groups.flatMap((g) => g.boards).some((b) => b.value === "Other")).toBe(
      false,
    );
  });
});

describe("summarizeBoardsForPrompt", () => {
  it("enumerates the full Indian board landscape for AI priming", () => {
    const text = summarizeBoardsForPrompt();
    expect(text).toContain("NCERT-aligned");
    for (const needle of [
      "CBSE",
      "Maharashtra",
      "Tripura",
      "Jammu & Kashmir",
      "Madrasa",
    ]) {
      expect(text).toContain(needle);
    }
  });
});
