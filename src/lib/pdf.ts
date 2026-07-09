import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Gerador de PDF textual simples (pdf-lib) com quebra de linha e de página.
 * Usado nos exports do plano de ensino (M1) e das provas/gabaritos (M6).
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const LINE_GAP = 1.35;

// Fontes padrão usam WinAnsi: acentos do português funcionam, mas alguns
// símbolos (→, aspas curvas, travessão) não — normalizamos.
function sanitize(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/•/g, "-")
    .replace(/[^\x00-\xFF]/g, "?");
}

export class PdfBuilder {
  private doc!: PDFDocument;
  private font!: PDFFont;
  private bold!: PDFFont;
  private page!: PDFPage;
  private y = 0;

  static async create(): Promise<PdfBuilder> {
    const b = new PdfBuilder();
    b.doc = await PDFDocument.create();
    b.font = await b.doc.embedFont(StandardFonts.Helvetica);
    b.bold = await b.doc.embedFont(StandardFonts.HelveticaBold);
    b.newPage();
    return b;
  }

  newPage() {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  private wrap(text: string, font: PDFFont, size: number): string[] {
    const maxWidth = A4.width - 2 * MARGIN;
    const lines: string[] = [];
    for (const raw of sanitize(text).split("\n")) {
      let current = "";
      for (const word of raw.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      lines.push(current);
    }
    return lines;
  }

  private writeLines(lines: string[], font: PDFFont, size: number, color = rgb(0.1, 0.1, 0.1)) {
    for (const line of lines) {
      this.ensure(size * LINE_GAP);
      this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font, color });
      this.y -= size * LINE_GAP;
    }
  }

  title(text: string) {
    this.writeLines(this.wrap(text, this.bold, 18), this.bold, 18, rgb(0.05, 0.15, 0.4));
    this.space(8);
  }

  heading(text: string) {
    this.space(10);
    this.writeLines(this.wrap(text, this.bold, 13), this.bold, 13, rgb(0.05, 0.15, 0.4));
    this.space(2);
  }

  subheading(text: string) {
    this.space(6);
    this.writeLines(this.wrap(text, this.bold, 11), this.bold, 11);
  }

  paragraph(text: string, size = 10.5) {
    this.writeLines(this.wrap(text, this.font, size), this.font, size);
  }

  meta(text: string) {
    this.writeLines(this.wrap(text, this.font, 9.5), this.font, 9.5, rgb(0.4, 0.4, 0.4));
  }

  space(pt = 8) {
    this.y -= pt;
  }

  divider() {
    this.space(6);
    this.ensure(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4.width - MARGIN, y: this.y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    this.space(10);
  }

  async toBytes(): Promise<Uint8Array> {
    return this.doc.save();
  }
}
