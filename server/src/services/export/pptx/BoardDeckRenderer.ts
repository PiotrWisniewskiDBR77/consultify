import JSZip from 'jszip';

export const BOARD_DECK_LAYOUT_ROLES = [
  'cover',
  'agenda',
  'section',
  'content-one',
  'content-two',
  'table',
  'chart',
  'decision',
] as const;

export type BoardDeckLayoutRole = (typeof BOARD_DECK_LAYOUT_ROLES)[number];

export type BoardDeckTable = {
  headers: string[];
  rows: Array<Array<string | number>>;
  totalRow?: Array<string | number>;
  columnWidths?: number[];
};

export type BoardDeckChart = {
  categories: string[];
  series: Array<{ name: string; values: number[] }>;
  target?: number;
  unit?: string;
};

export type BoardDeckDecisionOption = {
  label: string;
  title: string;
  meta?: string;
  body: string;
  recommended?: boolean;
};

export type BoardDeckDecisionMeta = {
  owner: string;
  dueBy: string;
  linkedRaid: string;
};

export type BoardDeckSlide = {
  role: BoardDeckLayoutRole;
  kicker?: string;
  title: string;
  subtitle?: string;
  keyMessage?: string;
  body?: string;
  bullets?: string[];
  columns?: Array<{ title: string; bullets: string[] }>;
  agenda?: Array<{ number?: string; title: string; detail?: string }>;
  table?: BoardDeckTable;
  chart?: BoardDeckChart;
  options?: BoardDeckDecisionOption[];
  recommendation?: string;
  decisionMeta?: BoardDeckDecisionMeta;
  source?: string;
};

export type BoardDeckSource = {
  title: string;
  organizationName: string;
  date: string;
  confidentiality: string;
  slides: BoardDeckSlide[];
  author?: string;
  subject?: string;
  company?: string;
  language?: 'en' | 'pl';
};

const C = {
  navy: '1B2A41',
  blue: '2563EB',
  text: '101828',
  muted: '667085',
  surface: 'F1F4F8',
  accentSoft: 'DCE6FA',
  line: 'D8DEE8',
  white: 'FFFFFF',
};

const G = { width: 13.333, height: 7.5, left: 0.82, right: 0.75, footerY: 7.1 };

function applyCanvas(slide: any, role: BoardDeckLayoutRole): void {
  const dark = role === 'cover' || role === 'section';
  slide.background = { color: dark ? C.navy : C.white };
  if (dark) {
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 0.16,
      h: G.height,
      fill: { color: C.blue },
      line: { color: C.blue },
    });
  }
}

function addText(slide: any, text: unknown, options: Record<string, unknown>): void {
  slide.addText(text, { margin: 0, breakLine: false, ...options });
}

function addHeader(slide: any, item: BoardDeckSlide): void {
  if (item.kicker) {
    addText(slide, item.kicker.toUpperCase(), {
      x: G.left,
      y: 0.36,
      w: 11.6,
      h: 0.18,
      fontSize: 7,
      bold: true,
      charSpacing: 1.5,
      color: C.blue,
    });
  }
  addText(slide, item.title, {
    x: G.left,
    y: 0.65,
    w: 11.7,
    h: 0.5,
    fontSize: 21,
    bold: true,
    color: C.navy,
    fit: 'shrink',
  });
  slide.addShape('line', {
    x: G.left,
    y: 1.23,
    w: 11.75,
    h: 0,
    line: { color: C.line, width: 0.8 },
  });
}

function addFooter(slide: any, src: BoardDeckSource, index: number): void {
  slide.addShape('line', {
    x: G.left,
    y: G.footerY - 0.1,
    w: 11.75,
    h: 0,
    line: { color: C.line, width: 0.5 },
  });
  addText(slide, `Consultify · ${src.organizationName} · ${src.confidentiality}`, {
    x: G.left,
    y: G.footerY,
    w: 9.8,
    h: 0.14,
    fontSize: 6.5,
    color: C.muted,
  });
  addText(slide, `slide ${index + 1}`, {
    x: 11.7,
    y: G.footerY,
    w: 0.85,
    h: 0.14,
    fontSize: 6.5,
    color: C.muted,
    align: 'right',
  });
}

function bulletRuns(items: string[]): Array<Record<string, unknown>> {
  return items.map((text) => ({
    text,
    options: { bullet: { indent: 12 }, hanging: 3, breakLine: true, paraSpaceAfterPt: 9 },
  }));
}

function renderCover(slide: any, item: BoardDeckSlide, src: BoardDeckSource): void {
  addText(slide, (item.kicker || 'CLIENT FINAL REVIEW').toUpperCase(), {
    x: 1.15,
    y: 1.48,
    w: 9.8,
    h: 0.2,
    fontSize: 7,
    bold: true,
    charSpacing: 1.8,
    color: '7FA8F5',
  });
  addText(slide, item.title, {
    x: 1.15,
    y: 1.95,
    w: 9.8,
    h: 1.25,
    fontSize: 31,
    bold: true,
    color: C.white,
    fit: 'shrink',
  });
  slide.addShape('line', { x: 1.15, y: 3.34, w: 1.8, h: 0, line: { color: C.blue, width: 2.5 } });
  addText(slide, item.subtitle || src.organizationName, {
    x: 1.15,
    y: 3.65,
    w: 8.5,
    h: 0.25,
    fontSize: 11,
    color: 'C8D4E6',
  });
  addText(slide, `${src.date} · Prepared by Consultify · DBR77`, {
    x: 1.15,
    y: 4.02,
    w: 8.5,
    h: 0.2,
    fontSize: 8,
    color: '8FA3C0',
  });
  addText(slide, '[CLIENT LOGO]', {
    x: 10.58,
    y: 0.72,
    w: 1.6,
    h: 0.42,
    fontSize: 7,
    color: '8FA3C0',
    align: 'center',
    valign: 'mid',
    fill: { color: '21344F' },
  });
  addText(slide, src.confidentiality.toUpperCase(), {
    x: 1.15,
    y: 6.55,
    w: 2.2,
    h: 0.18,
    fontSize: 6.5,
    bold: true,
    charSpacing: 1.4,
    color: '8FA3C0',
  });
}

function renderAgenda(slide: any, item: BoardDeckSlide): void {
  addHeader(slide, item);
  const rows = item.agenda || [];
  rows.slice(0, 7).forEach((row, i) => {
    const y = 1.55 + i * 0.68;
    addText(slide, row.number || String(i + 1).padStart(2, '0'), {
      x: 0.95,
      y,
      w: 0.45,
      h: 0.2,
      fontSize: 9,
      bold: true,
      color: C.blue,
    });
    addText(slide, row.title, {
      x: 1.62,
      y,
      w: 5.0,
      h: 0.23,
      fontSize: 10,
      bold: true,
      color: C.text,
    });
    addText(slide, row.detail || '', {
      x: 7.2,
      y,
      w: 4.5,
      h: 0.23,
      fontSize: 8,
      color: C.muted,
      fit: 'shrink',
    });
    slide.addShape('line', {
      x: 0.95,
      y: y + 0.34,
      w: 11.45,
      h: 0,
      line: { color: C.line, width: 0.5 },
    });
  });
}

function renderSection(slide: any, item: BoardDeckSlide): void {
  addText(slide, (item.kicker || 'SECTION').toUpperCase(), {
    x: 1.15,
    y: 2.15,
    w: 3,
    h: 0.2,
    fontSize: 7,
    bold: true,
    charSpacing: 1.8,
    color: '7FA8F5',
  });
  addText(slide, item.title, {
    x: 1.15,
    y: 2.58,
    w: 10.6,
    h: 0.78,
    fontSize: 28,
    bold: true,
    color: C.white,
    fit: 'shrink',
  });
  addText(slide, item.subtitle || item.keyMessage || '', {
    x: 1.15,
    y: 3.5,
    w: 9.6,
    h: 0.35,
    fontSize: 10,
    color: 'C8D4E6',
  });
}

function renderContentOne(slide: any, item: BoardDeckSlide): void {
  addHeader(slide, item);
  if (item.body)
    addText(slide, item.body, {
      x: 0.95,
      y: 1.55,
      w: 11.35,
      h: 0.65,
      fontSize: 12,
      color: C.text,
      breakLine: true,
      fit: 'shrink',
    });
  if (item.bullets?.length)
    addText(slide, bulletRuns(item.bullets), {
      x: 1.05,
      y: item.body ? 2.35 : 1.58,
      w: 11.05,
      h: 3.75,
      fontSize: 12,
      color: C.text,
      breakLine: true,
      valign: 'top',
      fit: 'shrink',
    });
  if (item.keyMessage) {
    slide.addShape('rect', {
      x: 0.95,
      y: 5.85,
      w: 11.35,
      h: 0.72,
      fill: { color: C.surface },
      line: { color: C.surface },
    });
    slide.addShape('rect', {
      x: 0.95,
      y: 5.85,
      w: 0.08,
      h: 0.72,
      fill: { color: C.blue },
      line: { color: C.blue },
    });
    addText(slide, 'SO WHAT', {
      x: 1.2,
      y: 5.96,
      w: 2,
      h: 0.16,
      fontSize: 6.5,
      bold: true,
      charSpacing: 1.2,
      color: C.blue,
    });
    addText(slide, item.keyMessage, {
      x: 1.2,
      y: 6.15,
      w: 10.75,
      h: 0.26,
      fontSize: 10,
      bold: true,
      color: C.text,
      fit: 'shrink',
    });
  }
}

function renderContentTwo(slide: any, item: BoardDeckSlide): void {
  addHeader(slide, item);
  const cols = (item.columns || []).slice(0, 2);
  cols.forEach((column, i) => {
    const x = 0.95 + i * 5.85;
    slide.addShape('rect', {
      x,
      y: 1.55,
      w: 5.5,
      h: 4.95,
      fill: { color: C.surface },
      line: { color: C.surface },
    });
    slide.addShape('line', {
      x,
      y: 1.55,
      w: 5.5,
      h: 0,
      line: { color: i ? C.blue : C.navy, width: 1.4 },
    });
    addText(slide, column.title, {
      x: x + 0.28,
      y: 1.82,
      w: 4.9,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: C.navy,
    });
    addText(slide, bulletRuns(column.bullets), {
      x: x + 0.34,
      y: 2.35,
      w: 4.75,
      h: 3.7,
      fontSize: 10.5,
      color: C.text,
      fit: 'shrink',
      valign: 'top',
    });
  });
}

function renderTable(slide: any, item: BoardDeckSlide): void {
  addHeader(slide, item);
  const table = item.table || { headers: [], rows: [] };
  const dataRows = table.totalRow ? [...table.rows, table.totalRow] : table.rows;
  const lastRowIndex = dataRows.length;
  const rows = [table.headers, ...dataRows].map((row, rowIndex) =>
    row.map((value, columnIndex) => ({
      text: String(value),
      options:
        rowIndex === 0
          ? { bold: true, color: C.white, fill: C.navy }
          : rowIndex === lastRowIndex && table.totalRow
            ? {
                bold: true,
                color: C.navy,
                fill: C.accentSoft,
                border: [
                  { type: 'solid', color: C.navy, pt: 1.1 },
                  { type: 'solid', color: C.line, pt: 0.5 },
                  { type: 'solid', color: C.line, pt: 0.5 },
                  { type: 'solid', color: C.line, pt: 0.5 },
                ],
              }
            : {
                bold: columnIndex === 0,
                color: columnIndex === 0 ? C.navy : C.text,
                fill: rowIndex % 2 === 0 ? C.surface : C.white,
              },
    }))
  );
  const rowHeights = [
    0.42,
    ...dataRows.map((row) => (row.some((value) => String(value).length > 34) ? 0.62 : 0.42)),
  ];
  slide.addTable(rows, {
    x: 0.95,
    y: 1.55,
    w: 11.35,
    colW: table.columnWidths,
    rowH: rowHeights,
    fontSize: 9,
    color: C.text,
    border: { type: 'solid', color: C.line, pt: 0.5 },
    fill: C.white,
    margin: 0.08,
    autoFit: false,
  });
}

function renderChart(slide: any, item: BoardDeckSlide, pptx: any): void {
  addHeader(slide, item);
  const chart = item.chart || { categories: [], series: [] };
  const seriesColors = [C.blue, C.navy, '7DA7FF'];
  const chartGroups: any[] = [
    {
      type: pptx.ChartType.bar,
      data: chart.series.map((series) => ({
        name: series.name,
        labels: chart.categories,
        values: series.values,
      })),
      options: {
        barDir: 'col',
        barGapWidthPct: 55,
        chartColors: chart.series.map((_, index) => seriesColors[index % seriesColors.length]),
        showValue: true,
        dataLabelPosition: 'outEnd',
      },
    },
  ];
  if (chart.target !== undefined) {
    chartGroups.push({
      type: pptx.ChartType.line,
      data: [
        {
          name: `Target ${chart.target}${chart.unit || ''}`,
          labels: chart.categories,
          values: chart.categories.map(() => chart.target!),
        },
      ],
      options: {
        chartColors: [C.muted],
        lineSize: 1.5,
        lineDash: 'dash',
        lineDataSymbol: 'none',
        showValue: false,
      },
    });
  }
  slide.addChart(chartGroups, {
    x: 0.95,
    y: 1.6,
    w: 7.6,
    h: 4.75,
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 8,
    showLegend: true,
    legendPos: 'b',
    showTitle: false,
    showCatName: false,
    showValAxisTitle: false,
    showCatAxisTitle: false,
    showBorder: false,
    showGridLines: false,
  });
  slide.addShape('rect', {
    x: 8.85,
    y: 1.6,
    w: 3.45,
    h: 4.75,
    fill: { color: C.surface },
    line: { color: C.surface },
  });
  addText(slide, item.keyMessage || item.body || '', {
    x: 9.15,
    y: 2.05,
    w: 2.85,
    h: 1.35,
    fontSize: 15,
    bold: true,
    color: C.navy,
    fit: 'shrink',
  });
  if (chart.target !== undefined)
    addText(slide, `Target ${chart.target}${chart.unit || ''}`, {
      x: 9.15,
      y: 3.78,
      w: 2.85,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: C.blue,
    });
}

function renderDecision(slide: any, item: BoardDeckSlide): void {
  addHeader(slide, item);
  const options = (item.options || []).slice(0, 2);
  options.forEach((option, i) => {
    const x = 0.95 + i * 5.85;
    slide.addShape('rect', {
      x,
      y: 1.55,
      w: 5.5,
      h: 2.55,
      fill: { color: option.recommended ? C.accentSoft : C.white },
      line: { color: option.recommended ? C.blue : C.line, width: option.recommended ? 1.5 : 0.8 },
    });
    addText(slide, option.label.toUpperCase(), {
      x: x + 0.28,
      y: 1.82,
      w: 1.4,
      h: 0.18,
      fontSize: 7,
      bold: true,
      color: C.blue,
      charSpacing: 1.2,
    });
    addText(slide, option.title, {
      x: x + 0.28,
      y: 2.2,
      w: 4.9,
      h: 0.38,
      fontSize: 13,
      bold: true,
      color: C.navy,
      fit: 'shrink',
    });
    addText(slide, option.body, {
      x: x + 0.28,
      y: option.meta ? 2.96 : 2.78,
      w: 4.9,
      h: option.meta ? 0.62 : 0.82,
      fontSize: 9,
      color: C.text,
      fit: 'shrink',
    });
    if (option.meta)
      addText(slide, option.meta, {
        x: x + 0.28,
        y: 2.66,
        w: 4.9,
        h: 0.2,
        fontSize: 9,
        color: C.muted,
      });
    if (option.recommended)
      addText(slide, 'RECOMMENDED', {
        x: x + 3.85,
        y: 1.77,
        w: 1.3,
        h: 0.28,
        fontSize: 6.5,
        bold: true,
        color: C.white,
        fill: { color: C.blue },
        align: 'center',
        valign: 'mid',
      });
  });
  if (item.recommendation) {
    slide.addShape('rect', {
      x: 0.95,
      y: 4.45,
      w: 11.35,
      h: 1.25,
      fill: { color: C.surface },
      line: { color: C.surface },
    });
    slide.addShape('rect', {
      x: 0.95,
      y: 4.45,
      w: 0.08,
      h: 1.25,
      fill: { color: C.blue },
      line: { color: C.blue },
    });
    addText(slide, 'RECOMMENDATION', {
      x: 1.22,
      y: 4.72,
      w: 2.0,
      h: 0.18,
      fontSize: 7,
      bold: true,
      color: C.blue,
      charSpacing: 1.2,
    });
    addText(slide, item.recommendation, {
      x: 1.22,
      y: 5.03,
      w: 10.6,
      h: 0.38,
      fontSize: 11,
      bold: true,
      color: C.navy,
      fit: 'shrink',
    });
  }
  if (item.decisionMeta) {
    const metadata = [
      ['DECISION OWNER', item.decisionMeta.owner],
      ['DUE BY', item.decisionMeta.dueBy],
      ['LINKED RAID', item.decisionMeta.linkedRaid],
    ];
    metadata.forEach(([label, value], index) => {
      const x = 0.95 + index * (11.35 / 3);
      addText(slide, label, {
        x,
        y: 5.86,
        w: 3.55,
        h: 0.16,
        fontSize: 6.5,
        bold: true,
        charSpacing: 0.8,
        color: C.muted,
      });
      addText(slide, value, {
        x,
        y: 6.08,
        w: 3.55,
        h: 0.48,
        fontSize: 9,
        color: C.text,
        valign: 'top',
        fit: 'shrink',
      });
    });
  }
}

async function removePptxGenJsPhantomMasterOverrides(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const contentTypes = zip.file('[Content_Types].xml');
  if (!contentTypes) return buffer;
  const xml = await contentTypes.async('string');
  const existing = new Set(Object.keys(zip.files));
  const cleaned = xml.replace(
    /<Override PartName="\/(ppt\/slideMasters\/slideMaster\d+\.xml)" ContentType="application\/vnd\.openxmlformats-officedocument\.presentationml\.slideMaster\+xml"\/>/g,
    (entry, part: string) => (existing.has(part) ? entry : '')
  );
  zip.file('[Content_Types].xml', cleaned);
  await Promise.all(
    Object.keys(zip.files)
      .filter((name) => name.endsWith('.xml'))
      .map(async (name) => {
        const file = zip.file(name);
        if (!file) return;
        const contents = await file.async('string');
        const themeDriven = contents.replace(/typeface="Arial"/g, 'typeface="+mn-lt"');
        if (themeDriven !== contents) zip.file(name, themeDriven);
      })
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function renderBoardDeckPptx(source: BoardDeckSource): Promise<Buffer> {
  const module = await import('pptxgenjs');
  const PptxGenJS = (module.default || module) as any;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = source.author || 'Consultify';
  pptx.company = source.company || 'Consultify · DBR77';
  pptx.subject = source.subject || source.title;
  pptx.title = source.title;
  pptx.lang = source.language || 'en';
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
    lang: source.language || 'en-US',
  };
  source.slides.forEach((item, index) => {
    const slide = pptx.addSlide();
    applyCanvas(slide, item.role);
    if (item.role === 'cover') renderCover(slide, item, source);
    else if (item.role === 'agenda') renderAgenda(slide, item);
    else if (item.role === 'section') renderSection(slide, item);
    else if (item.role === 'content-one') renderContentOne(slide, item);
    else if (item.role === 'content-two') renderContentTwo(slide, item);
    else if (item.role === 'table') renderTable(slide, item);
    else if (item.role === 'chart') renderChart(slide, item, pptx);
    else renderDecision(slide, item);

    if (item.role !== 'cover' && item.role !== 'section') addFooter(slide, source, index);
    if (item.source && item.role !== 'cover' && item.role !== 'section') {
      addText(slide, `Source: ${item.source}`, {
        x: G.left,
        y: 6.78,
        w: 9.5,
        h: 0.14,
        fontSize: 6.5,
        color: C.muted,
        fit: 'shrink',
      });
    }
  });

  const output = Buffer.from(await pptx.write({ outputType: 'nodebuffer' }));
  return removePptxGenJsPhantomMasterOverrides(output);
}
