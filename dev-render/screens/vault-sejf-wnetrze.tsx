/**
 * Dev-render: WNĘTRZE SEJFU (Client Vault → dokumenty) — `VaultDocumentsView`.
 *
 * Powód (CLAUDE.md #7): Piotr NIGDY nie jest pierwszym testerem wizualnym.
 * Ten harness montuje PRAWDZIWY komponent produkcyjny z mockowanymi metodami
 * `Api.*` (patch metod, nie `window.fetch` — patrz pułapka z pamięci sesji),
 * bez logowania, backendu i bazy.
 *
 * Do obejrzenia (light + dark):
 *  - pełna tabela (7 kolumn: Nazwa · Kategoria · Tagi · Poziom · Rozmiar ·
 *    Dodano · Status indeksowania), sort, pstryczek kolumn, kebab wiersza,
 *  - klik w wiersz → preview po prawej,
 *  - „Dodaj dokument" → panel boczny (drag&drop + kategoria + tagi + kontekst),
 *  - `?pusty=1` → stan pusty z jednym CTA „Dodaj pierwszy dokument".
 */
import React from 'react';

import { Api } from '../../src/services/api';
import { VaultDocumentsView } from '../../src/views/vault/VaultDocumentsView';

const DOCS = [
  {
    id: 'doc-1',
    filename: 'Strategia_transformacji_2026.pdf',
    category: 'Methodology',
    tags: ['strategia', 'zarząd', '2026'],
    status: 'indexed',
    created_at: '2026-07-18T09:12:00Z',
    chunk_count: 84,
    file_size_bytes: 2_411_520,
    scope: 'project',
    project_id: 'proj-1',
    owner_id: 'user-1',
  },
  {
    id: 'doc-2',
    filename: 'Benchmark_rynkowy_produkcja.xlsx',
    category: 'Best Practices',
    tags: ['benchmark', 'produkcja'],
    status: 'indexed',
    created_at: '2026-07-15T14:40:00Z',
    chunk_count: 37,
    file_size_bytes: 486_912,
    scope: 'project',
    project_id: 'proj-1',
    owner_id: 'user-1',
  },
  {
    id: 'doc-3',
    filename: 'Notatka_ze_spotkania_zarzadu.docx',
    category: 'Other',
    tags: ['notatka'],
    status: 'processing',
    created_at: '2026-07-22T08:05:00Z',
    chunk_count: 0,
    file_size_bytes: 61_440,
    scope: 'project',
    project_id: 'proj-1',
    owner_id: 'user-2',
  },
  {
    id: 'doc-4',
    filename: 'Polityka_bezpieczenstwa_informacji.pdf',
    category: 'Standards',
    tags: ['bezpieczeństwo', 'ISO', 'compliance'],
    status: 'indexed',
    created_at: '2026-06-30T11:00:00Z',
    chunk_count: 122,
    file_size_bytes: 5_242_880,
    scope: 'project',
    project_id: 'proj-1',
    owner_id: 'user-3',
  },
  {
    id: 'doc-5',
    filename: 'Szablon_raportu_tygodniowego.pptx',
    category: 'Templates',
    tags: [],
    status: 'failed',
    created_at: '2026-06-12T16:20:00Z',
    chunk_count: 0,
    file_size_bytes: 1_048_576,
    scope: 'project',
    project_id: 'proj-1',
    owner_id: 'user-1',
  },
  {
    id: 'doc-6',
    filename: 'Wyniki_ankiety_pracowniczej.csv',
    category: null,
    tags: ['ankieta', 'HR'],
    status: 'indexed',
    created_at: '2026-05-28T07:45:00Z',
    chunk_count: 19,
    file_size_bytes: 24_576,
    scope: 'project',
    project_id: 'proj-1',
    owner_id: 'user-2',
  },
];

type ApiShape = Record<string, unknown>;

const installMocks = (empty: boolean) => {
  const api = Api as unknown as ApiShape;
  api.getKnowledgeDocuments = async () => (empty ? [] : DOCS);
  api.getMyProjectMemberships = async () => [
    { id: 'proj-1', name: 'Transformacja DBR77' },
    { id: 'proj-2', name: 'Program energetyczny' },
  ];
  api.uploadKnowledgeDocument = async () => ({ document: { id: 'doc-new' }, chunkCount: 12 });
  api.updateKnowledgeDocument = async () => ({ success: true });
  api.deleteKnowledgeDocument = async () => ({ success: true });
  api.getKnowledgeDocumentScopeImpact = async () => ({ becameOrgVisibleCount: 1 });
  api.updateKnowledgeDocumentScope = async () => ({ success: true });
};

// Mocki instalujemy na poziomie MODUŁU — zanim komponent zdąży odpalić efekt.
// (Nie używamy tu React.lazy w ciele komponentu: nowy lazy przy każdym renderze
// = wieczne „Loading…". Import statyczny jest bezpieczny, bo mock podmienia
// metody obiektu `Api`, a nie jego moduł.)
installMocks(new URLSearchParams(window.location.search).get('pusty') === '1');

export default function VaultSejfWnetrzeScreen(): React.ReactElement {
  return (
    <div className="h-screen w-screen overflow-hidden bg-c-bg">
      <VaultDocumentsView
        safe={{
          id: 'safe-proj-1',
          name: 'Transformacja DBR77',
          type: 'project',
          projectId: 'proj-1',
        }}
        onBack={() => undefined}
      />
    </div>
  );
}
