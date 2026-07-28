/**
 * Dev-render host dla N19/N20 (menu „Plik" + afordancje wyjścia w Document
 * Studio, `_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md` część 3):
 *   - N20: dropdown "Plik" (Nowy · Otwórz · Zapisz · Zapisz jako) w topbarze
 *     (`DocumentStudioFileMenu.tsx`), wpięty w `DocumentStudioDocumentPanel`.
 *   - N19: strzałka "wróć" = "Start over" (widoczny label, nie sam icon) +
 *     etykieta modułu w breadcrumbie = jedyne realne wyjście z narzędzia.
 *
 * Montuje REALNY `DocumentStudioDocumentPanel` bezpośrednio w fazie
 * `phase==='document'` (bez streamingu/SSE/migotania) ze statycznym
 * fixture'em `DocumentSchema" (kształt wzięty z
 * `DocumentStudioDocumentPanel.test.tsx`), owinięty w pełne drzewo
 * `AppProviders` (wzór: `navdeclutter-sidebar.tsx`) — poprzedni, "gołuchy"
 * harness dla tego panelu (`document-studio-m1-share-primary.tsx`) nie miał
 * <Router>, a panel woła `useNavigate()` bezwarunkowo (linia 1647 w
 * DocumentStudioDocumentPanel.tsx) — bez Routera to twardy crash w
 * przeglądarce, nie tylko w testach.
 *
 * Mock jest STANOWY, nie zamrożony: menu „Plik" samo zarządza swoim `open`
 * stanem (`useState` w `DocumentStudioFileMenu`), więc klik w przycisk
 * realnie rozwija/zwija listę — nic tu nie trzeba specjalnie symulować.
 * `getDocumentStudioPolicy()` / diff / content-blocks wołania sieciowe idą
 * do prawdziwego `window.fetch` i failują do stanu domyślnego (panel łapie
 * błąd i chowa się za `.catch()` — patrz `DocumentStudioDocumentPanel.tsx`
 * linia ~1677); jedyne co stubujemy to dwa wywołania odpalane przez
 * `AppProviders`/`Sidebar`-owe konteksty przy montowaniu (partner-connection,
 * organizacje), identycznie jak `navdeclutter-sidebar.tsx`.
 *
 * URL: ?screen=document-studio-menu-pliku&theme=light|dark&lang=pl|en
 */
import React from 'react';

import { DocumentStudioDocumentPanel } from '../../src/components/DocumentStudio/DocumentStudioDocumentPanel';
import type { DocumentSchema } from '../../src/components/DocumentStudio/types';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

// Short-circuit the partner-portal connection check some shared chrome fires
// on mount — avoids a real fetch hitting the dev-render vite server (pattern
// from navdeclutter-sidebar.tsx).
Api.get = (async (url: string) => {
  if (url.startsWith('/partners/connection') || url.includes('/api/partners/connection')) {
    return { data: { connected: false } };
  }
  return { data: null };
}) as typeof Api.get;

// Short-circuit OrgContext's raw `fetch('/api/organizations/current')` so it
// doesn't hit the dev-render vite server and log a JSON-parse error. All
// other calls (incl. /api/document-studio/*) fall through to the real
// fetch — DocumentStudioDocumentPanel already catches those failures and
// degrades gracefully (see file header).
const g = window as unknown as { __DOC_STUDIO_MENU_PLIKU_FETCH__?: boolean };
if (!g.__DOC_STUDIO_MENU_PLIKU_FETCH__) {
  g.__DOC_STUDIO_MENU_PLIKU_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/organizations/current')) {
      return new Response(
        JSON.stringify({
          organizations: [
            {
              id: 'org-dbr77-demo',
              name: 'DBR77 Sp. z o.o.',
              plan: 'enterprise',
              role: 'ADMIN',
            },
          ],
          currentOrganizationId: 'org-dbr77-demo',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return realFetch(input as RequestInfo, init);
  };
}

// Fixture: kształt wzięty z DocumentStudioDocumentPanel.test.tsx, treści
// polskie i realistyczne (nie surowy prompt, nie Lorem ipsum) — ma wyglądać
// jak prawdziwy materiał konsultingowy na zrzucie.
const schema: DocumentSchema = {
  documentId: 'doc-audyt-1',
  artifactId: 'doc-audyt-1',
  title: 'Audyt procesu produkcyjnego — raport',
  documentType: 'executive_memo',
  language: 'pl',
  audience: ['Zarząd', 'Dyrektor operacyjny'],
  goal: 'decide',
  communicationRegister: 'executive',
  density: 'concise',
  languageStyle: 'consulting',
  confidentiality: 'client_confidential',
  templateRef: { templateId: 'tpl-audyt-produkcja', templateVersion: '1.0.0' },
  sourcePackId: 'sp-audyt-1',
  clientId: 'client-fabryka-metalowa',
  owner: 'piotr.wisniewski@dbr77.com',
  sourceRefs: [
    {
      sourceType: 'table',
      sourceId: 'table-linie-produkcyjne',
      sourceTitle: 'Linie produkcyjne — przestoje Q2',
      sourceVersion: 'v2',
      sourceSnapshotId: 'snap-1',
    },
  ],
  sections: [
    {
      sectionId: 'sec-1',
      orderIndex: 0,
      level: 1,
      title: 'Streszczenie wykonawcze',
      purpose: 'Trzy kluczowe wnioski dla zarządu',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'block-1',
          type: 'paragraph',
          content: {
            text: 'Audyt trzech linii produkcyjnych wykazał średni przestój 14% czasu pracy, głównie z powodu nieplanowanych przezbrojeń.',
          },
          sourceRef: {
            sourceType: 'table',
            sourceId: 'table-linie-produkcyjne',
            sourceTitle: 'Linie produkcyjne — przestoje Q2',
          },
        },
      ],
    },
    {
      sectionId: 'sec-2',
      orderIndex: 1,
      level: 1,
      title: 'Ryzyka wdrożeniowe',
      purpose: 'Zidentyfikowane ryzyka planu naprawczego',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'block-2',
          type: 'paragraph',
          content: {
            text: 'Skrócenie czasu przezbrojeń wymaga inwestycji w szkolenie zespołu utrzymania ruchu — założenie wymaga walidacji z HR.',
          },
          isAssumption: true,
        },
      ],
    },
  ],
};

export function DocumentStudioMenuPlikuScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div className="h-screen w-screen overflow-hidden bg-c-bg">
        <DocumentStudioDocumentPanel
          artifactId={schema.artifactId}
          schema={schema}
          onStartOver={() => {
            // eslint-disable-next-line no-console
            console.log('[dev-render] onStartOver');
          }}
          onSchemaUpdated={(next) => {
            // eslint-disable-next-line no-console
            console.log('[dev-render] onSchemaUpdated', next);
          }}
        />
      </div>
    </AppProviders>
  );
}

export default DocumentStudioMenuPlikuScreen;
