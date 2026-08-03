/**
 * Dev-render host for the Assessment SESSION as a Matryca artefakt (SPEC-A
 * archetype D — grid+toolbar centrum, ARTIFACT_ANATOMY_STANDARD §13).
 *
 * Renders the REAL `<DRDMatrixSession>` (Piotr's "Digital Pathfinder" —
 * axis-by-axis maturity matrix, cells change color on click) wrapped in the
 * REAL shared powłoka: `<TopBar>` (Menu 1 — back/breadcrumb/title/status
 * chip/save indicator/primary) from `ExecutiveModuleShell` + the canonical
 * `<ArtifactRightPanel>` accordion (Akcje·Właściwości·Powiązania·Komentarze·
 * Historia/AI — SSOT order, ARTIFACT_ANATOMY_STANDARD §10.2/§11.2). No
 * re-implementation: both shell pieces and the matrix are the REAL
 * production components; only the session `answers` + right-panel section
 * content are mocked (no store/API/login).
 *
 * Exercises: axis navigation (left "Matrix overview" aside baked into the
 * matrix centrum itself), click-to-set achieved level (cell recolors),
 * right-panel accordion collapse/expand, light+dark tokens (zero crimson —
 * dotTone/status uses `c-info`, never `primary-*`/`c-accent`).
 */
import { CheckCircle2, FileBarChart, History as HistoryIcon, Link2, Sparkles } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { DRDEditorAnswers } from '@/components/assessment/drd/DRDAssessmentEditor';
import { DRDMatrixSession } from '@/components/assessment/drd/DRDMatrixSession';
import { TopBar, type TopBarChipDescriptor } from '@/components/shared/ExecutiveModuleShell';
import {
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewMetaCard,
  PreviewRelations,
} from '@/components/shared/PreviewPane';
import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { getQuestionsForAxis } from '@/services/drdStructure';

// ── Mock session answers (realistic partial progress across 3 axes) ───────
function buildMockAnswers(): DRDEditorAnswers {
  const areas: Record<string, { achievedLevel: number }> = {};
  const levelPattern = [3, 4, 2, 5, 3];
  getQuestionsForAxis(1).forEach((area, i) => {
    areas[area.id] = { achievedLevel: levelPattern[i % levelPattern.length] };
  });
  getQuestionsForAxis(2).forEach((area, i) => {
    if (i < 2) areas[area.id] = { achievedLevel: [2, 3][i] };
  });
  const axis3 = getQuestionsForAxis(3);
  if (axis3[0]) areas[axis3[0].id] = { achievedLevel: 4 };
  return { areas };
}

export function AssessmentMatrycaScreen(): React.ReactElement {
  const isPl = (new URLSearchParams(window.location.search).get('lang') || 'pl') !== 'en';

  const [answers, setAnswers] = useState<DRDEditorAnswers>(() => buildMockAnswers());
  const [axisId, setAxisId] = useState<number>(1);
  const [areaId, setAreaId] = useState<string | undefined>(undefined);

  const chips: TopBarChipDescriptor[] = useMemo(
    () => [
      {
        id: 'status',
        label: isPl ? 'W realizacji' : 'In progress',
        kind: 'standard',
        dotTone: 'info',
      },
      {
        id: 'run',
        label: isPl ? 'Generuj inicjatywy' : 'Generate initiatives',
        icon: Sparkles,
        kind: 'primary',
        onClick: () => {},
      },
    ],
    [isPl]
  );

  const rightSections: ArtifactRightPanelSection[] = useMemo(
    () => [
      {
        id: 'actions',
        label: isPl ? 'Akcje' : 'Actions',
        children: (
          <PreviewActionBar
            rows={[
              {
                buttons: [
                  {
                    label: isPl ? 'Generuj inicjatywy' : 'Generate initiatives',
                    icon: Sparkles,
                    colorScheme: 'neutral',
                    onClick: () => {},
                    flex: true,
                  },
                  {
                    label: isPl ? 'Eksportuj PDF' : 'Export PDF',
                    icon: FileBarChart,
                    colorScheme: 'neutral',
                    onClick: () => {},
                    flex: true,
                  },
                ],
              },
            ]}
          />
        ),
      },
      {
        id: 'properties',
        label: isPl ? 'Właściwości' : 'Properties',
        children: (
          <PreviewMetaCard
            pills={[
              { label: isPl ? 'Jednostka' : 'Unit', value: 'Manufacturing BU' },
              { label: isPl ? 'Runda' : 'Round', value: 'Q3 2026' },
              { label: isPl ? 'Właściciel' : 'Owner', value: 'Anna Kowalska' },
              { label: isPl ? 'Pewność' : 'Confidence', value: '78%', tone: 'info' },
            ]}
          />
        ),
      },
      {
        id: 'relations',
        label: isPl ? 'Powiązania' : 'Relations',
        children: (
          <PreviewRelations
            items={[
              {
                id: 'r1',
                label: isPl ? 'Runda 2025 — porównanie' : '2025 round — comparison',
                icon: HistoryIcon,
                type: 'assessment',
              },
              {
                id: 'r2',
                label: isPl ? '3 inicjatywy powiązane' : '3 linked initiatives',
                icon: Link2,
                type: 'initiative',
              },
            ]}
          />
        ),
      },
      {
        id: 'comments',
        label: isPl ? 'Komentarze' : 'Comments',
        isEmpty: true,
        emptyLabel: isPl ? 'Brak komentarzy.' : 'No comments yet.',
        children: null,
      },
      {
        id: 'history',
        label: isPl ? 'Historia / AI' : 'History / AI',
        children: (
          <PreviewAIHintStrip
            hints={[
              isPl ? 'Podsumuj postęp osi' : 'Summarize axis progress',
              isPl ? 'Zaproponuj kolejny krok' : 'Suggest next step',
            ]}
            onRunHint={() => {}}
          />
        ),
      },
    ],
    [isPl]
  );

  return (
    <div className="flex h-screen w-full flex-col bg-c-bg">
      <TopBar
        moduleLabel={isPl ? 'Ocena' : 'Assessment'}
        title="DBR77 · Digital Readiness — Manufacturing BU"
        chips={chips}
        backLabel={isPl ? 'Wróć do listy ocen' : 'Back to assessments'}
        onBack={() => {}}
        presenceSlot={
          <span className="inline-flex items-center gap-1 text-xs text-c-text-muted">
            <CheckCircle2 size={13} className="text-c-success" />
            {isPl ? 'Zapisano' : 'Saved'}
          </span>
        }
      />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <DRDMatrixSession
            value={answers}
            onChange={setAnswers}
            currentAxisId={axisId}
            onAxisChange={setAxisId}
            currentAreaId={areaId}
            onAreaChange={setAreaId}
          />
        </div>
        <ArtifactRightPanel
          sections={rightSections}
          ariaLabel={isPl ? 'Szczegóły oceny' : 'Assessment details'}
        />
      </div>
    </div>
  );
}

export default AssessmentMatrycaScreen;
