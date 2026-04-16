import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import type { Contact } from "./supabase";

interface ImageCache {
  data: string;
  width: number;
  height: number;
}

let cachedLogo: ImageCache | null = null;
let cachedSign: ImageCache | null = null;
let cachedQr1: string | null = null;
let cachedQr2: string | null = null;

async function prepareImage(src: string): Promise<ImageCache> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve({ data: canvas.toDataURL("image/png"), width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function preloadImages(): Promise<void> {
  const [logo, sign, qr1, qr2] = await Promise.all([
    prepareImage("/logo_black.png"),
    prepareImage("/sign_black.png"),
    QRCode.toDataURL("https://cal.com/colin-grahm", { margin: 1, width: 200 }),
    QRCode.toDataURL("https://grahmdigital.de", { margin: 1, width: 200 }),
  ]);
  cachedLogo = logo;
  cachedSign = sign;
  cachedQr1 = qr1;
  cachedQr2 = qr2;
}

export function generateLetterPdf(contact: Contact): Uint8Array {
  if (!cachedLogo || !cachedSign) throw new Error("Images not preloaded");

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const marginLeft = 25;
  const marginRight = 25;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // --- LOGO (top right) ---
  const logoW = 48;
  const logoH = (cachedLogo.height / cachedLogo.width) * logoW;
  doc.addImage(cachedLogo.data, "PNG", pageWidth - marginRight - logoW, 10, logoW, logoH);

  // --- SENDER LINE ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text("Grahm Digital  |  Schwedenstraße 29A, 04420 Markranstädt", marginLeft, 28);

  // --- RECIPIENT ADDRESS BLOCK ---
  const addrY = 44;
  const addrLineH = 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  [contact.firma, contact.empfaenger, contact.strasse, `${contact.plz} ${contact.ort}`].forEach((line, i) => {
    if (line?.trim()) doc.text(line, marginLeft, addrY + i * addrLineH);
  });

  // --- DATE (right-aligned to right margin) ---
  const metaRightX = pageWidth - marginRight;
  const metaY = 55;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Datum", metaRightX, metaY, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const dateStr = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.text(dateStr, metaRightX, metaY + 5.5, { align: "right" });

  // --- SUBJECT LINE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(74, 121, 45);
  doc.text("Ihre Praxis – noch nicht online?", marginLeft, 82);

  // --- BODY ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  const lineH = 5.8;
  const paraGap = 4.5;

  const paragraphs = [
    "Sehr geehrte Dame, Sehr geehrter Herr des Hauses,",
    `bei meiner Recherche nach ${contact.fachrichtung} in Leipzig und Umgebung ist mir aufgefallen, dass Ihre Praxis aktuell keine eigene Website hat.`,
    "Das bedeutet: Patienten, die online nach Ihnen suchen, finden Sie nicht – oder landen bei der Konkurrenz.",
    "Ich bin Colin Grahm von Grahm Digital. Wir bauen professionelle Websites speziell für Arztpraxen, Pflegedienste und Therapeuten – und das Wichtigste dabei: Sie müssen sich um nichts kümmern.",
    "Kein Technik-Stress. Kein Abstimmungschaos. Kein stundenlanger Aufwand Ihrerseits. Ich übernehme alles – von der Domain über das Design bis zur DSGVO-konformen Einrichtung. Sie bekommen am Ende eine fertige, professionelle Website – und einen Ansprechpartner, der dauerhaft für Sie da ist.",
    "Ab 110 € im Monat, alles inklusive. Kein Einmalpreis, kein Risiko vorab. Live in 30 Tagen.",
    "Ich würde Ihnen das gerne in einem kurzen 15-minütigen Gespräch zeigen – kostenlos und unverbindlich.",
  ];

  let curY = 93;
  paragraphs.forEach((para, i) => {
    const lines = doc.splitTextToSize(para, contentWidth) as string[];
    lines.forEach((line, li) => {
      const isLastLine = li === lines.length - 1;
      if (lines.length > 1 && !isLastLine) {
        const words = line.split(" ");
        if (words.length > 1) {
          const textWidth = doc.getTextWidth(line.trimEnd());
          const spaceWidth = (contentWidth - textWidth) / (words.length - 1) + doc.getTextWidth(" ");
          let x = marginLeft;
          words.forEach((word, wi) => {
            doc.text(word, x, curY);
            if (wi < words.length - 1) x += doc.getTextWidth(word) + spaceWidth;
          });
        } else {
          doc.text(line, marginLeft, curY);
        }
      } else {
        doc.text(line, marginLeft, curY);
      }
      curY += lineH;
    });
    if (i < paragraphs.length - 1) curY += paraGap;
  });

  // --- CLOSING ---
  curY += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Mit freundlichen Grüßen", marginLeft, curY);

  // --- ANLAGE (right side, aligned with closing) ---
  const anlageX = 145;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const anlageText = "Anlage/n";
  const anlageW = doc.getTextWidth(anlageText);
  doc.text(anlageText, anlageX, curY);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(anlageX, curY + 0.5, anlageX + anlageW, curY + 0.5);

  // --- SIGNATURE ---
  const signW = 38;
  const signH = (cachedSign.height / cachedSign.width) * signW;
  doc.addImage(cachedSign.data, "PNG", marginLeft - 2, curY + 3, signW, signH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Colin Grahm", marginLeft, curY + signH + 7);

  // --- ANLAGE VALUE ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("- Keine -", anlageX, curY + 10);

  // --- QR CODES (bottom of page) ---
  if (cachedQr1 && cachedQr2) {
    const qrSize = 22;
    const qrY = 252;
    const labelY = qrY + qrSize + 4;

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, qrY - 5, pageWidth - marginRight, qrY - 5);

    doc.addImage(cachedQr1, "PNG", marginLeft, qrY, qrSize, qrSize);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("Kostenloses Erstgespräch buchen", marginLeft + qrSize / 2, labelY, { align: "center" });

    doc.addImage(cachedQr2, "PNG", pageWidth - marginRight - qrSize, qrY, qrSize, qrSize);
    doc.text("Unsere Website", pageWidth - marginRight - qrSize / 2, labelY, { align: "center" });
  }

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

export async function mergePdfs(pdfArrays: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const bytes of pdfArrays) {
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}
