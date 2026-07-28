/**
 * Dev-render host — P-10/P-11/P-12 (zgłoszenia z żywego przejścia 2026-07-28,
 * Document Studio / Word). Montuje REALNY `DocumentStudioDocumentPanel` z
 * mock `DocumentSchema` odtwarzającym DOKŁADNIE zgłoszony scenariusz:
 * NOWY dokument (tytuł "Nowy dokument", 1 sekcja, treść zastępcza).
 *
 * Weryfikuje trzy naprawy w tej samej karcie:
 *   P-10 — klik w tytuł w pasku otwiera pole edycji (TopBar `onTitleChange`
 *          teraz podpięty w `DocumentStudioDocumentPanel`); Enter/blur
 *          zapisuje przez `PUT /document-studio/:id/content` (title+sections).
 *   P-11 — Cofnij/Ponów (`DocumentUndoRedoControls`) nad edytorem TipTap;
 *          silnik (StarterKit `undoRedo`) już działał, brakowało tylko UI.
 *   P-12 — Historia/QA/Nadzór/Edytor AI w pasku górnym mają teraz realne
 *          `onClick` (były martwe — zero handlera, patrz
 *          `DocumentStudioDocumentPanel.tsx` komentarz przy `topBarChips`).
 *
 * Sieć: tylko `PUT /:artifactId/content` jest podstawiony (żeby zapis
 * tytułu/treści zwrócił zaktualizowany schemat bez prawdziwego backendu);
 * wszystkie pozostałe GET-y (policy/history/comments/…) idą do realnego
 * fetch i failują gracefully do pustych stanów — każdy panel ma już swój
 * `catch` (patrz `ActivityPanel`, `getDocumentStudioPolicy` default-deny
 * fallback w samym komponencie).
 *
 * URL: ?screen=document-studio-nowy-dokument-martwe-przyciski[&theme=light|dark][&lang=pl|en]
 */
import React from 'react';

import { DocumentStudioDocumentPanel } from '@/components/DocumentStudio/DocumentStudioDocumentPanel';
import type { DocumentSchema } from '@/components/DocumentStudio/types';

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

export default function DocumentStudioNowyDokumentMartweprzyciskiScreen(): React.ReactElement {
  const [live, setLive] = React.useState(schema);
  return (
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
  );
}
