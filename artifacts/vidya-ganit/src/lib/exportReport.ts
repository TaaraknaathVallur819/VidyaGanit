import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { StudentAnalytics, AssessmentSummary } from "@workspace/api-client-react";

type Translate = (key: string) => string;

export interface ExportReportOptions {
  t: Translate;
  analytics: StudentAnalytics;
  assessments: AssessmentSummary[];
}

function formatDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function baseFilename(analytics: StudentAnalytics): string {
  return `vidyaganit-progress-${analytics.studentVidyaId}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportReportPdf({ t, analytics, assessments }: ExportReportOptions): void {
  const doc = new jsPDF();
  const marginX = 14;
  let y = 18;

  doc.setFontSize(18);
  doc.text(t("report.heading"), marginX, y);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(110);
  const classLine = analytics.studentClass
    ? ` · ${analytics.studentClass}${analytics.board ? ` (${analytics.board})` : ""}`
    : analytics.board
      ? ` · ${analytics.board}`
      : "";
  doc.text(`${t("report.student")}: ${analytics.name} (${analytics.studentVidyaId})${classLine}`, marginX, y);
  y += 6;
  doc.text(`${t("report.generatedOn")}: ${formatDate(new Date())}`, marginX, y);
  y += 10;

  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.text(t("report.summaryHeading"), marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [[t("report.summaryHeading"), ""]],
    body: [
      [t("progress.totalSessions"), String(analytics.totalSessions)],
      [t("progress.totalMessages"), String(analytics.totalMessages)],
    ],
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(13);
  doc.text(t("report.topicHeading"), marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [[t("report.col.topic"), t("report.col.mastery"), t("progress.questions"), t("progress.sessions")]],
    body: analytics.topics.map((topic) => [
      topic.label,
      String(topic.mastery),
      String(topic.questionsPracticed),
      String(topic.sessions),
    ]),
    theme: "striped",
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(13);
  doc.text(t("report.testReports"), marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [
      [t("report.col.test"), t("report.col.score"), t("report.col.percent"), t("report.col.date")],
    ],
    body:
      assessments.length > 0
        ? assessments.map((a) => [
            a.topicLabel,
            `${a.score} / ${a.maxScore}`,
            a.maxScore > 0 ? `${Math.round((a.score / a.maxScore) * 100)}` : "0",
            formatDate(a.completedAt),
          ])
        : [["—", "—", "—", "—"]],
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129] },
    margin: { left: marginX, right: marginX },
  });

  doc.save(`${baseFilename(analytics)}.pdf`);
}

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportReportCsv({ t, analytics, assessments }: ExportReportOptions): void {
  const rows: (string | number)[][] = [];

  rows.push([t("report.heading")]);
  rows.push([t("report.student"), analytics.name, analytics.studentVidyaId]);
  if (analytics.studentClass) rows.push([t("report.col.topic"), analytics.studentClass]);
  rows.push([t("report.generatedOn"), formatDate(new Date())]);
  rows.push([]);

  rows.push([t("report.summaryHeading")]);
  rows.push([t("progress.totalSessions"), analytics.totalSessions]);
  rows.push([t("progress.totalMessages"), analytics.totalMessages]);
  rows.push([]);

  rows.push([t("report.topicHeading")]);
  rows.push([
    t("report.col.topic"),
    t("report.col.mastery"),
    t("progress.questions"),
    t("progress.sessions"),
  ]);
  for (const topic of analytics.topics) {
    rows.push([topic.label, topic.mastery, topic.questionsPracticed, topic.sessions]);
  }
  rows.push([]);

  rows.push([t("report.testReports")]);
  rows.push([
    t("report.col.test"),
    t("report.col.score"),
    t("report.col.percent"),
    t("report.col.date"),
  ]);
  for (const a of assessments) {
    rows.push([
      a.topicLabel,
      `${a.score} / ${a.maxScore}`,
      a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0,
      formatDate(a.completedAt),
    ]);
  }

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  // BOM so Excel reads UTF-8 (Indian-language labels) correctly.
  triggerDownload(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `${baseFilename(analytics)}.csv`);
}
