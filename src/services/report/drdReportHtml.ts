/**
 * DRD Report — HTML generator (pure, self-contained)
 *
 * Produces a single publishing-grade HTML string for the 8-section DRD client
 * report. It is fully standalone (inline CSS + inline SVG) so it can be:
 *   - written to a file (sample / archive),
 *   - opened in a new browser window and printed to PDF (print-CSS A4),
 *   - served by a backend export route.
 *
 * Print model: A4 pages, margins, page breaks between major sections, running
 * header/footer via @page. Palette: blue/teal/slate — NO crimson (guarded by tests).
 *
 * HARD RULE: every number rendered comes from `DrdReportModel` (engine-derived).
 */

import type {
  DrdChapter,
  DrdGapCard,
  DrdReportModel,
  DrdRoadmapItem,
} from './drdReportModel';
import {
  buildDimensionBarsSvg,
  buildMatrixSvg,
  buildRadarSvg,
  DRD_REPORT_PALETTE,
} from './drdReportSvg';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Strings {
  reportTitle: string;
  subtitle: string;
  credibility: string;
  completeness: string;
  confidence: string;
  areasAssessed: string;
  execSummary: string;
  radarTitle: string;
  radarLegendActual: string;
  radarLegendTarget: string;
  matrixTitle: string;
  matrixLegend: string;
  topGaps: string;
  whatIs: string;
  whatMeans: string;
  whatToDo: string;
  effect: string;
  roadmapTitle: string;
  wave: string;
  impact: string;
  effort: string;
  area: string;
  gap: string;
  chaptersTitle: string;
  areaCol: string;
  actualCol: string;
  targetCol: string;
  gapCol: string;
  levelCol: string;
  methodologyTitle: string;
  axis: string;
  areasCount: string;
  scale: string;
  overallLabel: string;
  target: string;
  stage: string;
  page: string;
  generated: string;
  low: string;
  medium: string;
  high: string;
  eightDNote: string;
  narrativeDeterministic: string;
}

const STR: Record<'pl' | 'en', Strings> = {
  pl: {
    reportTitle: 'Raport Diagnozy Dojrzałości Cyfrowej',
    subtitle: 'Digital Readiness Diagnosis (DRD)',
    credibility: 'Wskaźnik wiarygodności oceny',
    completeness: 'Kompletność',
    confidence: 'Pewność',
    areasAssessed: 'Obszary ocenione',
    execSummary: 'Streszczenie zarządcze',
    radarTitle: 'Profil dojrzałości — radar wymiarów',
    radarLegendActual: 'Stan aktualny',
    radarLegendTarget: 'Stan docelowy',
    matrixTitle: 'Macierz obszarów',
    matrixLegend: 'Kolor = wielkość luki (brak · niska · średnia · wysoka)',
    topGaps: 'Kluczowe luki (Top 3)',
    whatIs: 'Co jest',
    whatMeans: 'Co to znaczy',
    whatToDo: 'Co robić',
    effect: 'Efekt',
    roadmapTitle: 'Roadmapa transformacji — wpływ × nakład',
    wave: 'Fala',
    impact: 'Wpływ',
    effort: 'Nakład',
    area: 'Obszar',
    gap: 'Luka',
    chaptersTitle: 'Rozdziały wymiarów',
    areaCol: 'Obszar',
    actualCol: 'Aktualny',
    targetCol: 'Docelowy',
    gapCol: 'Luka',
    levelCol: 'Poziom aktualny',
    methodologyTitle: 'Załącznik metodyczny',
    axis: 'Oś',
    areasCount: 'Obszary',
    scale: 'Skala',
    overallLabel: 'Dojrzałość ogólna',
    target: 'Cel',
    stage: 'Faza',
    page: 'Strona',
    generated: 'Wygenerowano',
    low: 'niski',
    medium: 'średni',
    high: 'wysoki',
    eightDNote:
      'Radar komunikuje 7 mierzonych osi transformacji (wynik silnika). Warstwa komunikacyjna 8D (MAP-1.0) zostanie uzupełniona po dostarczeniu kanonu DRD.',
    narrativeDeterministic:
      'Narracja deterministyczna (bez modelu językowego). Liczby pochodzą z silnika oceny; interpretacje zostaną wzbogacone po podłączeniu narratora LLM.',
  },
  en: {
    reportTitle: 'Digital Readiness Diagnosis Report',
    subtitle: 'Digital Readiness Diagnosis (DRD)',
    credibility: 'Assessment credibility metric',
    completeness: 'Completeness',
    confidence: 'Confidence',
    areasAssessed: 'Areas assessed',
    execSummary: 'Executive Summary',
    radarTitle: 'Maturity profile — dimension radar',
    radarLegendActual: 'Current state',
    radarLegendTarget: 'Target state',
    matrixTitle: 'Area matrix',
    matrixLegend: 'Color = gap size (none · low · medium · high)',
    topGaps: 'Key gaps (Top 3)',
    whatIs: 'What is',
    whatMeans: 'What it means',
    whatToDo: 'What to do',
    effect: 'Effect',
    roadmapTitle: 'Transformation roadmap — impact × effort',
    wave: 'Wave',
    impact: 'Impact',
    effort: 'Effort',
    area: 'Area',
    gap: 'Gap',
    chaptersTitle: 'Dimension chapters',
    areaCol: 'Area',
    actualCol: 'Current',
    targetCol: 'Target',
    gapCol: 'Gap',
    levelCol: 'Current level',
    methodologyTitle: 'Methodology appendix',
    axis: 'Axis',
    areasCount: 'Areas',
    scale: 'Scale',
    overallLabel: 'Overall maturity',
    target: 'Target',
    stage: 'Stage',
    page: 'Page',
    generated: 'Generated',
    low: 'low',
    medium: 'medium',
    high: 'high',
    eightDNote:
      'The radar communicates the 7 measured transformation axes (engine output). The 8D communication layer (MAP-1.0) will be completed once the DRD canon is delivered.',
    narrativeDeterministic:
      'Deterministic narrative (no language model). Numbers come from the assessment engine; interpretations will be enriched once the LLM narrator is connected.',
  },
};

function levelWord(v: 'low' | 'medium' | 'high', s: Strings): string {
  return v === 'high' ? s.high : v === 'medium' ? s.medium : s.low;
}

function renderGapCard(card: DrdGapCard, s: Strings, index: number): string {
  const [pIs, pMeans, pDo, pEffect] = card.narrative.paragraphs;
  return `
  <div class="gap-card">
    <div class="gap-card__head">
      <span class="gap-card__badge">${index + 1}</span>
      <div>
        <h3>${esc(card.areaName)}</h3>
        <p class="gap-card__axis">${esc(card.axisName)} · ${card.actual}/${card.maxLevel} → ${card.target}/${card.maxLevel} · ${s.gap} ${card.gap}</p>
      </div>
    </div>
    <dl class="gap-card__body">
      <dt>${s.whatIs}</dt><dd>${esc(pIs)}</dd>
      <dt>${s.whatMeans}</dt><dd>${esc(pMeans)}</dd>
      <dt>${s.whatToDo}</dt><dd>${esc(pDo)}</dd>
      <dt>${s.effect}</dt><dd>${esc(pEffect)}</dd>
    </dl>
  </div>`;
}

function renderRoadmap(items: DrdRoadmapItem[], s: Strings): string {
  const waves: DrdRoadmapItem['wave'][] = ['F1', 'F2', 'F3'];
  return waves
    .map((w) => {
      const rows = items.filter((i) => i.wave === w);
      if (rows.length === 0) return '';
      const body = rows
        .map(
          (i) => `
      <tr>
        <td>${esc(i.areaName)}</td>
        <td class="muted">${esc(i.axisName)}</td>
        <td><span class="chip chip--${i.impact}">${levelWord(i.impact, s)}</span></td>
        <td><span class="chip chip--${i.effort}">${levelWord(i.effort, s)}</span></td>
        <td class="num">${i.gap}</td>
      </tr>`
        )
        .join('');
      return `
    <div class="wave">
      <h3 class="wave__title">${s.wave} ${w}</h3>
      <table class="tbl">
        <thead><tr><th>${s.area}</th><th>${s.axis}</th><th>${s.impact}</th><th>${s.effort}</th><th class="num">${s.gap}</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
    })
    .join('');
}

function renderChapter(ch: DrdChapter, s: Strings): string {
  const rows = ch.areas
    .map(
      (a) => `
    <tr>
      <td>${esc(a.areaId)} · ${esc(a.areaName)}</td>
      <td class="num">${a.actual}/${a.maxLevel}</td>
      <td class="num">${a.target}/${a.maxLevel}</td>
      <td class="num">${a.gap}</td>
      <td class="muted">${esc(a.currentLevelTitle)}</td>
    </tr>`
    )
    .join('');
  return `
  <section class="chapter">
    <div class="chapter__head">
      <h3>${esc(ch.axisName)}</h3>
      <span class="chapter__score">${ch.actual}/${ch.maxLevel} → ${ch.target}/${ch.maxLevel}</span>
    </div>
    ${ch.narrative.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
    <table class="tbl">
      <thead><tr><th>${s.areaCol}</th><th class="num">${s.actualCol}</th><th class="num">${s.targetCol}</th><th class="num">${s.gapCol}</th><th>${s.levelCol}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

/** Build the complete standalone HTML document for the DRD report. */
export function buildDrdReportHtml(model: DrdReportModel): string {
  const lang = model.meta.language;
  const s = { ...STR[lang], language: lang } as Strings & { language: 'pl' | 'en' };
  const P = DRD_REPORT_PALETTE;

  const radar = buildRadarSvg(model.dimensions);
  const matrix = buildMatrixSvg(model.areas);
  const bars = buildDimensionBarsSvg(model.dimensions);

  const benchmark = model.meta.benchmark
    ? `<div class="metric"><span class="metric__label">${esc(model.meta.benchmark.label)}</span><span class="metric__value">${model.meta.benchmark.value}%</span></div>`
    : '';

  const css = `
    :root { --ink:${P.ink}; --muted:${P.muted}; --actual:${P.actual}; --target:${P.target}; --grid:${P.grid}; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: -apple-system, "Segoe UI", Inter, Roboto, Arial, sans-serif; color: var(--ink); font-size: 13px; line-height: 1.55; background: #f8fafc; }
    .page { background:#fff; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 22mm 20mm; position: relative; box-shadow: 0 1px 6px rgba(15,23,42,.08); }
    h1 { font-size: 30px; margin: 0 0 6px; letter-spacing: -.02em; }
    h2 { font-size: 20px; margin: 0 0 14px; padding-bottom: 6px; border-bottom: 2px solid var(--actual); color: var(--ink); }
    h3 { font-size: 15px; margin: 0; }
    p { margin: 0 0 10px; }
    .muted { color: var(--muted); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .section-tag { display:inline-block; font-size: 11px; letter-spacing:.14em; text-transform: uppercase; color: var(--target); font-weight: 600; margin-bottom: 4px; }
    /* Cover */
    .cover { display:flex; flex-direction: column; justify-content: center; min-height: 253mm; }
    .cover__brand { font-size:12px; letter-spacing:.22em; text-transform:uppercase; color: var(--muted); margin-bottom: 28px; }
    .cover__org { font-size: 22px; font-weight:600; margin: 16px 0 6px; color: var(--actual); }
    .cover__meta { color: var(--muted); margin-top: 6px; }
    .credibility { margin-top: 44px; border:1px solid var(--grid); border-radius: 14px; padding: 20px 22px; display:flex; gap: 30px; flex-wrap: wrap; background: linear-gradient(180deg,#f0f9ff, #ffffff); }
    .metric { display:flex; flex-direction:column; }
    .metric__label { font-size: 11px; text-transform: uppercase; letter-spacing:.08em; color: var(--muted); }
    .metric__value { font-size: 26px; font-weight: 700; color: var(--ink); }
    .overall-band { display:flex; gap: 22px; align-items:baseline; margin: 8px 0 18px; flex-wrap: wrap; }
    .overall-band .big { font-size: 40px; font-weight: 800; color: var(--actual); }
    .overall-band .stage { font-size: 14px; font-weight:600; color: var(--target); }
    /* radar */
    .viz { display:flex; gap: 24px; align-items:center; flex-wrap: wrap; }
    .viz svg { display:block; width: 100%; max-width: 100%; height: auto; }
    .legend { display:flex; gap:18px; margin-top:10px; font-size:12px; }
    .legend span::before { content:''; display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:6px; vertical-align:middle; }
    .legend .l-actual::before { background: var(--actual); }
    .legend .l-target::before { background: var(--target); opacity:.4; }
    /* tables */
    .tbl { width:100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 12px; }
    .tbl th { text-align:left; background:#f1f5f9; padding: 7px 9px; border-bottom: 1px solid var(--grid); font-weight:600; }
    .tbl td { padding: 6px 9px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
    .tbl th.num, .tbl td.num { text-align:right; }
    /* gap cards */
    .gap-card { border:1px solid var(--grid); border-left: 4px solid var(--target); border-radius: 10px; padding: 14px 16px; margin: 12px 0; break-inside: avoid; }
    .gap-card__head { display:flex; gap: 12px; align-items:center; margin-bottom: 8px; }
    .gap-card__badge { flex:0 0 auto; width: 28px; height:28px; border-radius: 8px; background: var(--actual); color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center; }
    .gap-card__axis { margin: 2px 0 0; font-size: 11px; color: var(--muted); }
    .gap-card__body { display:grid; grid-template-columns: 92px 1fr; gap: 4px 12px; margin: 0; }
    .gap-card__body dt { font-weight: 600; color: var(--target); font-size: 11px; text-transform: uppercase; letter-spacing:.04em; padding-top: 2px; }
    .gap-card__body dd { margin: 0; }
    /* roadmap chips */
    .wave { margin-bottom: 14px; break-inside: avoid; }
    .wave__title { color: var(--actual); font-size: 13px; margin-bottom: 4px; }
    .chip { display:inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight:600; }
    .chip--high { background:#fef3c7; color:#92400e; }
    .chip--medium { background:#e0f2fe; color:#075985; }
    .chip--low { background:#ccfbf1; color:#115e59; }
    .chapter { break-inside: avoid; margin-bottom: 16px; }
    .chapter__head { display:flex; justify-content: space-between; align-items:baseline; border-bottom:1px solid var(--grid); padding-bottom:4px; margin-bottom: 8px; }
    .chapter__score { font-variant-numeric: tabular-nums; color: var(--actual); font-weight:600; }
    .note { font-size: 11px; color: var(--muted); border-left: 3px solid var(--grid); padding-left: 10px; margin-top: 10px; }
    .narrative-flag { font-size: 11px; color: var(--target); border: 1px solid var(--grid); border-left: 3px solid var(--target); border-radius: 6px; padding: 8px 10px; margin: 0 0 12px; background: #f0f9ff; }
    .foot { position:absolute; bottom: 12mm; left: 20mm; right: 20mm; display:flex; justify-content: space-between; font-size: 10px; color: var(--muted); border-top:1px solid var(--grid); padding-top: 5px; }
    @page { size: A4; margin: 16mm; @bottom-center { content: counter(page); } }
    @media print {
      body { background:#fff; }
      .page { box-shadow:none; margin: 0; width: auto; min-height: auto; padding: 0; }
      .page-break { page-break-before: always; }
    }
  `;

  const foot = (n: number) =>
    `<div class="foot"><span>${esc(model.meta.organizationName)} · ${s.subtitle}</span><span>${s.page} ${n}</span></div>`;

  // --- Section 1: Cover ---
  const cover = `
  <div class="page">
    <div class="cover">
      <div class="cover__brand">DBR77 · Digital Pathfinder</div>
      <h1>${s.reportTitle}</h1>
      <div class="cover__org">${esc(model.meta.organizationName)}</div>
      <div class="cover__meta">${s.subtitle}${model.meta.assessmentName ? ` · ${esc(model.meta.assessmentName)}` : ''}</div>
      <div class="cover__meta">${s.generated}: ${esc(model.meta.reportDate)}</div>
      <div class="credibility">
        <div class="metric"><span class="metric__label">${s.credibility}</span><span class="metric__value">${model.credibility.confidenceLabel}</span></div>
        <div class="metric"><span class="metric__label">${s.completeness}</span><span class="metric__value">${model.credibility.completionPercent}%</span></div>
        <div class="metric"><span class="metric__label">${s.areasAssessed}</span><span class="metric__value">${model.credibility.assessedAreas}/${model.credibility.totalAreas}</span></div>
        <div class="metric"><span class="metric__label">${s.overallLabel}</span><span class="metric__value">${model.overall.actualPercent}%</span></div>
        ${benchmark}
      </div>
    </div>
    ${foot(1)}
  </div>`;

  // --- Section 2: Executive summary ---
  const exec = `
  <div class="page page-break">
    <span class="section-tag">01</span>
    <h2>${s.execSummary}</h2>
    <div class="overall-band">
      <span class="big">${model.overall.actualPercent}%</span>
      <span class="muted">→ ${s.target} ${model.overall.targetPercent}%</span>
      <span class="stage">${s.stage}: ${esc(model.overall.maturityStage)}</span>
    </div>
    ${
      model.executiveSummary.narrative === 'deterministic'
        ? `<p class="narrative-flag">${esc(s.narrativeDeterministic)}</p>`
        : ''
    }
    ${model.executiveSummary.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="note">${esc(model.executiveSummary.limits)}</p>
    ${foot(2)}
  </div>`;

  // --- Section 3: Radar ---
  const radarPage = `
  <div class="page page-break">
    <span class="section-tag">02</span>
    <h2>${s.radarTitle}</h2>
    <div class="viz">
      <div style="flex:0 0 420px; width:420px; max-width:420px;">${radar}</div>
      <div style="flex:1 1 240px; min-width:220px;">
        ${bars}
        <div class="legend"><span class="l-actual">${s.radarLegendActual}</span><span class="l-target">${s.radarLegendTarget}</span></div>
        <p class="note">${s.eightDNote}</p>
      </div>
    </div>
    ${foot(3)}
  </div>`;

  // --- Section 4: Matrix ---
  const matrixPage = `
  <div class="page page-break">
    <span class="section-tag">03</span>
    <h2>${s.matrixTitle}</h2>
    <div class="viz"><div style="flex:1 1 auto;">${matrix}</div></div>
    <p class="muted" style="font-size:11px;">${s.matrixLegend}</p>
    ${foot(4)}
  </div>`;

  // --- Section 5: Top gap cards ---
  const gapsPage = `
  <div class="page page-break">
    <span class="section-tag">04</span>
    <h2>${s.topGaps}</h2>
    ${model.gapCards.map((c, i) => renderGapCard(c, s, i)).join('')}
    ${foot(5)}
  </div>`;

  // --- Section 6: Roadmap ---
  const roadmapPage = `
  <div class="page page-break">
    <span class="section-tag">05</span>
    <h2>${s.roadmapTitle}</h2>
    ${renderRoadmap(model.roadmap, s)}
    ${foot(6)}
  </div>`;

  // --- Section 7: Chapters ---
  const chaptersPage = `
  <div class="page page-break">
    <span class="section-tag">06</span>
    <h2>${s.chaptersTitle}</h2>
    ${model.chapters.map((ch) => renderChapter(ch, s)).join('')}
    ${foot(7)}
  </div>`;

  // --- Section 8: Methodology appendix ---
  const methodRows = model.methodology.axes
    .map(
      (a) => `
    <tr>
      <td>${s.axis} ${a.id} · ${esc(lang === 'pl' ? a.namePL || a.name : a.name)}</td>
      <td class="num">${a.areaCount}</td>
      <td class="num">1–${a.levelCount}</td>
    </tr>`
    )
    .join('');
  const methodPage = `
  <div class="page page-break">
    <span class="section-tag">07</span>
    <h2>${s.methodologyTitle}</h2>
    <p class="muted">${
      lang === 'pl'
        ? 'Metodyka DRD ocenia dojrzałość cyfrową w 7 osiach transformacji i 39 obszarach. Osie 1 i 4 stosują skalę 1–7, pozostałe 1–5; wartości procentowe normalizują skale dla porównań między osiami. Wszystkie liczby pochodzą wyłącznie z silnika oceny.'
        : 'The DRD methodology assesses digital maturity across 7 transformation axes and 39 areas. Axes 1 and 4 use a 1–7 scale, the rest 1–5; percentage values normalize the scales for cross-axis comparison. All numbers originate solely from the assessment engine.'
    }</p>
    <table class="tbl">
      <thead><tr><th>${s.axis}</th><th class="num">${s.areasCount}</th><th class="num">${s.scale}</th></tr></thead>
      <tbody>${methodRows}</tbody>
    </table>
    ${foot(8)}
  </div>`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(s.reportTitle)} — ${esc(model.meta.organizationName)}</title>
<style>${css}</style>
</head>
<body>
${cover}
${exec}
${radarPage}
${matrixPage}
${gapsPage}
${roadmapPage}
${chaptersPage}
${methodPage}
</body>
</html>`;
}
