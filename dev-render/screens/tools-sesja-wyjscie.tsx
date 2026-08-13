/**
 * Dev-render host dla REALNEGO `<DiscoveryToolsHub />` z OTWARTĄ sesją narzędzia
 * (zgłoszenie Piotra 2026-07-27: „wystartowałem sesję i nie mam jak z niej wyjść
 * — nie mam u góry menu, nie mam pauzy/zakończenia; zablokowałem wszystkie tule").
 *
 * Bez re-implementacji: montujemy produkcyjny hub, podmieniając wyłącznie METODY
 * `Api.*` (pułapka z 07-23: patchować metody Api, nie `window.fetch` — hub i
 * ToolDocumentView chodzą przez serwis, nie przez goły fetch). Sesja „otwarta"
 * jest zasiewana do `sessionStorage` pod kluczem `moduleHub.openDocuments.tools`,
 * czyli dokładnie tam, skąd czyta `useModuleOpenDocuments('tools')` — więc hub
 * startuje w tym samym stanie, w którym Piotr zrobił zrzut.
 *
 * Co ma być WIDAĆ po naprawie (Menu 3, wiersz `DynamicTabs`):
 *   1. przycisk „List" — powrót do listy sesji,
 *   2. chip otwartej sesji z „×" — zamknięcie karty,
 *   3. prawy slot `#module-command-row-right-actions` z pigułką statusu i
 *      akcjami cyklu życia (Request review / Approve / Generate initiatives)
 *      — ToolDocumentView portaluje je właśnie tam, więc przed naprawą wisiały
 *      w próżni (portal target nie istniał).
 *   4. pigułki Menu 2 (Library/Sessions/…) wyprowadzają z otwartej karty.
 *
 * `?stan=przed` renderuje hub ze STARYMI (błędnymi) nazwami propsów podanymi
 * wprost do fasady — do zrzutu PRZED/PO obok siebie.
 */
import React from 'react';

import { DiscoveryToolsHub } from '../../src/components/Discovery/DiscoveryToolsHub';
// AppProviders daje JEDEN `<BrowserRouter>` + FeatureFlags/Org/AI/AutoSave —
// hub konsumuje je wszystkie, więc goły MemoryRouter tu nie wystarcza.
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';

const SESSION_ID = 'tool-sess-swot-1';

const SESSION_ROW = {
  id: SESSION_ID,
  name: 'Dynamic SWOT — Session',
  toolType: 'dynamic-swot',
  tool_type: 'dynamic-swot',
  status: 'DRAFT',
  category: 'strategic',
  completion_percent: 0,
  completionPercent: 0,
  createdAt: '2026-07-27T08:00:00Z',
  updatedAt: '2026-07-27T09:10:00Z',
  answers: {},
  inputData: {},
  generatedInitiatives: [],
  decisions: [],
  permissions: { canRequestReview: true, canApproveTool: true, canGenerate: true },
};

const USERS = [
  { id: 'u1', firstName: 'Piotr', lastName: 'Wiśniewski', email: 'piotr@dbr77.com', name: 'Piotr Wiśniewski' },
  { id: 'u2', firstName: 'Anna', lastName: 'Kowalska', email: 'anna@dbr77.com', name: 'Anna Kowalska' },
];

const KNOWN_TOOLS = [
  { id: 'known:dynamic-swot', slug: 'dynamic-swot', name: 'Dynamic SWOT', category: 'strategic' },
  { id: 'known:market-forces', slug: 'market-forces', name: 'Market Forces', category: 'strategic' },
  { id: 'known:value-chain', slug: 'value-chain', name: 'Value Chain', category: 'operational' },
];

/** Podmiana METOD Api (nie window.fetch) — jednorazowa, idempotentna. */
let patched = false;
const patchApi = () => {
  if (patched) return;
  patched = true;
  const api = Api as unknown as Record<string, any>;

  api.listToolSessions = async () => [SESSION_ROW];
  api.getToolSession = async () => SESSION_ROW;
  api.updateToolSession = async () => SESSION_ROW;
  api.getToolGeneratedInitiatives = async () => [];
  api.getKnownTools = async () => KNOWN_TOOLS;
  api.getKnownTool = async () => KNOWN_TOOLS[0];
  api.getUsers = async () => USERS;
  api.listAssessments = async () => [];
  api.getAssessmentReports = async () => [];
  api.getInitiativesByStatus = async () => [];
  api.getInitiativeById = async () => null;
  api.getInitiativeTasks = async () => [];
  api.getLinkGraphBacklinks = async () => [];
  api.suggestTools = async () => [];
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
          name: 'Dynamic SWOT — Session',
          type: 'tool',
          subType: 'dynamic-swot',
          status: 'DRAFT',
        },
      ],
      activeDocumentId: SESSION_ID,
    })
  );
};

const ToolsSesjaWyjscieScreen: React.FC = () => {
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
};

export default ToolsSesjaWyjscieScreen;
