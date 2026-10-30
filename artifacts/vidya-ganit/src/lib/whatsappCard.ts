// A shareable progress card for a student: a ready-to-send WhatsApp message and a
// PNG image of the same summary, drawn in the browser. Nothing leaves the device
// until the person chooses to share it.

type T = (key: string) => string;

export interface ProgressCardTopic {
  label: string;
  avgScorePct: number;
}

export interface ProgressCardData {
  name: string;
  klass: string | null;
  overallPct: number;
  topics: ProgressCardTopic[];
}

const PASS_MARK = 60;

/** Up to three strongest topics (at or above the pass mark) and three weakest (below it). */
export function summariseTopics(topics: ProgressCardTopic[]) {
  const sorted = [...topics].sort((a, b) => b.avgScorePct - a.avgScorePct);
  return {
    strong: sorted.filter((x) => x.avgScorePct >= PASS_MARK).slice(0, 3),
    weak: [...sorted].reverse().filter((x) => x.avgScorePct < PASS_MARK).slice(0, 3),
  };
}

const listText = (items: ProgressCardTopic[]) =>
  items.length ? items.map((x) => `${x.label} (${x.avgScorePct}%)`).join(", ") : "-";

export function buildProgressMessage(t: T, data: ProgressCardData): string {
  const { strong, weak } = summariseTopics(data.topics);
  return [
    t("wa.heading").replace("{name}", data.name),
    data.klass ? t("wa.classLabel").replace("{class}", data.klass) : null,
    `${t("wa.overall")}: ${data.overallPct}%`,
    `${t("wa.strongest")}: ${listText(strong)}`,
    `${t("wa.needsPractice")}: ${listText(weak)}`,
    "www.vidyaganit.com",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

const FONT = '"Noto Sans", "Segoe UI", system-ui, -apple-system, sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function renderProgressCard(t: T, data: ProgressCardData): Promise<Blob> {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas is not available in this browser."));

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, "#312e81");
  bg.addColorStop(1, "#4f46e5");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText("VidyaGanit", 70, 105);

  const x = 60;
  const y = 150;
  const w = size - 120;
  const h = size - 210;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 48);
  ctx.fill();

  const left = x + 50;
  const maxWidth = w - 100;
  let cursor = y + 90;

  ctx.fillStyle = "#1e1b4b";
  ctx.font = `800 46px ${FONT}`;
  for (const line of wrap(ctx, t("wa.heading").replace("{name}", data.name), maxWidth).slice(0, 2)) {
    ctx.fillText(line, left, cursor);
    cursor += 58;
  }

  if (data.klass) {
    ctx.fillStyle = "#64748b";
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(t("wa.classLabel").replace("{class}", data.klass), left, cursor);
    cursor += 40;
  }

  cursor += 110;
  ctx.fillStyle = data.overallPct >= PASS_MARK ? "#059669" : "#d97706";
  ctx.font = `800 140px ${FONT}`;
  ctx.fillText(`${data.overallPct}%`, left, cursor);
  ctx.fillStyle = "#64748b";
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText(t("wa.overall"), left, cursor + 48);
  cursor += 120;

  const { strong, weak } = summariseTopics(data.topics);
  const block = (title: string, colour: string, items: ProgressCardTopic[]) => {
    ctx.fillStyle = colour;
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(title, left, cursor);
    cursor += 46;
    ctx.fillStyle = "#334155";
    ctx.font = `600 32px ${FONT}`;
    for (const line of wrap(ctx, listText(items), maxWidth).slice(0, 3)) {
      ctx.fillText(line, left, cursor);
      cursor += 42;
    }
    cursor += 26;
  };
  block(t("wa.strongest"), "#059669", strong);
  block(t("wa.needsPractice"), "#d97706", weak);

  ctx.fillStyle = "#94a3b8";
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText("www.vidyaganit.com", left, y + h - 40);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the card."))), "image/png"),
  );
}

const fileNameFor = (name: string) => `${name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "student"}-progress.png`;

export async function downloadProgressCard(t: T, data: ProgressCardData): Promise<void> {
  const blob = await renderProgressCard(t, data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFor(data.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Share the card. Phones that can share files open the share sheet with the image
 * attached (pick WhatsApp). Elsewhere WhatsApp opens with the written summary,
 * and the image can be saved with "Download card" and attached by hand.
 */
export async function shareProgressCard(t: T, data: ProgressCardData): Promise<void> {
  const message = buildProgressMessage(t, data);
  try {
    const blob = await renderProgressCard(t, data);
    const file = new File([blob], fileNameFor(data.name), { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: message });
      return;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return; // closed the share sheet
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}
