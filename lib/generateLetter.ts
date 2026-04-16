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

  // Logo top right (140pt = 49.4mm)
  const logoW = 49.4;
  const logoH = (cachedLogo.height / cachedLogo.width) * logoW;
  doc.addImage(cachedLogo.data, "PNG", pageWidth - marginRight - logoW, marginTop, logoW, logoH);

  // Absender
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Grahm Digital | Schwedenstraße 29A, 04420 Markranstädt", marginLeft, 31.2);

  // Empfänger address block (45mm from top)
  const addrY = 45;
  const addrLineH = 5.64; // 16pt
  doc.setFontSize(12);
  [contact.firma, contact.empfaenger, contact.strasse, `${contact.plz} ${contact.ort}`].forEach((line, i) => {
    if (line?.trim()) doc.text(line, marginLeft, addrY + i * addrLineH);
  });

  // Meta (right side) — metaX = (595 - 70.87 - 150) / 2.835 ≈ 132mm
  const metaX = 132;
  const metaY = 52;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Bearbeiter", metaX, metaY);
  doc.text("Datum", metaX + 28.22, metaY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Colin Grahm", metaX, metaY + 5.29);
  doc.text(new Date().toLocaleDateString("de-DE"), metaX + 28.22, metaY + 5.29);

  // Subject (87.33mm from top)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Ihre Praxis – noch nicht online?", marginLeft, 87.33);

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lineH = 6.35; // 18pt

  const bodyParagraphs = [
    "Sehr geehrte Dame, Sehr geehrter Herr des Hauses,",
    "",
    `bei meiner Recherche nach Praxen für ${contact.fachrichtung} ist mir aufgefallen, dass Ihre Praxis aktuell keine eigene Website hat.`,
    "",
    "Das bedeutet: Patienten, die online nach Ihnen suchen, finden Sie nicht – oder landen bei der Konkurrenz.",
    "",
    "Ich bin Colin Grahm von Grahm Digital. Wir bauen professionelle Websites speziell für Arztpraxen.",
    "",
    "Kein Technik-Stress. Kein Abstimmungschaos. Keine versteckten Kosten.",
    "",
    "Ab 110 € im Monat, alles inklusive.",
    "",
    "Ich würde Ihnen das gerne in einem kurzen Gespräch zeigen.",
  ];

  let curY = 101.44;
  bodyParagraphs.forEach((para) => {
    if (para === "") { curY += lineH; return; }
    const lines = doc.splitTextToSize(para, contentWidth);
    doc.text(lines, marginLeft, curY);
    curY += (lines as string[]).length * lineH;
  });

  // Closing
  const closingY = curY + 10.58; // 30pt gap
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Mit freundlichen Grüßen", marginLeft, closingY);

  // Signature image
  const signW = 42.33; // 120pt
  const signH = (cachedSign.height / cachedSign.width) * signW;
  doc.addImage(cachedSign.data, "PNG", marginLeft, closingY + 8, signW, signH);
  doc.text("Colin Grahm", marginLeft, closingY + 35.27);

  // Anlage (right side of closing)
  const anlageX = 142.67;
  doc.text("Anlage/n", anlageX, closingY);
  doc.text("- Keine -", anlageX, closingY + 7.06);

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
