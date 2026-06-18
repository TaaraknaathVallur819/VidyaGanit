import { describe, expect, it } from "vitest";
import { buildTutorSystemPrompt } from "./tutor";
import { buildCounselorSystemPrompt } from "./counselor";

const MARKER = "INDIAN MATHS SYLLABUS KNOWLEDGE";

describe("syllabus injection into AI prompts", () => {
  it("student Socratic tutor prompt includes the syllabus block", () => {
    const prompt = buildTutorSystemPrompt(
      { name: "Asha", studentClass: "5", board: "CBSE" },
      "en",
    );
    expect(prompt).toContain(MARKER);
    expect(prompt).toContain("Class 5 (THIS LEARNER'S CLASS");
    expect(prompt).toContain("follows the CBSE board");
  });

  it("parent counsellor prompt includes the syllabus block", () => {
    const prompt = buildCounselorSystemPrompt({
      parentName: "Parent",
      language: "en",
      role: "parent",
      student: {
        name: "Asha",
        studentClass: "6",
        board: "ICSE",
        totalSessions: 1,
        totalMessages: 2,
        topics: [],
      },
    });
    expect(prompt).toContain(MARKER);
    expect(prompt).toContain("Class 6 (THIS LEARNER'S CLASS");
    expect(prompt).toContain("follows the ICSE board");
  });

  it("tutor coach prompt includes the syllabus block", () => {
    const prompt = buildCounselorSystemPrompt({
      parentName: "Tutor",
      language: "en",
      role: "tutor",
      student: {
        name: "Ravi",
        studentClass: "7",
        board: "Maharashtra State Board",
        totalSessions: 0,
        totalMessages: 0,
        topics: [],
      },
    });
    expect(prompt).toContain(MARKER);
    expect(prompt).toContain("Class 7 (THIS LEARNER'S CLASS");
    expect(prompt).toContain("follows the Maharashtra State Board board");
  });

  it("tutor coach with no student selected still gets full syllabus knowledge", () => {
    const prompt = buildCounselorSystemPrompt({
      parentName: "Tutor",
      language: "en",
      role: "tutor",
      student: null,
    });
    expect(prompt).toContain(MARKER);
    // Falls back to CBSE and details all classes.
    expect(prompt).toContain("follows the CBSE board");
  });
});
