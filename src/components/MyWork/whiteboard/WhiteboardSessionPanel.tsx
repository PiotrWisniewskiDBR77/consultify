import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  FacilitationPhase,
  WhiteboardActivityEntry,
  WhiteboardHistoryEntry,
  WhiteboardLibraryItem,
  WhiteboardSessionState,
} from './whiteboardContracts';
import { WhiteboardPhaseBar } from './WhiteboardPhaseBar';

export interface WhiteboardSessionPanelProps {
  isPl: boolean;
  locked?: boolean;
  sessionState: WhiteboardSessionState;
  whiteboardModeCopy: { toggleLabel: string; modeLabel: string; exitHint: string; helper: string };
  activityLog: WhiteboardActivityEntry[];
  historyLog: WhiteboardHistoryEntry[];
  libraryItems: WhiteboardLibraryItem[];
  onCycleGovernance: () => void;
  onRestoreLatestHistory: () => void;
  onPhaseChange: (phase: FacilitationPhase) => void;
  /** Naprawa 2026-07-26 (Zadanie A, `ff_whiteboardSessionInPanel`): gdy `true`,
   * renderuje się jako zwykły blok wypełniający kontener rodzica (prawy
   * panel „Właściwości") zamiast pływającego overlaya `absolute` nad
   * płótnem. Zero zmian w treści/handlerach — tylko klasy wrappera.
   *
   * 2026-07-28 (`ff_ideaPanel6Sections`): ten sam tryb obsługuje sekcję
   * „Narzędzie" układu sześciu sekcji, a panel dostaje własny, ZWIJALNY
   * nagłówek — właściciel: „to musi mieć możliwość chowania z ekranu". */
  embedded?: boolean;
}

export const WhiteboardSessionPanel: React.FC<WhiteboardSessionPanelProps> = ({
  isPl,
  locked,
  sessionState,
  whiteboardModeCopy,
  activityLog,
  historyLog,
  libraryItems,
  onCycleGovernance,
  onRestoreLatestHistory,
  onPhaseChange,
  embedded,
}) => {
  const { t } = useTranslation();
  /** Zwijanie — tylko w wersji panelowej (overlay nad płótnem bez zmian). */
  const [rozwiniete, setRozwiniete] = useState(true);
  const tresc = !embedded || rozwiniete;
  /** W panelu karty są płaskie (panel ma już własną ramkę i cień). */
  const kartaCls = embedded
    ? 'rounded-[11px] border border-c-border-subtle bg-c-surface-raised'
    : 'rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface dark:backdrop-blur-xl backdrop-blur-sm shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.4)]';

  const roleLabel =
    sessionState.role === 'facilitator'
      ? t('myWork.whiteboard.sessionPanel.roleFacilitator')
      : sessionState.role === 'participant'
        ? t('myWork.whiteboard.sessionPanel.roleParticipant')
        : t('myWork.whiteboard.sessionPanel.roleObserver');

  return (
    // Whiteboard-only floating panel. `left-20` (not `left-3`) is deliberate:
    // `CanvasLeftToolbar` (the vertically-centered tool rail shared by all 3
    // canvases) also defaults to `left-3` when it has no measured `railLeftPx`,
    // and sits at a higher stacking tier (`z-context-menu` > this panel's
    // `z-20`) — so both anchored at the same spot meant the rail's opaque pill
    // visually ate the left edge of every line here (every string in this file
    // rendered with its first few characters occluded). Cleared past the
    // rail's pill width instead of matching its anchor.
    <div
      className={
        embedded
          ? 'flex flex-col gap-2 w-full'
          : 'absolute top-3 left-20 z-20 flex flex-col gap-2 max-w-[280px]'
      }
      data-testid="whiteboard-session-panel"
    >
      {embedded && (
        <button
          type="button"
          onClick={() => setRozwiniete((v) => !v)}
          aria-expanded={rozwiniete}
          className="w-full flex items-center gap-2 rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-left transition-colors hover:border-c-focus"
          data-testid="whiteboard-session-panel-toggle"
        >
          <Layers size={12} className="shrink-0 text-c-text-muted" />
          <span className="flex-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-c-text-muted">
            {t('myWork.whiteboard.sessionPanel.layer')}
          </span>
          <span className="text-[10px] font-semibold text-c-text-secondary">{roleLabel}</span>
          {rozwiniete ? (
            <ChevronUp size={12} className="shrink-0 text-c-text-muted" />
          ) : (
            <ChevronDown size={12} className="shrink-0 text-c-text-muted" />
          )}
        </button>
      )}

      {tresc && (
        <div className={`${kartaCls} px-3 py-2.5`}>
          <div className="flex items-center justify-between gap-3">
            {/* Nazwa panelu + rola: w wersji panelowej niesie je zwijalny nagłówek
              wyżej, więc tutaj byłby dubel (Doktryna Gęstości). */}
            {!embedded && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-c-text-muted">
                  {t('myWork.whiteboard.sessionPanel.layer')}
                </div>
                <div className="text-[11px] font-semibold text-c-text">{roleLabel}</div>
              </div>
            )}
            <div className={embedded ? 'text-left' : 'text-right'}>
              <div className="text-[10px] font-semibold text-c-text-secondary">
                {whiteboardModeCopy.modeLabel}
              </div>
              <div className="text-[9px] text-c-text-secondary">
                {sessionState.timerEndsAt
                  ? `${Math.max(0, Math.ceil((sessionState.timerEndsAt - Date.now()) / 1000))}s`
                  : t('myWork.whiteboard.sessionPanel.timerOff')}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-1 rounded-full bg-c-surface-raised text-[10px] font-medium text-c-text-secondary">
              {whiteboardModeCopy.exitHint}
            </span>
            <span className="px-2 py-1 rounded-full bg-c-surface-raised text-[10px] font-medium text-c-text-secondary">
              {sessionState.votingOpen
                ? t('myWork.whiteboard.sessionPanel.votingOpen')
                : t('myWork.whiteboard.sessionPanel.votingClosed')}
            </span>
            <span className="px-2 py-1 rounded-full bg-c-surface-raised text-[10px] font-medium text-c-text-secondary">
              {sessionState.followMe
                ? t('myWork.whiteboard.sessionPanel.followOn')
                : t('myWork.whiteboard.sessionPanel.followOff')}
            </span>
            {sessionState.spotlightNodeId && (
              <span className="px-2 py-1 rounded-full bg-warning-500/10 text-[10px] font-medium text-warning-700 dark:text-warning-300">
                {t('myWork.whiteboard.sessionPanel.spotlightActive')}
              </span>
            )}
          </div>
          <div className="mt-2 border-t border-c-border-subtle pt-2">
            <WhiteboardPhaseBar
              isPl={isPl}
              currentPhase={sessionState.facilitationPhase}
              locked={locked}
              onPhaseChange={onPhaseChange}
              wrap={embedded}
            />
          </div>
          <div className="mt-2 text-[10px] leading-4 text-c-text-muted">
            {whiteboardModeCopy.helper}
          </div>
        </div>
      )}

      {tresc && (activityLog.length > 0 || libraryItems.length > 0 || historyLog.length > 0) && (
        <div className={`${kartaCls} px-3 py-2.5 space-y-2`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-c-text-muted">
              {t('myWork.whiteboard.sessionPanel.opsGovernance')}
            </div>
            <button
              type="button"
              onClick={onCycleGovernance}
              className="text-[10px] font-semibold text-c-text-secondary hover:text-c-text transition-colors"
            >
              {t('myWork.whiteboard.sessionPanel.cyclePolicy')}
            </button>
          </div>
          {libraryItems[0] && (
            <div className="text-[10px] text-c-text-secondary">
              {t('myWork.whiteboard.sessionPanel.libraryPrefix')} {libraryItems[0].name}
            </div>
          )}
          {historyLog[0] && (
            <button
              type="button"
              onClick={onRestoreLatestHistory}
              className="w-full text-left px-2 py-1.5 rounded-xl bg-c-surface-raised text-[10px] font-medium text-c-text-secondary"
            >
              {t('myWork.whiteboard.sessionPanel.restorePrefix')} {historyLog[0].label}
            </button>
          )}
          {activityLog.slice(0, 3).map((entry) => (
            <div key={entry.id} className="text-[10px] text-c-text-muted">
              {entry.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
