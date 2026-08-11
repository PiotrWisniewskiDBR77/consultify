/**
 * OkrSetWorkspace — RN-G3 lane `okr` (2026-08-11), the FULL OKR tool for one
 * materialized Set (design §8.3: "8.3 Full OKR tool", 7 workspace modes).
 * Reached from `ResultsOkrHub.tsx`'s Set row menu ("Otwórz obszar roboczy" /
 * "Open workspace") — same breadcrumb-drill-under-`/results/okr` routing
 * decision `OkrObjectivesView.tsx`'s header already justified for the
 * Objectives/KeyResults/CheckIns levels (no new route: every level below
 * Sets is structurally scoped to exactly one parent Set, which is exactly
 * what Menu 1 breadcrumbs are for — TRIADA embedded-hub mode).
 *
 * Menu 2 tabs are the 7 modes design §8.3 names, MINUS "Program Settings"
 * and "Cycle Management" (explicitly NOT tabs of one Set per that same
 * section: "Program Settings and Cycle Management have their own governed
 * admin routes/tools... they are not tabs belonging to a selected Set" —
 * built instead as `OkrProgramsPage.tsx`/`OkrCyclesPage.tsx`, their own
 * top-level admin surfaces per D-task-brief §"Program i Cykl to OSOBNE
 * zarządzane powierzchnie"):
 *  1. Overview               -> OkrSetOverviewView
 *  2. Objectives & Key Results -> the EXISTING breadcrumb sub-drill
 *     (OkrObjectivesView -> OkrKeyResultsView -> OkrCheckInsView, unchanged
 *     code, reused verbatim — this workspace only adds ONE more breadcrumb
 *     level in front of theirs)
 *  3. Alignment              -> OkrAlignmentsView
 *  4. Conversations & Support -> OkrSupportView
 *  5. Review & Reflection    -> OkrReviewReflectionView (also carries
 *     Closing/carry-forward — design §8.3 doesn't name a separate 8th mode
 *     for closing, and OKR-E007 treats close/carry-forward as review-phase
 *     commands, so they live on this tab rather than inventing an 8th mode
 *     no doc names)
 *  6. History                -> OkrHistoryView
 *
 * When the "Objectives & Key Results" tab is active AND the user has
 * drilled into a KeyResult or a CheckIns list, Menu 2 tabs are replaced by
 * the deeper breadcrumb chain — same "breadcrumbs replace tabs at a deeper
 * level" convention `ResultsOkrHub.tsx` already established for the Sets
 * registry -> Objectives transition (not a new convention, a continuation
 * of the existing one).
 */
import React, { useCallback, useMemo, useState } from 'react';

import { StandardModuleBar, type StandardBreadcrumb } from '@/components/standard';
import { tokenService } from '@/services/tokenService';

import type { OkrSetDto } from './okrApi';
import type { OkrKeyResultDto, OkrObjectiveWithKeyResultsDto } from './okrObjectiveApi';
import { OkrObjectivesView } from './OkrObjectivesView';
import { OkrKeyResultsView } from './OkrKeyResultsView';
import { OkrCheckInsView } from './OkrCheckInsView';
import { OkrSetOverviewView } from './OkrSetOverviewView';
import { OkrAlignmentsView } from './OkrAlignmentsView';
import { OkrSupportView } from './OkrSupportView';
import { OkrReviewReflectionView } from './OkrReviewReflectionView';
import { OkrHistoryView } from './OkrHistoryView';

function resolveCurrentUserIdFromToken(): string | null {
  try {
    const token = tokenService.getToken();
    if (!token) return null;
    return tokenService.decodeToken(token)?.id ?? null;
  } catch {
    return null;
  }
}

type WorkspaceTab = 'overview' | 'objectives' | 'alignment' | 'support' | 'review' | 'history';

type ObjectivesDrill =
  | null
  | { level: 'keyResults'; objective: OkrObjectiveWithKeyResultsDto }
  | { level: 'checkIns'; objective: OkrObjectiveWithKeyResultsDto; keyResult: OkrKeyResultDto };

export interface OkrSetWorkspaceProps {
  set: OkrSetDto;
  isPolish: boolean;
  setsLabel: string;
  onBackToSets: () => void;
  onSetChanged: (set: OkrSetDto) => void;
}

export const OkrSetWorkspace: React.FC<OkrSetWorkspaceProps> = ({ set, isPolish, setsLabel, onBackToSets, onSetChanged }) => {
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [objDrill, setObjDrill] = useState<ObjectivesDrill>(null);
  const currentUserId = useMemo(() => resolveCurrentUserIdFromToken(), []);

  const rootCrumbs: StandardBreadcrumb[] = useMemo(
    () => [
      { label: setsLabel, onClick: onBackToSets },
      { label: set.title, onClick: () => { setTab('overview'); setObjDrill(null); } },
    ],
    [setsLabel, onBackToSets, set.title]
  );

  const openKeyResults = useCallback((objective: OkrObjectiveWithKeyResultsDto) => {
    setObjDrill({ level: 'keyResults', objective });
  }, []);
  const openCheckIns = useCallback((keyResult: OkrKeyResultDto, objective: OkrObjectiveWithKeyResultsDto) => {
    setObjDrill({ level: 'checkIns', objective, keyResult });
  }, []);

  if (tab === 'objectives' && objDrill?.level === 'keyResults') {
    const breadcrumbs: StandardBreadcrumb[] = [
      ...rootCrumbs,
      { label: isPolish ? 'Cele i Kluczowe Rezultaty' : 'Objectives & Key Results', onClick: () => setObjDrill(null) },
      { label: objDrill.objective.title },
    ];
    return (
      <OkrKeyResultsView
        set={set}
        objectiveId={objDrill.objective.objectiveId}
        isPolish={isPolish}
        breadcrumbs={breadcrumbs}
        onOpenCheckIns={(kr, obj) => openCheckIns(kr, obj)}
      />
    );
  }

  if (tab === 'objectives' && objDrill?.level === 'checkIns') {
    const breadcrumbs: StandardBreadcrumb[] = [
      ...rootCrumbs,
      { label: isPolish ? 'Cele i Kluczowe Rezultaty' : 'Objectives & Key Results', onClick: () => setObjDrill(null) },
      {
        label: objDrill.objective.title,
        onClick: () => setObjDrill({ level: 'keyResults', objective: objDrill.objective }),
      },
      { label: objDrill.keyResult.title },
    ];
    return <OkrCheckInsView set={set} objective={objDrill.objective} keyResult={objDrill.keyResult} isPolish={isPolish} breadcrumbs={breadcrumbs} />;
  }

  if (tab === 'objectives') {
    const breadcrumbs: StandardBreadcrumb[] = [...rootCrumbs, { label: isPolish ? 'Cele i Kluczowe Rezultaty' : 'Objectives & Key Results' }];
    return <OkrObjectivesView set={set} isPolish={isPolish} breadcrumbs={breadcrumbs} onOpenKeyResults={(o) => openKeyResults(o)} />;
  }

  if (tab === 'alignment') {
    const breadcrumbs: StandardBreadcrumb[] = [...rootCrumbs, { label: isPolish ? 'Dopasowania' : 'Alignment' }];
    return <OkrAlignmentsView set={set} isPolish={isPolish} breadcrumbs={breadcrumbs} />;
  }

  if (tab === 'support') {
    const breadcrumbs: StandardBreadcrumb[] = [...rootCrumbs, { label: isPolish ? 'Rozmowy i wsparcie' : 'Conversations & Support' }];
    return <OkrSupportView set={set} isPolish={isPolish} breadcrumbs={breadcrumbs} />;
  }

  if (tab === 'history') {
    const breadcrumbs: StandardBreadcrumb[] = [...rootCrumbs, { label: isPolish ? 'Historia' : 'History' }];
    return <OkrHistoryView set={set} isPolish={isPolish} breadcrumbs={breadcrumbs} />;
  }

  // 'overview' and 'review' render inside the workspace shell WITH Menu 2
  // tabs visible (no further sub-drill exists for either) — the other tabs
  // above replace the whole screen with their own breadcrumb-only shell,
  // matching each sub-view's own established `ResultsVNextRegistryShell`
  // pattern (they own their own Menu 1/table/preview wiring).
  return (
    <div className="h-full" data-testid="results-vnext-okr-set-workspace">
      <StandardModuleBar
        breadcrumbs={rootCrumbs}
        tabs={[
          { id: 'overview', label: isPolish ? 'Przegląd' : 'Overview' },
          { id: 'objectives', label: isPolish ? 'Cele i Kluczowe Rezultaty' : 'Objectives & Key Results' },
          { id: 'alignment', label: isPolish ? 'Dopasowania' : 'Alignment' },
          { id: 'support', label: isPolish ? 'Rozmowy i wsparcie' : 'Conversations & Support' },
          { id: 'review', label: isPolish ? 'Przegląd i refleksja' : 'Review & Reflection' },
          { id: 'history', label: isPolish ? 'Historia' : 'History' },
        ]}
        activeTab={tab}
        onTabChange={(id) => setTab(id as WorkspaceTab)}
        showTabCounts={false}
      >
        {tab === 'overview' ? (
          <OkrSetOverviewView set={set} isPolish={isPolish} currentUserId={currentUserId} onSetChanged={onSetChanged} />
        ) : (
          <OkrReviewReflectionView set={set} isPolish={isPolish} currentUserId={currentUserId} onSetChanged={onSetChanged} />
        )}
      </StandardModuleBar>
    </div>
  );
};

export default OkrSetWorkspace;
