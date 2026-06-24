import { describe, expect, it } from "vitest";
import { CLASS_TOPICS, TOPIC_I18N, topicsForClass } from "./worksheetTopics";
import { DICTS } from "./i18n";

// Guards the worksheet topic catalog (a client-side mirror of the api-server
// NCERT curriculum) against drift: every class must offer only its own topics,
// and every topic must have an i18n label that exists in every dictionary.
describe("worksheetTopics", () => {
  it("constrains topics to each class curriculum", () => {
    expect(topicsForClass("4")).toEqual(CLASS_TOPICS["4"]);
    expect(topicsForClass("6")).toEqual(CLASS_TOPICS["6"]);
    expect(topicsForClass("7")).toEqual(CLASS_TOPICS["7"]);
  });

  it("excludes advanced topics from Class 4 and includes them from Class 6", () => {
    for (const t of ["ratio", "algebra", "percent", "decimal"]) {
      expect(CLASS_TOPICS["4"]).not.toContain(t);
    }
    for (const t of ["ratio", "percent", "algebra"]) {
      expect(CLASS_TOPICS["6"]).toContain(t);
    }
  });

  it("falls back to all topics for an unknown class", () => {
    const all = topicsForClass(null);
    expect(all.length).toBe(Object.keys(TOPIC_I18N).length);
    for (const list of Object.values(CLASS_TOPICS)) {
      for (const t of list) expect(all).toContain(t);
    }
  });

  it("every topic has an i18n key present in all dictionaries", () => {
    const topics = new Set(Object.values(CLASS_TOPICS).flat());
    for (const topic of topics) {
      const key = TOPIC_I18N[topic];
      expect(key, `${topic} missing TOPIC_I18N entry`).toBeTruthy();
      for (const [lang, dict] of Object.entries(DICTS)) {
        expect(
          (dict as Record<string, string>)[key],
          `${key} missing in ${lang}`,
        ).toBeTruthy();
      }
    }
  });
});
