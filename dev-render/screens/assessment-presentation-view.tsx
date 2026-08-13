/**
 * dev-render harness for the REAL `AssessmentPresentationView`
 * (`src/components/assessment/presentation/**`) — the board-facing,
 * fullscreen slide deck built from ONE frozen Method Kernel Output.
 *
 * No `window.fetch` stub is needed: `AssessmentPresentationView` accepts an
 * injectable `fetchOutput` prop specifically so a harness (or a test) can
 * hand it a fixture directly instead of intercepting HTTP.
 *
 * URL params:
 *   ?variant=full|risksOnly|allMet|unknowns|empty|noOutput|notFound|forbidden|offline|badShape
 *     full       (default) — DRD-like fixture: some strengths, some risks,
 *                one unit with no accepted evidence (current=null).
 *     risksOnly  — every scored unit behind target, zero strengths.
 *     allMet     — every scored unit at/above target, zero risks.
 *     unknowns   — several units missing evidence (heavier slide 8).
 *     empty      — zero findings at all (edge case: every list empty).
 *     noOutput   — outputId=null -> the "no Output" honest state.
 *     notFound   — fetchOutput rejects with a 404 MethodCoreApiError.
 *     forbidden  — fetchOutput rejects with a 403 MethodCoreApiError.
 *     offline    — fetchOutput rejects with a network-level error.
 *     badShape   — fetchOutput resolves with an unrecognized payload.
 *   &narrative=1   also supply clientName/businessQuestion/participants
 *                  (demonstrates the "filled in" slides 1-3 instead of the
 *                  honest "not captured" notes).
 *   &theme=light|dark
 */
import React from 'react';

import { AssessmentPresentationView } from '../../src/components/assessment/presentation/AssessmentPresentationView';
import type { PresentationFetchResult } from '../../src/components/assessment/presentation/AssessmentPresentationView';
import type { RawAssessmentOutputRecord } from '../../src/components/assessment/presentation/rawOutputTypes';
import { MethodCoreApiError } from '../../src/method-core/api/methodCoreApi';
import { useAppStore } from '../../src/store/useAppStore';

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

function finding(overrides: Partial<RawAssessmentOutputRecord['findings'][number]>): RawAssessmentOutputRecord['findings'][number] {
  return {
    id: `finding-${overrides.unitId}`,
    unitId: 'u-1',
    unitName: 'Unit',
    currentLevel: 2,
    targetLevel: 3,
    gap: 1,
    supportingEvidence: [{ evidenceId: `ev-${overrides.unitId}`, evidenceType: 'document', strength: 'E2', locator: 'vault://doc' }],
    contradictingEvidence: [],
    businessMeaning: '—',
    rootCauseHypothesis: null,
    riskOrOpportunity: null,
    recommendation: '—',
    prerequisite: null,
    expectedOutcome: null,
    kpiProposal: null,
    confidence: 'medium',
    priorityRationale: null,
    sourceLocators: [],
    ...overrides,
  };
}

function buildOutput(variant: string): RawAssessmentOutputRecord {
  const base: Omit<RawAssessmentOutputRecord, 'findings' | 'current' | 'target' | 'gap' | 'aggregation' | 'evidenceCompleteness' | 'limitations'> = {
    id: 'output-demo-drd-0001',
    organizationId: 'org-demo',
    sessionId: 'sess-demo-drd-0001',
    snapshotId: 'snapshot-demo-0001',
    module: 'assessment',
    methodPackId: 'drd',
    methodPackVersion: '1.2.0',
    outputVersion: 2,
    revisionOfOutputId: 'output-demo-drd-0000',
    scope: 'DBR77 · Digital Readiness — Grupa Przemysłowa (runda Q3 2026)',
    contentHash: 'sha256-demo-presentation-0001',
    createdAt: '2026-08-10T15:12:00.000Z',
    frozenAt: '2026-08-10T15:12:00.000Z',
    demoBypassActive: false,
  };

  if (variant === 'empty') {
    return {
      ...base,
      findings: [],
      current: {},
      target: {},
      gap: {},
      aggregation: { byGroup: {}, mappingVersion: '1.2.0', rule: 'weighted-mean', excluded: {} },
      evidenceCompleteness: { totalUnits: 0, unitsWithAcceptedEvidence: 0, unitsMissingEvidence: 0, completenessRatio: 0 },
      limitations: ['Sesja zamrożona bez żadnych ustaleń — dane wejściowe puste.'],
    };
  }

  const strengthFindings = [
    finding({
      unitId: '1A',
      unitName: 'Procesy Sprzedaży',
      currentLevel: 4,
      targetLevel: 4,
      gap: 0,
      businessMeaning: 'Proces sprzedaży w pełni ustandaryzowany, mierzony miesięcznie w CRM.',
      recommendation: 'Utrzymaj bieżący poziom, zweryfikuj dowody przy reassessmencie.',
    }),
    finding({
      unitId: '3A',
      unitName: 'Jakość danych referencyjnych',
      currentLevel: 3,
      targetLevel: 3,
      gap: 0,
      businessMeaning: 'Dane referencyjne pod kontrolą jakości, właściciel wyznaczony.',
      recommendation: 'Rozszerz kontrolę jakości na dane transakcyjne.',
    }),
  ];

  const riskFindings = [
    finding({
      unitId: '1B',
      unitName: 'Procesy Marketingowe',
      currentLevel: 1,
      targetLevel: 3,
      gap: 2,
      businessMeaning: 'Kampanie marketingowe prowadzone ręcznie, bez wspólnego systemu.',
      riskOrOpportunity: 'Brak wspólnego systemu marketing automation utrudnia pomiar ROI kampanii i eskaluje koszt operacyjny.',
      recommendation: 'Wdróż jeden system marketing automation dla całej grupy.',
      confidence: 'high',
    }),
    finding({
      unitId: '2A',
      unitName: 'Produkty Cyfrowe',
      currentLevel: 2,
      targetLevel: 4,
      gap: 2,
      businessMeaning: 'Oferta cyfrowa istnieje, ale bez cyklu rozwoju opartego na danych klienta.',
      riskOrOpportunity: 'Konkurenci z krótszym cyklem iteracji przejmują udział w segmencie online.',
      recommendation: 'Wprowadź kwartalny cykl rozwoju produktu cyfrowego oparty na telemetrii użycia.',
      confidence: 'medium',
    }),
    finding({
      unitId: '6A',
      unitName: 'Cyberbezpieczeństwo — dostęp',
      currentLevel: 2,
      targetLevel: 3,
      gap: 1,
      businessMeaning: 'Kontrola dostępu częściowo wdrożona, brak regularnego przeglądu uprawnień.',
      riskOrOpportunity: 'Nieaktualne uprawnienia zwiększają powierzchnię ataku wewnętrznego.',
      recommendation: 'Wdróż kwartalny przegląd uprawnień dostępu.',
      confidence: 'medium',
    }),
  ];

  let findings = [...strengthFindings, ...riskFindings];
  if (variant === 'risksOnly') findings = riskFindings;
  if (variant === 'allMet') findings = strengthFindings;

  const current: Record<string, number | null> = {};
  const target: Record<string, number | null> = {};
  const gap: Record<string, number | null> = {};
  for (const f of findings) {
    current[f.unitId] = f.currentLevel;
    target[f.unitId] = f.targetLevel;
    gap[f.unitId] = f.gap;
  }

  // Unit(s) with no accepted evidence at all — current stays null, no
  // finding exists for it. `unknowns` variant adds several more.
  const unknownUnitIds = variant === 'unknowns' ? ['1C', '4A', '5B', '7A'] : ['1C'];
  for (const id of unknownUnitIds) {
    current[id] = null;
    target[id] = 3;
    gap[id] = null;
  }

  const totalUnits = Object.keys(current).length;
  const unitsMissingEvidence = unknownUnitIds.length;

  return {
    ...base,
    findings,
    current,
    target,
    gap,
    aggregation: {
      byGroup: { '1': 2.5, '2': 2, '3': 3, '6': 2 },
      mappingVersion: '1.2.0',
      rule: 'weighted-mean',
      excluded: {},
    },
    evidenceCompleteness: {
      totalUnits,
      unitsWithAcceptedEvidence: totalUnits - unitsMissingEvidence,
      unitsMissingEvidence,
      completenessRatio: totalUnits > 0 ? (totalUnits - unitsMissingEvidence) / totalUnits : 0,
    },
    limitations: ['Brak dowodu dla obszaru 1C (Procesy — Obsługa reklamacji) w tej rundzie.'],
  };
}

const params = new URLSearchParams(window.location.search);
const variant = params.get('variant') || 'full';
const withNarrative = params.get('narrative') === '1';

async function fetchOutput(): Promise<PresentationFetchResult> {
  await new Promise((r) => setTimeout(r, 150));
  if (variant === 'notFound') {
    throw new MethodCoreApiError('Output not found', 404, { error: 'Output not found' });
  }
  if (variant === 'forbidden') {
    throw new MethodCoreApiError('Forbidden', 403, { error: 'forbidden' });
  }
  if (variant === 'offline') {
    throw new MethodCoreApiError('Network request failed', 0, {}, true);
  }
  if (variant === 'badShape') {
    return { output: { unexpected: 'shape' } as unknown as RawAssessmentOutputRecord };
  }
  return { output: buildOutput(variant) };
}

export function AssessmentPresentationViewScreen(): React.ReactElement {
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <AssessmentPresentationView
        outputId={variant === 'noOutput' ? null : 'output-demo-drd-0001'}
        fetchOutput={fetchOutput}
        narrative={
          withNarrative
            ? {
                clientName: 'Grupa Przemysłowa DBR77',
                businessQuestion: 'Czy nasze procesy sprzedaży i marketingu są gotowe na skalowanie o 40% w 2027?',
                participants: ['Piotr Wiśniewski (Owner)', 'Anna Kowalska (Approver)', 'Marek Nowak (Assessor)'],
              }
            : undefined
        }
      />
    </div>
  );
}

export default AssessmentPresentationViewScreen;
