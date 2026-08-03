/**
 * Dev-render host — P-10/P-11/P-12 (zgłoszenia z żywego przejścia 2026-07-28,
 * Document Studio / Word). Montuje REALNY `DocumentStudioDocumentPanel` z
 * mock `DocumentSchema` odtwarzającym DOKŁADNIE zgłoszony scenariusz:
 * NOWY dokument (tytuł "Nowy dokument", 1 sekcja, treść zastępcza).
 *
 * ★ Pierwsza wersja tego harnessu montowała `DocumentStudioDocumentPanel`
 * BEZ `AppProviders` — działało w chwili napisania, ale po scaleniu z
 * `origin/demo` (`feat/menu-pliku-dokumentu`) panel zaczął wołać
 * `useNavigate()` (nowe menu Plik) i BEZ Routera w drzewie providerów
 * `useNavigate()` rzuca "may be used only in the context of a <Router>" —
 * ekran nigdy się nie montuje (pusty ekran "Ładowanie ekranu…" bez końca,
 * bo `React.lazy`+`Suspense` łapie odrzucony import/błąd renderu inaczej niż
 * zwykły wyjątek w konsoli deva). Wzór naprawy: `navdeclutter-sidebar.tsx` /
 * `document-studio-ai-teresa.tsx` — realny `AppProviders` (niesie
 * `BrowserRouter`+`QueryClientProvider`+resztę drzewa) + `seedRealisticSession()`.
 *
 * Weryfikuje trzy naprawy naraz w tej samej karcie:
 *   P-10 — klik w tytuł w pasku otwiera pole edycji (TopBar `onTitleChange`
 *          teraz podpięty w `DocumentStudioDocumentPanel`); Enter/blur
 *          zapisuje przez `PUT /document-studio/:id/content` (title+sections).
 *   P-11 — Cofnij/Ponów (`DocumentUndoRedoControls`) nad edytorem TipTap;
 *          silnik (StarterKit `undoRedo`) już działał, brakowało tylko UI.
 *   P-12 — Historia/QA/Nadzór/Edytor AI mają teraz realne `onClick` (były
 *          martwe — zero handlera). Po scaleniu z demo Historia/Nadzór
 *          żyją w overflow `⋯` (`group:'overflow'`, `feat/menu-pliku-dokumentu`)
 *          — kliknij `⋯` żeby je zobaczyć; oba nadal otwierają swój panel.
 *
 * Sieć: mock jest STANOWY (moduł-level `let schema`, aktualizowany przy
 * każdym udanym zapisie) — zamrożony mock dawał już fałszywe alarmy w tym
 * repo. Podstawiony jest tylko `PUT /:artifactId/content` (zapis
 * tytułu/treści); wszystkie pozostałe GET-y (policy/history/comments/org/
 * partnerzy/…) idą do realnego fetch i failują gracefully do pustych
 * stanów — każdy panel ma już swój `catch` (patrz `ActivityPanel`,
 * `getDocumentStudioPolicy` default-deny fallback w samym komponencie).
 *
 * URL: ?screen=document-studio-nowy-dokument-martwe-przyciski[&theme=light|dark][&lang=pl|en]
 */
import React from 'react';

import { DocumentStudioDocumentPanel } from '@/components/DocumentStudio/DocumentStudioDocumentPanel';
import type { DocumentSchema } from '@/components/DocumentStudio/types';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
useAppStore.setState({
  theme: params.get('theme') === 'dark' ? 'dark' : 'light',
} as any);

// `DocumentStudioDocumentPanel`'s File menu navigates to
// `/presentations?tab=documents` on "Wstecz"/"Otwórz" — give the router a
// sane starting path so that isn't a no-op jump from `/`.
if (!window.location.pathname.startsWith('/document-studio')) {
  window.history.replaceState({}, '', '/document-studio/mock-nowy-dokument-1');
}

let schema: DocumentSchema = {
  documentId: 'mock-nowy-dokument-1',
  artifactId: 'mock-nowy-dokument-1',
  title: 'Nowy dokument',
  documentType: 'generic_document',
  language: 'pl',
  audience: [],
  goal: 'inform',
  communicationRegister: 'professional',
  density: 'concise',
  languageStyle: 'formal',
  confidentiality: 'internal',
  sections: [
    {
      sectionId: 'sec-1',
      orderIndex: 0,
      level: 1,
      title: 'Sekcja 1',
      purpose: '',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'b1',
          type: 'paragraph',
          content: { text: 'Treść zastępcza — zacznij pisać, aby ją zastąpić.' },
        },
      ],
    },
  ],
  sourceRefs: [],
  owner: 'piotr.wisniewski@dbr77.com',
  createdAt: new Date().toISOString(),
  // P-10's title-save guard requires a version to lock against — real
  // freshly-generated documents always have this; a mock without it would
  // hide the exact bug (title button enabled, save silently refused).
  updatedAt: new Date().toISOString(),
};

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : (input?.url ?? '');

  if (url.includes(`/document-studio/${schema.artifactId}/content`) && init?.method === 'PUT') {
    const body = JSON.parse(init.body as string) as {
      sections?: DocumentSchema['sections'];
      title?: string;
      expectedVersion?: string;
    };
    if (body.expectedVersion !== schema.updatedAt) {
      return new Response(
        JSON.stringify({
          error: 'manual_save_conflict',
          code: 'DOC_CONTENT_CONFLICT',
          conflict: { yourVersion: body.expectedVersion, serverVersion: schema.updatedAt },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    schema = {
      ...schema,
      sections: body.sections ?? schema.sections,
      title: body.title?.trim() || schema.title,
      updatedAt: new Date().toISOString(),
    };
    return new Response(JSON.stringify({ schema }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return realFetch(input, init);
}) as typeof window.fetch;

function DocumentStudioNowyDokumentMartweprzyciskiInner(): React.ReactElement {
  const [live, setLive] = React.useState(schema);
  return (
    <div className="h-screen w-full bg-c-bg">
      <DocumentStudioDocumentPanel
        artifactId={live.artifactId}
        schema={live}
        onStartOver={() => {
          // eslint-disable-next-line no-console
          console.log('[dev-render] onStartOver');
        }}
        onSchemaUpdated={(next) => {
          schema = next;
          setLive(next);
          // eslint-disable-next-line no-console
          console.log('[dev-render] onSchemaUpdated', next);
        }}
      />
    </div>
  );
}

export default function DocumentStudioNowyDokumentMartweprzyciskiScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <DocumentStudioNowyDokumentMartweprzyciskiInner />
      </FeatureFlagsProvider>
    </AppProviders>
  );
}
