import { describe, expect, it } from "vitest";
import { renderMathsDiagram } from "./mathsDiagram";
describe("safe maths diagrams", () => {
  it("draws an outlined circle with two equal halves", () => {
    const svg = renderMathsDiagram({
      title: "Two halves",
      shapes: [
        {
          kind: "sector",
          x: 320,
          y: 200,
          radius: 120,
          startAngle: 0,
          endAngle: 180,
          fill: "#6366f1",
        },
        {
          kind: "sector",
          x: 320,
          y: 200,
          radius: 120,
          startAngle: 180,
          endAngle: 360,
        },
      ],
    });
    expect(svg.match(/<path/g)).toHaveLength(2);
    expect(svg).toContain('fill="#6366f1"');
  });
  it("escapes labels and never accepts executable primitives", () => {
    expect(
      renderMathsDiagram({
        shapes: [{ kind: "text", x: 10, y: 30, text: "<script>&" }],
      }),
    ).toContain("&lt;script&gt;&amp;");
    expect(() =>
      renderMathsDiagram({ shapes: [{ kind: "script", x: 0, y: 0 }] }),
    ).toThrow();
    expect(() =>
      renderMathsDiagram({
        shapes: [{ kind: "circle", x: 0, y: 0, radius: 90 }],
      }),
    ).toThrow();
    expect(() =>
      renderMathsDiagram({
        shapes: [
          {
            kind: "line",
            x: 0,
            y: 0,
            x2: 10,
            y2: 10,
            stroke: "url(https://example.invalid)",
          },
        ],
      }),
    ).toThrow();
  });
});
