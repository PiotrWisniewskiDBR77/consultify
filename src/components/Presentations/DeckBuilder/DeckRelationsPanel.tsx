/**
 * DeckRelationsPanel — deck-level "Powiązania" right-rail panel.
 *
 * Aggregates the per-card `source_refs` (already rendered inline by
 * `CardSourceFooter`/`SourceTraceability`) into a single deduplicated,
 * clickable list for the whole deck — satisfies the cross-cutting rule
 * "Powiązania first-class" without adding a new backend endpoint: the
 * data already lives on `deck.cards[].source_refs`.
 */

import { Link2 } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

import { SOURCE_ICONS, type SourceRef } from './SourceTraceability';

interface DeckRelationsPanelProps {
  cards: { card_id: string; title?: string; source_refs?: SourceRef[] }[];
}

interface AggregatedRef extends SourceRef {
  cardTitles: string[];
}

function navigateToSourceRef(navigate: ReturnType<typeof useNavigate>, ref: SourceRef): void {
  const artifactType = String(ref.artifact_type || '').toLowerCase();
  const artifactId = String(ref.artifact_id || '').trim();
  if (!artifactId) return;

  if (artifactType === 'initiative') {
    navigate(`${ROUTES.INITIATIVES}?open=${encodeURIComponent(artifactId)}&mode=doc`);
    return;
  }
  if (artifactType === 'financial_analysis') {
    navigate(`${ROUTES.ECONOMICS}?initiativeId=${encodeURIComponent(artifactId)}`);
    return;
  }
  if (artifactType === 'report') {
    navigate(`${ROUTES.REPORTS.BUILDER}/${encodeURIComponent(artifactId)}`);
    return;
  }
  if (artifactType === 'tool_session') {
    navigate(`${ROUTES.DISCOVERY_TOOLS.ROOT}?artifact=${encodeURIComponent(`tool:${artifactId}`)}`);
    return;
  }
  if (artifactType === 'note') {
    navigate(ROUTES.MY_WORK);
  }
}

export const DeckRelationsPanel: React.FC<DeckRelationsPanelProps> = ({ cards }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const aggregated = useMemo<AggregatedRef[]>(() => {
    const byId = new Map<string, AggregatedRef>();
    for (const card of cards) {
      for (const ref of card.source_refs || []) {
        if (!ref?.artifact_id) continue;
        const existing = byId.get(ref.artifact_id);
        const cardTitle = card.title || '';
        if (existing) {
          if (cardTitle && !existing.cardTitles.includes(cardTitle)) {
            existing.cardTitles.push(cardTitle);
          }
        } else {
          byId.set(ref.artifact_id, { ...ref, cardTitles: cardTitle ? [cardTitle] : [] });
        }
      }
    }
    return Array.from(byId.values());
  }, [cards]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4" data-testid="deck-relations-panel">
      <div className="mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-c-text">
          <Link2 className="h-4 w-4 text-c-text-secondary" />
          {t('presentations.relations.title', 'Powiązania')}
        </h3>
        <p className="text-xs text-c-text-secondary">
          {t(
            'presentations.relations.subtitle',
            'Wszystkie źródła powiązane z tą prezentacją — kliknij, aby przejść do artefaktu.'
          )}
        </p>
      </div>

      {aggregated.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-c-border-subtle p-6 text-center">
          <p className="text-xs text-c-text-secondary">
            {t(
              'presentations.relations.empty',
              'Brak powiązanych źródeł. Bloki wygenerowane z inicjatyw, analiz i narzędzi pojawią się tutaj.'
            )}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5" data-testid="deck-relations-list">
          {aggregated.map((ref) => {
            const Icon = SOURCE_ICONS[ref.artifact_type] || Link2;
            return (
              <li key={ref.artifact_id}>
                <button
                  type="button"
                  onClick={() => navigateToSourceRef(navigate, ref)}
                  className="flex w-full items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-left transition-colors hover:bg-c-surface-raised focus:outline-none focus:ring-2 focus:ring-c-focus"
                  title={t('presentations.relations.jumpTo', 'Przejdź do artefaktu')}
                >
                  <Icon size={14} className="mt-0.5 shrink-0 text-c-info" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-c-text">{ref.artifact_name}</span>
                    <span className="block truncate text-[11px] text-c-text-secondary">
                      {ref.artifact_type}
                      {ref.cardTitles.length > 0
                        ? ` · ${t('presentations.relations.usedOnCount', {
                            defaultValue: 'użyte {{count}}×',
                            count: ref.cardTitles.length,
                          })}`
                        : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default DeckRelationsPanel;
