import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";

const mmToPt = (mm: number) => mm * 2.83465;

export async function POST(req: Request) {
  const data = await req.json();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  // ==============================
  // 📏 MARGINS
  // ==============================
  const marginLeft = mmToPt(25);
  const marginRight = mmToPt(25);
  const marginTop = mmToPt(10);
  const marginBottom = mmToPt(10);

  const contentWidth = width - marginLeft - marginRight;

  // ==============================
  // 🖼️ LOGO (oben rechts)
  // ==============================
  const logoBytes = await fetch(
    new URL("/logo_black.png", req.url)
  ).then((res) => res.arrayBuffer());

  const logoImage = await pdfDoc.embedPng(logoBytes);

  const logoWidth = 140;
  const logoHeight = (logoImage.height / logoImage.width) * logoWidth;

  page.drawImage(logoImage, {
    x: width - marginRight - logoWidth,
    y: height - marginTop - logoHeight,
    width: logoWidth,
    height: logoHeight,
  });

  // ==============================
  // 📍 ABSENDER
  // ==============================
  page.drawText(
    "Grahm Digital | Schwedenstraße 29A, 04420 Markranstädt",
    {
      x: marginLeft,
      y: height - marginTop - 60,
      size: 9,
      font,
    }
  );

  // ==============================
  // 📬 EMPFÄNGER (Fensterbereich)
  // ==============================
  const addressY = height - mmToPt(45);

  const addressLines = [
    data.firma,
    data.name,
    `${data.strasse}, ${data.hausnummer}`,
    `${data.plz} ${data.stadt}`,
  ];

  addressLines.forEach((line, i) => {
    if (!line) return;

    page.drawText(line, {
      x: marginLeft,
      y: addressY - i * 16,
      size: 12,
      font,
    });
  });

  // ==============================
  // 📊 META (rechts)
  // ==============================
  const metaX = width - marginRight - 150;
  const metaY = addressY - 20;

  page.drawText("Datum", {
    x: metaX,
    y: metaY,
    size: 9,
    font,
  });

  page.drawText(new Date().toLocaleDateString("de-DE"), {
    x: metaX,
    y: metaY - 15,
    size: 11,
    font: fontBold,
  });

  // ==============================
  // 🧾 BETREFF (grün simuliert über Größe/Bold)
  // ==============================
  const subjectY = addressY - 120;

  page.drawText("Ihre Praxis – noch nicht online?", {
    x: marginLeft,
    y: subjectY,
    size: 14,
    font: fontBold,
  });

  // ==============================
  // 📝 TEXTBLOCK
  // ==============================
  const bodyY = subjectY - 40;

  const bodyLines = [
    "Sehr geehrte Dame, Sehr geehrter Herr des Hauses,",
    "",
    `bei meiner Recherche nach Praxen für ${data.fachrichtung} ist mir aufgefallen, dass Ihre Praxis aktuell keine eigene Website hat.`,
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

  bodyLines.forEach((line, i) => {
    page.drawText(line, {
      x: marginLeft,
      y: bodyY - i * 18,
      size: 11,
      font,
      maxWidth: contentWidth,
    });
  });

  // ==============================
  // 👋 GRUSS
  // ==============================
  const closingY = bodyY - bodyLines.length * 18 - 30;

  page.drawText("Mit freundlichen Grüßen", {
    x: marginLeft,
    y: closingY,
    size: 11,
    font,
  });

  // ==============================
  // ✍️ SIGNATUR (Bild)
  // ==============================
  const signBytes = await fetch(
    new URL("/sign_black.png", req.url)
  ).then((res) => res.arrayBuffer());

  const signImage = await pdfDoc.embedPng(signBytes);

  const signWidth = 120;
  const signHeight = (signImage.height / signImage.width) * signWidth;

  page.drawImage(signImage, {
    x: marginLeft,
    y: closingY - 80,
    width: signWidth,
    height: signHeight,
  });

  page.drawText("Colin Grahm", {
    x: marginLeft,
    y: closingY - 100,
    size: 11,
    font,
  });

  // ==============================
  // 📎 ANLAGE (rechts unten)
  // ==============================
  page.drawText("Anlage/n", {
    x: width - marginRight - 120,
    y: closingY,
    size: 11,
    font,
  });

  page.drawText("- Keine -", {
    x: width - marginRight - 120,
    y: closingY - 20,
    size: 11,
    font,
  });

  // ==============================
  // 📄 EXPORT
  // ==============================
  const pdfBytes = await pdfDoc.save();

  return new NextResponse(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=geschaeftsbrief.pdf",
    },
  });
}