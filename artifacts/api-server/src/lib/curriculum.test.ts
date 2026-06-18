import { describe, expect, it } from "vitest";
import {
  buildSyllabusKnowledge,
  CURRICULUM,
  CURRICULUM_CLASSES,
  getCurriculum,
  normalizeCurriculumClass,
  recommendNextLessons,
} from "./curriculum";

describe("curriculum data", () => {
  it("has ordered, non-empty units with lessons for every class 4–7", () => {
    for (const cls of CURRICULUM_CLASSES) {
      const units = CURRICULUM[cls];
      expect(units.length).toBeGreaterThan(0);
      for (const u of units) {
        expect(u.id).toBeTruthy();
        expect(u.title).toBeTruthy();
        expect(u.lessons.length).toBeGreaterThan(0);
      }
    }
  });

  it("normalizes known classes and rejects unknown values", () => {
    expect(normalizeCurriculumClass("5")).toBe("5");
    expect(normalizeCurriculumClass(" 6 ")).toBe("6");
    expect(normalizeCurriculumClass("9")).toBeNull();
    expect(normalizeCurriculumClass(null)).toBeNull();
    expect(normalizeCurriculumClass(7)).toBeNull();
  });

  it("returns an empty unit list for an unknown class", () => {
    expect(getCurriculum("9")).toEqual([]);
  });
});

describe("recommendNextLessons", () => {
  it("returns nothing for an unknown class", () => {
    const { recommendations, allMastered } = recommendNextLessons(
      null,
      new Map(),
      new Map(),
    );
    expect(recommendations).toEqual([]);
    expect(allMastered).toBe(false);
  });

  it("flags untouched topics as not_started", () => {
    const { recommendations } = recommendNextLessons("4", new Map(), new Map());
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(3);
    expect(recommendations[0].reason).toBe("not_started");
  });

  it("treats a strong test score as mastered even with no chat practice", () => {
    // First unit of class 4 is add_subtract; a perfect test should master it.
    const firstTopic = CURRICULUM["4"][0].topic;
    const { recommendations } = recommendNextLessons(
      "4",
      new Map(),
      new Map([[firstTopic, 100]]),
    );
    // The mastered topic must not be recommended again.
    expect(recommendations.some((r) => r.topic === firstTopic)).toBe(false);
  });

  it("recommends a topic with a low test score as low_score despite practice", () => {
    const firstTopic = CURRICULUM["4"][0].topic;
    const { recommendations } = recommendNextLessons(
      "4",
      new Map([[firstTopic, 50]]), // lots of practice
      new Map([[firstTopic, 20]]), // but failing the test
    );
    const rec = recommendations.find((r) => r.topic === firstTopic);
    expect(rec).toBeDefined();
    expect(rec?.reason).toBe("low_score");
  });

  it("marks all-mastered and suggests the next class as next_up", () => {
    // Master every topic in class 6 with perfect tests.
    const perfect = new Map<string, number>();
    for (const u of CURRICULUM["6"]) perfect.set(u.topic, 100);
    const { recommendations, allMastered } = recommendNextLessons(
      "6",
      new Map(),
      perfect,
    );
    expect(allMastered).toBe(true);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].reason).toBe("next_up");
  });

  it("marks all-mastered with no recommendation for the top class (7)", () => {
    const perfect = new Map<string, number>();
    for (const u of CURRICULUM["7"]) perfect.set(u.topic, 100);
    const { recommendations, allMastered } = recommendNextLessons(
      "7",
      new Map(),
      perfect,
    );
    expect(allMastered).toBe(true);
    expect(recommendations).toEqual([]);
  });

  it("caps recommendations at three", () => {
    const { recommendations } = recommendNextLessons("7", new Map(), new Map());
    expect(recommendations.length).toBeLessThanOrEqual(3);
  });
});

describe("buildSyllabusKnowledge", () => {
  it("names the major Indian boards", () => {
    const text = buildSyllabusKnowledge("5", "CBSE");
    expect(text).toContain("CBSE");
    expect(text).toContain("ICSE");
    expect(text).toContain("State Board");
  });

  it("reflects the learner's own board", () => {
    const text = buildSyllabusKnowledge("6", "ICSE");
    expect(text).toContain("follows the ICSE board");
  });

  it("defaults to CBSE when no board is given", () => {
    const text = buildSyllabusKnowledge("4", null);
    expect(text).toContain("follows the CBSE board");
  });

  it("details the learner's class and covers every class 4–7", () => {
    const text = buildSyllabusKnowledge("6", "CBSE");
    expect(text).toContain("Class 6 (THIS LEARNER'S CLASS");
    for (const cls of CURRICULUM_CLASSES) {
      expect(text).toContain(`Class ${cls}`);
    }
    // A class-6 unit title should appear in full detail.
    expect(text).toContain(CURRICULUM["6"][0].title);
  });

  it("details all classes when no class is specified (e.g. tutor with no student)", () => {
    const text = buildSyllabusKnowledge(null, null);
    // Every class's first unit title should be present in full-detail mode.
    for (const cls of CURRICULUM_CLASSES) {
      expect(text).toContain(CURRICULUM[cls][0].title);
    }
  });
});
