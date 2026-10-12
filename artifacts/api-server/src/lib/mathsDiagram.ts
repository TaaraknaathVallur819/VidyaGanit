const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );

// Model output is data. Only allowlisted primitives become SVG markup.
export function renderMathsDiagram(value: unknown): string {
  if (!value || typeof value !== "object") throw new Error("Invalid diagram");
  const diagram = value as Record<string, unknown>;
  if (
    !Array.isArray(diagram.shapes) ||
    diagram.shapes.length < 1 ||
    diagram.shapes.length > 80
  )
    throw new Error("Invalid diagram shape count");
  const title =
    typeof diagram.title === "string"
      ? diagram.title.slice(0, 160)
      : "Maths diagram";
  const shapes = diagram.shapes.map((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Invalid shape");
    const s = input as Record<string, unknown>;
    const number = (key: string, max = 640, min = 0): number => {
      const n = s[key];
      if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
        throw new Error(`Invalid coordinate: ${key}`);
      return n;
    };
    const colour = (key: string, fallback: string) => {
      const c = s[key] ?? fallback;
      if (typeof c !== "string" || !/^(#[0-9a-f]{6}|none)$/i.test(c))
        throw new Error("Invalid colour");
      return c;
    };
    const x = number("x"),
      y = number("y", 400);
    const fill = colour("fill", s.kind === "text" ? "#1e293b" : "#ffffff");
    const stroke = colour("stroke", "#334155");
    const style = `fill="${fill}" stroke="${stroke}" stroke-width="2"`;
    switch (s.kind) {
      case "rect": {
        const width = number("width"),
          height = number("height", 400);
        if (x + width > 640 || y + height > 400)
          throw new Error("Rectangle outside canvas");
        return `<rect x="${x}" y="${y}" width="${width}" height="${height}" ${style}/>`;
      }
      case "circle":
      case "sector": {
        const radius = number("radius", 200, 1);
        if (
          x - radius < 0 ||
          x + radius > 640 ||
          y - radius < 0 ||
          y + radius > 400
        )
          throw new Error("Circle outside canvas");
        if (s.kind === "circle")
          return `<circle cx="${x}" cy="${y}" r="${radius}" ${style}/>`;
        const start = number("startAngle", 360),
          end = number("endAngle", 720);
        const angle = end - start;
        if (angle <= 0 || angle > 360) throw new Error("Invalid sector");
        if (angle === 360)
          return `<circle cx="${x}" cy="${y}" r="${radius}" ${style}/>`;
        const point = (a: number) =>
          `${x + radius * Math.cos((a * Math.PI) / 180)} ${y + radius * Math.sin((a * Math.PI) / 180)}`;
        return `<path d="M ${x} ${y} L ${point(start)} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${point(end)} Z" ${style}/>`;
      }
      case "line":
        return `<line x1="${x}" y1="${y}" x2="${number("x2")}" y2="${number("y2", 400)}" stroke="${stroke}" stroke-width="2"/>`;
      case "text":
        if (typeof s.text !== "string" || s.text.length > 120)
          throw new Error("Invalid label");
        return `<text x="${x}" y="${y}" fill="${fill}" font-family="sans-serif" font-size="${s.fontSize === undefined ? 20 : number("fontSize", 28, 12)}">${escapeXml(s.text)}</text>`;
      default:
        throw new Error("Unsupported primitive");
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" role="img"><title>${escapeXml(title)}</title><rect width="640" height="400" fill="#ffffff"/>${shapes.join("")}</svg>`;
}
