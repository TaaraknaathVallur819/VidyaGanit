import type { ReactNode } from "react";

/**
 * Minimal Markdown renderer for AI chat replies.
 *
 * The student tutor and the parent/tutor consultant both answer in Markdown —
 * headings, bold, bullet and numbered lists — and routinely slip in simple
 * LaTeX such as $\frac{3}{4}$. Rendering a deliberately small subset here keeps
 * react-markdown and KaTeX out of the bundle, and because every branch below
 * builds React elements (never dangerouslySetInnerHTML) model output cannot
 * inject markup.
 *
 * Replies stream in token by token, so the input is usually *partial* Markdown:
 * a bold span is often half-written. Every delimiter therefore requires its
 * closing partner to match, leaving unfinished spans as literal text instead of
 * swallowing everything after them.
 */

// Inline spans, tried in this order at each position. Bold precedes italic so
// that `**x**` is never mistaken for an italic run starting at the second `*`.
const INLINE_PATTERN =
  "\\*\\*([^\\n]+?)\\*\\*" + // **bold**
  "|\\*([^*\\n]+?)\\*" + //    *italic*
  "|`([^`\\n]+)`" + //         `code`
  "|\\$([^$\\n]+)\\$"; //      $math$

const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d+[.)])\s+(.*)$/;
const BULLET_RE = /^(\s*)[-*•]\s+(.*)$/;

const BULLET_MARKERS = ["•", "◦", "▪"];

/**
 * Convert the handful of LaTeX commands these models actually emit into plain
 * Unicode. Anything unrecognised is left alone rather than mangled.
 */
function mathToUnicode(src: string): string {
  return src
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1⁄$2")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\cdot/g, "·")
    .replace(/\\pm/g, "±")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\le\b/g, "≤")
    .replace(/\\ge\b/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\pi\b/g, "π")
    .replace(/\\%/g, "%")
    .replace(/[{}]/g, "")
    .trim();
}

/** Currency ("$5 off") must not be read as maths, so require a LaTeX command. */
function looksLikeMath(inner: string): boolean {
  return inner.includes("\\");
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // A fresh regex per call: this recurses for nested spans, and a shared global
  // regex would carry `lastIndex` into the inner call and corrupt both.
  const re = new RegExp(INLINE_PATTERN, "g");
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let n = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const [whole, bold, italic, code, math] = match;
    if (math !== undefined && !looksLikeMath(math)) continue;

    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const key = `${keyPrefix}${n}`;

    if (bold !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {renderInline(bold, `${key}-`)}
        </strong>,
      );
    } else if (italic !== undefined) {
      nodes.push(<em key={key}>{renderInline(italic, `${key}-`)}</em>);
    } else if (code !== undefined) {
      nodes.push(
        <code key={key} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.92em]">
          {code}
        </code>,
      );
    } else if (math !== undefined) {
      nodes.push(
        <span key={key} className="font-medium">
          {mathToUnicode(math)}
        </span>,
      );
    }

    cursor = match.index + whole.length;
    n += 1;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

interface ListItem {
  depth: number;
  marker: string;
  text: string;
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; items: ListItem[] }
  | { kind: "para"; text: string };

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let items: ListItem[] | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "para", text: para.join("\n") });
      para = [];
    }
  };
  const flushList = () => {
    if (items) {
      blocks.push({ kind: "list", items });
      items = null;
    }
  };

  for (const line of src.split("\n")) {
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }

    const ordered = ORDERED_RE.exec(line);
    const bullet = ordered ? null : BULLET_RE.exec(line);
    if (ordered || bullet) {
      flushPara();
      // Indent is roughly three spaces per level in what the models emit.
      const indent = (ordered ? ordered[1] : bullet![1]).length;
      const depth = Math.min(BULLET_MARKERS.length - 1, Math.floor(indent / 3));
      // Keep the model's own numbering rather than recomputing it, so a list
      // interrupted by sub-bullets still reads 1, 2, 3 instead of restarting.
      const marker = ordered ? ordered[2] : BULLET_MARKERS[depth];
      const text = ordered ? ordered[3] : bullet![2];
      if (!items) items = [];
      items.push({ depth, marker, text });
      continue;
    }

    // A plain line directly under a list is a wrapped continuation of the last
    // item; treating it as a new paragraph would split the list in two.
    if (items && items.length) {
      items[items.length - 1].text += ` ${line.trim()}`;
      continue;
    }

    para.push(line.trim());
  }

  flushPara();
  flushList();
  return blocks;
}

/** Markdown stripped back to speech-friendly prose, for the read-aloud button. */
export function plainTextFromMarkdown(src: string): string {
  return src
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^(\s*)[-*•]\s+/gm, "$1")
    .replace(/\*\*([^\n]+?)\*\*/g, "$1")
    .replace(/\*([^*\n]+?)\*/g, "$1")
    .replace(/\$([^$\n]+)\$/g, (whole, inner: string) =>
      looksLikeMath(inner) ? mathToUnicode(inner) : whole,
    )
    .trim();
}

export default function MarkdownMessage({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  if (!content) return null;
  const blocks = parseBlocks(content);

  return (
    <div className={`space-y-2 break-words ${className}`}>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <p
              key={i}
              className={`font-semibold ${block.level <= 2 ? "text-[1.06em]" : ""}`}
            >
              {renderInline(block.text, `h${i}-`)}
            </p>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className="space-y-1">
              {block.items.map((item, j) => (
                <li
                  key={j}
                  className="flex gap-2"
                  style={{ paddingLeft: item.depth * 14 }}
                >
                  <span className="shrink-0 select-none opacity-70">{item.marker}</span>
                  <span className="min-w-0 flex-1">
                    {renderInline(item.text, `l${i}-${j}-`)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(block.text, `p${i}-`)}
          </p>
        );
      })}
    </div>
  );
}
