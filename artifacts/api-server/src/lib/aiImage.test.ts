import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("./googleAi", () => ({ gemini: { models: mocks } }));
import { generateImageDataUrl } from "./aiImage";
const shape = {
  kind: "sector",
  x: 320,
  y: 200,
  radius: 120,
  startAngle: 0,
  endAngle: 180,
};
beforeEach(() => mocks.generateContent.mockReset());
describe("maths image generation", () => {
  it("uses the text model and repairs invalid geometry once", async () => {
    mocks.generateContent
      .mockResolvedValueOnce({
        text: JSON.stringify({ shapes: [{ ...shape, endAngle: 0 }] }),
      })
      .mockResolvedValueOnce({ text: JSON.stringify({ shapes: [shape] }) });
    const image = await generateImageDataUrl(
      "gemini-nano-banana",
      "Draw half a circle",
    );
    expect(image).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(mocks.generateContent).toHaveBeenCalledTimes(2);
    expect(mocks.generateContent.mock.calls[0][0].model).toBe(
      "gemini-flash-lite-latest",
    );
    expect(
      mocks.generateContent.mock.calls[0][0].config.responseJsonSchema,
    ).toBeUndefined();
  });
  it("rejects repeatedly invalid geometry", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify({ shapes: [{ ...shape, endAngle: 0 }] }),
    });
    await expect(
      generateImageDataUrl("gemini-nano-banana", "Draw"),
    ).rejects.toThrow("Invalid sector");
    expect(mocks.generateContent).toHaveBeenCalledTimes(2);
  });
});
