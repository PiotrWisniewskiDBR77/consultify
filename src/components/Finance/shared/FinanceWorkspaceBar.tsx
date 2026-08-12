/**
 * `FinanceWorkspaceBar` — JEDEN wspólny pasek dla wszystkich pięciu
 * workspace'ów Finance (Pakiet C, OWN-FIN-011/012/013/016/020/021).
 *
 * Renderuje `WorkspaceBarConfig` (`./financeWorkspaceBar.contract.ts`) —
 * konfigurację, nie zgaduje wyglądu. Zasada z CANON.md §1: „ekrany funkcjonalne
 * nie wymyślają wyglądu" — TEN komponent JEST tym zatwierdzonym wyglądem;
 * moduł (Statements/Models/Analysis/Prediction/Valuation) dostarcza tylko dane.
 *
 * Anatomia (handoff §11, cytowany w kontrakcie):
 *   LEWO   — Wróć do listy · nazwa (edytowalna, kontrolowana operacja) ·
 *            odznaka wersji · odznaka statusu · (i) Context popover
 *   ŚRODEK — nawigacja widoków, TYLKO gdy ≤2 widoki (`placement==='in-bar'`);
 *            przy >2 widokach renderowana jako osobny, kompaktowy rząd POD
 *            paskiem (ten sam komponent, drugi <div>, żeby nie duplikować
 *            nagłówka — OWN-FIN-005).
 *   PRAWO  — primary (freshness scalone z CTA) · secondary? · lifecycle? ·
 *            more? · fullscreen (zawsze ostatni). MAKS. 5 bezpośrednich
 *            kontrolek — `countDirectRightControls` z kontraktu.
 *
 * Twarde kryteria (addendum §7, zweryfikowane przez negatywną kontrolę w
 * `__tests__/FinanceWorkspaceBar.test.tsx` + zrzuty w
 * `docs/validation/finance-v3/generated/gate-e/visual/pkg-c/`):
 *   - 1280px + nazwa 60 znaków → brak nakładania (`estimateWorkspaceBarLayout`,
 *     `min-width:0` + `truncate` na nazwie, reszta `flex-shrink-0`).
 *   - ≤5 bezpośrednich kontrolek po prawej.
 *   - 200% zoom pozostaje operacyjny — wyłącznie jednostki relatywne
 *     (`rem`/`%`/`flex`), zero `px` na wymiarach, które muszą skalować się
 *     z tekstem przy zoomie przeglądarki (przeglądarka skaluje `rem`/`em`
 *     automatycznie; stałe `px` w kontrakcie layoutu to tylko HEURYSTYKA
 *     budżetu szerokości w teście, nie CSS tego komponentu).
 *
 * A11y: kontrolki bezpośrednio interaktywne ≥44px (`min-h-11 min-w-11`),
 * fokus = `c-focus` (NIGDY `primary-*`), status niesiony tekstem+ikoną (nie
 * samym kolorem), pełna klawiatura (Tab/Enter/Escape), aria-label na
 * ikona-only fullscreen, `aria-expanded`/`aria-haspopup` na menu.
 */

import React, { useEffect, useId, useRef, useState } from 'react';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';

import {
  countDirectRightControls,
  mergeFreshnessIntoPrimaryLabel,
  resolveControlState,
  validateWorkspaceBarConfig,
  validateWorkspaceName,
  type WorkspaceBarConfig,
  type WorkspaceBarContextField,
  type WorkspaceBarEvaluationContext,
  type WorkspaceBarLifecycleTransition,
  type WorkspaceBarMoreMenuItem,
} from './financeWorkspaceBar.contract';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FinanceWorkspaceBarProps {
  config: WorkspaceBarConfig;
  evaluationContext: WorkspaceBarEvaluationContext;
  /** Wartości pól Context popover — tylko te, które moduł faktycznie ma (puste pola są pomijane, nie pokazywane jako puste wiersze). */
  contextValues: Partial<Record<WorkspaceBarContextField, string>>;
  onNavigateBack: () => void;
  onSelectView: (viewId: string) => void;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  onLifecycleTransition: (transition: WorkspaceBarLifecycleTransition) => void;
  onMoreItem: (item: WorkspaceBarMoreMenuItem) => void;
  onEnterFocusMode: () => void;
  /** OWN-FIN-011: rename to KONTROLOWANA operacja — walidacja + zapis + readback + historia. Ten komponent robi walidację lokalnie i deleguje zapis/readback do callera. */
  onCommitRename: (nextName: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}

// ---------------------------------------------------------------------------
// Etykiety pól Context popover
// ---------------------------------------------------------------------------

const CONTEXT_FIELD_LABELS: Record<WorkspaceBarContextField, string> = {
  type: 'Typ',
  period: 'Okres',
  entity: 'Podmiot',
  currencyScale: 'Waluta / skala',
  source: 'Źródło',
  lastCompute: 'Ostatnie przeliczenie',
};

const CONTROL_BASE_CLASS =
  'inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50';

export function FinanceWorkspaceBar(props: FinanceWorkspaceBarProps): React.ReactElement {
  const { config, evaluationContext, contextValues, onCommitRename } = props;

  if (import.meta.env?.DEV) {
    const validation = validateWorkspaceBarConfig(config);
    if (!validation.ok) {
      // eslint-disable-next-line no-console
      console.error(
        '[FinanceWorkspaceBar] Nieprawidłowa konfiguracja paska (naprawić w module adapterze, nie w tym komponencie):',
        validation.errors
      );
    }
  }

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(config.identity.name.value);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pendingDestructive, setPendingDestructive] = useState<
    | { kind: 'lifecycle'; transition: WorkspaceBarLifecycleTransition }
    | { kind: 'more'; item: WorkspaceBarMoreMenuItem }
    | null
  >(null);

  useEffect(() => {
    if (!isEditingName) setNameDraft(config.identity.name.value);
  }, [config.identity.name.value, isEditingName]);

  const contextRef = useRef<HTMLDivElement>(null);
  const lifecycleRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(contextRef, () => setContextOpen(false));
  useOnClickOutside(lifecycleRef, () => setLifecycleOpen(false));
  useOnClickOutside(moreRef, () => setMoreOpen(false));

  function focusLifecycleOrMoreTrigger(kind: 'lifecycle' | 'more'): void {
    const containerRef = kind === 'lifecycle' ? lifecycleRef : moreRef;
    containerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }

  const nameInputId = useId();
  const { identity, viewNavigation, actions } = config;

  const directControlCount = countDirectRightControls(actions);

  const primaryMerged = mergeFreshnessIntoPrimaryLabel(
    actions.primary.label,
    identity.freshness,
    actions.primary.mergesFreshness
  );
  const primaryState = resolveControlState(actions.primary.enablement, evaluationContext);

  async function commitName(): Promise<void> {
    const check = validateWorkspaceName(nameDraft);
    if (!check.ok) {
      setNameError(check.message);
      return;
    }
    if (check.normalized === identity.name.value) {
      setIsEditingName(false);
      setNameError(null);
      return;
    }
    setIsSavingName(true);
    setNameError(null);
    try {
      const result = await onCommitRename(check.normalized);
      if (result.ok) {
        setIsEditingName(false);
      } else {
        setNameError(result.message);
      }
    } finally {
      setIsSavingName(false);
    }
  }

  function cancelNameEdit(): void {
    setNameDraft(identity.name.value);
    setNameError(null);
    setIsEditingName(false);
  }

  const contextFieldsWithValues = identity.contextFields.filter((field) => contextValues[field] !== undefined);

  return (
    <div className="flex w-full flex-col border-b border-c-border-subtle bg-c-surface" data-testid="finance-workspace-bar">
      {/* ── Rząd główny ────────────────────────────────────────────────── */}
      {/*
        `overflow-x-auto`: pod 200% zoom (efektywna szerokość layoutu spada
        do ok. połowy referencyjnego viewportu) osiem+ elementów paska nie
        zmieści się bez skrótów — zamiast NIEWIDOCZNEGO przelania poza
        krawędź strony (niedostępne bez wiedzy, że strona w ogóle się
        przewija w poziomie — antywzorzec WCAG reflow), pasek dostaje WŁASNY,
        widoczny scrollbar: `primary`/`fullscreen` pozostają osiągalne
        przewinięciem TEGO paska, nie całej strony. Zmierzone dev-render
        zrzutem `finance-workspace-bar-zoom200-*` — patrz PKG_C_UI_PLATFORM_report.md.
      */}
      <div className="flex w-full items-center gap-2 overflow-x-auto px-4 py-2">
        {/* LEWO */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={props.onNavigateBack}
            aria-label={identity.back.label.pl}
            className={`${CONTROL_BASE_CLASS} shrink-0 min-w-[2.75rem] text-c-text-secondary hover:bg-c-surface-raised`}
            data-testid="finance-workspace-bar-back"
          >
            <BackIcon />
          </button>

          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <input
                  id={nameInputId}
                  autoFocus
                  value={nameDraft}
                  disabled={isSavingName}
                  onChange={(e) => {
                    setNameDraft(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void commitName();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      cancelNameEdit();
                    }
                  }}
                  maxLength={identity.name.maxChars}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? `${nameInputId}-error` : undefined}
                  className="min-w-0 flex-1 rounded-md border border-c-border-subtle bg-c-bg px-2 py-1 text-sm font-semibold text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                />
                <button
                  type="button"
                  onClick={() => void commitName()}
                  disabled={isSavingName}
                  className={`${CONTROL_BASE_CLASS} shrink-0 min-w-0 bg-c-text px-2.5 text-c-surface hover:brightness-95`}
                >
                  {isSavingName ? 'Zapisuję…' : 'Zapisz'}
                </button>
                <button
                  type="button"
                  onClick={cancelNameEdit}
                  disabled={isSavingName}
                  className={`${CONTROL_BASE_CLASS} shrink-0 min-w-0 border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised`}
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!identity.name.editable}
                onClick={() => identity.name.editable && setIsEditingName(true)}
                title={
                  identity.name.editable
                    ? 'Kliknij, aby zmienić nazwę'
                    : identity.name.editableBlockedReason === 'STATUS_IMMUTABLE'
                      ? 'Nazwy nie można zmienić — wersja jest zatwierdzona/zamknięta. Otwórz ponownie lub utwórz nową wersję.'
                      : 'Twoja rola nie pozwala na zmianę nazwy.'
                }
                className={`group flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                  identity.name.editable ? 'hover:bg-c-surface-raised' : 'cursor-default'
                }`}
                data-testid="finance-workspace-bar-name"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-c-text">{identity.name.value}</span>
                {identity.name.editable && (
                  <EditIcon className="shrink-0 text-c-text-muted opacity-0 group-hover:opacity-100" />
                )}
              </button>
            )}
            {nameError && (
              <p id={`${nameInputId}-error`} role="alert" className="mt-0.5 text-xs text-c-danger">
                {nameError}
              </p>
            )}
          </div>

          {/*
            ★ NAPRAWA (ten sam defekt zdiagnozowany wcześniej w Pakiecie C —
            addendum §7): wersja i status były DWIEMA osobnymi odznakami
            (`v1` + `Wersja robocza`), a lifecycle-menu obok POWTARZA tekst
            statusu jako trzeci raz — łącznie trzy miejsca z tą samą
            informacją. Jedna kombinowana odznaka tożsamości („v1 · Wersja
            robocza") + kontrolka lifecycle to KANONICZNE dwa miejsca
            (tożsamość raz, kontrolka zmiany stanu raz), nie trzy.
          */}
          <IdentityBadge version={identity.version} status={identity.status} />

          {contextFieldsWithValues.length > 0 && (
            <div className="relative shrink-0" ref={contextRef}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={contextOpen}
                aria-label="Szczegóły kontekstu"
                onClick={() => setContextOpen((v) => !v)}
                className={`${CONTROL_BASE_CLASS} min-w-[2.75rem] text-c-text-muted hover:bg-c-surface-raised`}
              >
                <InfoIcon />
              </button>
              {contextOpen && (
                <div
                  role="dialog"
                  aria-label="Kontekst artefaktu"
                  className="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-c-border-subtle bg-c-surface p-3 shadow-lg"
                >
                  <dl className="space-y-1.5">
                    {contextFieldsWithValues.map((field) => (
                      <div key={field} className="flex items-baseline justify-between gap-3 text-xs">
                        <dt className="text-c-text-muted">{CONTEXT_FIELD_LABELS[field]}</dt>
                        <dd className="min-w-0 truncate text-right font-medium text-c-text">{contextValues[field]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ŚRODEK — tylko gdy ≤2 widoki */}
        {viewNavigation.placement === 'in-bar' && (
          <div className="hidden shrink-0 items-center gap-1 rounded-lg bg-c-surface-raised p-1 md:flex" role="tablist">
            {viewNavigation.views.map((view) => (
              <ViewTab
                key={view.id}
                view={view}
                active={view.id === viewNavigation.activeViewId}
                onClick={() => props.onSelectView(view.id)}
              />
            ))}
          </div>
        )}

        {/* PRAWO — maks. 5 bezpośrednich kontrolek */}
        <div className="flex shrink-0 items-center gap-1.5" data-direct-control-count={directControlCount}>
          {actions.secondary && (
            <SecondaryButton
              label={actions.secondary.label.pl}
              disabled={!resolveControlState(actions.secondary.enablement, evaluationContext).available}
              onClick={() => props.onSecondaryAction?.()}
            />
          )}

          {actions.lifecycle && (
            <div className="relative" ref={lifecycleRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={lifecycleOpen}
                onClick={() => setLifecycleOpen((v) => !v)}
                className={`${CONTROL_BASE_CLASS} border-c-border-subtle text-c-text hover:bg-c-surface-raised`}
                data-testid="finance-workspace-bar-lifecycle-trigger"
              >
                {actions.lifecycle.label.pl}
                <ChevronDownIcon />
              </button>
              {lifecycleOpen && (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-c-border-subtle bg-c-surface p-1 shadow-lg">
                  {actions.lifecycle.transitions.map((transition) => {
                    const state = resolveControlState(transition.enablement, evaluationContext);
                    return (
                      <button
                        key={transition.action}
                        type="button"
                        role="menuitem"
                        disabled={!state.available}
                        onClick={() => {
                          setLifecycleOpen(false);
                          if (transition.requiresConfirmation) {
                            setPendingDestructive({ kind: 'lifecycle', transition });
                          } else {
                            props.onLifecycleTransition(transition);
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-40 ${
                          transition.destructive ? 'text-c-danger hover:bg-c-danger/10' : 'text-c-text hover:bg-c-surface-raised'
                        }`}
                      >
                        {transition.label.pl}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {actions.more && (
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label={actions.more.label.pl}
                onClick={() => setMoreOpen((v) => !v)}
                className={`${CONTROL_BASE_CLASS} min-w-[2.75rem] text-c-text-secondary hover:bg-c-surface-raised`}
                data-testid="finance-workspace-bar-more-trigger"
              >
                <MoreIcon />
              </button>
              {moreOpen && (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-c-border-subtle bg-c-surface p-1 shadow-lg">
                  {actions.more.items.map((item) => {
                    const state = resolveControlState(item.enablement, evaluationContext);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        disabled={!state.available}
                        onClick={() => {
                          setMoreOpen(false);
                          if (item.requiresConfirmation) {
                            setPendingDestructive({ kind: 'more', item });
                          } else {
                            props.onMoreItem(item);
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-40 ${
                          item.destructive ? 'text-c-danger hover:bg-c-danger/10' : 'text-c-text hover:bg-c-surface-raised'
                        }`}
                      >
                        {item.label.pl}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!primaryState.available}
            onClick={props.onPrimaryAction}
            title={primaryState.available ? undefined : `Niedostępne: ${primaryState.reason}`}
            className={`${CONTROL_BASE_CLASS} bg-c-text px-3.5 text-c-surface hover:brightness-95`}
            data-testid="finance-workspace-bar-primary"
          >
            {primaryMerged.prefix && <span className="opacity-80">{primaryMerged.prefix.pl}</span>}
            {primaryMerged.prefix && <span aria-hidden="true">·</span>}
            <span>{primaryMerged.action.pl}</span>
          </button>

          <button
            type="button"
            onClick={props.onEnterFocusMode}
            aria-label={actions.fullscreen.ariaLabel.pl}
            title={actions.fullscreen.ariaLabel.pl}
            className={`${CONTROL_BASE_CLASS} min-w-[2.75rem] border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised`}
            data-testid="finance-workspace-bar-fullscreen"
          >
            <FullscreenIcon />
          </button>
        </div>
      </div>

      {/* ── Osobny kompaktowy rząd nawigacji, gdy >2 widoki ─────────────── */}
      {viewNavigation.placement === 'separate-row' && (
        <div className="flex w-full items-center gap-1 overflow-x-auto border-t border-c-border-subtle bg-c-surface-raised/40 px-4 py-1.5" role="tablist">
          {viewNavigation.views.map((view) => (
            <ViewTab key={view.id} view={view} active={view.id === viewNavigation.activeViewId} onClick={() => props.onSelectView(view.id)} />
          ))}
        </div>
      )}

      {/* ── Potwierdzenie operacji destrukcyjnej (CANON.md §4.3) ────────── */}
      {pendingDestructive && (
        <ConfirmDestructiveDialog
          label={pendingDestructive.kind === 'lifecycle' ? pendingDestructive.transition.label.pl : pendingDestructive.item.label.pl}
          onCancel={() => {
            // ★ NAPRAWA a11y (Pakiet I): przywracamy fokus na trigger JAWNIE
            // i SYNCHRONICZNIE, tu — zanim stan się zmieni i dialog
            // odmontuje. `useDialogA11y`'s wbudowane "poprzedni aktywny
            // element" nie jest tu użyteczne z zasady: wyzwalacz TEGO
            // dialogu to zawsze pozycja menu (lifecycle/more), która
            // odmontowuje się (bo menu się zamyka) W TYM SAMYM commit, co
            // otwarcie dialogu — `document.activeElement` w momencie efektu
            // montującego dialog jest więc zawsze "już nic" (obsłużone przez
            // fallback hooka), nie faktyczny wyzwalacz. Bezpośredni fokus na
            // trigger tu jest prostszy i pewny niezależnie od tej wyścigówki.
            focusLifecycleOrMoreTrigger(pendingDestructive.kind);
            setPendingDestructive(null);
          }}
          onConfirm={() => {
            if (pendingDestructive.kind === 'lifecycle') {
              props.onLifecycleTransition(pendingDestructive.transition);
            } else {
              props.onMoreItem(pendingDestructive.item);
            }
            focusLifecycleOrMoreTrigger(pendingDestructive.kind);
            setPendingDestructive(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Podkomponenty
// ---------------------------------------------------------------------------

function ViewTab({
  view,
  active,
  onClick,
}: {
  view: WorkspaceBarConfig['viewNavigation']['views'][number];
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-[2.25rem] shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
        active ? 'bg-c-surface text-c-text shadow-sm' : 'text-c-text-secondary hover:bg-c-surface-raised'
      }`}
    >
      <span>{view.label.pl}</span>
      {view.state && <ViewStateBadge state={view.state} />}
    </button>
  );
}

function ViewStateBadge({ state }: { state: NonNullable<WorkspaceBarConfig['viewNavigation']['views'][number]['state']> }): React.ReactElement {
  // ★ NAPRAWA a11y (Pakiet I): przy 10px `text-c-warning` mierzył 4.31:1
  // (axe, próg 4.5:1) na tle karty zakładki — surowy token semantyczny jest
  // kalibrowany pod większe elementy (kropki/ikony), nie mikro-tekst.
  // `text-amber-900`/dark `amber-300` to ta sama konwencja co `StatusChip`
  // TONE_SHELL (zweryfikowana tam kontrastowo) — analogicznie dla
  // success/danger, żeby nie zostawić utajonej wersji tego samego defektu.
  const toneClass =
    state.kind === 'ready'
      ? 'text-emerald-800 dark:text-emerald-300'
      : state.kind === 'stale'
        ? 'text-amber-900 dark:text-amber-300'
        : state.kind === 'blocked'
          ? 'text-red-800 dark:text-red-300'
          : 'text-c-text-muted';
  return <span className={`text-[10px] font-semibold uppercase tracking-wide ${toneClass}`}>{state.label.pl}</span>;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Wersja robocza',
  READY_FOR_REVIEW: 'Gotowe do przeglądu',
  IN_REVIEW: 'W przeglądzie',
  APPROVED: 'Zatwierdzone',
  NEEDS_CHANGES: 'Wymaga zmian',
  SUPERSEDED: 'Zastąpione',
  ARCHIVED: 'Zarchiwizowane',
  INVALIDATED: 'Unieważnione',
};

/** Odznaka tożsamości: wersja + status w JEDNYM pilule (naprawa duplikacji — patrz wywołanie). */
function IdentityBadge({
  version,
  status,
}: {
  version: WorkspaceBarConfig['identity']['version'];
  status: WorkspaceBarConfig['identity']['status'];
}): React.ReactElement {
  const toneClass =
    status === 'APPROVED'
      ? 'border-c-success/30 bg-c-success/10 text-c-success'
      : status === 'NEEDS_CHANGES' || status === 'INVALIDATED'
        ? 'border-c-danger/30 bg-c-danger/10 text-c-danger'
        : 'border-c-border-subtle bg-c-surface-raised text-c-text-secondary';
  return (
    <span
      className={`hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium sm:inline-flex ${toneClass}`}
      title={version.hasUncommittedWorkingRevision ? 'Wersja robocza — niezapisane zmiany' : undefined}
      data-testid="finance-workspace-bar-identity-badge"
    >
      <span className="tabular-nums">{version.label}</span>
      <span aria-hidden="true">·</span>
      <span>{STATUS_LABELS[status] ?? status}</span>
      {version.hasUncommittedWorkingRevision && <span className="text-c-text-muted">· robocza</span>}
    </span>
  );
}

function SecondaryButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${CONTROL_BASE_CLASS} border-c-border-subtle text-c-text hover:bg-c-surface-raised`}
    >
      {label}
    </button>
  );
}

function ConfirmDestructiveDialog({
  label,
  onCancel,
  onConfirm,
}: {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}): React.ReactElement {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // ★ NAPRAWA a11y (Pakiet I): poprzednia wersja miała TYLKO Escape (bez
  // pułapki fokusa Tab) — Tab mógł uciec pod przyciemnione tło.
  // `useDialogA11y` daje pułapkę Tab + Escape + fokus początkowy. Fokus
  // POWROTNY na wyzwalacz jest ustawiany JAWNIE przez `onCancel`/`onConfirm`
  // (patrz `focusLifecycleOrMoreTrigger` w rodzicu) — NIE przez wbudowane
  // "poprzedni aktywny element" hooka: wyzwalacz tego dialogu to zawsze
  // pozycja menu (lifecycle/more), która odmontowuje się (menu się zamyka) W
  // TYM SAMYM commit co otwarcie dialogu, więc `document.activeElement` w
  // momencie montowania dialogu nie niesie użytecznej informacji o
  // wyzwalaczu. `getFallbackFocusTarget` zostaje jako defensywny backstop
  // (np. gdyby ktoś w przyszłości otworzył ten dialog spoza lifecycle/more).
  useDialogA11y({
    open: true,
    onClose: onCancel,
    containerRef,
    initialFocusRef: confirmRef,
    getFallbackFocusTarget: () =>
      document.querySelector<HTMLElement>(
        '[data-testid="finance-workspace-bar-lifecycle-trigger"], [data-testid="finance-workspace-bar-more-trigger"]'
      ),
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={onCancel}>
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Potwierdź: ${label}`}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-c-border-subtle bg-c-surface p-4 shadow-xl"
      >
        <p className="text-sm font-semibold text-c-text">Potwierdź operację</p>
        <p className="mt-1 text-sm text-c-text-secondary">
          Czy na pewno chcesz wykonać: <span className="font-medium text-c-text">{label}</span>? Tej operacji nie da się cofnąć jednym kliknięciem.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`${CONTROL_BASE_CLASS} border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised`}
          >
            Anuluj
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`${CONTROL_BASE_CLASS} bg-c-danger px-3.5 text-white hover:brightness-95`}
          >
            Potwierdź
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ikony (inline SVG, zero zewnętrznej biblioteki ikon w tym pakiecie)
// ---------------------------------------------------------------------------

function BackIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function EditIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function InfoIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7.2v3.8M8 5.2v.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function ChevronDownIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function MoreIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="4" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="12" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}
function FullscreenIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 6V3a1 1 0 011-1h3M10 2h3a1 1 0 011 1v3M14 10v3a1 1 0 01-1 1h-3M6 14H3a1 1 0 01-1-1v-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default FinanceWorkspaceBar;
