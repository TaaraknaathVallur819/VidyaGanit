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
  const request = {
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      // This deployed model supports JSON mode but rejects the JSON Schema
      // parameter. Validate every primitive locally before rendering instead.
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
  };
  let svg: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await gemini.models.generateContent(request);
    try {
      svg = renderMathsDiagram(JSON.parse(response.text ?? ""));
      break;
    } catch (error) {
      if (attempt === 1) throw error;
      // Ask for one repair of invalid geometry rather than showing a broken
      // image or weakening the renderer's safety checks.
      request.contents = [
        prompt,
        "Correct your previous diagram JSON:",
        response.text?.slice(0, 24000) ?? "",
        `Validation error: ${error instanceof Error ? error.message : "Invalid diagram"}`,
        "Return corrected JSON only. Every sector must have positive extent; use 0 to 180 and 180 to 360 for two halves.",
      ].join("\n");
    }
  }
  if (!svg) throw new Error("No valid diagram");
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
