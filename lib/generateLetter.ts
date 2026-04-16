import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import type { Contact } from "./supabase";

interface ImageCache {
  data: string;
  width: number;
  height: number;
}

let cachedLogo: ImageCache | null = null;
let cachedSign: ImageCache | null = null;

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
  [cachedLogo, cachedSign] = await Promise.all([
    prepareImage("/logo_black.png"),
    prepareImage("/sign_black.png"),
  ]);
}

export function generateLetterPdf(contact: Contact): Uint8Array {
  if (!cachedLogo || !cachedSign) throw new Error("Images not preloaded");

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const marginLeft = 25;
  const marginRight = 25;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // --- CROP MARKS ---
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.2);
  const markLen = 4;
  const markOffset = 5;
  // top-left
  doc.line(markOffset, markOffset, markOffset + markLen, markOffset);
  doc.line(markOffset, markOffset, markOffset, markOffset + markLen);
  // top-right
  doc.line(pageWidth - markOffset, markOffset, pageWidth - markOffset - markLen, markOffset);
  doc.line(pageWidth - markOffset, markOffset, pageWidth - markOffset, markOffset + markLen);
  // bottom-left
  doc.line(markOffset, pageHeight - markOffset, markOffset + markLen, pageHeight - markOffset);
  doc.line(markOffset, pageHeight - markOffset, markOffset, pageHeight - markOffset - markLen);
  // bottom-right
  doc.line(pageWidth - markOffset, pageHeight - markOffset, pageWidth - markOffset - markLen, pageHeight - markOffset);
  doc.line(pageWidth - markOffset, pageHeight - markOffset, pageWidth - markOffset, pageHeight - markOffset - markLen);

  // --- FOLD MARKS (left edge, DIN 5008) ---
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.15);
  doc.line(markOffset, 105, markOffset + markLen, 105);
  doc.line(markOffset, 210, markOffset + markLen, 210);

  // --- LOGO (top right) ---
  const logoW = 48;
  const logoH = (cachedLogo.height / cachedLogo.width) * logoW;
  doc.addImage(cachedLogo.data, "PNG", pageWidth - marginRight - logoW, 10, logoW, logoH);

  // --- SENDER LINE ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text("Grahm Digital  |  Schwedenstraße 29A, 04420 Markranstädt", marginLeft, 28);

  // --- HEADER SEPARATOR ---
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, 31, pageWidth - marginRight, 31);

  // --- RECIPIENT ADDRESS BLOCK ---
  const addrY = 44;
  const addrLineH = 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  [contact.firma, contact.empfaenger, contact.strasse, `${contact.plz} ${contact.ort}`].forEach((line, i) => {
    if (line?.trim()) doc.text(line, marginLeft, addrY + i * addrLineH);
  });

  // --- META BLOCK (right side) ---
  const metaX = 128;
  const metaY = 55;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Bearbeiter", metaX, metaY);
  doc.text("Datum", metaX + 32, metaY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Colin Grahm", metaX, metaY + 5.5);
  const dateStr = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.text(dateStr, metaX + 32, metaY + 5.5);

  // --- SUBJECT LINE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(74, 121, 45); // dark green
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
        // justify all but last line
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
  // underline "Anlage/n"
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
