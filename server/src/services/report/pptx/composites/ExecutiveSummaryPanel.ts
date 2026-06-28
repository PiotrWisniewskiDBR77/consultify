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

export interface ExecutiveSummaryPanelProps {
  headline: string;
  kpis?: KpiData[];
  keyFindings: string[];
  recommendation?: string;
  position: ElementPosition;
}

export function ExecutiveSummaryPanel(
  props: ExecutiveSummaryPanelProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const elements: RenderedElement[] = [];

  // W7 anti-sparseness: rozłóż bloki przez distributeY('fill') przez cały region
  // contentH, tak by callout rekomendacji siadał NISKO (~y 4.4-4.8), a findings
  // wypełniały środek — zero pustego dołu.
  const hasKpis = !!(props.kpis && props.kpis.length > 0);
  const hasReco = !!props.recommendation;

  const headlineH = 0.72;
  const kpiH = 0.92;
  const dividerH = 0.02; // cienka linia (gap w distributeY robi odstęp)
  const recoH = 0.55;

  // Findings biorą cały „luz" regionu: liczymy ile zostaje po stałych blokach
  // i minimalnych odstępach, by stos sięgał dołu zamiast się zbijać u góry.
  const fixed =
    headlineH + (hasKpis ? kpiH : 0) + dividerH + (hasReco ? recoH : 0);
  const blockCount = 2 + (hasKpis ? 1 : 0) + (hasReco ? 1 : 0); // headline, divider, findings + opcje
  const minGap = 0.18;
  const findingsH = Math.max(1.2, p.h - fixed - minGap * (blockCount - 1));

  // Kolejność bloków = kolejność wysokości; distributeY zwraca y dla każdego.
  const rowHeights: number[] = [headlineH];
  if (hasKpis) rowHeights.push(kpiH);
  rowHeights.push(dividerH);
  rowHeights.push(findingsH);
  if (hasReco) rowHeights.push(recoH);

  const ys = distributeY({ y: p.y, h: p.h }, rowHeights, 'fill', minGap);
  let idx = 0;

  // Headline — do 2 linii.
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
