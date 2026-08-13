/**
 * FinanceLineageNavigator — Pakiet AP-CLIENT (Gate J), priorytet #1 (zamyka
 * OWN-FIN-007/022 — dwa wymagania właścicielskie z rejestru).
 *
 * Samodzielny, gotowy do osadzenia komponent: kompaktowy breadcrumb łańcucha
 * przodków (`Statement pack v3 → Analysis v2 → Baseline v4 → Scenario Bull v2
 * → Valuation v1`) z okresem/statusem/aktualnością każdego elementu, plus
 * panel „Powiązane" z licznikami i akcją „+ Nowy" per typ. NIE jest
 * montowany w żadnym workspace produkcyjnym w tym pakiecie (dev-render only,
 * do akceptu Piotra na zrzutach — CLAUDE.md #7).
 *
 * Za flagą `financeLineageNavigatorV1` (default OFF, `useFinanceLineageNavigatorFlag`):
 * przy `enabled=false` renderuje `null` PRZED jakimkolwiek wywołaniem sieciowym —
 * dowiedzione testem `flaga OFF → zero wywołań fetch`.
 *
 * Dane: `getFinanceLineageNavigator` (financeV2.api.ts), zwraca kształt
 * ZBUDOWANY przez `lineageNavigatorContract.ts` (AP-11) — trail/relatedPanel
 * są już gotowe do renderu (etykiety PL w `label.pl`, nigdy surowy token).
 */
import React, { useEffect, useState } from 'react';

import { FinanceStatusAnnouncer } from '@/components/Finance/shared/FinanceStatusAnnouncer';
import { StatusChip, type StatusTone } from '@/components/ui/primitives/chips/StatusChip';
import { useFinanceLineageNavigatorFlag } from '@/hooks/useFinanceLineageNavigatorFlag';
import { getFinanceLineageNavigator } from '@/services/api/financeV2.api';
import {
  businessVersionStatusLabel,
  describeFinanceV2Error,
  financeArtifactFreshnessLabel,
  financeArtifactTypeLabel,
  type FinanceLineageNavigatorDto,
  type LineageRelatedGroupDto,
  type LineageStaleBadgeDto,
  type LineageTrailItemDto,
} from '@/services/api/financeV2.types';

export interface FinanceLineageNavigatorProps {
  /** Ognisko nawigacji — wersja biznesowa aktualnie otwartego artefaktu. */
  businessVersionId: string;
  maxDepth?: number;
  maxTrailNodes?: number;
  terminalVisibility?: 'show' | 'dim' | 'hide';
  /** Wywoływane po kliknięciu w węzeł breadcrumb/wiersz „Powiązane" — nawigacja jest zadaniem callera (ten komponent jest samodzielny, nie zna routingu hosta). */
  onNavigate?: (
    versionId: string,
    artifactType: FinanceLineageNavigatorDto['relatedPanel']['focus']['artifactType']
  ) => void;
  /** Wywoływane po kliknięciu „+ Nowy" dla danego typu docelowego. */
  onCreateNew?: (action: FinanceLineageNavigatorDto['relatedPanel']['createNew'][number]) => void;
  className?: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; title: string; detail: string; code: string | null }
  | { kind: 'loaded'; data: FinanceLineageNavigatorDto };

function badgeTone(severity: LineageStaleBadgeDto['severity']): StatusTone {
  switch (severity) {
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'info':
    default:
      return 'info';
  }
}

function Badge({ badge }: { badge: LineageStaleBadgeDto }): React.ReactElement {
  return <StatusChip label={badge.label.pl} tone={badgeTone(badge.severity)} size="sm" />;
}

function TrailItemView({ item }: { item: LineageTrailItemDto }): React.ReactElement {
  if (item.kind === 'collapsed') {
    return (
      <span
        className="rounded-md border border-dashed border-c-border-subtle px-2 py-1 text-xs text-c-text-secondary"
        title={`${item.hiddenCount} ukrytych wersji pośrednich`}
        data-testid="lineage-trail-collapsed"
      >
        … +{item.hiddenCount}
      </span>
    );
  }
  const { metadata } = item;
  return (
    <div
      className={`flex flex-col gap-1 rounded-md border px-2.5 py-1.5 ${
        item.isFocus ? 'border-c-focus bg-c-surface-raised' : 'border-c-border-subtle bg-c-surface'
      } ${item.isDimmed ? 'opacity-60' : ''}`}
      data-testid="lineage-trail-node"
      data-focus={item.isFocus ? 'true' : 'false'}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-c-text-primary">{item.displayName}</span>
        <span className="text-[11px] text-c-text-secondary">{metadata.versionLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <StatusChip
          label={businessVersionStatusLabel(metadata.status)}
          tone="neutral"
          size="sm"
          hideDot
        />
        {metadata.periodLabel ? (
          <span className="text-[11px] text-c-text-secondary">{metadata.periodLabel}</span>
        ) : null}
        {item.staleBadge ? <Badge badge={item.staleBadge} /> : null}
        {item.stateBadge ? <Badge badge={item.stateBadge} /> : null}
      </div>
    </div>
  );
}

function RelatedGroupSection({
  title,
  groups,
  emptyLabel,
}: {
  title: string;
  groups: readonly LineageRelatedGroupDto[];
  emptyLabel: string;
}): React.ReactElement {
  const totalCount = groups.reduce((sum, g) => sum + g.count, 0);
  return (
    <div className="flex flex-col gap-1.5" data-testid={`lineage-related-section-${title}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-c-text-secondary">{title}</span>
        <span className="text-xs text-c-text-secondary">{totalCount}</span>
      </div>
      {groups.length === 0 ? (
        <p className="text-xs text-c-text-secondary">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {groups.map((group) => (
            <li
              key={group.artifactType}
              className="flex items-center justify-between rounded-md border border-c-border-subtle px-2 py-1"
            >
              <span className="text-xs text-c-text-primary">
                {financeArtifactTypeLabel(group.artifactType)}
              </span>
              <span className="text-xs font-medium text-c-text-secondary">{group.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FinanceLineageNavigator({
  businessVersionId,
  maxDepth,
  maxTrailNodes,
  terminalVisibility,
  onNavigate,
  onCreateNew,
  className,
}: FinanceLineageNavigatorProps): React.ReactElement | null {
  const { enabled } = useFinanceLineageNavigatorFlag();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    // ★ Flaga OFF → zero wywołań sieciowych. Sprawdzone testem poniżej.
    if (!enabled) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    getFinanceLineageNavigator(businessVersionId, { maxDepth, maxTrailNodes, terminalVisibility })
      .then((data) => {
        if (!cancelled) setState({ kind: 'loaded', data });
      })
      .catch((err) => {
        if (!cancelled) {
          const described = describeFinanceV2Error(err);
          setState({ kind: 'error', ...described });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, businessVersionId, maxDepth, maxTrailNodes, terminalVisibility]);

  if (!enabled) return null;

  // ★ NAPRAWA a11y (Pakiet I, wymaganie #7 — MutationObserver defekt): patrz
  // ten sam komentarz w `FinanceCommentsPanel.tsx`. JEDEN stabilny korzeń `<>`
  // dla wszystkich trzech stanów, ogłoszenie zawsze pierwszym dzieckiem — nie
  // odmontowuje się przy `loading` → `loaded` (np. po zmianie `businessVersionId`).
  let announcerMessage: string;
  let announcerPriority: 'polite' | 'assertive' = 'polite';
  let content: React.ReactNode;

  if (state.kind === 'loading') {
    announcerMessage = 'Ładowanie powiązań…';
    content = (
      <div
        className={`rounded-lg border border-c-border-subtle bg-c-surface p-3 ${className ?? ''}`}
        data-testid="lineage-navigator-loading"
      >
        <p className="text-xs text-c-text-secondary">Ładowanie powiązań…</p>
      </div>
    );
  } else if (state.kind === 'error') {
    announcerMessage = `Błąd: ${state.title}`;
    announcerPriority = 'assertive';
    content = (
      <div
        className={`rounded-lg border border-c-danger/40 bg-c-surface p-3 ${className ?? ''}`}
        data-testid="lineage-navigator-error"
      >
        <p className="text-sm font-medium text-c-danger">{state.title}</p>
        <p className="text-xs text-c-text-secondary">{state.detail}</p>
      </div>
    );
  } else {
    const { data } = state;
    const { trail, relatedPanel } = data;
    announcerMessage = `Łańcuch powiązań wczytany: ${trail.items.length} elementów.`;
    content = (
      <div
        className={`flex flex-col gap-4 rounded-lg border border-c-border-subtle bg-c-surface p-3 ${className ?? ''}`}
        data-testid="finance-lineage-navigator"
      >
        <div>
          <p className="mb-2 text-xs font-semibold text-c-text-secondary">Łańcuch powiązań</p>
          <div
            className="flex flex-wrap items-center gap-1.5"
            data-testid="lineage-trail"
            role="list"
            aria-label="Łańcuch powiązań"
          >
            {trail.items.map((item, idx) => (
              <React.Fragment
                key={item.kind === 'node' ? item.metadata.versionId : `collapsed-${idx}`}
              >
                {/* ★ NAPRAWA a11y (Pakiet I): `role="list"` wymaga, żeby WSZYSTKIE
                  bezpośrednie dzieci miały rolę listitem (axe: "aria-required-children"
                  critical — <button> jako bezpośrednie dziecko nie spełniał tego).
                  Separator strzałki jest dekoracją — `aria-hidden` wyjmuje go z
                  drzewa dostępności, więc nie musi (i nie powinien) być listitem. */}
                {idx > 0 ? (
                  <span className="text-c-text-secondary" aria-hidden="true">
                    →
                  </span>
                ) : null}
                <span role="listitem">
                  <button
                    type="button"
                    className="cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-default"
                    disabled={item.kind === 'collapsed'}
                    onClick={() => {
                      if (item.kind === 'node' && onNavigate)
                        onNavigate(item.metadata.versionId, item.metadata.artifactType);
                    }}
                  >
                    <TrailItemView item={item} />
                  </button>
                </span>
              </React.Fragment>
            ))}
          </div>
          {trail.unresolvedVersionIds.length > 0 ? (
            <p className="mt-1 text-[11px] text-c-danger" data-testid="lineage-trail-unresolved">
              {trail.unresolvedVersionIds.length} wersji nie udało się opisać.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3" data-testid="lineage-related-panel">
          <p className="text-xs font-semibold text-c-text-secondary">Powiązane</p>
          {relatedPanel.focusBadges.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {relatedPanel.focusBadges.map((badge) => (
                <Badge key={badge.kind} badge={badge} />
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <RelatedGroupSection
              title="Rodzice"
              groups={relatedPanel.parents}
              emptyLabel="Brak bezpośrednich rodziców."
            />
            <RelatedGroupSection
              title="Dzieci"
              groups={relatedPanel.children}
              emptyLabel="Brak bezpośrednich dzieci."
            />
            <RelatedGroupSection
              title="Przodkowie pośredni"
              groups={relatedPanel.indirectAncestors}
              emptyLabel="Brak."
            />
            <RelatedGroupSection
              title="Potomkowie pośredni"
              groups={relatedPanel.indirectDescendants}
              emptyLabel="Brak."
            />
          </div>
          {relatedPanel.siblings.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-semibold text-c-text-secondary">
                Inne wersje/warianty
              </p>
              <ul className="flex flex-col gap-1">
                {relatedPanel.siblings.map((sibling) => (
                  <li key={sibling.metadata.versionId} className="text-xs text-c-text-secondary">
                    {sibling.displayName} ({businessVersionStatusLabel(sibling.metadata.status)})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5" data-testid="lineage-create-new">
            {relatedPanel.createNew.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {relatedPanel.createNew.map((action) => (
                  <button
                    key={action.targetArtifactType}
                    type="button"
                    className="rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1 text-xs font-medium text-c-text-primary hover:bg-c-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    onClick={() => onCreateNew?.(action)}
                  >
                    + Nowy: {financeArtifactTypeLabel(action.targetArtifactType)}
                  </button>
                ))}
              </div>
            ) : relatedPanel.createNewBlockedLabel ? (
              <p className="text-xs text-c-text-secondary">
                {relatedPanel.createNewBlockedLabel.pl}
              </p>
            ) : null}
          </div>

          {relatedPanel.hiddenTerminalCount > 0 ? (
            <p className="text-[11px] text-c-text-secondary">
              Ukryto {relatedPanel.hiddenTerminalCount} zarchiwizowanych/unieważnionych powiązań.
            </p>
          ) : null}
        </div>

        <p className="text-[11px] text-c-text-secondary" data-testid="lineage-freshness-note">
          Świeżość ogniska: {financeArtifactFreshnessLabel(relatedPanel.focus.freshness)}
        </p>
      </div>
    );
  }

  return (
    <>
      <FinanceStatusAnnouncer message={announcerMessage} priority={announcerPriority} />
      {content}
    </>
  );
}

export default FinanceLineageNavigator;
