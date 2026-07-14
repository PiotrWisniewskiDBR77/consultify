/**
 * Composite: Executive Summary Panel
 * Board-level synthesis: headline + optional KPIs + key findings + recommendation.
 */
import { BodyText } from '../atomics/BodyText.js';
import { Bullet } from '../atomics/Bullet.js';
import { Divider } from '../atomics/Divider.js';
import type { DesignTokens, ElementPosition, KpiData, RenderedElement } from '../types.js';
import { KpiStrip } from './KpiStrip.js';
import { distributeY } from './verticalRhythm.js';

/**
 * Panel geometry variant — mirrors the on-screen `LayoutEngine` template the
 * FE renders for this slide, so the PPTX export reproduces the SAME shape
 * (P13 ekran = eksport parity). Defaults to `'stacked'` = today's behaviour.
 *   - `'stacked'`    → exec_full: one column, headline → KPIs → findings → reco.
 *   - `'top_kpi'`    → exec_top_kpi: KPI strip pinned full-width at the TOP,
 *                       findings/reco fill the region below.
 *   - `'split'`      → exec_left_bullets: findings on the LEFT column, KPIs +
 *                       recommendation on the RIGHT column.
 */
export type ExecutiveSummaryPanelVariant = 'stacked' | 'top_kpi' | 'split';

export interface ExecutiveSummaryPanelProps {
  headline: string;
  kpis?: KpiData[];
  keyFindings: string[];
  recommendation?: string;
  position: ElementPosition;
  /** On-screen layout variant to mirror. Omit → 'stacked' (back-compat). */
  variant?: ExecutiveSummaryPanelVariant;
}

export function ExecutiveSummaryPanel(
  props: ExecutiveSummaryPanelProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const variant = props.variant ?? 'stacked';
  if (variant === 'split') return execSummarySplit(props, tokens);
  if (variant === 'top_kpi') return execSummaryTopKpi(props, tokens);
  const elements: RenderedElement[] = [];

  // W7 anti-sparseness: rozłóż bloki przez distributeY('fill') przez cały region
  // contentH, tak by callout rekomendacji siadał NISKO (~y 4.4-4.8), a findings
  // wypełniały środek — zero pustego dołu.
  const hasKpis = !!(props.kpis && props.kpis.length > 0);
  const hasReco = !!props.recommendation;
  // Empty headline = layout deduped it against the slide title → skip the block
  // entirely so findings reclaim the reclaimed vertical space (no phantom gap).
  const hasHeadline = !!props.headline && props.headline.trim() !== '';

  const headlineH = hasHeadline ? 0.72 : 0;
  const kpiH = 0.92;
  const dividerH = 0.02; // cienka linia (gap w distributeY robi odstęp)
  const recoH = 0.55;

  // Kolejność bloków = kolejność wysokości; distributeY zwraca y dla każdego.
  const rowHeights: number[] = [];
  if (hasHeadline) rowHeights.push(headlineH);
  if (hasKpis) rowHeights.push(kpiH);
  rowHeights.push(dividerH);
  const findingsIdx = rowHeights.length;
  rowHeights.push(0); // findings — wysokość policzona niżej
  if (hasReco) rowHeights.push(recoH);

  // Findings biorą cały „luz" regionu: liczymy ile zostaje po stałych blokach
  // i minimalnych odstępach, by stos sięgał dołu zamiast się zbijać u góry.
  const minGap = 0.18;
  const fixed = headlineH + (hasKpis ? kpiH : 0) + dividerH + (hasReco ? recoH : 0);
  const findingsH = Math.max(1.2, p.h - fixed - minGap * (rowHeights.length - 1));
  rowHeights[findingsIdx] = findingsH;

  const ys = distributeY({ y: p.y, h: p.h }, rowHeights, 'fill', minGap);
  let idx = 0;

  // Headline — do 2 linii (pominięty gdy zdeduplikowany z tytułem slajdu).
  if (hasHeadline) {
    const headlineY = ys[idx++];
    elements.push(
      BodyText(
        {
          text: props.headline,
          position: { x: p.x, y: headlineY, w: p.w, h: headlineH },
          bold: true,
          fontSize: tokens.fontSizes.heading,
          color: tokens.colors.primary,
        },
        tokens
      )
    );
  }

  // KPI strip (if present, max 4 for exec summary)
  if (hasKpis) {
    const kpiY = ys[idx++];
    const kpiElements = KpiStrip(
      {
        kpis: props.kpis!.slice(0, 4),
        position: { x: p.x, y: kpiY, w: p.w, h: kpiH },
      },
      tokens
    );
    elements.push(...kpiElements);
  }

  // Divider
  const dividerY = ys[idx++];
  elements.push(
    Divider(
      {
        position: { x: p.x, y: dividerY, w: p.w, h: 0 },
      },
      tokens
    )
  );

  // Key findings — wypełniają środek do dołu.
  const findingsY = ys[idx++];
  elements.push(
    Bullet(
      {
        items: props.keyFindings.slice(0, 5),
        position: { x: p.x, y: findingsY, w: p.w, h: findingsH },
      },
      tokens
    )
  );

  // Recommendation callout — ostatni blok, siada nisko.
  if (hasReco) {
    const recoText = props.recommendation as string;
    const recoY = ys[idx++];
    elements.push({
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: p.x,
          y: recoY,
          w: p.w,
          h: recoH,
          fill: { color: tokens.colors.accent },
          rectRadius: 0.05,
        });
      },
    });
    elements.push(
      BodyText(
        {
          // Bez angielskiego prefiksu „Recommendation:" — zielony pasek niesie sens;
          // prefiks szpecił w polskim decku.
          text: recoText,
          position: { x: p.x + 0.15, y: recoY, w: p.w - 0.3, h: recoH },
          bold: true,
          color: tokens.colors.textInverse,
          valign: 'middle',
        },
        tokens
      )
    );
  }

  return elements;
}

// ── Recommendation callout (shared by the variant renderers) ──────────────────
function recoCallout(text: string, pos: ElementPosition, tokens: DesignTokens): RenderedElement[] {
  return [
    {
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: pos.x,
          y: pos.y,
          w: pos.w,
          h: pos.h,
          fill: { color: tokens.colors.accent },
          rectRadius: 0.05,
        });
      },
    },
    BodyText(
      {
        text,
        position: { x: pos.x + 0.15, y: pos.y, w: pos.w - 0.3, h: pos.h },
        bold: true,
        color: tokens.colors.textInverse,
        valign: 'middle',
      },
      tokens
    ),
  ];
}

function headlineElement(
  text: string,
  pos: ElementPosition,
  tokens: DesignTokens
): RenderedElement {
  return BodyText(
    {
      text,
      position: pos,
      bold: true,
      fontSize: tokens.fontSizes.heading,
      color: tokens.colors.primary,
    },
    tokens
  );
}

/**
 * `exec_top_kpi` — KPI strip pinned full-width at the TOP (below the headline),
 * findings fill the middle, recommendation sits low. Mirrors the FE
 * `"kpi" "content"` grid.
 */
function execSummaryTopKpi(
  props: ExecutiveSummaryPanelProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const elements: RenderedElement[] = [];
  const hasKpis = !!(props.kpis && props.kpis.length > 0);
  const hasReco = !!props.recommendation;
  const hasHeadline = !!props.headline && props.headline.trim() !== '';

  const headlineH = hasHeadline ? 0.7 : 0;
  const kpiH = hasKpis ? 1.0 : 0;
  const recoH = hasReco ? 0.55 : 0;
  const gap = 0.18;

  let y = p.y;
  if (hasHeadline) {
    elements.push(headlineElement(props.headline, { x: p.x, y, w: p.w, h: headlineH }, tokens));
    y += headlineH + gap;
  }

  if (hasKpis) {
    elements.push(
      ...KpiStrip(
        { kpis: props.kpis!.slice(0, 4), position: { x: p.x, y, w: p.w, h: kpiH } },
        tokens
      )
    );
    y += kpiH + gap;
  }

  const findingsBottom = p.y + p.h - (hasReco ? recoH + gap : 0);
  const findingsH = Math.max(1.0, findingsBottom - y);
  elements.push(
    Bullet(
      { items: props.keyFindings.slice(0, 6), position: { x: p.x, y, w: p.w, h: findingsH } },
      tokens
    )
  );

  if (hasReco) {
    elements.push(
      ...recoCallout(
        props.recommendation as string,
        { x: p.x, y: p.y + p.h - recoH, w: p.w, h: recoH },
        tokens
      )
    );
  }
  return elements;
}

/**
 * `exec_left_bullets` — split: key findings in the LEFT column, KPIs +
 * recommendation stacked in the RIGHT column. Mirrors the FE `"left right"`
 * grid (findings/prose left, data right).
 */
function execSummarySplit(
  props: ExecutiveSummaryPanelProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const elements: RenderedElement[] = [];
  const hasKpis = !!(props.kpis && props.kpis.length > 0);
  const hasReco = !!props.recommendation;
  const hasHeadline = !!props.headline && props.headline.trim() !== '';

  const headlineH = hasHeadline ? 0.7 : 0;
  const gap = 0.18;
  const colGap = 0.35;
  const leftW = p.w * 0.56;
  const rightX = p.x + leftW + colGap;
  const rightW = p.w - leftW - colGap;

  // Headline spans full width (pominięty gdy zdeduplikowany z tytułem slajdu).
  if (hasHeadline) {
    elements.push(headlineElement(props.headline, { x: p.x, y: p.y, w: p.w, h: headlineH }, tokens));
  }
  const bodyY = p.y + (hasHeadline ? headlineH + gap : 0);
  const bodyH = p.y + p.h - bodyY;

  // LEFT: key findings fill the column.
  elements.push(
    Bullet(
      { items: props.keyFindings.slice(0, 6), position: { x: p.x, y: bodyY, w: leftW, h: bodyH } },
      tokens
    )
  );

  // RIGHT: KPIs on top, recommendation at the bottom.
  const recoH = hasReco ? 0.6 : 0;
  if (hasKpis) {
    const kpiH = Math.max(1.0, bodyH - (hasReco ? recoH + gap : 0));
    elements.push(
      ...KpiStrip(
        { kpis: props.kpis!.slice(0, 4), position: { x: rightX, y: bodyY, w: rightW, h: kpiH } },
        tokens
      )
    );
  }
  if (hasReco) {
    elements.push(
      ...recoCallout(
        props.recommendation as string,
        { x: rightX, y: p.y + p.h - recoH, w: rightW, h: recoH },
        tokens
      )
    );
  }
  return elements;
}
