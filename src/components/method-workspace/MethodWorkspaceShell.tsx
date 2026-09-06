/**
 * MethodWorkspaceShell — the common Method Workspace UI shell (A5, 2026-08-13).
 *
 * Shared by DRD (A6) and SIRI (A7): every prop is either a kernel contract
 * type (`MethodSession`, `MethodReadiness`, `MethodSaveState`, …) or a
 * presentational shape from `./types`. No DRD/SIRI-specific string, id or
 * rule lives in this file — the caller supplies the Method Pack-derived data.
 *
 * Layout (WORKBENCH §2):
 *   Header — method · name · status · pack version · mode · Wyjdź/Zapisz/Menu3
 *   Context strip + one Command Row (view mode switch)
 *   ┌──────────────┬───────────────────────────┬──────────────┐
 *   │ Navigator    │ Interview / Matrix Canvas │ Teresa       │
 *   ├──────────────┴───────────────────────────┴──────────────┤
 *   │ Graphic Mirror (matrix) — sticky/expandable              │
 *   └────────────────────────────────────────────────────────┘
 *   Bottom status: save · version · evidence · review · blockers
 *
 * Three view modes (`interview` / `matrix` / `report`) are pure presentations
 * of the SAME state — switching never re-fetches or forks data. The chosen
 * mode and the last matrix position are remembered per session in
 * localStorage (UI-NAV §6 "System zapamiętuje preferowany widok i ostatnią
 * pozycję").
 */
import {
  AlertTriangle,
  LayoutGrid,
  LogOut,
  MessageSquareText,
  MoreVertical,
  FileText,
  Settings,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { MethodReadiness, MethodSaveState, MethodSession } from '@/method-core/contracts';

import type { InterviewFocusPanelProps } from './InterviewFocusPanel';
import { InterviewFocusPanel } from './InterviewFocusPanel';
import type { LiveMatrixProps } from './LiveMatrix';
import { LiveMatrix } from './LiveMatrix';
import type { MethodNavigatorProps } from './MethodNavigator';
import { MethodNavigator } from './MethodNavigator';
import { SaveStateIndicator } from './SaveStateIndicator';
import type { TeresaPreviewPanelProps } from './TeresaPreviewPanel';
import type { MethodWorkspaceViewMode } from './types';

export interface MethodWorkspaceShellProps {
  session: MethodSession;
  methodName: string;
  packVersionLabel: string;
  readiness: MethodReadiness;
  mode: 'guided_manual' | 'teresa_led';
  onModeChange: (mode: 'guided_manual' | 'teresa_led') => void;
  onExit: () => void;

  saveState: MethodSaveState;
  saveLastSavedAt: string | null;
  saveErrorMessage: string | null;
  onSaveNow: () => void;
  onSaveRetry: () => void;
  onSaveStay: () => void;

  navigatorProps: Omit<MethodNavigatorProps, 'className'>;
  interviewProps: Omit<InterviewFocusPanelProps, 'className'>;
  teresaProps: Omit<TeresaPreviewPanelProps, 'className'>;
  matrixProps: Omit<LiveMatrixProps, 'className' | 'methodName'>;
  /**
   * Macierz metody narysowana po SWOJEMU, zamiast wspólnej `LiveMatrix`.
   *
   * ★ DLACZEGO TO ISTNIEJE (2026-09-05). DRD ma własną, ZAAKCEPTOWANĄ przez
   * właściciela macierz (`DRDMatrixGrid` — obszary × poziomy, treść w komórce,
   * dolny pasek `AS`/`TO`), a `LiveMatrix` jest siatką stanów jednostka × poziom
   * wspólną dla wszystkich metod. Do 05.09 zakładka „Macierz" w sesji DRD
   * pokazywała `LiveMatrix` i właściciel po raz szósty napisał, że to nie jest
   * jego macierz.
   *
   * Nadpisanie, a NIE zamiana na stałe: SIRI (A7) i każda następna metoda
   * dostają `LiveMatrix` dokładnie jak dotąd, bo nie mają własnej, przyjętej
   * macierzy. Powłoka nie wie nic o DRD — dostaje gotowy węzeł od ekranu metody.
   */
  matrixContent?: React.ReactNode;
  /** Method-specific report workspace; it reads the same session state. */
  reportContent: React.ReactNode;
  /** Runtime provenance shown in Settings instead of occupying a permanent technical stripe. */
  documentSourceLabel?: string;
  /** Canonical source proof component, kept inside Settings. */
  documentSourceIndicator?: React.ReactNode;
  /** Method-specific controls that belong to document settings, not the working canvas. */
  settingsContent?: React.ReactNode;
  /** Governed lifecycle actions live with approval settings, never in a permanent footer. */
  governanceActions?: React.ReactNode;

  /** Uncontrolled by default (persists to localStorage); pass to control externally. */
  viewMode?: MethodWorkspaceViewMode;
  onViewModeChange?: (mode: MethodWorkspaceViewMode) => void;

  /** Explicit degraded/permission banner — never a silent missing feature. */
  degradedMessage?: string | null;
  loading?: boolean;
  errorMessage?: string | null;
  readOnly?: boolean;

  className?: string;
}

function storageKey(sessionId: string): string {
  return `method-workspace:${sessionId}:view-mode`;
}

function readStoredViewMode(sessionId: string): MethodWorkspaceViewMode {
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (raw === 'interview' || raw === 'matrix' || raw === 'report') return raw;
  } catch {
    // localStorage unavailable (privacy mode, SSR) — fall back silently.
  }
  return 'interview';
}

// Reszta powłoki (nagłówek, pasek statusu, aria-label) jest już po polsku —
// te trzy etykiety i przycisk „Settings" niżej były jedynym angielskim
// niedopatrzeniem w tym pliku (kanon: mieszany język). Terminologia 1:1 z
// resztą apki: „Wywiad" (Interview — patrz Sidebar/menuConfig.ts,
// FeedbackSidePanel.tsx), „Macierz" (Matrix — patrz DrdHttpMethodWorkspaceScreen
// „Macierz osi"), „Raport".
function viewModeOptions(
  t: (key: string, fallback: string) => string
): Array<{ id: MethodWorkspaceViewMode; label: string; icon: React.ReactNode }> {
  return [
    { id: 'interview', label: t('methodWorkspace.tabs.interview', 'Wywiad'), icon: <MessageSquareText size={13} /> },
    { id: 'matrix', label: t('methodWorkspace.tabs.matrix', 'Macierz'), icon: <LayoutGrid size={13} /> },
    { id: 'report', label: t('methodWorkspace.tabs.report', 'Raport'), icon: <FileText size={13} /> },
  ];
}

export const MethodWorkspaceShell: React.FC<MethodWorkspaceShellProps> = ({
  session,
  methodName,
  packVersionLabel,
  readiness,
  mode,
  onExit,
  saveState,
  saveLastSavedAt,
  saveErrorMessage,
  onSaveNow,
  onSaveRetry,
  onSaveStay,
  navigatorProps,
  interviewProps,
  teresaProps,
  matrixProps,
  matrixContent,
  reportContent,
  documentSourceLabel,
  documentSourceIndicator,
  settingsContent,
  governanceActions,
  viewMode: viewModeProp,
  onViewModeChange,
  degradedMessage,
  loading = false,
  errorMessage,
  readOnly = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const VIEW_MODE_OPTIONS = viewModeOptions(t);
  const [internalViewMode, setInternalViewMode] = useState<MethodWorkspaceViewMode>(() =>
    readStoredViewMode(session.id)
  );
  const viewMode = viewModeProp ?? internalViewMode;

  const [menu3Open, setMenu3Open] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Esc closes the most local open layer — here, Menu3 (kebab). Only wired
  // while it's open, so it never swallows Esc meant for something else.
  useEffect(() => {
    if (!menu3Open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu3Open(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menu3Open]);

  const setViewMode = useCallback(
    (next: MethodWorkspaceViewMode) => {
      if (onViewModeChange) onViewModeChange(next);
      else setInternalViewMode(next);
      try {
        window.localStorage.setItem(storageKey(session.id), next);
      } catch {
        // best-effort persistence only
      }
    },
    [onViewModeChange, session.id]
  );

  const transitionClass = prefersReducedMotion ? '' : 'transition-all duration-200';

  const statusLabel = useMemo(() => {
    const map: Record<MethodSession['state'], string> = {
      draft: t('methodWorkspace.status.draft', 'Szkic'),
      prepared: t('methodWorkspace.status.prepared', 'Przygotowana'),
      active: t('methodWorkspace.status.active', 'W trakcie wywiadu'),
      in_review: t('methodWorkspace.status.inReview', 'Do przeglądu'),
      frozen: t('methodWorkspace.status.frozen', 'Zamrożona'),
      closed: t('methodWorkspace.status.closed', 'Zamknięta'),
      archived: t('methodWorkspace.status.archived', 'Zarchiwizowana'),
    };
    return map[session.state];
  }, [session.state, t]);

  if (loading) {
    return (
      <div
        data-testid="method-workspace-loading"
        className="flex h-full items-center justify-center text-sm text-c-text-muted"
      >
        {t('methodWorkspace.loading', 'Ładowanie sesji…')}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        data-testid="method-workspace-error"
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-2 text-sm text-c-danger"
      >
        <AlertTriangle size={20} />
        {errorMessage}
      </div>
    );
  }

  return (
    <div
      data-testid="method-workspace-shell"
      className={`flex h-full flex-col bg-c-bg text-c-text ${className}`}
    >
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-c-border px-4 py-2.5">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <LogOut size={13} />
          {t('methodWorkspace.exit', 'Wyjdź')}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-c-text">
            {methodName} · Sesja {session.id.slice(0, 8)}
          </p>
          <p className="truncate text-[11px] text-c-text-muted">
            {t('methodWorkspace.methodPack', 'Method Pack {{version}}', { version: packVersionLabel })}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-c-border bg-c-surface-raised px-2.5 py-1 text-[11px] font-medium text-c-text-secondary">
          {statusLabel}
        </span>

        <SaveStateIndicator
          compact
          state={saveState}
          lastSavedAt={saveLastSavedAt}
          errorMessage={saveErrorMessage}
          onSaveNow={onSaveNow}
          onRetry={onSaveRetry}
          onStay={onSaveStay}
        />

        <button
          type="button"
          onClick={onSaveNow}
          disabled={readOnly}
          className="shrink-0 rounded-lg border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {t('methodWorkspace.saveNow', 'Zapisz teraz')}
        </button>

        <button
          type="button"
          onClick={() => setSettingsOpen((value) => !value)}
          aria-expanded={settingsOpen}
          aria-controls="method-workspace-settings"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <Settings size={13} />
          {t('methodWorkspace.settings', 'Ustawienia')}
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenu3Open((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menu3Open}
            aria-label={t('methodWorkspace.moreOptions', 'Więcej opcji')}
            className="rounded-lg p-1.5 text-c-text-muted hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <MoreVertical size={16} />
          </button>
          {menu3Open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-c-border bg-c-surface-raised py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-xs text-c-text-secondary hover:bg-c-surface"
              >
                {t('methodWorkspace.menu.duplicate', 'Duplikuj jako nową')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-xs text-c-text-secondary hover:bg-c-surface"
              >
                {t('methodWorkspace.menu.versionHistory', 'Historia wersji')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-xs text-c-text-secondary hover:bg-c-surface"
              >
                {t('methodWorkspace.menu.share', 'Udostępnij / kopiuj link')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-xs text-c-text-secondary hover:bg-c-surface"
              >
                {t('methodWorkspace.menu.archive', 'Archiwizuj')}
              </button>
            </div>
          )}
        </div>
      </header>

      {settingsOpen && (
        <section
          id="method-workspace-settings"
          data-testid="method-workspace-settings"
          className="grid shrink-0 gap-3 border-b border-c-border bg-c-surface px-4 py-3 text-xs text-c-text-secondary md:grid-cols-4"
        >
          <div>
            <p className="font-semibold text-c-text">Informacje o dokumencie</p>
            <p>Metoda {methodName} · {packVersionLabel}</p>
            <p>Wersja sesji v{session.version}</p>
            {documentSourceLabel && <p>Źródło: {documentSourceLabel}</p>}
            {documentSourceIndicator && <div className="mt-2">{documentSourceIndicator}</div>}
            {/* Zapis (save state) already has its own header pill
                (SaveStateIndicator) — a second line repeating the same fact
                here is noise, not information (same reasoning already
                applied to `degradedMessage` below in this file). */}
            <p className="mt-2">
              Dowody: {readiness.totalUnits - readiness.unitsMissingEvidence}/{readiness.totalUnits}
            </p>
            <p>Do przeglądu: {readiness.openDiscrepancies}</p>
            {readiness.freezeBlockers.length > 0 ? (
              <div className="mt-1">
                <p>Blokery zamrożenia ({readiness.freezeBlockers.length}):</p>
                <ul className="ml-3 list-disc space-y-0.5">
                  {readiness.freezeBlockers.map((blocker, i) => (
                    <li key={i}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>Brak blokerów zamrożenia.</p>
            )}
            {/* Raw session UUID — technical detail, not something an
                operator needs on first glance (the header already shows a
                short, human-scannable "Sesja {id.slice(0,8)}"). */}
            <details className="mt-2">
              <summary className="cursor-pointer text-c-text-muted hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus">
                Szczegóły techniczne
              </summary>
              <p className="mt-1 font-mono text-[10px] text-c-text-muted">ID sesji: {session.id}</p>
            </details>
          </div>
          <div>
            <p className="font-semibold text-c-text">Zespół i uprawnienia</p>
            <p>Tryb pracy: {mode === 'teresa_led' ? 'AI assisted' : 'human led'}</p>
            <p>{readOnly ? 'Tylko odczyt' : 'Edycja dozwolona'}</p>
          </div>
          <div>
            {/* DEC-2026-08-25-56: "Akceptacje", nie "Zatwierdzenia". */}
            <p className="font-semibold text-c-text">Akceptacje</p>
            <p>Odpowiedzi: {session.state === 'in_review' || session.state === 'frozen' ? 'w przeglądzie lub zatwierdzone' : 'robocze'}</p>
            <p>Targety i raport: {session.state === 'frozen' ? 'zamrożone' : 'niezatwierdzone'}</p>
            {governanceActions && <div className="mt-2 flex flex-wrap gap-2">{governanceActions}</div>}
          </div>
          <div>
            <p className="font-semibold text-c-text">Licencja i wersje</p>
            {/* 2026-08-26 assessment cleanup: removed "Status subskrypcji: do
                potwierdzenia przez backend" — a developer TODO note, not
                real data, left visible on the client's face (no field on
                `session`/`readiness` backs a subscription status; showing
                one would just be another fabricated fact). */}
            <p>Historia wersji dostępna z menu dokumentu</p>
          </div>
          {settingsContent && <div className="md:col-span-4">{settingsContent}</div>}
        </section>
      )}

      {degradedMessage && (
        <div
          role="status"
          data-testid="method-workspace-degraded-banner"
          className="flex items-center gap-2 border-b border-c-warning/30 bg-c-warning/10 px-4 py-2 text-xs text-c-warning"
        >
          <AlertTriangle size={13} />
          {degradedMessage}
        </div>
      )}

      {/* Context strip + one Command Row: view mode switch */}
      <div className="flex items-center justify-between border-b border-c-border-subtle px-4 py-2">
        <div className="text-xs text-c-text-muted">
          {t('methodWorkspace.unitsAnswered', '{{answered}}/{{total}} jednostek odpowiedzianych', {
            answered: readiness.answeredUnits,
            total: readiness.totalUnits,
          })}
          {readiness.unitsMissingEvidence > 0 &&
            ` · ${t('methodWorkspace.unitsMissingEvidence', '{{count}} bez dowodu', {
              count: readiness.unitsMissingEvidence,
            })}`}
        </div>
        <div
          role="tablist"
          aria-label={t('methodWorkspace.viewModeAria', 'Tryb widoku')}
          className="flex items-center rounded-lg border border-c-border p-0.5"
        >
          {VIEW_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={viewMode === opt.id}
              data-testid={`view-mode-${opt.id}`}
              onClick={() => setViewMode(opt.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${transitionClass} ${
                viewMode === opt.id ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted hover:text-c-text'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* ★ DRZEWO SESJI ZNIKA NA ZAKŁADCE „RAPORT" (2026-09-05).
              Raport ma WŁASNĄ szynę rozdziałów (osie 1–7) po swojej lewej
              stronie. Dwie szyny obok siebie kosztowały 240 px z 1440 i to
              one wypychały macierz właściciela do kadru ~500 px, w którym
              z dziewięciu obszarów widać było trzy. Nawigator wraca w tej
              samej sekundzie, w której użytkownik wraca na „Wywiad" albo
              „Macierz" — nic nie jest chowane na stałe. */}
          {viewMode === 'report' ? null : (
            <div className="hidden w-60 shrink-0 overflow-y-auto border-r border-c-border-subtle p-3 lg:block">
              <MethodNavigator {...navigatorProps} />
            </div>
          )}
          {viewMode === 'matrix' ? (
            <div className="min-w-0 flex-1 overflow-auto p-4">
              {matrixContent ?? (
                <LiveMatrix {...matrixProps} methodName={methodName} className="h-full" />
              )}
            </div>
          ) : viewMode === 'report' ? (
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4" data-testid="method-report-workspace">
              {reportContent}
            </div>
          ) : (
            <div className="min-w-0 flex-1 overflow-y-auto p-4">
              <InterviewFocusPanel {...interviewProps} readOnly={readOnly} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default MethodWorkspaceShell;
