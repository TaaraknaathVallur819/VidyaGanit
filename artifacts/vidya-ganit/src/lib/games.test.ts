import { describe, it, expect } from "vitest";
import {
  GAME_CATALOG,
  gamesForClass,
  makeQuestion,
  clampClass,
  type GameDef,
} from "./games";
import {
  timerFor,
  gamesForClassBoard,
  boardProfileId,
  boardShortLabel,
} from "./syllabus";

describe("game catalog integrity", () => {
  it("has 21 games", () => {
    expect(GAME_CATALOG).toHaveLength(21);
  });

  it("every game has unique id, sane class range and complexity 1..5", () => {
    const ids = new Set<string>();
    for (const g of GAME_CATALOG) {
      expect(ids.has(g.id), `duplicate id ${g.id}`).toBe(false);
      ids.add(g.id);
      expect(g.minClass).toBeGreaterThanOrEqual(4);
      expect(g.maxClass).toBeLessThanOrEqual(7);
      expect(g.minClass).toBeLessThanOrEqual(g.maxClass);
      expect(g.complexity).toBeGreaterThanOrEqual(1);
      expect(g.complexity).toBeLessThanOrEqual(5);
      expect(g.nameKey).toMatch(/^games\./);
      expect(g.descKey).toMatch(/^games\./);
      expect(typeof g.emoji).toBe("string");
      expect(g.emoji.length).toBeGreaterThan(0);
    }
  });

  it("includes the 8 new syllabus-mapped games", () => {
    const ids = new Set(GAME_CATALOG.map((g) => g.id));
    for (const id of [
      "multiples",
      "primes",
      "money",
      "average",
      "hcflcm",
      "ratio",
      "mensuration",
      "interest",
    ]) {
      expect(ids.has(id as never), `missing ${id}`).toBe(true);
    }
  });
});

describe("gamesForClass", () => {
  it("only returns games matching the class range", () => {
    for (let cls = 4; cls <= 7; cls++) {
      for (const g of gamesForClass(cls)) {
        expect(cls).toBeGreaterThanOrEqual(g.minClass);
        expect(cls).toBeLessThanOrEqual(g.maxClass);
      }
    }
  });

  it("returns the full catalog when class is unknown", () => {
    expect(gamesForClass(null)).toHaveLength(GAME_CATALOG.length);
  });
});

describe("gamesForClassBoard", () => {
  it("keeps the same set as gamesForClass (only reorders)", () => {
    for (const board of ["CBSE", "ICSE", "IB", "Tamil Nadu State Board"]) {
      for (let cls = 4; cls <= 7; cls++) {
        const plain = gamesForClass(cls)
          .map((g) => g.id)
          .sort();
        const tailored = gamesForClassBoard(cls, board)
          .map((g) => g.id)
          .sort();
        expect(tailored).toEqual(plain);
      }
    }
  });

  it("moves a board's emphasised topics toward the front when present", () => {
    // ICSE emphasises fractions; in Class 7 it should outrank a non-emphasised
    // game like 'speed'.
    const ids = gamesForClassBoard(7, "ICSE").map((g) => g.id);
    if (ids.includes("fractions") && ids.includes("speed")) {
      expect(ids.indexOf("fractions")).toBeLessThan(ids.indexOf("speed"));
    }
  });
});

describe("boardProfileId / boardShortLabel", () => {
  it("maps known boards to the expected profile", () => {
    expect(boardProfileId("ICSE")).toBe("icse");
    expect(boardProfileId("")).toBe("cbse");
    expect(boardProfileId(null)).toBe("cbse");
    expect(boardProfileId("IB Diploma Programme")).toBe("international");
  });

  it("produces a compact label", () => {
    expect(boardShortLabel(null)).toBe("CBSE");
    expect(boardShortLabel("ICSE (Indian Certificate)")).toBe("ICSE");
    expect(boardShortLabel("CBSE – Central Board")).toBe("CBSE");
  });
});

describe("timerFor", () => {
  const cbseDef = (complexity: GameDef["complexity"]): GameDef => ({
    id: "speed",
    emoji: "x",
    nameKey: "games.speed.name",
    descKey: "games.speed.desc",
    kind: "mcq",
    minClass: 4,
    maxClass: 7,
    complexity,
    make: () => ({ prompt: "", options: ["1"], answer: 0 }),
  });

  it("is always clamped to 15..70 seconds", () => {
    for (const g of GAME_CATALOG) {
      for (let cls = 4; cls <= 7; cls++) {
        for (const board of ["CBSE", "ICSE", "IB"]) {
          const t = timerFor(g, cls, board);
          expect(t).toBeGreaterThanOrEqual(15);
          expect(t).toBeLessThanOrEqual(70);
        }
      }
    }
  });

  it("grows monotonically with complexity", () => {
    let prev = 0;
    for (let c = 1; c <= 5; c++) {
      const t = timerFor(cbseDef(c as GameDef["complexity"]), 5, "CBSE");
      expect(t).toBeGreaterThan(prev);
      prev = t;
    }
  });

  it("gives ICSE/international more (or equal) time than CBSE for the same game", () => {
    for (const g of GAME_CATALOG) {
      const cbse = timerFor(g, 6, "CBSE");
      const icse = timerFor(g, 6, "ICSE");
      const intl = timerFor(g, 6, "IB");
      expect(icse).toBeGreaterThanOrEqual(cbse);
      expect(intl).toBeGreaterThanOrEqual(cbse);
    }
  });
});

describe("generator answer correctness (sampled)", () => {
  it("every game's answer index is valid and options are well-formed", () => {
    for (const g of GAME_CATALOG) {
      for (let cls = clampClass(g.minClass); cls <= g.maxClass; cls++) {
        for (let i = 0; i < 60; i++) {
          const q = makeQuestion(g.id, cls);
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
          // No duplicate options (would make the MCQ ambiguous).
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.prompt.length).toBeGreaterThan(0);
          if (g.kind === "truefalse") {
            expect(q.options).toEqual(["true", "false"]);
          }
        }
      }
    }
  });

  it("primes game labels prime numbers as true and composites as false", () => {
    const isPrime = (n: number) => {
      if (n < 2) return false;
      for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
      return true;
    };
    for (let i = 0; i < 200; i++) {
      const q = makeQuestion("primes", 7);
      const n = Number(q.prompt);
      expect(Number.isFinite(n)).toBe(true);
      // answer 0 = true (prime), 1 = false (composite)
      expect(q.answer === 0).toBe(isPrime(n));
    }
  });
});
