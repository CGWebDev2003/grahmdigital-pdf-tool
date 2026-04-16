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
  const marginTop = 10;
  const pageWidth = 210;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // --- LOGO (top right) ---
  const logoW = 46;
  const logoH = (cachedLogo.height / cachedLogo.width) * logoW;
  doc.addImage(cachedLogo.data, "PNG", pageWidth - marginRight - logoW, marginTop, logoW, logoH);

  // --- SENDER LINE ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Grahm Digital  |  Schwedenstraße 29A, 04420 Markranstädt", marginLeft, 30);

  // --- HEADER SEPARATOR ---
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, 33, pageWidth - marginRight, 33);

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
  const metaX = 130;
  const metaY = 44;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Bearbeiter", metaX, metaY);
  doc.text("Datum", metaX + 30, metaY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Colin Grahm", metaX, metaY + 5);
  doc.text(new Date().toLocaleDateString("de-DE"), metaX + 30, metaY + 5);

  // --- SUBJECT SEPARATOR ---
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, 71, pageWidth - marginRight, 71);

  // --- SUBJECT LINE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Ihre Praxis – noch nicht online?", marginLeft, 80);

  // --- BODY ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  const lineH = 5.5;
  const paraGap = 4.5;

  const bodyParagraphs = [
    "Sehr geehrte Dame, Sehr geehrter Herr des Hauses,",
    `bei meiner Recherche nach Praxen für ${contact.fachrichtung} ist mir aufgefallen, dass Ihre Praxis aktuell keine eigene Website hat.`,
    "Das bedeutet: Patienten, die online nach Ihnen suchen, finden Sie nicht – oder landen bei der Konkurrenz.",
    "Ich bin Colin Grahm von Grahm Digital. Wir bauen professionelle Websites speziell für Arztpraxen.",
    "Kein Technik-Stress. Kein Abstimmungschaos. Keine versteckten Kosten.",
    "Ab 110 € im Monat, alles inklusive.",
    "Ich würde Ihnen das gerne in einem kurzen Gespräch zeigen.",
  ];

  let curY = 91;
  bodyParagraphs.forEach((para, index) => {
    const lines = doc.splitTextToSize(para, contentWidth) as string[];
    doc.text(lines, marginLeft, curY);
    curY += lines.length * lineH;
    if (index < bodyParagraphs.length - 1) curY += paraGap;
  });

  // --- CLOSING SEPARATOR ---
  const closingY = curY + 12;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, closingY - 5, pageWidth - marginRight, closingY - 5);

  // --- CLOSING TEXT ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Mit freundlichen Grüßen", marginLeft, closingY);

  // --- SIGNATURE ---
  const signW = 40;
  const signH = (cachedSign.height / cachedSign.width) * signW;
  doc.addImage(cachedSign.data, "PNG", marginLeft - 2, closingY + 4, signW, signH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Colin Grahm", marginLeft, closingY + signH + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Grahm Digital", marginLeft, closingY + signH + 14);

  // --- ANLAGE (right side) ---
  const anlageX = 142;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Anlage/n", anlageX, closingY);
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("– Keine –", anlageX, closingY + 6);

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

export async function mergePdfs(pdfArrays: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const bytes of pdfArrays) {
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}
