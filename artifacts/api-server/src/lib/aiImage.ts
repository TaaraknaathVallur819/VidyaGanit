import { gemini } from "./googleAi";
import { renderMathsDiagram } from "./mathsDiagram";

// Keep existing wire values for older clients; both use the text model now.
export type ImageModel = "gemini-nano-banana" | "gemini-nano-banana-pro";
export function normalizeImageModel(value: unknown): ImageModel {
  return value === "gemini-nano-banana-pro" ? value : "gemini-nano-banana";
}
export async function generateImageDataUrl(
  _model: ImageModel,
  prompt: string,
): Promise<string> {
  const response = await gemini.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        required: ["title", "shapes"],
        properties: {
          title: { type: "string" },
          shapes: {
            type: "array",
            minItems: 1,
            maxItems: 80,
            items: {
              type: "object",
              required: ["kind", "x", "y"],
              properties: {
                kind: {
                  type: "string",
                  enum: ["rect", "circle", "line", "sector", "text"],
                },
                x: { type: "number" },
                y: { type: "number" },
                x2: { type: "number" },
                y2: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
                radius: { type: "number" },
                startAngle: { type: "number" },
                endAngle: { type: "number" },
                text: { type: "string" },
                fontSize: { type: "number" },
                fill: { type: "string" },
                stroke: { type: "string" },
              },
            },
          },
        },
      },
      temperature: 0.1,
      maxOutputTokens: 8192,
      systemInstruction: [
        "Plan an accurate maths diagram on a 640 by 400 canvas. Return JSON only.",
        'Format: {"title":"short title","shapes":[...]} with 1 to 80 shapes.',
        'Each shape has kind "rect", "circle", "line", "sector", or "text", and optional fill/stroke hex colours (#RRGGBB or "none").',
        "rect: x,y,width,height; circle: x,y,radius; line: x,y,x2,y2;",
        "sector: x,y,radius,startAngle,endAngle in degrees (0 is right, clockwise, end > start, at most 360 degrees);",
        "text: x,y,text,fontSize (12 to 28). Use text shapes for short labels.",
        "Use sectors with shared centre and radius to partition circles into EXACT equal slices, each with an outline; shade only requested slices.",
        "Keep all shapes inside the canvas with space for labels. Respect every requested quantity. No decorative objects or final numeric answer unless requested.",
        "Do not return SVG, HTML, links, scripts, or any fields outside this format.",
      ].join("\n"),
    },
  });
  const svg = renderMathsDiagram(JSON.parse(response.text ?? ""));
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
