/**
 * CEL 8 / MPQ ISOLATED TEST HARNESS — mounts the REAL `MethodReportView` and
 * `MethodPresentationView` (src/components/method-workspace/) with a
 * realistic, deterministic DRD-flavored mock `AssessmentOutput` — no login,
 * no backend (CLAUDE.md #7).
 *
 * The mock deliberately includes: one unit with the LARGEST gap (headline
 * material), one UNSCORED unit (current=null — must never look like a
 * blocker), one unit whose only evidence is E0 (must never render red), and
 * one unit where target is already met (gap<=0 — the one place green/
 * "success" framing IS appropriate, a genuinely different concept from
 * "missing evidence").
 *
 * URL: ?screen=mpq-report-presentation&surface=report|presentation&theme=light|dark
 */
import React from 'react';

import { MethodPresentationView } from '../../src/components/method-workspace/MethodPresentationView';
import { MethodReportView } from '../../src/components/method-workspace/MethodReportView';
import { buildReportSnapshot, type Finding, type PresentationSourceBlock } from '../../src/method-core/outputs';

const params = new URLSearchParams(window.location.search);
const surface = params.get('surface') || 'report';

// ── Mock findings — DRD-flavored, Polish, answer-first ─────────────────────

const FINDINGS: Finding[] = [
  {
    id: 'f-governance',
    unitId: 'axis1.governance',
    unitName: 'Governance danych',
    currentLevel: 2,
    targetLevel: 4,
    gap: 2,
    supportingEvidence: [
      { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2', locator: 'vault://polityka-danych.pdf', title: 'Polityka danych (robocza)' },
    ],
    contradictingEvidence: [],
    businessMeaning: 'Decyzje o jakości danych klienta czekają na osobę, która nie jest formalnie wyznaczona.',
    rootCauseHypothesis: 'Nikt nie ma formalnego mandatu właściciela danych klienta.',
    riskOrOpportunity: 'Zespoły sprzedaży i marketingu pracują na rozjeżdżających się kopiach tych samych danych.',
    recommendation: 'Wdroż jednego formalnego właściciela danych klienta i coroczny przegląd polityki.',
    prerequisite: null,
    expectedOutcome: 'Jedna, spójna wersja danych klienta w organizacji.',
    kpiProposal: null,
    confidence: 'high',
    priorityRationale: 'Największa luka i blokuje dwie inne jednostki.',
    sourceLocators: ['question:q-gov-1'],
  },
  {
    id: 'f-roadmap',
    unitId: 'axis1.roadmap',
    unitName: 'Mapa drogowa cyfrowa',
    currentLevel: 1,
    targetLevel: 3,
    gap: 2,
    supportingEvidence: [
      { evidenceId: 'ev-2', evidenceType: 'interview_statement', strength: 'E1', locator: 'interview://cio-2026-08-01' },
    ],
    contradictingEvidence: [],
    businessMeaning: 'Inicjatywy cyfrowe konkurują o te same zasoby bez wspólnych priorytetów.',
    rootCauseHypothesis: 'Lista inicjatyw istnieje, ale nigdy nie przeszła formalnej akceptacji zarządu.',
    riskOrOpportunity: 'Zespoły planują niezależnie, co podwaja pracę nad tymi samymi obszarami.',
    recommendation: 'Skonsoliduj listę inicjatyw w jedną mapę drogową i zatwierdź ją na poziomie zarządu.',
    prerequisite: null,
    expectedOutcome: 'Jedna, priorytetowana lista inicjatyw cyfrowych.',
    kpiProposal: null,
    confidence: 'medium',
    priorityRationale: 'Wysoki wpływ na koordynację, średnia pilność.',
    sourceLocators: ['question:q-roadmap-1'],
  },
  {
    id: 'f-automation',
    unitId: 'axis3.automation',
    unitName: 'Automatyzacja procesów',
    currentLevel: 3,
    targetLevel: 5,
    gap: 2,
    // Deliberately E0 — the "missing evidence must not be red" case.
    supportingEvidence: [
      { evidenceId: 'ev-3', evidenceType: 'observation', strength: 'E0', locator: 'observation://none' },
    ],
    contradictingEvidence: [],
    businessMeaning: 'Zespół deklaruje wysoki poziom automatyzacji, ale nie ma na to udokumentowanego dowodu.',
    rootCauseHypothesis: 'Automatyzacja istnieje punktowo, bez centralnego rejestru.',
    riskOrOpportunity: 'Nie da się dziś potwierdzić deklarowanego poziomu — decyzja inwestycyjna czeka na dowód.',
    recommendation: 'Poproś o rejestr zautomatyzowanych procesów przed podjęciem decyzji o dalszej inwestycji.',
    prerequisite: null,
    expectedOutcome: 'Potwierdzony, udokumentowany poziom automatyzacji.',
    kpiProposal: null,
    confidence: 'low',
    priorityRationale: 'Niska pewność — priorytet to zebranie dowodu, nie inwestycja.',
    sourceLocators: ['question:q-auto-1'],
  },
  {
    id: 'f-integration',
    unitId: 'axis2.integration',
    unitName: 'Integracja systemów',
    currentLevel: 2,
    targetLevel: 2,
    gap: 0,
    supportingEvidence: [
      { evidenceId: 'ev-4', evidenceType: 'system_record', strength: 'E3', locator: 'system://crm-erp-sync-log' },
    ],
    contradictingEvidence: [],
    businessMeaning: 'CRM i ERP wymieniają dane automatycznie, zgodnie z celem na ten rok.',
    rootCauseHypothesis: '—',
    riskOrOpportunity: 'Cel na ten rok osiągnięty — kolejny przegląd celu ma sens za 12 miesięcy.',
    recommendation: 'Utrzymaj obecny poziom integracji; zaplanuj przegląd celu za rok.',
    prerequisite: null,
    expectedOutcome: 'Stabilna integracja bez dodatkowej inwestycji w tym roku.',
    kpiProposal: null,
    confidence: 'high',
    priorityRationale: 'Cel osiągnięty — niski priorytet działania.',
    sourceLocators: ['question:q-int-1'],
  },
];

const CURRENT: Record<string, number | null> = {
  'axis1.governance': 2,
  'axis1.roadmap': 1,
  'axis2.quality': null, // unscored — must not look like a blocker
  'axis2.integration': 2,
  'axis3.automation': 3,
  'axis3.monitoring': 4,
};
const TARGET: Record<string, number | null> = {
  'axis1.governance': 4,
  'axis1.roadmap': 3,
  'axis2.quality': 3,
  'axis2.integration': 2,
  'axis3.automation': 5,
  'axis3.monitoring': 4,
};
const GAP: Record<string, number | null> = {
  'axis1.governance': 2,
  'axis1.roadmap': 2,
  'axis2.quality': null,
  'axis2.integration': 0,
  'axis3.automation': 2,
  'axis3.monitoring': 0,
};
const UNIT_NAMES: Record<string, string> = {
  'axis1.governance': 'Governance danych',
  'axis1.roadmap': 'Mapa drogowa cyfrowa',
  'axis2.quality': 'Jakość danych',
  'axis2.integration': 'Integracja systemów',
  'axis3.automation': 'Automatyzacja procesów',
  'axis3.monitoring': 'Monitoring i alerting',
};

// unitResultsFrom (reportSnapshot.ts, internal) reads unit NAME from a
// matching Finding — units without one fall back to the unitId itself, so
// give every unit at least a zero-evidence stand-in finding for a readable
// name in the chart (axis2.quality and axis3.monitoring have none above).
const FINDINGS_WITH_NAME_STANDINS: Finding[] = [
  ...FINDINGS,
  {
    ...FINDINGS[0],
    id: 'f-quality-name-standin',
    unitId: 'axis2.quality',
    unitName: UNIT_NAMES['axis2.quality'],
    currentLevel: null,
    targetLevel: 3,
    gap: null,
    supportingEvidence: [{ evidenceId: 'ev-5', evidenceType: 'document', strength: 'E1', locator: 'x' }],
  },
  {
    ...FINDINGS[0],
    id: 'f-monitoring-name-standin',
    unitId: 'axis3.monitoring',
    unitName: UNIT_NAMES['axis3.monitoring'],
    currentLevel: 4,
    targetLevel: 4,
    gap: 0,
    supportingEvidence: [{ evidenceId: 'ev-6', evidenceType: 'metric', strength: 'E4', locator: 'x' }],
  },
];

const OUTPUT_LIKE = {
  id: 'output-mpq-demo',
  organizationId: 'org-demo',
  current: CURRENT,
  target: TARGET,
  gap: GAP,
  aggregation: { byGroup: { axis1: 1.5, axis2: 2, axis3: 3.5 }, mappingVersion: '1.0.0', rule: 'weighted-mean' as const, excluded: {} },
  evidenceCompleteness: { totalUnits: 6, unitsWithAcceptedEvidence: 4, unitsMissingEvidence: 2, completenessRatio: 0.67 },
  limitations: [
    'Poziom „Automatyzacja procesów” oparty wyłącznie na deklaracji — brak dowodu dokumentacyjnego.',
    '„Jakość danych” nie została jeszcze oceniona — wywiad w toku.',
  ],
  findings: FINDINGS_WITH_NAME_STANDINS,
  methodology: { methodPackId: 'drd', version: '2.0.0-methodpack.1' },
  scope: 'Pełna diagnostyka gotowości cyfrowej — 3 osie, 6 jednostek.',
  version: 1,
  frozenAt: '2026-08-13T10:00:00.000Z',
};

const REPORT = buildReportSnapshot(OUTPUT_LIKE as Parameters<typeof buildReportSnapshot>[0], {
  id: 'report-mpq-demo',
  executiveSummary:
    'Organizacja ma solidne podstawy integracji systemów, ale governance danych i mapa drogowa cyfrowa pozostają w tyle za celem na ten rok — to one, nie brak narzędzi, spowalniają decyzje.',
  participants: ['Anna Kowalska (CIO)', 'Piotr Nowak (Dyrektor operacyjny)'],
  strengths: ['Integracja CRM-ERP działa zgodnie z celem, bez dodatkowej inwestycji.', 'Silne wsparcie zarządu dla transformacji.'],
  initiativeCandidates: [],
  appendices: [],
  createdAt: '2026-08-13T10:00:00.000Z',
});

// ── Presentation deck — a title slide + one slide per top finding ──────────

// Slide bars key on human-readable unit names, never raw unitIds — a
// client-facing slide (unlike a debug dataSnapshot) must never surface an
// internal id like "axis1.governance".
const CURRENT_BY_NAME: Record<string, number | null> = Object.fromEntries(
  Object.entries(CURRENT).map(([unitId, level]) => [UNIT_NAMES[unitId] ?? unitId, level])
);

const BLOCKS: PresentationSourceBlock[] = [
  {
    sourceOutputId: 'output-mpq-demo',
    sourceVersion: 1,
    blockType: 'summary',
    blockId: 'slide-title',
    dataSnapshot: CURRENT_BY_NAME,
    title: 'Diagnostyka gotowości cyfrowej',
    keyMessage: 'Governance danych i mapa drogowa hamują wynik — integracja systemów już dowozi cel.',
    evidenceRefs: ['ev-1', 'ev-2', 'ev-4'],
    visualIntent: 'comparison',
    preferredLayouts: ['title', 'matrix'],
    density: 'standard',
    themeTokens: {},
    confidentiality: 'client_deliverable',
    freshness: '2026-08-13T10:00:00.000Z',
    provenance: { generatedBy: 'human', generatedAt: '2026-08-13T10:00:00.000Z', isDraft: false },
  },
  {
    sourceOutputId: 'output-mpq-demo',
    sourceVersion: 1,
    blockType: 'finding',
    blockId: 'slide-governance',
    dataSnapshot: { 'Governance danych': 2 },
    title: 'Governance danych',
    keyMessage: FINDINGS[0].recommendation,
    evidenceRefs: FINDINGS[0].supportingEvidence.map((e) => e.evidenceId),
    visualIntent: 'recommendation',
    preferredLayouts: ['two_column'],
    density: 'sparse',
    themeTokens: {},
    confidentiality: 'client_deliverable',
    freshness: '2026-08-13T10:00:00.000Z',
    provenance: { generatedBy: 'teresa', generatedAt: '2026-08-13T10:00:00.000Z', isDraft: false },
  },
  {
    sourceOutputId: 'output-mpq-demo',
    sourceVersion: 1,
    blockType: 'recommendation',
    blockId: 'slide-automation-draft',
    dataSnapshot: { 'Automatyzacja procesów': 3 },
    title: 'Automatyzacja procesów',
    keyMessage: FINDINGS[2].recommendation,
    evidenceRefs: [],
    visualIntent: 'decision',
    preferredLayouts: ['two_column'],
    density: 'sparse',
    themeTokens: {},
    confidentiality: 'internal_only',
    freshness: '2026-08-13T10:00:00.000Z',
    // Deliberately a DRAFT slide — proves the violet ribbon on a real slide.
    provenance: { generatedBy: 'teresa', generatedAt: '2026-08-13T10:00:00.000Z', isDraft: true },
  },
];

function Screen(): React.ReactElement {
  if (surface === 'presentation') {
    return <MethodPresentationView blocks={BLOCKS} methodName="Diagnostyka gotowości — DEMO" />;
  }
  return <MethodReportView report={REPORT} findings={FINDINGS} methodName="Diagnostyka gotowości — DEMO" />;
}

export default Screen;
