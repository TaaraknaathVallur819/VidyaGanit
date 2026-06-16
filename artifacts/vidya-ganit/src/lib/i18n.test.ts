import { describe, expect, it } from "vitest";
import { DICTS, LANGUAGES, type Language } from "./i18n";

const LANG_CODES = LANGUAGES.map((l) => l.code);
const BASE: Language = "en";
const baseKeys = Object.keys(DICTS[BASE]).sort();

// Every language code the UI advertises (LANGUAGES) and every dictionary in
// DICTS must line up, and every non-English dictionary must declare exactly the
// same key set as the English base. This is the guard that catches an
// untranslated string slipping into a future change across any language.
const NON_BASE = (Object.keys(DICTS) as Language[]).filter((c) => c !== BASE);

// The four languages whose translations were manually verified end-to-end; for
// these we additionally assert the value is not the English string verbatim.
const VERIFIED: Language[] = ["ta", "hi", "te"];

describe("i18n dictionaries", () => {
  it("every advertised language has a dictionary and vice versa", () => {
    const dictCodes = Object.keys(DICTS).sort();
    expect([...LANG_CODES].sort()).toEqual(dictCodes);
    for (const code of ["en", "ta", "hi", "te"] as const) {
      expect(LANG_CODES).toContain(code);
      expect(DICTS[code]).toBeDefined();
    }
  });

  it("the base (English) dictionary is non-empty", () => {
    expect(baseKeys.length).toBeGreaterThan(0);
  });

  for (const code of NON_BASE) {
    describe(`${code} dictionary`, () => {
      const keys = Object.keys(DICTS[code]).sort();

      it("has no missing keys vs. English", () => {
        const missing = baseKeys.filter((k) => !(k in DICTS[code]));
        expect(missing).toEqual([]);
      });

      it("has no extra/stale keys vs. English", () => {
        const extra = keys.filter((k) => !(k in DICTS[BASE]));
        expect(extra).toEqual([]);
      });

      it("has a non-empty translation for every key", () => {
        const blank = keys.filter((k) => DICTS[code][k].trim() === "");
        expect(blank).toEqual([]);
      });

      if (VERIFIED.includes(code)) {
        it("does not accidentally reuse the English string verbatim", () => {
          // Placeholders / symbol-only values can legitimately match across
          // languages, so only flag longer alphabetic strings that are
          // identical to English — a strong signal the key was left
          // untranslated.
          const suspicious = keys.filter((k) => {
            const base = DICTS[BASE][k];
            const val = DICTS[code][k];
            if (val !== base) return false;
            return (
              base.length > 12 &&
              /[a-zA-Z]/.test(base.replace(/VidyaGanit/g, ""))
            );
          });
          expect(suspicious).toEqual([]);
        });
      }
    });
  }
});
