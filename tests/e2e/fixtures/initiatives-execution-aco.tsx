import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { CanonicalInitiativeCardWorkspace } from '@/components/Initiatives/CanonicalInitiativeCardWorkspace';
import { CanonicalInitiativeRegister } from '@/components/Initiatives/CanonicalInitiativeRegister';
import { PortfolioScenarioSurface } from '@/components/Initiatives/PortfolioScenarioSurface';
import { PlanScenarioSurface } from '@/components/Initiatives/PlanScenarioSurface';
import { CapacityScenarioSurface } from '@/components/Initiatives/CapacityScenarioSurface';
import { ExecutionControlSurface } from '@/components/Execution/ExecutionControlSurface';
import { ExecutionRealizationsSurface } from '@/components/Execution/ExecutionRealizationsSurface';
import { ExecutionReportsSurface } from '@/components/Execution/ExecutionReportsSurface';
import { ExecutionResourcesSurface } from '@/components/Execution/ExecutionResourcesSurface';
import { ExecutionWorkSurface } from '@/components/Execution/ExecutionWorkSurface';
import { SourceProposalRegistrationSurface } from '@/components/Initiatives/SourceProposalRegistrationSurface';
import { DefinitionDecisionQueue } from '@/components/MyWork/DefinitionDecisionQueue';
import { DefinitionRemediationQueue } from '@/components/MyWork/DefinitionRemediationQueue';
import { AIAnalysisProposalReviewQueue } from '@/components/MyWork/AIAnalysisProposalReviewQueue';
import { PortfolioDecisionQueue } from '@/components/MyWork/PortfolioDecisionQueue';
import { GateSignoffQueue } from '@/components/MyWork/GateSignoffQueue';
import { ScheduleDecisionQueue } from '@/components/MyWork/ScheduleDecisionQueue';
import { HandoffAcceptanceQueue } from '@/components/MyWork/HandoffAcceptanceQueue';
import { DeliveryResultsAcceptanceQueue } from '@/components/MyWork/DeliveryResultsAcceptanceQueue';
import { EffectivenessClosureQueue } from '@/components/MyWork/EffectivenessClosureQueue';
import { ClosureDecisionQueue } from '@/components/MyWork/ClosureDecisionQueue';
import { submitSourceProposal } from '@/services/initiatives-execution/runtimeApi';
import '@/index.css';
import { InitiativeStatus } from '@/types';

const Harness: React.FC = () => {
  const initialParams = new URLSearchParams(window.location.search);
  const [initiativeId, setInitiativeId] = useState<string | null>(
    initialParams.get('initiativeId')
  );
  const [submitted, setSubmitted] = useState(
    initialParams.has('sourceProposalId') || initialParams.has('initiativeId')
  );
  const [submitState, setSubmitState] = useState('IDLE');
  const [sourceProposalId, setSourceProposalId] = useState<string | null>(
    initialParams.get('sourceProposalId')
  );
  const [registerSelection, setRegisterSelection] = useState<any>(null);
  const updateSourceContext = (proposalId: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (proposalId) next.set('sourceProposalId', proposalId);
    else next.delete('sourceProposalId');
    window.history.replaceState({}, '', `${window.location.pathname}?${next.toString()}`);
    setSourceProposalId(proposalId);
  };
  const mode = new URLSearchParams(window.location.search).get('mode') ?? 'initiatives';
  if (mode === 'initiative-register') {
    const registerRows = [
      {
        id: 'aco-initiative-1',
        name: 'Automated Changeover Optimization',
        summary: 'Long and unstable changeovers reduce available production time.',
        axis: 'operational',
        status: InitiativeStatus.EXECUTING,
        displayStatus: 'IN_EXECUTION',
        priority: undefined as never,
        progress: undefined as never,
        budget: undefined as never,
        ownerBusiness: { id: 'owner-1', firstName: 'Marta', lastName: 'Nowak' },
        canonicalVersion: 12,
        gateName: 'Delivery',
        gateReadiness: 'READY',
        nextAction: 'Monitoruj realizację',
        expectedImpact: 'Reduce average changeover duration by 25%',
        impactConfidence: 'HIGH',
        plannedWindow: '2026-Q3',
        healthState: 'ON_TRACK',
        sourceFreshness: 'CURRENT',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-10T08:00:00.000Z',
      },
      {
        id: 'aco-initiative-2',
        name: 'Digital Performance Management',
        summary: 'Daily decisions rely on delayed and inconsistent operating data.',
        axis: 'operational',
        status: InitiativeStatus.APPROVED,
        displayStatus: 'APPROVED_BACKLOG',
        priority: undefined as never,
        progress: undefined as never,
        budget: undefined as never,
        ownerBusiness: { id: 'owner-2', firstName: 'Piotr', lastName: 'Kowalski' },
        canonicalVersion: 8,
        gateName: 'Schedule',
        gateReadiness: 'NOT_EVALUATED',
        nextAction: 'Zaplanuj realizację',
        expectedImpact: 'UNKNOWN',
        impactConfidence: 'UNKNOWN',
        plannedWindow: null,
        healthState: 'N/A',
        sourceFreshness: 'STALE',
        createdAt: '2026-08-02T08:00:00.000Z',
        updatedAt: '2026-08-09T08:00:00.000Z',
      },
    ];
    return (
      <main aria-label="Canonical Initiative register preview" className="h-screen bg-c-app p-4">
        <CanonicalInitiativeRegister
          rows={registerRows}
          selectedId={registerSelection?.id ?? null}
          onSelect={setRegisterSelection}
          onOpen={setRegisterSelection}
          persistKey="acceptance.initiatives.canonical-register.v1"
          emptyTitle="Brak inicjatyw"
          emptyDescription="Brak inicjatyw w wybranym zakresie."
        />
      </main>
    );
  }
  if (mode === 'portfolio') {
    const portfolioInitiativeId = initialParams.get('initiativeId');
    const portfolioInitiativeVersion = Number(initialParams.get('initiativeVersion'));
    return (
      <main aria-label="Portfolio acceptance harness" className="min-h-screen bg-c-app">
        <PortfolioScenarioSurface
          portfolioId="operations-transformation-2027"
          initiatives={
            portfolioInitiativeId &&
            Number.isInteger(portfolioInitiativeVersion) &&
            portfolioInitiativeVersion > 0
              ? [
                  {
                    id: portfolioInitiativeId,
                    name: 'Automated Changeover Optimization',
                    version: portfolioInitiativeVersion,
                  },
                ]
              : []
          }
        />
      </main>
    );
  }
  if (mode === 'portfolio-decision') {
    return (
      <main aria-label="Portfolio Decision acceptance harness" className="min-h-screen bg-c-app">
        <GateSignoffQueue />
        <PortfolioDecisionQueue />
      </main>
    );
  }
  if (mode === 'plan') {
    const planInitiativeId = initialParams.get('initiativeId');
    return (
      <main aria-label="Plan acceptance harness" className="min-h-screen bg-c-app">
        <PlanScenarioSurface
          initiatives={
            planInitiativeId
              ? [{ id: planInitiativeId, name: 'Automated Changeover Optimization' }]
              : []
          }
        />
      </main>
    );
  }
  if (mode === 'capacity') {
    return (
      <main aria-label="Capacity acceptance harness" className="min-h-screen bg-c-app">
        <CapacityScenarioSurface />
      </main>
    );
  }
  if (mode === 'schedule-handoff') {
    return (
      <main aria-label="Schedule and Handoff acceptance harness" className="min-h-screen bg-c-app">
        <GateSignoffQueue />
        <ScheduleDecisionQueue />
        <HandoffAcceptanceQueue />
      </main>
    );
  }
  if (mode === 'my-work') {
    return (
      <main aria-label="My Work acceptance harness" className="min-h-screen bg-c-app">
        <AIAnalysisProposalReviewQueue />
        <DefinitionRemediationQueue />
        <DefinitionDecisionQueue />
      </main>
    );
  }
  if (mode === 'delivery-results-closure') {
    return (
      <main aria-label="Delivery Results Closure acceptance harness" className="min-h-screen bg-c-app">
        <GateSignoffQueue />
        <DeliveryResultsAcceptanceQueue />
        <EffectivenessClosureQueue />
        <ClosureDecisionQueue />
      </main>
    );
  }
  if (mode === 'execution-realizations') {
    return (
      <main
        aria-label="Execution Realizations acceptance harness"
        className="min-h-screen bg-c-app"
      >
        <ExecutionRealizationsSurface />
      </main>
    );
  }
  if (mode === 'execution-work') {
    return (
      <main aria-label="Execution Work acceptance harness" className="min-h-screen bg-c-app">
        <ExecutionWorkSurface />
      </main>
    );
  }
  if (mode === 'execution-control') {
    return (
      <main aria-label="Execution Control acceptance harness" className="min-h-screen bg-c-app">
        <ExecutionControlSurface />
      </main>
    );
  }
  if (mode === 'execution-reports') {
    return (
      <main aria-label="Execution Reports acceptance harness" className="min-h-screen bg-c-app">
        <ExecutionReportsSurface />
      </main>
    );
  }
  if (mode === 'execution-resources') {
    return (
      <main aria-label="Execution Resources acceptance harness" className="min-h-screen bg-c-app">
        <ExecutionResourcesSurface />
      </main>
    );
  }
  if (!submitted) {
    return (
      <main className="min-h-screen bg-c-app p-8" aria-label="Assessment finding">
        <h1>Assessment finding ASM-F-ACO-BROWSER</h1>
        <p>Median changeover is 95 minutes.</p>
        <p>Assessment / finding / version 3</p>
        <button
          type="button"
          disabled={submitState === 'SAVING'}
          onClick={async () => {
            setSubmitState('SAVING');
            try {
              const result = await submitSourceProposal({
                proposalId: 'proposal-aco-browser',
                expectedVersion: 0,
                clientRequestId: 'aco-source-submit-001',
                sourceType: 'assessment-finding',
                sourceId: 'ASM-F-ACO-BROWSER',
                sourceVersion: 3,
                provenance: {
                  system: 'Assessment',
                  recordType: 'finding',
                  capturedAt: '2026-08-10T10:00:00.000Z',
                  evidenceRefs: ['assessment:ASM-F-ACO-BROWSER:v3'],
                },
                title: 'Automated Changeover Optimization',
                problem: 'Median changeover is 95 minutes.',
                proposedOutcome: 'Reduce median changeover time.',
                projectId: 'operations-transformation-2027',
                initiativeOwnerId: 'initiative-owner',
                visibility: 'PROJECT',
              });
              if (result.proposal?.id === 'proposal-aco-browser') setSubmitted(true);
            } catch {
              setSubmitState('FAILED');
            }
          }}
        >
          Submit Proposal
        </button>
        <div role="status">{submitState}</div>
      </main>
    );
  }
  return initiativeId ? (
    <CanonicalInitiativeCardWorkspace
      initiativeId={initiativeId}
      onBack={() => setInitiativeId(null)}
    />
  ) : (
    <SourceProposalRegistrationSurface
      initialSelectedId={sourceProposalId}
      onSelectionChange={updateSourceContext}
      onOpenInitiative={setInitiativeId}
    />
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>
);
