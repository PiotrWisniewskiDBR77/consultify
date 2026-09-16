import { Sparkles } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DrdLevelInterviewWorkspace, type DrdLevelDecision } from '@/components/assessment/drd/DrdLevelInterviewWorkspace';
import { buildNavigatorNodes, confirmedLevelsFor, targetLevelFor } from '@/components/assessment/drd/drdWorkspaceViewModel';
import { MethodWorkspaceShell } from '@/components/method-workspace/MethodWorkspaceShell';
import type { MethodEvent, MethodReadiness, MethodSession } from '@/method-core/contracts';
import { compileDrdPack } from '@/method-core/methods/drd/compileDrdPack';
import { drdAdapter } from '@/method-core/methods/drd/drdAdapter';
import { DRD_STRUCTURE } from '@/services/drdStructure';

const SESSION_ID = '7f3c1a2e-9b41-4d55-a0c7-2e6d8b5f1a90';
const AREA_ID = '1A';
const session = { id: SESSION_ID, organizationId: 'org-northwind', projectId: null, module: 'assessment', methodPackId: 'drd', methodPackVersion: '2.0.0-methodpack.1', state: 'in_progress', domainStage: 'interview', mode: 'guided_manual', ownerUserId: 'user-northwind-owner', createdAt: '2026-09-15T08:00:00.000Z', updatedAt: '2026-09-16T07:20:00.000Z', version: 4, frozenSnapshotId: null } as MethodSession;
const readiness: MethodReadiness = { answeredUnits: 1, totalUnits: 39, unitsMissingEvidence: 38, openDiscrepancies: 0, pendingProposals: 0, freezeBlockers: [] };

function answerEvent(level: number, state: string, text = ''): MethodEvent {
  return { id: `event-${level}-${state}`, type: 'ANSWER_CONFIRMED', organizationId: 'org-northwind', sessionId: SESSION_ID, unitId: AREA_ID, level, actorKind: 'human', actorUserId: 'user-northwind-owner', methodPackVersion: session.methodPackVersion, occurredAt: '2026-09-16T07:20:00.000Z', payload: { questionId: `${AREA_ID}-L${level}-Q1`, answerState: state, text } } as MethodEvent;
}

export default function U19DrdTrzyKolumnyScreen(): React.ReactElement {
  const { t } = useTranslation();
  const pack = useMemo(() => compileDrdPack('en').pack, []);
  const axis = DRD_STRUCTURE[0];
  const area = axis.areas.find((item) => item.id === AREA_ID)!;
  const levels = pack.levels.filter((item) => item.unitId === AREA_ID).sort((a, b) => a.level - b.level);
  const questions = pack.questions.filter((item) => item.unitId === AREA_ID);
  const [selectedLevel, setSelectedLevel] = useState(2);
  const [answer, setAnswer] = useState('Weekly dashboard is generated automatically in the CRM every Monday 06:00; conversion and pipeline are live, average deal size is still tallied by hand in Excel.');
  const [events, setEvents] = useState<MethodEvent[]>([
    answerEvent(1, 'confirmed'),
    { ...answerEvent(5, 'confirmed'), type: 'DECISION_APPROVED', payload: { subject: 'target_level' } } as MethodEvent,
    { ...answerEvent(2, 'partial', answer), type: 'ANSWER_DRAFTED' } as MethodEvent,
  ]);
  const progression = drdAdapter.resolveOpenLevels({ unitId: AREA_ID, confirmedLevels: confirmedLevelsFor(events, AREA_ID), evidenceByLevel: {} });
  const primaryQuestion = questions.find((item) => item.level === selectedLevel);

  const saveDecision = async (decision: DrdLevelDecision, text: string) => {
    const state = decision === 'yes' ? 'confirmed' : decision === 'no' ? 'no' : 'dont_know';
    setEvents((current) => [...current, answerEvent(selectedLevel, state, text)]);
    if (decision === 'yes' && selectedLevel < levels.length) setSelectedLevel((level) => level + 1);
  };

  return <div className="h-screen w-full bg-c-bg"><MethodWorkspaceShell
    session={session} methodName="DRD — Digital Readiness Diagnosis" packVersionLabel="2.0.0"
    readiness={readiness} mode="guided_manual" onModeChange={() => {}} onExit={() => {}}
    saveState="CLEAN" saveLastSavedAt={null} saveErrorMessage={null} onSaveNow={() => {}} onSaveRetry={() => {}} onSaveStay={() => {}}
    viewMode="interview" onViewModeChange={() => {}}
    navigatorProps={{ nodes: buildNavigatorNodes(events, 'en', { includeAreaMaxLevel: true }), activeUnitId: AREA_ID, onSelect: () => {} }}
    interviewProps={{} as never} teresaProps={{} as never} matrixProps={{} as never} reportContent={null}
    interviewContent={<DrdLevelInterviewWorkspace
      axis={axis} area={area} levels={levels} questions={questions} events={events}
      selectedLevel={selectedLevel} currentLevel={progression.currentLevel} targetLevel={targetLevelFor(events, AREA_ID)}
      answerText={answer} canWrite onAnswerChange={(_questionId, text) => setAnswer(text)} onSelectLevel={setSelectedLevel}
      onSaveDecision={saveDecision} onEvidenceDrop={() => {}} onAskTeresa={() => {}}
    />}
    aiButton={<button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary"><Sparkles size={13}/>{t('discoveryToolsMain.toolContextPanel.workWithAi')}</button>}
  /></div>;
}
