import jsPDF from "jspdf";

type Translate = (key: string) => string;

export interface CertificateMeta {
  studentName: string;
  title: string;
  subtitle: string;
}

/** Draw a decorative landscape achievement certificate and save it. */
export function exportCertificatePdf(t: Translate, meta: CertificateMeta): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Double border.
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(2);
  doc.rect(8, 8, w - 16, h - 16);
  doc.setLineWidth(0.5);
  doc.rect(13, 13, w - 26, h - 26);

  doc.setTextColor(99, 102, 241);
  doc.setFontSize(14);
  doc.text("VidyaGanit", w / 2, 30, { align: "center" });

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(30);
  doc.text(t("cert.pdf.heading"), w / 2, 55, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(110);
  doc.text(t("cert.pdf.presentedTo"), w / 2, 72, { align: "center" });

  doc.setFontSize(26);
  doc.setTextColor(16, 185, 129);
  doc.text(meta.studentName, w / 2, 88, { align: "center" });

  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text(meta.title, w / 2, 104, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(110);
  const lines = doc.splitTextToSize(meta.subtitle, w - 80);
  doc.text(lines, w / 2, 116, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(140);
  doc.text(
    `${t("cert.pdf.date")}: ${new Date().toLocaleDateString("en-IN")}`,
    w / 2,
    h - 24,
    { align: "center" },
  );

  doc.save(`VidyaGanit-Certificate-${meta.studentName}.pdf`);
}
