/**
 * Dev-render host dla M18 punkt 2 — kanon Formuły M1: "Udostępnij" primary,
 * "Export DOCX" obok (dziś było odwrotnie). Montuje REALNY
 * `DocumentStudioDocumentPanel` z mock `DocumentSchema` (bez backendu —
 * `getDocumentStudioPolicy()` fails gracefully do default-deny).
 *
 * URL params: ?screen=document-studio-m1-share-primary&theme=light|dark&lang=pl|en
 */
import React from 'react';

import { DocumentStudioDocumentPanel } from '@/components/DocumentStudio/DocumentStudioDocumentPanel';
import type { DocumentSchema } from '@/components/DocumentStudio/types';

const schema: DocumentSchema = {
  documentId: 'mock-doc-1',
  artifactId: 'mock-doc-1',
  title: 'Raport statusu — Ekspansja DE Q3',
  documentType: 'project_status_report',
  language: 'pl',
  audience: ['steering_committee'],
  goal: 'inform',
  communicationRegister: 'executive',
  density: 'standard',
  languageStyle: 'consulting',
  confidentiality: 'client_confidential',
  sections: [
    {
      sectionId: 'sec-1',
      orderIndex: 0,
      level: 1,
      title: 'Streszczenie wykonawcze',
      purpose: '3 kluczowe wnioski',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'b1',
          type: 'paragraph',
          content: {
            text: 'Projekt postępuje zgodnie z planem; budżet wykorzystany w 62%.',
          },
        },
      ],
    },
  ],
  sourceRefs: [{ sourceType: 'initiative', sourceId: 'init-1', sourceTitle: 'Ekspansja DE' }],
  owner: 'piotr.wisniewski@dbr77.com',
  createdAt: new Date().toISOString(),
};

export default function DocumentStudioM1SharePrimaryScreen(): React.ReactElement {
  return (
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
  );
}
