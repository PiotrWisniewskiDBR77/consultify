/**
 * assessmentDeckPptxRenderer — .pptx z modelu `assessmentDeckModel`.
 *
 * SUFIT pptxgenjs 4.x jest przyjęty świadomie, nie obchodzony: zero
 * gradientów, zero osadzania krojów. Dlatego (a) wszystkie wypełnienia są
 * płaskie, (b) fonty to wyłącznie Office-native (BRAND_EXPORT_CANON §11 D1),
 * (c) wykres jest NATYWNYM wykresem OOXML (`addChart`), a nie obrazkiem —
 * klient może kliknąć w słupek i zobaczyć liczbę.
 *
 * Renderer nie podejmuje ŻADNEJ decyzji o położeniu — bierze prostokąty z
 * modelu. To jest warunek tego, żeby test geometrii miał sens: gdyby renderer
 * przesuwał pola „na oko", sprawdzanie modelu nic by nie dowodziło.
 */
import PptxGenJS, { type Slide, type TextProps } from 'pptxgenjs';

import {
  DECK_FONTS,
  DECK_GEOMETRY as G,
  DECK_PALETTE as P,
  type DeckModel,
  type DeckSlide,
} from './assessmentDeckModel.js';

const FOOTER_RULE_Y = G.footerY - 0.08;

function stopka(slide: Slide, model: DeckModel, numer: number, total: number): void {
  slide.addShape('line', {
    x: G.margin,
    y: FOOTER_RULE_Y,
    w: G.slideW - 2 * G.margin,
    h: 0,
    line: { color: P.hairline, width: 0.75 },
  });
  slide.addText(model.confidentiality, {
    x: G.margin,
    y: G.footerY,
    w: (G.slideW - 2 * G.margin) * 0.7,
    h: G.footerH,
    fontFace: DECK_FONTS.body,
    fontSize: 9,
    color: P.muted,
    align: 'left',
    valign: 'middle',
  });
  slide.addText(`${numer} / ${total}`, {
    x: G.margin + (G.slideW - 2 * G.margin) * 0.7,
    y: G.footerY,
    w: (G.slideW - 2 * G.margin) * 0.3,
    h: G.footerH,
    fontFace: DECK_FONTS.body,
    fontSize: 9,
    color: P.muted,
    align: 'right',
    valign: 'middle',
  });
}

function renderSlide(
  pptx: PptxGenJS,
  model: DeckModel,
  slide: DeckSlide,
  index: number,
  total: number
): void {
  const s = pptx.addSlide();
  s.background = { color: slide.cover ? P.dominant : P.white };

  if (slide.cover) {
    s.addText(slide.kicker.toUpperCase(), {
      x: G.margin,
      y: 1.6,
      w: G.slideW - 2 * G.margin,
      h: 0.32,
      fontFace: DECK_FONTS.body,
      fontSize: 12,
      bold: true,
      charSpacing: 2,
      color: P.white,
      valign: 'middle',
    });
    s.addText(slide.title, {
      x: G.margin,
      y: 1.98,
      w: G.slideW - 2 * G.margin,
      h: 1.0,
      fontFace: DECK_FONTS.heading,
      fontSize: 32,
      bold: true,
      color: P.white,
      valign: 'middle',
    });
    s.addShape('line', {
      x: G.margin,
      y: 3.02,
      w: 2.2,
      h: 0,
      line: { color: P.accent, width: 2.25 },
    });
  } else {
    s.addText(slide.kicker.toUpperCase(), {
      x: G.margin,
      y: G.kickerY,
      w: G.slideW - 2 * G.margin,
      h: G.kickerH,
      fontFace: DECK_FONTS.body,
      fontSize: 11,
      bold: true,
      charSpacing: 2,
      color: P.accent,
      valign: 'middle',
    });
    s.addText(slide.title, {
      x: G.margin,
      y: G.titleY,
      w: G.slideW - 2 * G.margin,
      h: G.titleH,
      fontFace: DECK_FONTS.heading,
      fontSize: 24,
      bold: true,
      color: P.dominant,
      valign: 'middle',
    });
    s.addShape('line', {
      x: G.margin,
      y: G.titleY + G.titleH + 0.06,
      w: G.slideW - 2 * G.margin,
      h: 0,
      line: { color: P.hairline, width: 0.75 },
    });
  }

  for (const body of slide.bodies) {
    const r = body.rect;
    if (body.kind === 'bullets') {
      s.addText(
        body.items.map((item) => ({ text: item, options: { breakLine: true, bullet: true } })),
        {
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
          fontFace: DECK_FONTS.body,
          fontSize: slide.cover ? 14 : 15,
          color: slide.cover ? P.white : P.text,
          lineSpacingMultiple: 1.25,
          valign: 'top',
        }
      );
    } else if (body.kind === 'stat') {
      s.addShape('rect', { x: r.x, y: r.y, w: r.w, h: r.h, fill: { color: P.surface } });
      s.addText(body.value, {
        x: r.x + 0.16,
        y: r.y + 0.1,
        w: r.w - 0.32,
        h: r.h * 0.55,
        fontFace: DECK_FONTS.heading,
        fontSize: 30,
        bold: true,
        color: P.dominant,
        valign: 'middle',
      });
      s.addText(body.caption, {
        x: r.x + 0.16,
        y: r.y + r.h * 0.58,
        w: r.w - 0.32,
        h: r.h * 0.36,
        fontFace: DECK_FONTS.body,
        fontSize: 12,
        color: P.muted,
        valign: 'top',
      });
    } else if (body.kind === 'table') {
      const rows: TextProps[][] = [
        body.head.map((cell) => ({
          text: cell,
          options: {
            bold: true,
            color: P.white,
            fill: { color: P.dominant },
            fontFace: DECK_FONTS.body,
            fontSize: 12,
          },
        })),
        ...body.rows.map((row) =>
          row.map((cell) => ({
            text: cell,
            options: { color: P.text, fontFace: DECK_FONTS.body, fontSize: 12 },
          }))
        ),
      ];
      s.addTable(rows, {
        x: r.x,
        y: r.y,
        w: r.w,
        colW: body.widths.map((share) => share * r.w),
        border: { type: 'solid', color: P.hairline, pt: 0.75 },
        autoPage: false,
        valign: 'middle',
        margin: 0.06,
      });
    } else {
      s.addChart(
        'bar',
        body.series.map((serie) => ({
          name: serie.label,
          labels: [...body.categories],
          values: [...serie.values],
        })),
        {
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
          barDir: 'col',
          barGrouping: 'clustered',
          chartColors: [P.dominant, P.accent],
          showLegend: true,
          legendPos: 'b',
          legendFontFace: DECK_FONTS.body,
          legendFontSize: 10,
          catAxisLabelFontFace: DECK_FONTS.body,
          catAxisLabelFontSize: 9,
          valAxisLabelFontFace: DECK_FONTS.body,
          valAxisLabelFontSize: 9,
          valAxisMinVal: 0,
          valAxisMaxVal: body.maxValue,
          valAxisMajorUnit: 20,
          showValue: false,
          dataBorder: { pt: 0, color: P.white },
          catGridLine: { style: 'none' },
          valGridLine: { color: P.hairline, style: 'solid', size: 0.75 },
        }
      );
    }
  }

  if (slide.takeaway) {
    s.addText(slide.takeaway, {
      x: G.margin,
      y: G.contentY + G.contentH - 0.34,
      w: G.slideW - 2 * G.margin,
      h: 0.3,
      fontFace: DECK_FONTS.body,
      fontSize: 12,
      italic: true,
      color: P.supporting,
      valign: 'middle',
    });
  }

  if (!slide.cover) stopka(s, model, index + 1, total);
}

export async function renderAssessmentDeckPptx(model: DeckModel): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  // BRAND_EXPORT_CANON §4 „Metadane pliku": creator = Consultify (nie nazwisko
  // konsultanta — decyzja D5), title = nazwa deliverable, company = klient.
  pptx.author = 'Consultify';
  pptx.company = model.organizationName;
  pptx.title = model.title;
  pptx.subject = 'Raport z oceny dojrzałości cyfrowej DRD';

  model.slides.forEach((slide, index) =>
    renderSlide(pptx, model, slide, index, model.slides.length)
  );

  const data = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return Buffer.isBuffer(data) ? data : Buffer.from(data as unknown as ArrayBuffer);
}
