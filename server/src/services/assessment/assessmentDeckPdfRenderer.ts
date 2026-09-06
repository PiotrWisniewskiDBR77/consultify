/**
 * assessmentDeckPdfRenderer — .pdf tej samej prezentacji, z tego samego modelu.
 *
 * ★ DLACZEGO WŁASNY RENDER, A NIE KONWERSJA PPTX→PDF. Konwersja wymaga
 * LibreOffice na serwerze — czyli działałaby na maszynie dewelopera i nie
 * działałaby w produkcji. PDF jest tu renderowany trasą produktu (pdfkit +
 * `registerPdfFonts`), więc polskie znaki są w pliku ZAWSZE — Lato jest
 * osadzone w strumieniu PDF, nie pobierane z systemu odbiorcy (DEC-132/133).
 *
 * Strona = slajd: 720 × 405 pt (dokładnie 10" × 5,625", czyli 16:9 modelu),
 * więc jedna jednostka modelu (cal) = 72 pt i geometria jest ta sama co w
 * PPTX. Żadne pole nie jest tu przesuwane „na oko".
 */
import PDFDocument from 'pdfkit';

import { PDF_FONT, registerPdfFonts } from '../../utils/pdfFonts.js';
import {
  DECK_GEOMETRY as G,
  DECK_PALETTE as P,
  takeawayRect,
  type DeckBody,
  type DeckModel,
  type DeckSlide,
} from './assessmentDeckModel.js';

const PT = 72;
const hex = (value: string): string => `#${value}`;

type Doc = InstanceType<typeof PDFDocument>;

function rect(body: { rect: { x: number; y: number; w: number; h: number } }): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return {
    x: body.rect.x * PT,
    y: body.rect.y * PT,
    w: body.rect.w * PT,
    h: body.rect.h * PT,
  };
}

function renderTable(doc: Doc, body: Extract<DeckBody, { kind: 'table' }>): void {
  const r = rect(body);
  const rowH = Math.min(0.34 * PT, r.h / (body.rows.length + 1));
  const colX: number[] = [];
  let acc = r.x;
  for (const share of body.widths) {
    colX.push(acc);
    acc += share * r.w;
  }
  doc.rect(r.x, r.y, r.w, rowH).fill(hex(P.dominant));
  doc.fillColor(hex(P.white)).font(PDF_FONT.bold).fontSize(10);
  body.head.forEach((cell, index) => {
    doc.text(cell, colX[index] + 4, r.y + rowH / 2 - 5, {
      width: body.widths[index] * r.w - 8,
      lineBreak: false,
      ellipsis: true,
    });
  });
  body.rows.forEach((row, rowIndex) => {
    const y = r.y + rowH * (rowIndex + 1);
    doc.fillColor(hex(P.text)).font(PDF_FONT.regular).fontSize(10);
    row.forEach((cell, index) => {
      doc.text(cell, colX[index] + 4, y + rowH / 2 - 5, {
        width: body.widths[index] * r.w - 8,
        lineBreak: false,
        ellipsis: true,
      });
    });
    doc
      .moveTo(r.x, y + rowH)
      .lineTo(r.x + r.w, y + rowH)
      .lineWidth(0.5)
      .strokeColor(hex(P.hairline))
      .stroke();
  });
}

function renderChart(doc: Doc, body: Extract<DeckBody, { kind: 'chart' }>): void {
  const r = rect(body);
  const legendH = 18;
  const axisH = 26;
  const plotY = r.y;
  const plotH = r.h - legendH - axisH;
  const plotW = r.w - 30;
  const plotX = r.x + 30;
  const colors = [P.dominant, P.accent];

  // Siatka pozioma + etykiety osi wartości (rola TEXT_L5 — 9pt, kanon §7).
  doc.font(PDF_FONT.regular).fontSize(8);
  for (let step = 0; step <= body.maxValue; step += 20) {
    const y = plotY + plotH - (step / body.maxValue) * plotH;
    doc
      .moveTo(plotX, y)
      .lineTo(plotX + plotW, y)
      .lineWidth(0.5)
      .strokeColor(hex(P.hairline))
      .stroke();
    doc.fillColor(hex(P.muted)).text(`${step}%`, r.x, y - 4, { width: 26, align: 'right' });
  }

  const groups = body.categories.length;
  const groupW = plotW / groups;
  const barW = (groupW * 0.62) / body.series.length;
  body.categories.forEach((category, groupIndex) => {
    const groupX = plotX + groupIndex * groupW;
    body.series.forEach((serie, serieIndex) => {
      const value = serie.values[groupIndex] ?? 0;
      const h = (value / body.maxValue) * plotH;
      const x = groupX + groupW * 0.19 + serieIndex * barW;
      doc.rect(x, plotY + plotH - h, barW, h).fill(hex(colors[serieIndex % colors.length]));
    });
    doc
      .fillColor(hex(P.muted))
      .font(PDF_FONT.regular)
      .fontSize(7.5)
      .text(category, groupX + 2, plotY + plotH + 6, {
        width: groupW - 4,
        align: 'center',
        height: axisH - 6,
        ellipsis: true,
      });
  });

  // Legenda-chips pod wykresem (kanon §7: kropka + etykieta, nie kwadraciki w rogu).
  let legendX = plotX;
  const legendY = plotY + plotH + axisH;
  body.series.forEach((serie, index) => {
    doc.circle(legendX + 4, legendY + 6, 4).fill(hex(colors[index % colors.length]));
    doc
      .fillColor(hex(P.text))
      .font(PDF_FONT.regular)
      .fontSize(9)
      .text(serie.label, legendX + 12, legendY + 2, { lineBreak: false });
    legendX += 12 + doc.widthOfString(serie.label) + 22;
  });
}

function renderSlide(doc: Doc, model: DeckModel, slide: DeckSlide, index: number, total: number) {
  if (slide.cover) {
    doc.rect(0, 0, G.slideW * PT, G.slideH * PT).fill(hex(P.dominant));
    doc
      .fillColor(hex(P.white))
      .font(PDF_FONT.bold)
      .fontSize(12)
      .text(slide.kicker.toUpperCase(), G.margin * PT, 1.66 * PT, {
        width: (G.slideW - 2 * G.margin) * PT,
        characterSpacing: 1.6,
      });
    doc
      .font(PDF_FONT.bold)
      .fontSize(30)
      .text(slide.title, G.margin * PT, 2.14 * PT, {
        width: (G.slideW - 2 * G.margin) * PT,
      });
    doc
      .moveTo(G.margin * PT, 3.02 * PT)
      .lineTo((G.margin + 2.2) * PT, 3.02 * PT)
      .lineWidth(2.25)
      .strokeColor(hex(P.accent))
      .stroke();
  } else {
    doc
      .fillColor(hex(P.accent))
      .font(PDF_FONT.bold)
      .fontSize(10)
      .text(slide.kicker.toUpperCase(), G.margin * PT, G.kickerY * PT, {
        width: (G.slideW - 2 * G.margin) * PT,
        characterSpacing: 1.4,
      });
    doc
      .fillColor(hex(P.dominant))
      .font(PDF_FONT.bold)
      .fontSize(21)
      .text(slide.title, G.margin * PT, (G.titleY + 0.08) * PT, {
        width: (G.slideW - 2 * G.margin) * PT,
      });
    const ruleY = (G.titleY + G.titleH + 0.06) * PT;
    doc
      .moveTo(G.margin * PT, ruleY)
      .lineTo((G.slideW - G.margin) * PT, ruleY)
      .lineWidth(0.75)
      .strokeColor(hex(P.hairline))
      .stroke();
  }

  for (const body of slide.bodies) {
    const r = rect(body);
    if (body.kind === 'bullets') {
      doc
        .fillColor(slide.cover ? hex(P.white) : hex(P.text))
        .font(PDF_FONT.regular)
        .fontSize(slide.cover ? 12 : 12.5);
      let y = r.y;
      for (const item of body.items) {
        doc.circle(r.x + 3, y + 6, 2).fill(slide.cover ? hex(P.accent) : hex(P.dominant));
        doc.fillColor(slide.cover ? hex(P.white) : hex(P.text));
        doc.text(item, r.x + 14, y, { width: r.w - 14 });
        y = doc.y + 7;
      }
    } else if (body.kind === 'stat') {
      doc.rect(r.x, r.y, r.w, r.h).fill(hex(P.surface));
      doc
        .fillColor(hex(P.dominant))
        .font(PDF_FONT.bold)
        .fontSize(26)
        .text(body.value, r.x + 12, r.y + 10, { width: r.w - 24 });
      doc
        .fillColor(hex(P.muted))
        .font(PDF_FONT.regular)
        .fontSize(10)
        .text(body.caption, r.x + 12, r.y + r.h * 0.56, { width: r.w - 24 });
    } else if (body.kind === 'table') {
      renderTable(doc, body);
    } else {
      renderChart(doc, body);
    }
  }

  if (slide.takeaway) {
    doc
      .fillColor(hex(P.supporting))
      .font(PDF_FONT.italic)
      .fontSize(10)
      .text(slide.takeaway, takeawayRect().x * PT, (takeawayRect().y + 0.03) * PT, {
        width: takeawayRect().w * PT,
        lineBreak: false,
        ellipsis: true,
      });
  }

  if (!slide.cover) {
    const ruleY = (G.footerY - 0.08) * PT;
    doc
      .moveTo(G.margin * PT, ruleY)
      .lineTo((G.slideW - G.margin) * PT, ruleY)
      .lineWidth(0.75)
      .strokeColor(hex(P.hairline))
      .stroke();
    doc
      .fillColor(hex(P.muted))
      .font(PDF_FONT.regular)
      .fontSize(8.5)
      .text(model.confidentiality, G.margin * PT, (G.footerY + 0.06) * PT, {
        width: (G.slideW - 2 * G.margin) * PT * 0.7,
        lineBreak: false,
        ellipsis: true,
      });
    doc.text(`${index + 1} / ${total}`, (G.margin + (G.slideW - 2 * G.margin) * 0.7) * PT, (G.footerY + 0.06) * PT, {
      width: (G.slideW - 2 * G.margin) * PT * 0.3,
      align: 'right',
      lineBreak: false,
    });
  }
}

export async function renderAssessmentDeckPdf(model: DeckModel): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [G.slideW * PT, G.slideH * PT],
    margin: 0,
    autoFirstPage: false,
    info: {
      Title: model.title,
      Author: 'Consultify',
      Subject: 'Raport z oceny dojrzałości cyfrowej DRD',
    },
  });
  registerPdfFonts(doc);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  model.slides.forEach((slide, index) => {
    doc.addPage();
    renderSlide(doc, model, slide, index, model.slides.length);
  });
  doc.end();
  return done;
}
