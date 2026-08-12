/**
 * FinanceSavedViewsPanel — Pakiet AP-CLIENT (Gate J), priorytet #4.
 *
 * Samodzielny panel zapisanych widoków: widoczność PERSONAL/TEAM, zapis
 * BIEŻĄCEGO stanu siatki (przekazanego przez hosta — ten panel nie ma
 * własnej siatki, jest zarządcą widoków obok niej), zastosowanie zapisanego
 * widoku (`onApplyView`, host decyduje jak wpiąć w swoją siatkę), link do
 * udostępnienia (`shareToken`), usuwanie (owner-only, egzekwowane serwerowo —
 * ten panel pokazuje błąd honest-UI, nie ukrywa przycisku).
 *
 * NIE montowany w żadnym workspace produkcyjnym w tym pakiecie — dev-render
 * only, do akceptu Piotra na zrzutach (CLAUDE.md #7).
 *
 * Za flagą `financeSavedViewsV1` (default OFF): przy `enabled=false` renderuje
 * `null` PRZED jakimkolwiek wywołaniem sieciowym.
 */
import React, { useEffect, useState } from 'react';

import { FinanceStatusAnnouncer } from '@/components/Finance/shared/FinanceStatusAnnouncer';
import { useFinanceSavedViewsFlag } from '@/hooks/useFinanceSavedViewsFlag';
import { createFinanceSavedView, deleteFinanceSavedView, listFinanceSavedViews } from '@/services/api/financeV2.api';
import {
  describeFinanceV2Error,
  emptyGridViewStateSnapshot,
  financeSavedViewScopeLabel,
  type FinanceSavedViewDto,
  type FinanceSavedViewScope,
  type GridViewStateSnapshotInput,
  type SavedViewFilterInput,
} from '@/services/api/financeV2.types';

export interface FinanceSavedViewsPanelProps {
  artifactId: string;
  /** Bieżący stan siatki hosta — to on jest zapisywany po kliknięciu „Zapisz widok". */
  currentGridViewState?: GridViewStateSnapshotInput;
  currentFilters?: SavedViewFilterInput[];
  onApplyView?: (view: FinanceSavedViewDto) => void;
  className?: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; title: string; detail: string; code: string | null }
  | { kind: 'loaded'; views: FinanceSavedViewDto[] };

export function FinanceSavedViewsPanel({
  artifactId,
  currentGridViewState,
  currentFilters,
  onApplyView,
  className,
}: FinanceSavedViewsPanelProps): React.ReactElement | null {
  const { enabled } = useFinanceSavedViewsFlag();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [newViewName, setNewViewName] = useState('');
  const [newViewScope, setNewViewScope] = useState<FinanceSavedViewScope>('PERSONAL');
  const [rowError, setRowError] = useState<string | null>(null);
  const [copiedViewId, setCopiedViewId] = useState<string | null>(null);
  // ★ NAPRAWA a11y (Pakiet I, wymaganie #7): "Kopiuj link" zmieniał TYLKO
  // widoczny tekst przycisku na "Skopiowano" (2s) — czytnik ekranu, który
  // nie ma fokusu na tym konkretnym przycisku w danej chwili, nigdy się o
  // tym nie dowiadywał. `actionMessage` niesie ten sam komunikat do stałego
  // `role="status"`.
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = React.useCallback(() => {
    if (!enabled) return;
    setState({ kind: 'loading' });
    listFinanceSavedViews(artifactId)
      .then((views) => setState({ kind: 'loaded', views }))
      .catch((err) => setState({ kind: 'error', ...describeFinanceV2Error(err) }));
  }, [enabled, artifactId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!enabled) return null;

  async function handleSave() {
    if (!newViewName.trim()) return;
    try {
      await createFinanceSavedView({
        artifactId,
        scope: newViewScope,
        name: newViewName.trim(),
        gridViewState: currentGridViewState ?? emptyGridViewStateSnapshot(),
        filters: currentFilters ?? [],
      });
      setNewViewName('');
      setActionMessage('Widok zapisany.');
      load();
    } catch (err) {
      setRowError(describeFinanceV2Error(err).detail);
    }
  }

  async function handleDelete(viewId: string) {
    setRowError(null);
    try {
      await deleteFinanceSavedView(viewId);
      setActionMessage('Widok usunięty.');
      load();
    } catch (err) {
      setRowError(describeFinanceV2Error(err).detail);
    }
  }

  function handleCopyShareLink(view: FinanceSavedViewDto) {
    const url = `${window.location.origin}${window.location.pathname}#saved-view=${view.shareToken}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedViewId(view.id);
    setActionMessage(`Link do widoku „${view.name}" skopiowany.`);
    window.setTimeout(() => setCopiedViewId((cur) => (cur === view.id ? null : cur)), 2000);
  }

  if (state.kind === 'loading') {
    return (
      <>
        <FinanceStatusAnnouncer message="Ładowanie zapisanych widoków…" />
        <div className={`rounded-lg border border-c-border-subtle bg-c-surface p-3 ${className ?? ''}`} data-testid="saved-views-panel-loading">
          <p className="text-xs text-c-text-secondary">Ładowanie zapisanych widoków…</p>
        </div>
      </>
    );
  }

  if (state.kind === 'error') {
    return (
      <>
        <FinanceStatusAnnouncer message={`Błąd: ${state.title}`} priority="assertive" />
        <div className={`rounded-lg border border-c-danger/40 bg-c-surface p-3 ${className ?? ''}`} data-testid="saved-views-panel-error">
          <p className="text-sm font-medium text-c-danger">{state.title}</p>
          <p className="text-xs text-c-text-secondary">{state.detail}</p>
        </div>
      </>
    );
  }

  const { views } = state;
  const personalViews = views.filter((v) => v.scope === 'PERSONAL');
  const teamViews = views.filter((v) => v.scope === 'TEAM');

  return (
    <div className={`flex flex-col gap-4 rounded-lg border border-c-border-subtle bg-c-surface p-3 ${className ?? ''}`} data-testid="finance-saved-views-panel">
      <FinanceStatusAnnouncer message={actionMessage ?? 'Zapisane widoki wczytane.'} />
      <p className="text-xs font-semibold text-c-text-secondary">Zapisane widoki</p>

      {rowError ? (
        <div role="alert" className="rounded-md border border-c-danger/40 bg-c-danger/10 px-2 py-1.5 text-xs text-c-danger" data-testid="saved-views-row-error">
          {rowError}
        </div>
      ) : null}

      <ViewGroup title="Zespołowe" views={teamViews} onApplyView={onApplyView} onDelete={handleDelete} onCopyShareLink={handleCopyShareLink} copiedViewId={copiedViewId} />
      <ViewGroup title="Osobiste" views={personalViews} onApplyView={onApplyView} onDelete={handleDelete} onCopyShareLink={handleCopyShareLink} copiedViewId={copiedViewId} />

      <div className="flex flex-col gap-1.5 rounded-md border border-c-border-subtle p-2">
        <p className="text-xs font-medium text-c-text-primary">Zapisz bieżący widok</p>
        <input
          className="rounded-md border border-c-border-subtle bg-c-surface-raised p-1.5 text-xs text-c-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          placeholder="Nazwa widoku…"
          value={newViewName}
          onChange={(e) => setNewViewName(e.target.value)}
          data-testid="saved-view-name-input"
        />
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-c-border-subtle bg-c-surface-raised p-1.5 text-xs text-c-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            value={newViewScope}
            onChange={(e) => setNewViewScope(e.target.value as FinanceSavedViewScope)}
            data-testid="saved-view-scope-select"
          >
            <option value="PERSONAL">{financeSavedViewScopeLabel('PERSONAL')}</option>
            <option value="TEAM">{financeSavedViewScopeLabel('TEAM')}</option>
          </select>
          <button
            type="button"
            disabled={!newViewName.trim()}
            className="rounded-md border border-c-border-subtle bg-c-surface-raised px-2.5 py-1.5 text-xs font-medium text-c-text-primary hover:bg-c-surface disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            onClick={handleSave}
            data-testid="saved-view-save-submit"
          >
            Zapisz widok
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewGroup({
  title,
  views,
  onApplyView,
  onDelete,
  onCopyShareLink,
  copiedViewId,
}: {
  title: string;
  views: FinanceSavedViewDto[];
  onApplyView?: (view: FinanceSavedViewDto) => void;
  onDelete: (viewId: string) => void;
  onCopyShareLink: (view: FinanceSavedViewDto) => void;
  copiedViewId: string | null;
}): React.ReactElement {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-c-text-secondary">{title} ({views.length})</p>
      {views.length === 0 ? (
        <p className="text-xs text-c-text-secondary">Brak.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {views.map((view) => (
            <li key={view.id} className="flex items-center justify-between gap-2 rounded-md border border-c-border-subtle px-2 py-1.5" data-testid="saved-view-row">
              <span className="text-xs text-c-text-primary">{view.name}</span>
              <div className="flex items-center gap-1.5">
                <button type="button" className="text-[11px] font-medium text-c-focus hover:underline" onClick={() => onApplyView?.(view)} data-testid="saved-view-apply">
                  Zastosuj
                </button>
                <button type="button" className="text-[11px] font-medium text-c-focus hover:underline" onClick={() => onCopyShareLink(view)} data-testid="saved-view-copy-link">
                  {copiedViewId === view.id ? 'Skopiowano' : 'Kopiuj link'}
                </button>
                <button type="button" className="text-[11px] font-medium text-c-danger hover:underline" onClick={() => onDelete(view.id)} data-testid="saved-view-delete">
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FinanceSavedViewsPanel;
