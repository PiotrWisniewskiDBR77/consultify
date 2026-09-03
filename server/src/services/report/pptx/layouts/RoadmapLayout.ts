/**
 * Layout: Roadmap
 * Sequenced plan — horizontal phase bands (Now/Next/Later).
 */
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { RoadmapBand } from '../composites/RoadmapBand.js';
import type {
  DesignTokens,
  LayoutResult,
  RoadmapContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function RoadmapLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as RoadmapContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      { text: slide.key_message || (meta.language === 'pl' ? 'Plan Działania' : 'Roadmap') },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  const bandElements = RoadmapBand(
    {
      // Decks created before the canonical roadmap contract used
      // `{title,timing,owner}` rather than `{label,timeframe,items}`.  The
      // download route can legitimately render those persisted unified_json
      // slides directly, so normalize at the renderer boundary as the final
      // compatibility gate instead of assuming every upstream projection ran.
      phases: (Array.isArray((c as any)?.phases) ? (c as any).phases : []).map(
        (phase: any) => {
          const label = String(phase?.label || phase?.title || '').trim();
          const timeframe = String(phase?.timeframe || phase?.timing || '').trim();
          const items = Array.isArray(phase?.items)
            ? phase.items.map(String)
            : phase?.owner
              ? [`Owner: ${String(phase.owner)}`]
              : [];
          return { ...phase, label, timeframe, items };
        }
      ),
      position: { x: g.contentX, y: g.contentY, w: g.contentW, h: g.contentH },
    },
    tokens
  );
  elements.push(...bandElements);

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
