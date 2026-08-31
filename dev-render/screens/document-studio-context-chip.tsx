/**
 * Dev-render: DOCUMENT STUDIO ▸ chip kontekstu organizacji (P0, 2026-07-27).
 *
 * Właściciel dostał na żywo dokument z „0 sources" i zablokowanym eksportem —
 * bo formularz NIGDY nie wysyłał kontekstu organizacji do generatora. Naprawa
 * dokłada auto-grounding po stronie serwera + ten chip, który UCZCIWIE mówi
 * użytkownikowi, co zostanie automatycznie dołączone.
 *
 * Montuje REALNY `<DocumentStudioIntakeForm />`; jedyne co podstawiamy to
 * `currentOrganization` w store (normalnie wypełniane po zalogowaniu).
 *
 * URL: ?screen=document-studio-context-chip[&theme=light|dark]
 */
import React from 'react';

import { DocumentStudioIntakeForm } from '../../src/components/DocumentStudio/DocumentStudioIntakeForm';
import { useAppStore } from '../../src/store/useAppStore';

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
  currentOrganization: {
    id: 'org-dbr77',
    name: 'DBR77 Sp. z o.o.',
  },
} as any);

export default function DocumentStudioContextChipScreen(): React.ReactElement {
  return (
    <div className="min-h-screen w-full bg-c-bg">
      <div className="border-b border-c-border px-6 py-3" data-dev-render-chrome="true">
        <div className="text-sm font-semibold text-c-text">
          Document Studio — chip kontekstu organizacji (P0)
        </div>
        <div className="text-xs text-c-text-secondary">
          oczekiwane: nad polem opisu chip „Kontekst: DBR77 Sp. z o.o."
        </div>
      </div>
      <div className="mx-auto max-w-4xl">
        <DocumentStudioIntakeForm onSubmit={() => undefined} />
      </div>
    </div>
  );
}
