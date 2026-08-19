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
 * Three view modes (`interview` / `split` / `matrix`) are pure presentations
 * of the SAME state — switching never re-fetches or forks data. The chosen
 * mode and the last matrix position are remembered per session in
 * localStorage (UI-NAV §6 "System zapamiętuje preferowany widok i ostatnią
 * pozycję").
 */
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  LogOut,
  MessageSquareText,
  MoreHorizontal,
  Rows3,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { MethodReadiness, MethodSaveState, MethodSession } from '@/method-core/contracts';

import type { InterviewFocusPanelProps } from './InterviewFocusPanel';
import { InterviewFocusPanel } from './InterviewFocusPanel';
import type { LiveMatrixProps } from './LiveMatrix';
import { LiveMatrix } from './LiveMatrix';
import type { MethodNavigatorProps } from './MethodNavigator';
import { MethodNavigator } from './MethodNavigator';
import { SaveStateIndicator } from './SaveStateIndicator';
import type { TeresaPreviewPanelProps } from './TeresaPreviewPanel';
import { TeresaPreviewPanel } from './TeresaPreviewPanel';
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
  matrixProps: Omit<LiveMatrixProps, 'className' | 'legendCollapsed' | 'methodName'>;

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
    if (raw === 'interview' || raw === 'split' || raw === 'matrix') return raw;
  } catch {
    // localStorage unavailable (privacy mode, SSR) — fall back silently.
  }
  return 'interview';
}

const VIEW_MODE_OPTIONS: Array<{ id: MethodWorkspaceViewMode; label: string; icon: React.ReactNode }> = [
  { id: 'interview', label: 'Interview', icon: <MessageSquareText size={13} /> },
  { id: 'split', label: 'Split', icon: <Rows3 size={13} /> },
  { id: 'matrix', label: 'Matrix', icon: <LayoutGrid size={13} /> },
];

export const MethodWorkspaceShell: React.FC<MethodWorkspaceShellProps> = ({
  session,
  methodName,
  packVersionLabel,
  readiness,
  mode,
  onModeChange,
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
  viewMode: viewModeProp,
  onViewModeChange,
  degradedMessage,
  loading = false,
  errorMessage,
  readOnly = false,
  className = '',
}) => {
  const [internalViewMode, setInternalViewMode] = useState<MethodWorkspaceViewMode>(() =>
    readStoredViewMode(session.id)
  );
  const viewMode = viewModeProp ?? internalViewMode;

  const [mirrorExpanded, setMirrorExpanded] = useState(false);
  const [menu3Open, setMenu3Open] = useState(false);
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
      draft: 'Szkic',
      prepared: 'Przygotowana',
      active: 'W trakcie wywiadu',
      in_review: 'Do przeglądu',
      frozen: 'Zamrożona',
      closed: 'Zamknięta',
      archived: 'Zarchiwizowana',
    };
    return map[session.state];
  }, [session.state]);

  if (loading) {
    return (
      <div
        data-testid="method-workspace-loading"
        className="flex h-full items-center justify-center text-sm text-c-text-muted"
      >
        Ładowanie sesji…
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
          Wyjdź
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-c-text">
            {methodName} · Sesja {session.id.slice(0, 8)}
          </p>
          <p className="truncate text-[11px] text-c-text-muted">Method Pack {packVersionLabel}</p>
        </div>

        <span className="shrink-0 rounded-full border border-c-border bg-c-surface-raised px-2.5 py-1 text-[11px] font-medium text-c-text-secondary">
          {statusLabel}
        </span>

        <div className="shrink-0 flex items-center rounded-lg border border-c-border p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onModeChange('guided_manual')}
            disabled={readOnly}
            aria-pressed={mode === 'guided_manual'}
            className={`rounded-md px-2 py-1 font-medium transition-colors ${
              mode === 'guided_manual' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted hover:text-c-text'
            }`}
          >
            Pracuję samodzielnie
          </button>
          <button
            type="button"
            onClick={() => onModeChange('teresa_led')}
            disabled={readOnly}
            aria-pressed={mode === 'teresa_led'}
            className={`rounded-md px-2 py-1 font-medium transition-colors ${
              mode === 'teresa_led' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted hover:text-c-text'
            }`}
          >
            Prowadzi Teresa
          </button>
        </div>

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
          Zapisz teraz
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenu3Open((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menu3Open}
            aria-label="Więcej opcji"
            className="rounded-lg p-1.5 text-c-text-muted hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <MoreHorizontal size={16} />
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
                Duplikuj jako nową
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-xs text-c-text-secondary hover:bg-c-surface"
              >
                Historia wersji
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-xs text-c-text-secondary hover:bg-c-surface"
              >
                Udostępnij / kopiuj link
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-xs text-c-text-secondary hover:bg-c-surface"
              >
                Archiwizuj
              </button>
            </div>
          )}
        </div>
      </header>

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
          {readiness.answeredUnits}/{readiness.totalUnits} jednostek odpowiedzianych
          {readiness.unitsMissingEvidence > 0 && ` · ${readiness.unitsMissingEvidence} bez dowodu`}
        </div>
        <div role="tablist" aria-label="Tryb widoku" className="flex items-center rounded-lg border border-c-border p-0.5">
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
        {viewMode === 'matrix' ? (
          <div className="flex-1 overflow-auto p-4">
            <LiveMatrix {...matrixProps} methodName={methodName} className="h-full" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="hidden w-60 shrink-0 overflow-y-auto border-r border-c-border-subtle p-3 lg:block">
              <MethodNavigator {...navigatorProps} />
            </div>
            <div className="min-w-0 flex-1 overflow-y-auto p-4">
              <InterviewFocusPanel {...interviewProps} readOnly={readOnly} />
              {viewMode === 'split' && (
                <div className="mt-4 rounded-xl border border-c-border-subtle p-3">
                  <LiveMatrix {...matrixProps} methodName={methodName} legendCollapsed />
                </div>
              )}
            </div>
            <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-c-border-subtle p-3 xl:block">
              <TeresaPreviewPanel {...teresaProps} readOnly={readOnly} />
            </div>
          </div>
        )}

        {/* Graphic Mirror — sticky/expandable, hidden while in full-screen matrix mode */}
        {viewMode === 'interview' && (
          <div className="shrink-0 border-t border-c-border-subtle">
            <button
              type="button"
              onClick={() => setMirrorExpanded((v) => !v)}
              aria-expanded={mirrorExpanded}
              data-testid="graphic-mirror-toggle"
              className="flex w-full items-center justify-between px-4 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised"
            >
              Macierz na żywo (Graphic Mirror)
              {mirrorExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
            {mirrorExpanded && (
              <div className={`max-h-64 overflow-auto p-3 ${transitionClass}`}>
                <LiveMatrix {...matrixProps} methodName={methodName} />
              </div>
            )}
          </div>
        )}

        {/* Bottom status bar */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-c-border px-4 py-1.5 text-[11px] text-c-text-muted">
          <SaveStateIndicator state={saveState} lastSavedAt={saveLastSavedAt} errorMessage={saveErrorMessage} />
          <span>Wersja metody {packVersionLabel}</span>
          <span>
            Evidence: {readiness.totalUnits - readiness.unitsMissingEvidence}/{readiness.totalUnits}
          </span>
          <span>{readiness.openDiscrepancies} do przeglądu</span>
          {readiness.freezeBlockers.length > 0 ? (
            <span className="flex items-center gap-1 text-c-warning">
              <AlertTriangle size={11} />
              {readiness.freezeBlockers.length} blokerów freeze
            </span>
          ) : (
            <span className="text-c-success">Gotowe do zamrożenia</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MethodWorkspaceShell;
