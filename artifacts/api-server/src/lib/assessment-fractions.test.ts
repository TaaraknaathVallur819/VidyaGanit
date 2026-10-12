import { describe, expect, it } from "vitest";
import { generateAssessment } from "./assessment";
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
describe("fraction assessment answers", () => {
  it("always gives equivalent fractions in lowest terms", () => {
    for (let run = 0; run < 200; run++) {
      for (const question of generateAssessment("fraction", "5")) {
        const original = question.prompt.match(/(\d+)\/(\d+)/)!;
        const answer =
          question.options[question.answerIndex].match(/^(\d+)\/(\d+)$/)!;
        expect(answer).not.toBeNull();
        const n = Number(answer[1]),
          d = Number(answer[2]);
        expect(gcd(n, d)).toBe(1);
        expect(n * Number(original[2])).toBe(d * Number(original[1]));
        expect(new Set(question.options).size).toBe(question.options.length);
      }
    }
  });
});
