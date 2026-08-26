/**
 * Dev-render host for the REAL Execution → Prezentacje export chain
 * (naprawa martwej funkcji „Export as presentation", 2026-07-27).
 *
 * Bug: `ReportCompactPanel.handleExportPresentation` /
 * `ReportDocumentView.handlePresentation` otwierały
 * `/prezentacje?sourceType=execution_report&sourceName=…&content=…`,
 * ale `PrezentacjeView` nigdzie tych parametrów nie czytał — otwierał się
 * goły hub, treść raportu ginęła.
 *
 * Ten ekran przechodzi CAŁY produkcyjny łańcuch w dwóch fazach:
 *
 * FAZA 1 (`?screen=execution-export-prezentacja`)
 *   Montuje REAL `<ReportCompactPanel>` z realistycznym `ReportDef`.
 *   Klik zakładki „Export" → klik „Open presentation builder" wykonuje
 *   PRODUKCYJNY handler (buildReportMarkdown → encodeURIComponent →
 *   window.open). Patch `window.open` (module-level, jak w
 *   prezentacje-template-states.tsx) zamienia nową kartę na nawigację
 *   same-tab do TEGO ekranu z NIETKNIĘTYM query stringiem z handlera —
 *   harness nie fabrykuje URL-a, tylko przenosi go 1:1.
 *
 * FAZA 2 (po nawigacji: `…&sourceType=execution_report&sourceName=…&content=…`)
 *   Montuje REAL `<PrezentacjeView>` w AppProviders (BrowserRouter czyta
 *   window.location.search — dokładnie jak w produkcji po window.open).
 *   Oczekiwanie: NIE hub (`ArtifactModuleHome`), tylko auto-start pipeline'u
 *   „Z AI" z treścią raportu. Mocki sieci (patched na METODACH Api, nie na
 *   window.fetch — pułapka z 2026-07-23):
 *     - Api.createConversation → fake conversation
 *     - V8ChatApi.captureSnapshot → { snapshotId }
 *     - ArtifactRunsApi.createFromChat → REJESTRUJE goal w
 *       `window.__EXPORT_PREZ_TEST__` (dowód: treść raportu dotarła do
 *       tworzenia runa) i nigdy się nie rozstrzyga → widok zostaje w stanie
 *       generacji, co jest wystarczającym, stabilnym dowodem wizualnym.
 *
 * URL: ?screen=execution-export-prezentacja [&theme=light|dark] [&lang=pl|en]
 */
import { ClipboardList } from 'lucide-react';
import React from 'react';

import { PrezentacjeView } from '../../src/components/AIChat/KimiWorkspace/PrezentacjeView';
import type { ReportDef } from '../../src/components/Execution/executionReports';
import { ReportCompactPanel } from '../../src/components/Execution/ReportCompactPanel';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { ArtifactRunsApi } from '../../src/services/api/artifactRuns';
import { V8ChatApi } from '../../src/services/api/v8';
import { seedRealisticSession } from '../mocks/seedStore';

const params = new URLSearchParams(window.location.search);
const tenEkran = params.get('screen') === 'execution-export-prezentacja';
// FAZA 2 = URL zawiera już parametry wyprodukowane przez produkcyjny handler.
const faza2 = tenEkran && params.get('sourceType') === 'execution_report';

const MOCK_REPORT: ReportDef = {
  id: 'weekly-status',
  title: 'Raport tygodniowy transformacji',
  audience: 'Sponsor / Steering Committee',
  cadence: 'Weekly',
  scope: 'Portfel 12 inicjatyw — faza Execution',
  dataSources: ['Initiatives', 'Tasks', 'Decisions', 'Risk signals'],
  sections: [
    'Podsumowanie wykonawcze',
    'Postęp inicjatyw (RAG)',
    'Decyzje wymagające uwagi',
    'Ryzyka i opóźnienia',
    'Następne kroki',
  ],
  ragLogic: 'Red gdy ≥2 inicjatywy opóźnione o >7 dni lub decyzja krytyczna po terminie.',
  followUpActions: [
    'Eskalacja decyzji o budżecie linii pakowania do sponsora',
    'Przegląd capacity zespołu utrzymania ruchu',
  ],
  icon: <ClipboardList size={18} />,
  highlights: [
    { label: 'Inicjatywy on-track', value: '8/12' },
    { label: 'Opóźnione', value: 3, variant: 'warn' },
    { label: 'Decyzje po terminie', value: 1, variant: 'critical' },
  ],
  aiExecutiveReadout: [
    'Portfel utrzymuje tempo: 8 z 12 inicjatyw zgodnie z planem.',
    'Największe ryzyko: integracja MES z linią pakowania (14 dni opóźnienia).',
    'Decyzja o budżecie automatyzacji magazynu czeka 9 dni po terminie.',
  ],
  aiRecommendedActions: [
    {
      title: 'Eskaluj decyzję budżetową',
      description: 'Decyzja D-041 blokuje start dwóch zadań krytycznych.',
      priority: 'high',
    },
  ],
  dataQuality: { confidence: 'high', completeness: 92, freshnessLabel: 'Dziś 07:40' },
  degradedFlags: [],
  lastRefreshAt: '2026-07-27T07:40:00Z',
  scenarioNotes: [],
};

declare global {
  interface Window {
    __EXPORT_PREZ_TEST__?: {
      faza: 1 | 2;
      openedUrl?: string;
      calls?: Array<Record<string, unknown>>;
    };
  }
}

const g = window as unknown as { __EXPORT_PREZ_PATCHED__?: boolean };
if (tenEkran && !g.__EXPORT_PREZ_PATCHED__) {
  g.__EXPORT_PREZ_PATCHED__ = true;
  seedRealisticSession();

  if (!faza2) {
    // FAZA 1 — przechwyć window.open z produkcyjnego handlera i przenieś jego
    // query string 1:1 na ten ekran (same-tab; nowa karta nie zna harnessu).
    window.__EXPORT_PREZ_TEST__ = { faza: 1 };
    window.open = ((url?: string | URL) => {
      const s = String(url ?? '');
      window.__EXPORT_PREZ_TEST__ = { faza: 1, openedUrl: s };
      // eslint-disable-next-line no-console
      console.info('[harness] window.open przechwycony', { url: s.slice(0, 200) });
      const query = s.includes('?') ? s.slice(s.indexOf('?') + 1) : '';
      window.location.assign(
        `${window.location.pathname}?screen=execution-export-prezentacja&theme=${
          params.get('theme') || 'light'
        }&lang=${params.get('lang') || 'pl'}&${query}`
      );
      return null;
    }) as typeof window.open;
  } else {
    // FAZA 2 — mocki na metodach Api (nie window.fetch), rejestrujące dowody.
    const cap: NonNullable<Window['__EXPORT_PREZ_TEST__']> = { faza: 2, calls: [] };
    window.__EXPORT_PREZ_TEST__ = cap;

    Api.createConversation = (async (data?: { title?: string }) => {
      cap.calls!.push({ fn: 'createConversation', title: data?.title });
      return {
        id: 'conv-harness-export-1',
        title: data?.title || 'Presentation',
        created_at: '2026-07-27T08:00:00Z',
        updated_at: '2026-07-27T08:00:00Z',
        message_count: 0,
        version: 1,
      };
    }) as typeof Api.createConversation;

    V8ChatApi.captureSnapshot = (async (p: Record<string, unknown>) => {
      cap.calls!.push({ fn: 'captureSnapshot', conversationId: p?.conversationId });
      return { snapshotId: 'snap-harness-export-1' };
    }) as typeof V8ChatApi.captureSnapshot;

    ArtifactRunsApi.createFromChat = ((p: { goal?: string }) => {
      cap.calls!.push({
        fn: 'createFromChat',
        goalLength: p?.goal?.length ?? 0,
        goalHead: p?.goal?.slice(0, 160),
        goalContainsReportSection: (p?.goal || '').includes('Postęp inicjatyw'),
      });
      // eslint-disable-next-line no-console
      console.info('[harness] createFromChat przechwycony', cap.calls![cap.calls!.length - 1]);
      return new Promise(() => {}); // widok zostaje w stanie generacji
    }) as typeof ArtifactRunsApi.createFromChat;

    // Safety net: reszta ruchu /api/ → neutralne 200 (wzorzec
    // prezentacje-template-states.tsx); /locales/** zostaje realne.
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
      if (url.includes('/api/')) {
        return new Response(JSON.stringify({ data: [], items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return realFetch(input as RequestInfo, init);
    };
  }
}

export default function ExecutionExportPrezentacjaScreen(): React.ReactElement {
  if (faza2) {
    return (
      <AppProviders>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
          <PrezentacjeView />
        </div>
      </AppProviders>
    );
  }
  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
      <div className="p-6 text-sm text-c-text-secondary">
        FAZA 1 — realny <code>ReportCompactPanel</code>. Ścieżka testu: zakładka „Export" → „Open
        presentation builder".
      </div>
      <ReportCompactPanel report={MOCK_REPORT} isOpen onClose={() => {}} mode="embedded" />
    </div>
  );
}
