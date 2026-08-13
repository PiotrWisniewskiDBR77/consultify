/**
 * Harness: Dynamic SWOT — Session Workspace (`ToolWorkspace`, live work
 * surface: header, canvas, action bar, review panel).
 *
 * Mounts the REAL component over a realistic, fully fictional demo session.
 * `ToolWorkspace` is deeply wired to TWO zustand stores (`useToolStore`,
 * `useAppStore`) plus several `Api.*` calls fired on mount (getUsers,
 * getToolSession, getInitiatives, and a 1.5s-debounced autosave via
 * updateToolSession — see the effects at ToolWorkspace.tsx:444-598). No
 * login, no backend: the stores are pre-seeded via `setState` (the
 * documented zustand escape hatch) instead of going through a network round
 * trip, and the handful of `Api.*` calls the mount effects fire are patched
 * to safe fixture responses — same method-patch approach as
 * `tools-swot-library-detail.tsx`.
 *
 * URL: ?screen=tools-swot-session-workspace&theme=light|dark
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ToolWorkspace } from '@/components/DiscoveryTools/ToolWorkspace';
import { HelpProvider } from '@/contexts/HelpContext';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { SWOTData, ToolSession } from '@/store/useToolStore';
import { useToolStore } from '@/store/useToolStore';

const SESSION_ID = 'sess-demo-1';

const SWOT_DATA: Partial<SWOTData> = {
  context: {
    goal: 'Zdecydować, czy i jak wejść na rynek DACH w tym kwartale.',
    scope: 'Segment MŚP, oferta wdrożeniowa, rynek DACH.',
    timeframe: 'this-quarter',
    successSignal: 'Podpisany pilot referencyjny do końca kwartału.',
  } as SWOTData['context'],
  signals: [],
  items: [
    { id: 'i1', text: 'Zespół wdrożeniowy z 40 zamkniętymi projektami', impact: 'high', quadrant: 'strengths', proposalStatus: 'accepted', evidenceStatus: 'confirmed' },
    { id: 'i2', text: 'Certyfikacja ISO 27001 od 2023', impact: 'medium', quadrant: 'strengths', proposalStatus: 'accepted', evidenceStatus: 'confirmed' },
    { id: 'i3', text: 'Czas wdrożenia 2× dłuższy niż u konkurencji', impact: 'high', quadrant: 'weaknesses', proposalStatus: 'accepted', evidenceStatus: 'confirmed' },
    { id: 'i4', text: 'Brak lokalnego zespołu wsparcia w DACH', impact: 'medium', quadrant: 'weaknesses', proposalStatus: 'accepted', evidenceStatus: 'declared' },
    { id: 'i5', text: 'Popyt w DACH rośnie trzeci kwartał z rzędu', impact: 'high', quadrant: 'opportunities', proposalStatus: 'accepted', evidenceStatus: 'declared' },
    { id: 'i6', text: 'Program dotacji na cyfryzację MŚP w 2026', impact: 'medium', quadrant: 'opportunities', proposalStatus: 'ai-proposed' },
    { id: 'i7', text: 'Konkurent obniżył cenę wejścia o 30%', impact: 'medium', quadrant: 'threats', proposalStatus: 'accepted', evidenceStatus: 'confirmed' },
    { id: 'i8', text: 'Nowy gracz z USA zapowiedział wejście na rynek PL', impact: 'high', quadrant: 'threats', proposalStatus: 'ai-proposed' },
  ] as SWOTData['items'],
  tensions: [
    { id: 't1', title: 'Doświadczony zespół × rosnący popyt w DACH', type: 'attack', linkedCorrelationIds: [], linkedItemIds: ['i1', 'i5'], insight: 'Przewaga wdrożeniowa jest niewykorzystana w otwierającym się oknie.' },
    { id: 't2', title: 'Długi czas wdrożenia × presja cenowa', type: 'protect', linkedCorrelationIds: [], linkedItemIds: ['i3', 'i7'], insight: 'Wolne wdrożenie zwiększa ekspozycję na tańszego konkurenta.' },
  ] as SWOTData['tensions'],
  correlations: [],
  recommendedMoves: [
    { id: 'm1', title: 'Uruchomić pilota referencyjnego w DACH', category: 'quick-win', rationale: 'Popyt rośnie, zdolność wdrożeniowa wolna.', linkedTensionIds: ['t1'], linkedItemIds: ['i1', 'i5'], expectedImpact: 'high', estimatedEffort: 'medium', firstStep: 'Wybrać klienta pilotażowego', ownerRole: 'Dyrektor sprzedaży' },
  ] as SWOTData['recommendedMoves'],
  outputCandidates: [],
} as unknown as SWOTData;

const SESSION: ToolSession = {
  id: SESSION_ID,
  toolType: 'dynamic-swot',
  name: 'Wejście na rynek DACH',
  createdAt: '2026-08-10T09:00:00Z',
  updatedAt: '2026-08-13T11:40:00Z',
  currentStep: 2,
  steps: [],
  inputData: SWOT_DATA as SWOTData,
  chatHistory: [],
  generatedInitiatives: [],
  status: 'DRAFT' as ToolSession['status'],
} as unknown as ToolSession;

// ---- Seed BOTH zustand stores directly (documented escape hatch — no
// network round trip needed for a harness). ----
useToolStore.setState({ savedSessions: [SESSION], currentSession: null } as never);
useAppStore.setState({
  currentOrganization: { id: 'org-demo', name: 'Firma Demo Sp. z o.o.' },
  currentProjectId: 'proj-demo-1',
  activeChatMessages: [],
} as never);

// ---- Patch the handful of Api.* calls ToolWorkspace's mount effects fire
// (getUsers, getToolSession, getInitiatives, updateToolSession) to safe
// fixture responses — same method-patch approach as the Library-detail
// harness. Nothing here is a network round trip. ----
(Api as any).getUsers = async () => [];
(Api as any).getToolSession = async () => ({
  id: SESSION_ID,
  status: 'draft',
  version: 1,
  generatedInitiatives: [],
  decisions: [],
  permissions: { canRequestReview: true, canApproveTool: false, canGenerate: true },
});
(Api as any).getInitiatives = async () => ({ items: [] });
// `useOrganizationContext` (src/hooks/discovery/useOrganizationContext.ts)
// calls this unconditionally on mount; unstubbed it hits the dev-render
// catch-all HTML route and throws a JSON parse error in the console.
(Api as any).organizationContextGet = async () => ({ context: null });
(Api as any).updateToolSession = async () => ({ version: 1 });
(Api as any).createToolSession = async () => ({ id: SESSION_ID, status: 'draft', version: 1 });

export default function ToolsSwotSessionWorkspaceScreen() {
  return (
    <MemoryRouter>
      <HelpProvider>
        <div className="min-h-screen bg-c-bg">
          <ToolWorkspace toolType="dynamic-swot" sessionId={SESSION_ID} onBack={() => {}} />
        </div>
      </HelpProvider>
    </MemoryRouter>
  );
}
