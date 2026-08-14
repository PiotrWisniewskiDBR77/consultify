/**
 * Harness: Dynamic SWOT — Initiative Proposal (SummaryStep → recommended
 * initiatives review).
 *
 * Mounts the REAL component (`SummaryStep`, specifically its dynamic-swot
 * branch) over a realistic, fully fictional demo session — no login, no
 * backend. This is where AI-drafted initiatives derived from accepted moves
 * are reviewed (`ProposalCard`) and materialized into real Initiatives.
 *
 * Renders the REAL component, not a mockup — CLAUDE.md #7 / stream G5 brief.
 *
 * URL: ?screen=tools-swot-initiative-proposal&theme=light|dark
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { SummaryStep } from '@/components/DiscoveryTools/steps/SummaryStep';
import type { InitiativeDraft, SWOTData, ToolSession } from '@/store/useToolStore';

const INITIATIVES: InitiativeDraft[] = [
  {
    id: 'ini-1',
    title: 'Uruchomić pilota referencyjnego w DACH',
    description:
      'Wykorzystać wolną zdolność wdrożeniową i rosnący popyt w DACH, aby zbudować pierwszą referencję na nowym rynku w ciągu jednego kwartału.',
    type: 'strategic',
    source: 'dynamic-swot',
    linkedItems: ['i1', 'i3'],
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    rationale:
      'Popyt rośnie trzeci kwartał z rzędu, a zespół wdrożeniowy ma udokumentowaną zdolność (40 zamkniętych projektów). Ruch domyka napięcie t1 (doświadczony zespół × rosnący popyt).',
  },
  {
    id: 'ini-2',
    title: 'Skrócić ścieżkę wdrożenia o 30%',
    description:
      'Ustandaryzować proces wdrożenia, aby zmniejszyć ekspozycję na presję cenową konkurenta i skrócić czas do wartości dla klienta.',
    type: 'defensive',
    source: 'dynamic-swot',
    linkedItems: ['i2', 'i4'],
    estimatedImpact: 'high',
    estimatedEffort: 'high',
    rationale:
      'Czas wdrożenia 2× dłuższy niż konkurencja jest jednocześnie słabością i powodem ekspozycji cenowej — domyka napięcie t2.',
  },
  {
    id: 'ini-3',
    title: 'Rozważyć model subskrypcyjny dla segmentu MŚP',
    description:
      'Hipoteza nie ma jeszcze potwierdzonego dowodu — wymaga walidacji przed przejściem do wdrożenia.',
    type: 'growth',
    source: 'dynamic-swot',
    linkedItems: ['i9'],
    estimatedImpact: 'medium',
    estimatedEffort: 'low',
    rationale: 'Sygnał rynkowy nieskonfirmowany dowodem — do przemyślenia lub odrzucenia.',
  },
];

const SWOT_DATA: Partial<SWOTData> = {
  context: {
    goal: 'Zdecydować, czy i jak wejść na rynek DACH w tym kwartale.',
    scope: 'Segment MŚP, oferta wdrożeniowa, rynek DACH.',
    timeframe: 'this-quarter',
  } as SWOTData['context'],
  signals: [],
  items: [
    { id: 'i1', text: 'Zespół wdrożeniowy z 40 zamkniętymi projektami', impact: 'high', quadrant: 'strengths', proposalStatus: 'accepted', evidenceStatus: 'confirmed' },
    { id: 'i2', text: 'Czas wdrożenia 2× dłuższy niż u konkurencji', impact: 'high', quadrant: 'weaknesses', proposalStatus: 'accepted', evidenceStatus: 'confirmed' },
    { id: 'i3', text: 'Popyt w DACH rośnie trzeci kwartał z rzędu', impact: 'high', quadrant: 'opportunities', proposalStatus: 'accepted', evidenceStatus: 'declared' },
    { id: 'i4', text: 'Konkurent obniżył cenę wejścia o 30%', impact: 'medium', quadrant: 'threats', proposalStatus: 'accepted', evidenceStatus: 'confirmed' },
  ] as SWOTData['items'],
  tensions: [
    { id: 't1', title: 'Doświadczony zespół × rosnący popyt w DACH', type: 'attack', linkedCorrelationIds: [], linkedItemIds: ['i1', 'i3'], insight: 'Przewaga wdrożeniowa jest niewykorzystana w otwierającym się oknie.' },
    { id: 't2', title: 'Długi czas wdrożenia × presja cenowa', type: 'protect', linkedCorrelationIds: [], linkedItemIds: ['i2', 'i4'], insight: 'Wolne wdrożenie zwiększa ekspozycję na tańszego konkurenta.' },
  ] as SWOTData['tensions'],
  correlations: [],
  recommendedMoves: [
    { id: 'm1', title: 'Uruchomić pilota referencyjnego w DACH', category: 'quick-win', rationale: 'Popyt rośnie, zdolność wdrożeniowa wolna.', linkedTensionIds: ['t1'], linkedItemIds: ['i1', 'i3'], expectedImpact: 'high', estimatedEffort: 'medium', firstStep: 'Wybrać klienta pilotażowego', ownerRole: 'Dyrektor sprzedaży' },
    { id: 'm2', title: 'Skrócić ścieżkę wdrożenia o 30%', category: 'capability-build', rationale: 'Czas wdrożenia to słabość i ekspozycja cenowa.', linkedTensionIds: ['t2'], linkedItemIds: ['i2', 'i4'], expectedImpact: 'high', estimatedEffort: 'high', firstStep: 'Zmierzyć czas 5 ostatnich wdrożeń', ownerRole: 'Dyrektor operacyjny' },
  ] as SWOTData['recommendedMoves'],
  outputCandidates: [],
  summary: {
    executiveSummary:
      'Firma ma udokumentowaną zdolność wdrożeniową i otwierające się okno popytu w DACH, ale długi czas wdrożenia zwiększa ekspozycję na tańszego konkurenta. Rekomendacja: pilot referencyjny równolegle ze standaryzacją procesu.',
    keyInsights: [
      'Przewaga wdrożeniowa jest dziś niewykorzystana w oknie rosnącego popytu DACH.',
      'Długi czas wdrożenia to jednocześnie słabość operacyjna i ryzyko cenowe.',
    ],
    appliedConclusions: [],
    recommendedInitiatives: INITIATIVES,
    proposalStatus: 'accepted',
  } as unknown as SWOTData['summary'],
} as unknown as SWOTData;

const SESSION: ToolSession = {
  id: 'sess-demo-1',
  toolType: 'dynamic-swot',
  name: 'Wejście na rynek DACH',
  createdAt: '2026-08-10T09:00:00Z',
  updatedAt: '2026-08-13T12:00:00Z',
  currentStep: 4,
  steps: [],
  inputData: SWOT_DATA as SWOTData,
  chatHistory: [],
  generatedInitiatives: INITIATIVES,
  status: 'approved',
} as unknown as ToolSession;

export default function ToolsSwotInitiativeProposalScreen() {
  return (
    <MemoryRouter>
      <div className="min-h-screen bg-c-bg p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-c-border-subtle bg-c-surface">
          <SummaryStep
            toolType="dynamic-swot"
            session={SESSION}
            isPolish
            onAcceptCard={() => {}}
            onRejectCard={() => {}}
            onRethinkCard={() => {}}
          />
        </div>
      </div>
    </MemoryRouter>
  );
}
