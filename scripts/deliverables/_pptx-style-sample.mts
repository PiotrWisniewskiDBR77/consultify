/**
 * _pptx-style-sample — Vegas Fala 6: BEFORE/AFTER próbka warstwy wizualnej PPTX.
 *
 * AFTER  = realny pipeline `deckPlansToPptxBuffer` (bundlePptxRuntime) z wpiętym
 *          DeckStyler (okładka/sekcje/stopka/teza/bullet discipline/guardy).
 * BEFORE = wierny replikat POPRZEDNIEGO minimalnego renderera ("3 z minusem":
 *          surowy tekst na białym, pasek akcentowy, brak dyscypliny/guardów),
 *          zbudowany na TYCH SAMYCH danych seed → uczciwe porównanie.
 *
 * Dane seed: scenariusz S06 (diagnoza rekrutacji ACME) — te same slajdy co w
 * _diag-deck, wzbogacone o `bullets` (celowo za długie/za liczne) + jeden
 * chartSpec, by pokazać dyscyplinę bullet i overflow-guard.
 *
 * RUN:
 *   node --import tsx scripts/deliverables/_pptx-style-sample.mts
 * OUT:
 *   docs/qa/deliverables/runs/PPTX-STYLE-SAMPLE-before.pptx
 *   docs/qa/deliverables/runs/PPTX-STYLE-SAMPLE-after.pptx
 */

import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deckPlansToPptxBuffer,
  type DeckPlanSlide,
} from '../../server/src/services/deliverables/bundlePptxRuntime.js';
import { resolveTheme, PPT_TYPE_SCALE } from '../../server/src/services/deliverables/themeRegistry.js';

const require = createRequire(import.meta.url);

const OUT_DIR = path.resolve('docs/qa/deliverables/runs');
const COMPANY = 'ACME';
const TITLE = 'Diagnoza procesu rekrutacji ACME';

// ── Seed plans (S06 narrative) — z bulletami i jednym wykresem ────────────────
const PLANS: DeckPlanSlide[] = [
  {
    slideIndex: 1,
    layoutIntent: 'executive_summary',
    title: 'Rekrutacja ACME kosztuje dwa razy za dużo czasu i pieniędzy',
    keyMessage:
      'Diagnoza wykazała trzy krytyczne wąskie gardła w procesie rekrutacji ACME; jedna rekomendacja — wdrożenie ATS — adresuje wszystkie trzy naraz.',
    bullets: [
      'Time-to-hire 62 dni — dwukrotnie powyżej benchmarku branżowego wynoszącego trzydzieści jeden dni',
      'Koszt pozyskania kandydata przekracza średnią rynkową o czterdzieści procent',
      'Brak ustandaryzowanego lejka i jednego źródła prawdy o kandydatach',
      'Rozproszone narzędzia — arkusze, maile, komunikatory — powodują utratę kandydatów',
      'Menedżerowie liniowi nie mają wglądu w status ani wskaźniki jakości zatrudnień',
      'Sześć ról otwartych ponad kwartał — realne straty produktywności zespołów',
    ],
  },
  {
    slideIndex: 2,
    layoutIntent: 'root_cause',
    title: 'Time-to-hire wynosi 62 dni — dwukrotnie powyżej benchmarku',
    keyMessage:
      'Najdłuższe etapy to selekcja CV (18 dni) i koordynacja rozmów (16 dni), oba w pełni automatyzowalne przez ATS z regułami i kalendarzem.',
    chartSpec: {
      type: 'bar_series',
      labels: ['Selekcja CV', 'Rozmowy', 'Decyzja', 'Oferta'],
      series: [{ name: 'Dni', values: [18, 16, 9, 19] }],
    },
  },
  {
    slideIndex: 3,
    layoutIntent: 'recommendation_single',
    title: 'Wdrożenie ATS skraca time-to-hire o 40% w dwa kwartały',
    keyMessage:
      'Rekomendujemy wdrożenie systemu ATS z ustandaryzowanym lejkiem, automatyczną selekcją CV i integracją kalendarza — pilotaż na jednym dziale, potem skalowanie.',
    bullets: [
      'Kwartał 1 — pilotaż ATS na dziale IT, standaryzacja lejka',
      'Kwartał 2 — skalowanie na całą organizację, szkolenia menedżerów',
      'Oczekiwany efekt — 62 → 37 dni time-to-hire, koszt −30%',
    ],
  },
];

// ── BEFORE: wierny replikat POPRZEDNIEGO renderera (pre-DeckStyler) ───────────
async function renderBefore(): Promise<Buffer> {
  const theme = resolveTheme('executive');
  const hex = (c: string) => c.replace('#', '').toUpperCase();
  const headingFont = theme.fontPair.heading;
  const bodyFont = theme.fontPair.body;
  const dominant = hex(theme.palette.dominant);
  const accent = hex(theme.palette.accent);
  const neutral = hex(theme.palette.neutralText);

  const PptxGenJS: any = require('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = TITLE;

  // Slajd tytułowy — stary: wyśrodkowany tekst na granacie, bez spine/eyebrow/daty.
  const title = pptx.addSlide();
  title.background = { color: dominant };
  title.addText(TITLE, {
    x: 0.6, y: 2.1, w: 8.8, h: 1.3,
    fontFace: headingFont, fontSize: PPT_TYPE_SCALE.coverTitle, bold: true, color: 'FFFFFF',
    align: 'left', valign: 'middle',
  });
  title.addText(COMPANY, {
    x: 0.6, y: 3.5, w: 8.8, h: 0.6,
    fontFace: bodyFont, fontSize: PPT_TYPE_SCALE.body, color: 'FFFFFF', align: 'left',
  });

  let n = 0;
  for (const plan of PLANS) {
    n++;
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.12, fill: { color: accent } });
    slide.addText(plan.title ?? '', {
      x: 0.6, y: 0.5, w: 8.8, h: 1.0,
      fontFace: headingFont, fontSize: PPT_TYPE_SCALE.slideTitle, bold: true, color: dominant,
      align: 'left', valign: 'top',
    });
    // Stary: cała proza + WSZYSTKIE bullety jako jeden blok tekstu bez dyscypliny/guardu.
    const body = [
      plan.keyMessage ?? '',
      ...(plan.bullets ?? []).map((b) => `• ${b}`),
    ].filter(Boolean).join('\n');
    slide.addText(body, {
      x: 0.6, y: 1.7, w: 8.8, h: 3.0,
      fontFace: bodyFont, fontSize: PPT_TYPE_SCALE.body, color: neutral,
      align: 'left', valign: 'top',
    });
    slide.addText(COMPANY, {
      x: 0.6, y: 5.25, w: 6, h: 0.3,
      fontFace: bodyFont, fontSize: PPT_TYPE_SCALE.caption, color: '999999', align: 'left',
    });
    slide.addText(String(n), {
      x: 9.0, y: 5.25, w: 0.6, h: 0.3,
      fontFace: bodyFont, fontSize: PPT_TYPE_SCALE.caption, color: '999999', align: 'right',
    });
  }

  const closing = pptx.addSlide();
  closing.background = { color: dominant };
  closing.addText('Dziękujemy', {
    x: 0.6, y: 2.3, w: 8.8, h: 1.0,
    fontFace: headingFont, fontSize: PPT_TYPE_SCALE.coverTitle, bold: true, color: 'FFFFFF', align: 'left',
  });

  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
}

(async () => {
  const before = await renderBefore();
  await writeFile(path.join(OUT_DIR, 'PPTX-STYLE-SAMPLE-before.pptx'), before);
  console.log(`BEFORE written: ${before.length} bytes`);

  const after = await deckPlansToPptxBuffer(PLANS, {
    themeId: 'executive',
    title: TITLE,
    company: COMPANY,
    language: 'pl',
    date: '2026-07-02',
  });
  if (!after) throw new Error('AFTER render returned null');
  await writeFile(path.join(OUT_DIR, 'PPTX-STYLE-SAMPLE-after.pptx'), after);
  console.log(`AFTER  written: ${after.length} bytes`);

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
