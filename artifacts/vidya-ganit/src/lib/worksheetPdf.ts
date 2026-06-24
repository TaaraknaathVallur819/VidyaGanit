import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { WorksheetResponse } from "@workspace/api-client-react";

type Translate = (key: string) => string;

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function exportWorksheetPdf(
  t: Translate,
  worksheet: WorksheetResponse,
  meta?: { studentName?: string | null; board?: string | null },
): void {
  const doc = new jsPDF();
  const marginX = 14;
  let y = 18;

  doc.setFontSize(18);
  doc.text(
    t("worksheet.pdf.heading").replace("{topic}", worksheet.topicLabel),
    marginX,
    y,
  );
  y += 7;

  doc.setFontSize(10);
  doc.setTextColor(110);
  const classLine = worksheet.klass ? ` · ${worksheet.klass}` : "";
  doc.text(`${t("worksheet.pdf.subtitle")}${classLine}`, marginX, y);
  y += 8;

  doc.setTextColor(0);
  doc.setFontSize(11);
  if (meta?.studentName) {
    doc.text(
      t("worksheet.pdf.student").replace("{name}", meta.studentName),
      marginX,
      y,
    );
  } else {
    doc.text(t("worksheet.pdf.name"), marginX, y);
  }
  doc.text(t("worksheet.pdf.date"), 130, y);
  y += 8;
  if (meta?.board) {
    doc.text(t("worksheet.pdf.board").replace("{board}", meta.board), marginX, y);
    y += 8;
  }

  doc.setFontSize(13);
  doc.text(t("worksheet.pdf.questions"), marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [[t("worksheet.pdf.question"), ""]],
    body: worksheet.questions.flatMap((q, i) => {
      const optionLines = q.options
        .map((opt, oi) => `(${LETTERS[oi]}) ${opt}`)
        .join("    ");
      return [[`${i + 1}.`, `${q.prompt}\n${optionLines}`]];
    }),
    theme: "grid",
    styles: { cellPadding: 3, fontSize: 11, valign: "top" },
    columnStyles: { 0: { cellWidth: 12, fontStyle: "bold" } },
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: marginX, right: marginX },
  });

  // Answer key on a fresh page so the printed worksheet can be handed out
  // without the answers showing through.
  doc.addPage();
  y = 18;
  doc.setFontSize(15);
  doc.text(t("worksheet.pdf.answerKey"), marginX, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [[t("worksheet.pdf.question"), t("worksheet.pdf.answerKey")]],
    body: worksheet.questions.map((q, i) => [
      `${i + 1}.`,
      `(${LETTERS[q.answer] ?? "?"}) ${q.options[q.answer] ?? ""}`,
    ]),
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129] },
    columnStyles: { 0: { cellWidth: 16, fontStyle: "bold" } },
    margin: { left: marginX, right: marginX },
  });

  const safeTopic = worksheet.topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`vidyaganit-worksheet-${safeTopic}.pdf`);
}
