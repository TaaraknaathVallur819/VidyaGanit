import { describe, expect, it } from "vitest";
import {
  generateAssessment,
  QUESTIONS_PER_TEST,
  topicLabel,
} from "./assessment";

describe("unrecognised assessment topics", () => {
  it.each([
    "constructor",
    "toString",
    "__proto__",
    "hasOwnProperty",
    "unknown-topic",
  ])("generates a valid fallback assessment for %s", (topic) => {
    expect(topicLabel(topic)).toBe("Mixed Maths");
    const questions = generateAssessment(topic, "5");
    expect(questions).toHaveLength(QUESTIONS_PER_TEST);
    for (const question of questions) {
      expect(question.options).toHaveLength(4);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(4);
    }
  });
  it("retains the selected topic for recognised topics", () => {
    expect(topicLabel("fraction")).toBe("Fractions");
    expect(
      generateAssessment("fraction", "5").every((q) =>
        q.prompt.includes("fraction"),
      ),
    ).toBe(true);
  });
});
