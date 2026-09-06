/**
 * Dev-render host dla REALNEGO `<DiscoveryToolsHub />` — zakładka
 * Outputs/Insights PO naprawie DEC-118 #1 (2026-08-26): bootstrap woła
 * `Api.listToolOutputs()` i miesza wynik do `mergedOutputs`
 * (1.1-T1/DEC-412: flaga `ff_toolsInsightsWiring` usunięta — pobranie
 * `tool_outputs` jest bezwarunkowe).
 *
 * Bez re-implementacji: montujemy produkcyjny hub, podmieniając wyłącznie
 * METODY `Api.*` (ta sama zasada co tools-sesja-wyjscie.tsx — CLAUDE.md #7:
 * zrzut PRZED Piotrem, bez logowania, bez backendu).
 *
 * URL: /tools-outputs-insights-tab.html?theme=light|dark&lang=pl|en
 * (language default 'pl' — set in tools-outputs-insights-tab-main.tsx)
 */
import React from 'react';

import { DiscoveryToolsHub } from '../../src/components/Discovery/DiscoveryToolsHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';

const TOOL_OUTPUT_APPROVED = {
  id: 'out-swot-1',
  toolSessionId: 'sess-swot-1',
  projectId: null,
  toolType: 'dynamic-swot',
  methodPackVersion: '1.0.0',
  version: 2,
  supersedesId: 'out-swot-0',
  title: 'Dynamic SWOT — wejście na rynek DACH',
  status: 'approved',
  contentHash: 'a1b2c3',
  createdBy: 'u1',
  createdAt: '2026-08-20T09:00:00Z',
  approvedBy: 'u1',
  approvedAt: '2026-08-20T09:15:00Z',
  frozenAt: '2026-08-20T09:15:00Z',
  isCurrent: true,
};

const TOOL_OUTPUT_IN_REVIEW = {
  id: 'out-value-chain-1',
  toolSessionId: 'sess-value-chain-1',
  projectId: null,
  toolType: 'value-chain',
  methodPackVersion: '1.0.0',
  version: 1,
  supersedesId: null,
  title: 'Value Chain — outsourcing logistyki',
  status: 'in_review',
  contentHash: 'd4e5f6',
  createdBy: 'u1',
  createdAt: '2026-08-22T11:00:00Z',
  approvedBy: null,
  approvedAt: null,
  frozenAt: null,
  isCurrent: true,
};

const REPORT_BUILDER_CONFIGURING = {
  id: 'rb-1',
  title: 'Raport — Q3 przegląd portfela',
  status: 'CONFIGURING',
  createdAt: '2026-08-24T08:00:00Z',
  updatedAt: '2026-08-24T08:00:00Z',
};

const ASSESSMENT_REPORT_APPROVED = {
  id: 'ar-1',
  name: 'Raport oceny dojrzałości cyfrowej',
  status: 'APPROVED',
  createdAt: '2026-08-18T08:00:00Z',
  updatedAt: '2026-08-18T10:00:00Z',
  assessmentId: 'assessment-1',
};

const KNOWN_TOOLS = [
  { id: 'known:dynamic-swot', slug: 'dynamic-swot', toolType: 'dynamic-swot', name: 'Dynamic SWOT', libraryCategory: 'strategic', isActive: true, isComingSoon: false, tags: [], whatYouGet: [] },
  { id: 'known:value-chain', slug: 'value-chain', toolType: 'value-chain', name: 'Value Chain', libraryCategory: 'operational', isActive: true, isComingSoon: false, tags: [], whatYouGet: [] },
];

/** Podmiana METOD Api (nie window.fetch) — jednorazowa, idempotentna. */
let patched = false;
const patchApi = () => {
  if (patched) return;
  patched = true;
  const api = Api as unknown as Record<string, any>;

  api.listToolSessions = async () => ({ items: [], total: 0, limit: 0, offset: 0 });
  api.listAssessmentsLegacy = async () => ({ items: [], total: 0, limit: 100, offset: 0 });
  api.getAssessmentReports = async () => [ASSESSMENT_REPORT_APPROVED];
  api.getKnownTools = async () => ({ items: KNOWN_TOOLS });
  api.getKnownTool = async () => KNOWN_TOOLS[0];
  api.getUsers = async () => [];
  api.getInitiativesByStatus = async () => [];
  api.suggestTools = async () => ({ suggestions: [] });
  api.get = async (path: string) => {
    if (path === '/report-builder') return { reports: [REPORT_BUILDER_CONFIGURING] };
    if (path === '/presentations/decks') return { success: true, data: [] };
    return {};
  };
  api.post = async () => ({});
  api.patch = async () => ({});
  api.delete = async () => ({});
  // The repair under test: this call was NEVER made before DEC-118 #1.
  api.listToolOutputs = async () => ({ outputs: [TOOL_OUTPUT_APPROVED, TOOL_OUTPUT_IN_REVIEW] });
  // DEC-118 repair #5 (partial): reopen for an approved tool_output.
  api.reopenToolOutput = async () => ({
    superseded: { id: TOOL_OUTPUT_APPROVED.id, status: 'superseded' },
    revision: { id: 'out-swot-1-rev3', version: 3 },
  });
};

const ToolsOutputsInsightsTabScreen: React.FC = () => {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    patchApi();
    // ThemeSync (AppProviders.tsx) drives the `dark` class off
    // useAppStore().theme (default 'dark'), overriding a manual DOM class
    // toggle set before mount — set the store directly instead.
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
    useAppStore.setState({ theme });
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <AppProviders>
      <div className="h-screen w-screen overflow-hidden bg-c-bg text-c-text">
        <DiscoveryToolsHub initialTab="outputs" />
      </div>
    </AppProviders>
  );
};

export default ToolsOutputsInsightsTabScreen;
