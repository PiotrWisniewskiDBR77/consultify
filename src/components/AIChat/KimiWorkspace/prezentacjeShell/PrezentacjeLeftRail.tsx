/**
 * PrezentacjeLeftRail — slide navigator / thumbnail rail for the
 * Prezentacje lane left rail (archetyp E Deck).
 *
 * Unlike `TabeleLeftRail` (an outline of document SECTIONS), the deck
 * lane's rail is a NAVIGATOR over `preview.deckSlides` — one row per
 * slide (number, title, intent, first bullet as a mini-thumbnail
 * preview), consistent with what `DeckBuilder`'s `SlideSorter` already
 * shows for slide navigation, but presentational-only here (read-only
 * generator preview, no drag/reorder).
 *
 * Token note: `TabeleLeftRail`'s active-row style
 * (`bg-c-accent-soft text-c-accent`) is a KNOWN MISTAKE — `c-accent` is
 * the crimson brand token and must never drive an active/selection
 * state. This rail uses a neutral background for the active row plus a
 * `c-focus` (blue) left-edge indicator instead.
 */

import { AlertTriangle, Presentation } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ArtifactPreview } from '../KimiWorkspaceShell';

export type PrezentacjeSlide = NonNullable<ArtifactPreview['deckSlides']>[number];

interface PrezentacjeLeftRailProps {
  slides: PrezentacjeSlide[];
  activeSlideId?: string | null;
  onSelect?: (slideId: string) => void;
  /** Slot rendered above the slide list (search / filter, currently unused). */
  toolsSlot?: React.ReactNode;
  emptyLabel?: string;
  testId?: string;
}

export const PrezentacjeLeftRail: React.FC<PrezentacjeLeftRailProps> = ({
  slides,
  activeSlideId,
  onSelect,
  toolsSlot,
  emptyLabel,
  testId,
}) => {
  const { t } = useTranslation();
  const empty = slides.length === 0;

  return (
    <div className="flex flex-col h-full text-sm" data-testid={testId ?? 'prezentacje-left-rail'}>
      {toolsSlot ? (
        <div className="px-3 pt-2 pb-2 flex-shrink-0" data-testid="prezentacje-left-rail-tools">
          {toolsSlot}
        </div>
      ) : null}

      <ul
        className="flex-1 overflow-y-auto py-1 space-y-1 px-2"
        role="listbox"
        aria-label={t('prezentacje.leftRail.ariaLabel', 'Slide navigator')}
      >
        {empty ? (
          <li className="px-2 py-6 text-c-text-secondary text-xs italic flex items-center gap-2">
            <AlertTriangle size={14} className="flex-shrink-0" />
            {emptyLabel ?? t('prezentacje.leftRail.empty', 'No slides to display yet.')}
          </li>
        ) : (
          slides.map((slide, i) => {
            const active = slide.slideId === activeSlideId;
            const firstBullet = slide.bulletPoints?.[0];
            return (
              <li key={slide.slideId} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => onSelect?.(slide.slideId)}
                  className={`w-full flex items-start gap-2 rounded-hig-sm border px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                    active
                      ? 'border-c-focus bg-c-surface-raised'
                      : 'border-transparent hover:bg-c-surface-raised'
                  }`}
                  data-testid={`prezentacje-slide-nav-${slide.slideId}`}
                  data-active={active ? 'true' : 'false'}
                >
                  <span className="w-6 h-6 rounded-hig-xs bg-c-surface-raised border border-c-border-subtle text-c-text-secondary flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-c-text truncate">
                      {slide.title}
                    </span>
                    <span className="block text-[11px] text-c-text-secondary truncate">
                      {firstBullet || slide.intent.replace(/_/g, ' ')}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      {empty && (
        <div className="px-3 py-3 flex-shrink-0 text-c-text-secondary text-xs flex items-center gap-2 border-t border-c-border-subtle">
          <Presentation size={14} className="flex-shrink-0 opacity-60" />
          {t('prezentacje.leftRail.emptyHint', 'Slides will appear here once generated.')}
        </div>
      )}
    </div>
  );
};

export default PrezentacjeLeftRail;
