import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportCardResponse } from "@workspace/api-client-react";

type Translate = (key: string) => string;

/** Build a printable progress report card PDF for a student. */
export function exportReportCardPdf(t: Translate, r: ReportCardResponse): void {
  const doc = new jsPDF();
  const marginX = 14;
  let y = 18;

  doc.setFontSize(18);
  doc.text(t("reportcard.pdf.heading"), marginX, y);
  y += 8;

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(r.student.name, marginX, y);
  const meta = [r.student.studentClass, r.student.board, r.student.batch]
    .filter(Boolean)
    .join("  ·  ");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(meta, 130, y);
  y += 9;

  doc.setTextColor(0);
  doc.setFontSize(11);
  const summary = `${t("reportcard.totalTests")}: ${r.totalTests}     ${t(
    "reportcard.avgScore",
  )}: ${r.averageScorePct}%     XP: ${r.xp}     ${t("reportcard.streak")}: ${r.streakLongest}`;
  doc.text(summary, marginX, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [
      [
        t("reportcard.col.topic"),
        t("reportcard.col.attempts"),
        t("reportcard.col.avg"),
        t("reportcard.col.best"),
      ],
    ],
    body: r.topics.map((tp) => [
      tp.label,
      String(tp.attempts),
      `${tp.avgScorePct}%`,
      `${tp.bestScorePct}%`,
    ]),
    theme: "grid",
    styles: { cellPadding: 3, fontSize: 11 },
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: marginX, right: marginX },
  });

  const afterTopics = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
  let y2 = (afterTopics?.finalY ?? y) + 10;
  doc.setFontSize(13);
  doc.text(t("reportcard.recent"), marginX, y2);
  y2 += 2;

  autoTable(doc, {
    startY: y2,
    head: [[t("reportcard.col.test"), t("reportcard.col.score"), t("reportcard.col.date")]],
    body: r.recentTests.map((rt) => [
      rt.topicLabel,
      `${rt.correctCount}/${rt.totalQuestions} (${rt.scorePct}%)`,
      new Date(rt.completedAt).toLocaleDateString("en-IN"),
    ]),
    theme: "grid",
    styles: { cellPadding: 3, fontSize: 11 },
    headStyles: { fillColor: [16, 185, 129] },
    margin: { left: marginX, right: marginX },
  });

  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(
    `${t("reportcard.pdf.footer")} · ${new Date(r.generatedAt).toLocaleString("en-IN")}`,
    marginX,
    doc.internal.pageSize.getHeight() - 10,
  );

  doc.save(`VidyaGanit-ReportCard-${r.student.name}.pdf`);
}
