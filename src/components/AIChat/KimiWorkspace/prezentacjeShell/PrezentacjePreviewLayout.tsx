/**
 * PrezentacjePreviewLayout — canvas content for the Prezentacje lane
 * under the MELS shell (`ExecutiveModuleShell` adapter, archetyp E Deck).
 *
 * This mirrors the deck-preview rendering the legacy
 * `<KimiWorkspaceShell lane="prezentacje">` already performs inline
 * (`KimiWorkspaceShell.tsx` — `preview.type === 'deck'` branch): summary
 * banner + lifecycle badge, KPI tiles, slide list (title + intent +
 * bullet points), and an "Open in Builder" CTA. It does NOT invent new
 * rendering — it reflects the existing shape 1:1, swapping the legacy
 * `fuchsia-*` literal accent for the `c-info` token (MELS token rule:
 * no hex/literal-palette accents in new code).
 *
 * Presentational only — no pipeline state, no data fetching.
 */

import { LayoutGrid, Presentation } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { deriveDeckBadgeFromNativeStatus } from '@/utils/deckLifecycleBadge';

import type { ArtifactPreview } from '../KimiWorkspaceShell';

export interface PrezentacjePreviewLayoutProps {
  preview: ArtifactPreview & { type: 'deck' };
  onOpenBuilder?: () => void;
}

const BADGE_TONE: Record<string, string> = {
  Exported: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  Reviewed: 'bg-c-info/15 text-c-info',
  Draft: 'bg-c-surface-raised text-c-text-secondary',
};

export const PrezentacjePreviewLayout: React.FC<PrezentacjePreviewLayoutProps> = ({
  preview,
  onOpenBuilder,
}) => {
  const { t } = useTranslation();
  const slides = preview.deckSlides ?? [];
  const hasSlides = slides.length > 0;
  const badge = preview.deckStatus ? deriveDeckBadgeFromNativeStatus(preview.deckStatus) : null;

  return (
    <div className="space-y-4" data-testid="prezentacje-mels-preview-layout">
      {preview.summary && (
        <div className="p-4 bg-c-surface-raised rounded-hig-md border border-c-border-subtle">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-c-text">{preview.summary}</p>
            {badge && (
              <span
                className={`ml-3 px-2.5 py-0.5 rounded-hig-full text-xs font-medium whitespace-nowrap ${
                  BADGE_TONE[badge] ?? BADGE_TONE.Draft
                }`}
              >
                {badge}
              </span>
            )}
          </div>
        </div>
      )}

      {preview.kpiItems && preview.kpiItems.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {preview.kpiItems.map((kpi, i) => (
            <div key={i} className="p-3 bg-c-surface rounded-hig-sm border border-c-border-subtle">
              <p className="text-xs text-c-text-secondary">{kpi.label}</p>
              <p className="text-lg font-semibold text-c-text mt-0.5">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {hasSlides ? (
        <div className="space-y-3">
          {slides.map((slide, i) => (
            <div
              key={slide.slideId}
              className="bg-c-surface rounded-hig-md border border-c-border-subtle overflow-hidden"
              data-testid={`prezentacje-mels-slide-${slide.slideId}`}
            >
              <div className="flex items-center gap-3 px-4 py-2.5 bg-c-surface-raised border-b border-c-border-subtle">
                <span className="w-7 h-7 rounded-hig-xs bg-c-info/15 text-c-info flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-c-text truncate">{slide.title}</p>
                  <p className="text-xs text-c-text-secondary">{slide.intent.replace(/_/g, ' ')}</p>
                </div>
              </div>
              {slide.bulletPoints && slide.bulletPoints.length > 0 && (
                <ul className="px-4 py-2.5 space-y-1">
                  {slide.bulletPoints.slice(0, 4).map((bp, bi) => (
                    <li key={bi} className="text-xs text-c-text-secondary flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-hig-full bg-c-info flex-shrink-0" />
                      {bp}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-c-surface rounded-hig-md border border-c-border-subtle overflow-hidden">
          <div className="p-8 text-center text-c-text-secondary">
            <Presentation size={24} className="mx-auto mb-3 opacity-50" aria-hidden />
            <p className="text-sm font-medium">{t('kimi.deckPreview', 'Presentation preview')}</p>
            {preview.deckId && onOpenBuilder && (
              <button
                type="button"
                onClick={onOpenBuilder}
                data-testid="prezentacje-mels-open-in-builder-empty"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-hig-sm text-sm font-medium bg-c-info/10 text-c-info hover:bg-c-info/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <LayoutGrid size={14} />
                {t('kimi.openInBuilder', 'Open in Builder')}
              </button>
            )}
          </div>
        </div>
      )}

      {preview.deckId && hasSlides && onOpenBuilder && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onOpenBuilder}
            data-testid="prezentacje-mels-open-in-builder-populated"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-hig-sm text-sm font-medium bg-c-info/10 text-c-info hover:bg-c-info/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <LayoutGrid size={14} />
            {t('kimi.openInBuilder', 'Open in Builder')}
          </button>
        </div>
      )}
    </div>
  );
};

export default PrezentacjePreviewLayout;
