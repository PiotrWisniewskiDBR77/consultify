/**
 * Layout: Initiative Portfolio
 * Displays strategic initiatives as a grid of cards (2–3 columns).
 *
 * Design approach:
 * - When ≤4 items → 2×2 grid on single slide
 * - When 5–6 items → 3×2 grid (compact mode)
 * - When >6 items → auto-paginate (first 6 per slide)
 *
 * Each card shows: intent color bar, name, summary, impact/effort dots,
 * optional effort profile bars, timeline/owner metadata.
 */
import { BodyText } from '../atomics/BodyText.js';
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import type { InitiativeCardItem } from '../composites/InitiativeCard.js';
import { InitiativeCard } from '../composites/InitiativeCard.js';
import type {
  DesignTokens,
  InitiativePortfolioContent,
  LayoutResult,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

const MAX_PER_SLIDE = 6;

export function InitiativePortfolioLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as InitiativePortfolioContent;
  const elements = [];
  const g = tokens.grid;

  // ── Chrome ──
  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      {
        text:
          slide.key_message ||
          (meta.language === 'pl' ? 'Portfolio Inicjatyw' : 'Initiative Portfolio'),
      },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  // ── Grid calculation ──
  const initiatives = c.initiatives || [];
  const itemsOnThisSlide = initiatives.slice(0, MAX_PER_SLIDE);
  const count = itemsOnThisSlide.length;

  if (count === 0) {
    elements.push(
      BodyText(
        {
          text:
            meta.language === 'pl'
              ? 'Brak inicjatyw do wyświetlenia.'
              : 'No initiatives to display.',
          position: { x: g.contentX, y: g.contentY + 1.5, w: g.contentW, h: 0.4 },
          color: tokens.colors.textSecondary,
        },
        tokens
      )
    );
  } else {
    // Decide grid: cols × rows — fill the region with as few empty cells as possible.
    const cols = count === 1 ? 1 : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const gutter = tokens.spacing.gutter;
    const cardW = (g.contentW - (cols - 1) * gutter) / cols;
    const cardH = (g.contentH - (rows - 1) * gutter) / rows;

    // Show effort bars only when cards are large enough
    const showEffort = cardH >= 1.8;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = g.contentX + col * (cardW + gutter);
      const y = g.contentY + row * (cardH + gutter);

      const item = itemsOnThisSlide[i] as InitiativeCardItem;
      const cardElements = InitiativeCard(
        {
          item,
          position: { x, y, w: cardW, h: cardH },
          showEffortBars: showEffort,
        },
        tokens
      );
      elements.push(...cardElements);
    }
  }

  // ── Summary footer ──
  const totalInitiatives = initiatives.length;
  if (totalInitiatives > MAX_PER_SLIDE) {
    elements.push(
      BodyText(
        {
          text: `Showing ${MAX_PER_SLIDE} of ${totalInitiatives} initiatives`,
          position: { x: g.contentX, y: g.footerY - 0.15, w: g.contentW, h: 0.15 },
          color: tokens.colors.muted,
          fontSize: 8,
        },
        tokens
      )
    );
  }

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
