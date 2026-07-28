/**
 * Dev-render host dla FALA 2 (2026-07-28, `_SPEC_GENERATOR_TEMPLATOW_2026-07-28.md`
 * Część 3) — "Zrób z tego wzorzec": ożywienie `createTemplateFromArtifact`
 * (server-side kompletne od dawna, zero przycisku w UI je wywoływało).
 *
 * Same base fixture as `document-studio-menu-pliku.tsx` (real
 * `DocumentStudioDocumentPanel`, real `DocumentStudioFileMenu`, wrapped in
 * `AppProviders` for the same `useNavigate()` reason), PLUS a `window.fetch`
 * mock for `POST /api/document-studio/templates/from-artifact/:artifactId`
 * so clicking through "Plik" → "Zrób z tego wzorzec" → fill the 3-5
 * clarifying questions → "Utwórz wzorzec" completes successfully and can be
 * screenshotted end-to-end, not just the empty modal.
 *
 * URL: ?screen=document-studio-save-as-template&theme=light|dark&lang=pl|en
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

Api.get = (async (url: string) => {
  if (url.startsWith('/partners/connection') || url.includes('/api/partners/connection')) {
    return { data: { connected: false } };
  }
  if (url.includes('/presentations/brand-kit')) {
    return {
      data: { primary_color: 'A51C30', secondary_color: '3B2883', accent_color: '6578B4' },
    };
  }
  return { data: null };
}) as typeof Api.get;

const g = window as unknown as { __DOC_STUDIO_SAVE_AS_TEMPLATE_FETCH__?: boolean };
if (!g.__DOC_STUDIO_SAVE_AS_TEMPLATE_FETCH__) {
  g.__DOC_STUDIO_SAVE_AS_TEMPLATE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/organizations/current')) {
      return new Response(
        JSON.stringify({
          organizations: [
            { id: 'org-dbr77-demo', name: 'DBR77 Sp. z o.o.', plan: 'enterprise', role: 'ADMIN' },
          ],
          currentOrganizationId: 'org-dbr77-demo',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // Fala 2 — the endpoint this whole screen exists to exercise.
    if (url.includes('/api/document-studio/templates/from-artifact/')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      // eslint-disable-next-line no-console
      console.log('[dev-render] createDocumentStudioTemplateFromArtifact answers', body);
      return new Response(
        JSON.stringify({
          template: {
            templateId: 'tpl-dev-render-from-artifact-1',
            organizationId: 'org-dbr77-demo',
            name: body.name || 'Audyt procesu produkcyjnego — raport (kopia)',
            category: 'management',
            documentType: 'executive_memo',
            purpose: 'Cloned from artifact',
            audience: ['Zarząd'],
            language: 'pl',
            languageStyle: 'consulting',
            communicationRegister: 'executive',
            density: 'concise',
            confidentiality: 'client_confidential',
            requiredInputs: [],
            sectionBlueprint: [],
            formattingSchema: {
              colorTemplateId: body.carryColorPattern === false ? null : 'harvard',
            },
            exportRules: {
              docx: true,
              pdf: true,
              markdown: true,
              approvalRequiredForExport: false,
            },
            status: 'draft',
            version: '0.1',
            createdBy: 'dev',
            createdAt: '2026-07-28T00:00:00.000Z',
            updatedAt: '2026-07-28T00:00:00.000Z',
            notes: body.sensitiveContentNotes
              ? `⚠ Do przejrzenia przed użyciem (treść specyficzna dla klienta): ${body.sensitiveContentNotes}`
              : undefined,
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return realFetch(input as RequestInfo, init);
  };
}

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
    {
      sectionId: 'sec-3',
      orderIndex: 2,
      level: 1,
      title: 'Rekomendacje',
      purpose: 'Priorytetowe działania naprawcze',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'block-3',
          type: 'paragraph',
          content: { text: 'Wdrożenie systemu SMED na linii 2 w ciągu 6 tygodni.' },
        },
      ],
    },
  ],
};

export function DocumentStudioSaveAsTemplateScreen(): React.ReactElement {
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

export default DocumentStudioSaveAsTemplateScreen;
