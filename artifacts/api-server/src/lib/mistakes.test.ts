import { describe, expect, it } from "vitest";
import { collectMistakes, type CompletedAssessmentRow } from "./assessment";

function row(
  over: Partial<CompletedAssessmentRow> & {
    testId: string;
    submittedAnswers: number[] | null;
  },
): CompletedAssessmentRow {
  return {
    topic: "fraction",
    topicLabel: "Fractions",
    completedAt: "2026-06-19T00:00:00.000Z",
    questions: [
      { prompt: "1/2 + 1/2 = ?", options: ["1", "2", "1/4"], answerIndex: 0 },
      { prompt: "1/4 + 1/4 = ?", options: ["1/2", "2/4", "1"], answerIndex: 0 },
    ],
    ...over,
  };
}

describe("collectMistakes", () => {
  it("returns only the questions the student got wrong", () => {
    const out = collectMistakes([
      row({ testId: "t1", submittedAnswers: [1, 0] }), // Q1 wrong, Q2 right
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      testId: "t1",
      prompt: "1/2 + 1/2 = ?",
      correctIndex: 0,
      chosenIndex: 1,
    });
  });

  it("returns nothing for a perfect score", () => {
    expect(collectMistakes([row({ testId: "t1", submittedAnswers: [0, 0] })])).toEqual([]);
  });

  it("treats a blank/invalid answer as a mistake with chosenIndex -1", () => {
    const out = collectMistakes([row({ testId: "t1", submittedAnswers: [-1, 0] })]);
    expect(out).toHaveLength(1);
    expect(out[0].chosenIndex).toBe(-1);
  });

  it("skips legacy rows that have no captured answers", () => {
    expect(collectMistakes([row({ testId: "t1", submittedAnswers: null })])).toEqual([]);
  });

  it("preserves newest-first row order across tests", () => {
    const out = collectMistakes([
      row({ testId: "newer", completedAt: "2026-06-19T00:00:00.000Z", submittedAnswers: [1, 1] }),
      row({ testId: "older", completedAt: "2026-06-18T00:00:00.000Z", submittedAnswers: [1, 1] }),
    ]);
    expect(out.map((m) => m.testId)).toEqual(["newer", "newer", "older", "older"]);
  });

  it("caps the number of mistakes returned at the limit", () => {
    const many: CompletedAssessmentRow[] = Array.from({ length: 5 }, (_, i) =>
      row({ testId: `t${i}`, submittedAnswers: [1, 1] }),
    );
    // 5 tests × 2 wrong = 10 potential; cap at 3.
    expect(collectMistakes(many, 3)).toHaveLength(3);
  });
});
