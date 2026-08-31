/**
 * Harness: Dynamic SWOT — Session Workspace.
 *
 * NAPRAWA 2026-08-30 (odbiór Piotra, uwaga „tools-swot-session-workspace"
 * [ODRZUCONY]: „Jest jakaś prehistoryczna karta jeszcze za tym, zanim
 * przerobiliśmy to."). Zbadane i POTWIERDZONE: ten ekran montował
 * `<ToolWorkspace>` (`@/components/DiscoveryTools/ToolWorkspace`) — a ten
 * komponent NIE renderuje się nigdzie w produkcie. Jedyne realne miejsce
 * JSX `<ToolWorkspace ...>` poza tym harnessem to
 * `src/views/discovery-tools/OperationalToolsView.tsx`, a CAŁY barrel
 * `src/views/discovery-tools/index.ts` (5 widoków, w tym ten) nie ma ANI
 * JEDNEGO importera w resztcie `src/` — martwy, nigdy nie podpięty do
 * routingu ani menu. Dla realnej sesji `dynamic-swot` produkt idzie inną
 * drogą: `dynamic-swot` jest w `DEDICATED_TOOL_TYPES`
 * (`dedicatedToolTypes.ts`), więc `DiscoveryToolsHub.tsx` (linia ~3786)
 * renderuje `<ToolDocumentView>`, NIE `<ToolWorkspace>`. `ToolWorkspace`
 * jest więc dosłownie „prehistoryczną kartą" — kodem sprzed przepisania na
 * `ToolDocumentView`, którego nikt nie usunął.
 *
 * Ten harness miał WŁASNE wejście .html właśnie po to, żeby ominąć listę
 * awaryjną `?screen=` — ale to tylko udowodniło, że plik .tsx się
 * renderuje, nie że renderowany komponent jest tym, co widzi użytkownik.
 * Poprzedni odbiór (`docs/program/grafika/status.json`, id
 * `tools-swot-session-workspace`, ocena A) pomylił „harness się ładuje" z
 * „to jest aktualny ekran" — dokładnie pułapka „wołacz istnieje ≠
 * renderuje się".
 *
 * PO naprawie: mountujemy REALNY `<DiscoveryToolsHub>` (ten sam komponent
 * co produkcja) z otwartą sesją `dynamic-swot`, dokładnie techniką z
 * `tools-sesja-wyjscie.tsx` (sprawdzona, zbudowana 2026-07-27 dla innego
 * zgłoszenia Piotra — patrz ten plik po wyjaśnienie wzorca: seed
 * `sessionStorage['moduleHub.openDocuments.tools']` + podmiana METOD
 * `Api.*`, nie `window.fetch`). `dynamic-swot` w DEDICATED_TOOL_TYPES ⇒
 * hub renderuje `ToolDocumentView` — TO jest dziś „warsztat sesji".
 *
 * URL: ?screen=tools-swot-session-workspace&theme=light|dark
 *      /tools-swot-session-workspace.html?theme=light|dark
 */
import React from 'react';

import { DiscoveryToolsHub } from '@/components/Discovery/DiscoveryToolsHub';
import { AppProviders } from '@/providers/AppProviders';
import { Api } from '@/services/api';
import type { SWOTData } from '@/store/useToolStore';

const SESSION_ID = 'sess-demo-1';

// Ta sama treść demo co przed naprawą (fikcyjna, realistyczna) — tylko
// wehikuł zmieniony z `useToolStore.savedSessions` (czytane przez
// ToolWorkspace) na `Api.getToolSession().answers` (czytane przez
// ToolDocumentView → hydrateSessionFromApi, patrz useToolStore.ts:4198 —
// `answers` jest mergowane do `inputData`, więc kształt SWOTData zostaje).
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

const SESSION_ROW = {
  id: SESSION_ID,
  name: 'Wejście na rynek DACH',
  toolType: 'dynamic-swot',
  tool_type: 'dynamic-swot',
  status: 'DRAFT',
  category: 'strategic',
  completion_percent: 40,
  completionPercent: 40,
  createdAt: '2026-08-10T09:00:00Z',
  updatedAt: '2026-08-13T11:40:00Z',
  answers: SWOT_DATA,
  inputData: SWOT_DATA,
  generatedInitiatives: [],
  decisions: [],
  permissions: { canRequestReview: true, canApproveTool: true, canGenerate: true },
};

const USERS = [
  { id: 'u1', firstName: 'Piotr', lastName: 'Wiśniewski', email: 'piotr@dbr77.com', name: 'Piotr Wiśniewski' },
];

/** Podmiana METOD Api (nie window.fetch) — ten sam wzorzec co tools-sesja-wyjscie.tsx. */
let patched = false;
const patchApi = () => {
  if (patched) return;
  patched = true;
  const api = Api as unknown as Record<string, any>;

  api.listToolSessions = async () => [SESSION_ROW];
  api.getToolSession = async () => SESSION_ROW;
  api.updateToolSession = async () => SESSION_ROW;
  api.createToolSession = async () => SESSION_ROW;
  api.getToolGeneratedInitiatives = async () => [];
  api.getUsers = async () => USERS;
  api.getInitiativesByStatus = async () => [];
  api.getInitiativeById = async () => null;
  api.getInitiativeTasks = async () => [];
  api.getLinkGraphBacklinks = async () => [];
  api.suggestTools = async () => [];
  // `useOrganizationContext` (src/hooks/discovery/useOrganizationContext.ts)
  // woła to bezwarunkowo na mount; bez stuba trafia w catch-all HTML route
  // dev-render i wybucha błędem parsowania JSON w konsoli.
  api.organizationContextGet = async () => ({ context: null });
  api.get = async () => [];
  api.post = async () => ({});
  api.patch = async () => ({});
  api.delete = async () => ({});
};

/** Zasiew otwartej sesji dokładnie tam, skąd czyta `useModuleOpenDocuments('tools')`. */
const seedOpenSession = () => {
  window.sessionStorage.setItem(
    'moduleHub.openDocuments.tools',
    JSON.stringify({
      openDocuments: [
        {
          id: SESSION_ID,
          name: SESSION_ROW.name,
          type: 'tool',
          subType: 'dynamic-swot',
          status: 'DRAFT',
        },
      ],
      activeDocumentId: SESSION_ID,
    })
  );
};

export default function ToolsSwotSessionWorkspaceScreen() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    patchApi();
    seedOpenSession();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <AppProviders>
      <div className="h-screen w-screen overflow-hidden bg-c-bg text-c-text">
        <DiscoveryToolsHub initialTab="sessions" />
      </div>
    </AppProviders>
  );
}
