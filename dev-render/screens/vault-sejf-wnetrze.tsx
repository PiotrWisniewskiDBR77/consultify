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
import { seedRealisticSession } from '../mocks/seedStore';

// MW-10 — `canChangeScope`/wersje w `VaultDocumentPanel` czytają
// `currentUser.id` z `useAppStore` (nie z Api), więc bez seeda dev-render
// pokazywałby panel wersji jako zablokowany (nikt nie jest „właścicielem").
seedRealisticSession();

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
    folder_id: 'folder-1',
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
    folder_id: 'folder-1',
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
    folder_id: 'folder-2',
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
  // ★ MW-10 — dokument WŁASNY demo-usera (`user-piotr-demo`, patrz
  // `seedRealisticSession`), żeby `canChangeScope`/panel „Wersje" był
  // klikalny w tym harnessie (mirror backendu: wersje edytuje tylko
  // właściciel własnego prywatnego dokumentu).
  {
    id: 'doc-mw010-versions',
    filename: 'MW10_wersjonowanie_demo.docx',
    category: 'Methodology',
    tags: ['mw-10', 'wersje'],
    status: 'indexed',
    created_at: '2026-08-01T10:00:00Z',
    chunk_count: 6,
    file_size_bytes: 51_200,
    scope: 'user',
    project_id: null,
    owner_id: 'user-piotr-demo',
    folder_id: null,
  },
];

type ApiShape = Record<string, unknown>;

// ★ VLT-FOLDERS — mock STANOWY (nie zamrożony — lekcja z pamięci sesji: mock
// zamrożony = fałszywe bugi w render-verify). Nowy folder/przeniesienie
// dokumentu faktycznie zmienia to, co harness pokazuje na kolejnym renderze.
const FOLDERS = [
  { id: 'folder-1', name: 'Zarząd' },
  { id: 'folder-2', name: 'Zgodność' },
];

// ★ MW-10 — historia wersji, STANOWA (ten sam wymóg co FOLDERS powyżej):
// upload nowej wersji / restore faktycznie dopisuje wiersz, więc klik-po-kliku
// w harnessie pokazuje TO SAMO co realny backend (`knowledge.routes.ts`
// `serializeVersion` — kształt pól 1:1).
type MockVersion = {
  versionId: string;
  documentId: string;
  versionNumber: number;
  filename: string;
  fileSizeBytes: number | null;
  contentHash: string | null;
  chunkCount: number;
  origin: 'upload' | 'edit' | 'restore';
  restoredFromVersion: number | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string | null;
};

const VERSIONS = new Map<string, MockVersion[]>([
  [
    'doc-mw010-versions',
    [
      {
        versionId: 'ver-1',
        documentId: 'doc-mw010-versions',
        versionNumber: 1,
        filename: 'MW10_wersjonowanie_demo.docx',
        fileSizeBytes: 40_960,
        contentHash: 'hash-v1',
        chunkCount: 4,
        origin: 'upload',
        restoredFromVersion: null,
        note: null,
        createdBy: 'user-piotr-demo',
        createdAt: '2026-08-01T10:00:00Z',
      },
      {
        versionId: 'ver-2',
        documentId: 'doc-mw010-versions',
        versionNumber: 2,
        filename: 'MW10_wersjonowanie_demo.docx',
        fileSizeBytes: 51_200,
        contentHash: 'hash-v2',
        chunkCount: 6,
        origin: 'edit',
        restoredFromVersion: null,
        note: null,
        createdBy: 'user-piotr-demo',
        createdAt: '2026-08-01T12:30:00Z',
      },
    ],
  ],
]);

const installMocks = (empty: boolean) => {
  const api = Api as unknown as ApiShape;
  const docs = empty ? [] : DOCS.map((d) => ({ ...d }));
  api.getKnowledgeDocuments = async () => docs;
  api.getMyProjectMemberships = async () => [
    { id: 'proj-1', name: 'Transformacja DBR77' },
    { id: 'proj-2', name: 'Program energetyczny' },
  ];
  api.uploadKnowledgeDocument = async () => ({ document: { id: 'doc-new' }, chunkCount: 12 });
  api.updateKnowledgeDocument = async (id: string, data: Record<string, unknown>) => {
    const doc = docs.find((d) => d.id === id) as Record<string, unknown> | undefined;
    if (doc && 'folderId' in data) doc.folder_id = data.folderId;
    return { success: true };
  };
  api.deleteKnowledgeDocument = async () => ({ success: true });
  api.getKnowledgeDocumentScopeImpact = async () => ({ becameOrgVisibleCount: 1 });
  api.updateKnowledgeDocumentScope = async () => ({ success: true });

  api.getVaultFolders = async () => FOLDERS.map((f) => ({ ...f }));
  api.createVaultFolder = async (payload: { name: string }) => {
    const created = { id: `folder-${FOLDERS.length + 1}`, name: payload.name };
    FOLDERS.push(created);
    return created;
  };
  api.updateVaultFolder = async () => undefined;
  api.deleteVaultFolder = async (folderId: string) => {
    const idx = FOLDERS.findIndex((f) => f.id === folderId);
    if (idx >= 0) FOLDERS.splice(idx, 1);
    docs.forEach((d) => {
      if ((d as Record<string, unknown>).folder_id === folderId) {
        (d as Record<string, unknown>).folder_id = null;
      }
    });
  };

  // ★ MW-10 — kontrakt 1:1 z `knowledge.routes.ts` (GET .../versions,
  // POST .../versions z CAS, POST .../versions/:n/restore z CAS).
  api.getKnowledgeDocumentVersions = async (id: string) => {
    const list = VERSIONS.get(id) || [];
    const sorted = [...list].sort((a, b) => b.versionNumber - a.versionNumber);
    return {
      documentId: id,
      currentVersion: sorted[0]?.versionNumber ?? 1,
      versions: sorted,
    };
  };
  api.uploadKnowledgeDocumentVersion = async (id: string, file: File, expectedVersion: number) => {
    const list = VERSIONS.get(id) || [];
    const current = Math.max(0, ...list.map((v) => v.versionNumber));
    if (expectedVersion !== current) {
      const err = new Error('Dokument zmienił się w międzyczasie') as Error & {
        code?: string;
        currentVersion?: number;
      };
      err.code = 'VAULT_VERSION_CONFLICT';
      err.currentVersion = current;
      throw err;
    }
    const nextNumber = current + 1;
    const version: MockVersion = {
      versionId: `ver-${nextNumber}-${Date.now()}`,
      documentId: id,
      versionNumber: nextNumber,
      filename: file.name,
      fileSizeBytes: file.size,
      contentHash: `hash-v${nextNumber}`,
      chunkCount: current + 2,
      origin: 'edit',
      restoredFromVersion: null,
      note: null,
      createdBy: 'user-piotr-demo',
      createdAt: new Date().toISOString(),
    };
    list.push(version);
    VERSIONS.set(id, list);
    return { documentId: id, version, currentVersion: nextNumber };
  };
  api.restoreKnowledgeDocumentVersion = async (
    id: string,
    versionNumber: number,
    expectedVersion: number
  ) => {
    const list = VERSIONS.get(id) || [];
    const source = list.find((v) => v.versionNumber === versionNumber);
    const current = Math.max(0, ...list.map((v) => v.versionNumber));
    if (!source) throw new Error('Version not found');
    if (expectedVersion !== current) {
      const err = new Error('Dokument zmienił się w międzyczasie') as Error & {
        code?: string;
        currentVersion?: number;
      };
      err.code = 'VAULT_VERSION_CONFLICT';
      err.currentVersion = current;
      throw err;
    }
    const nextNumber = current + 1;
    const version: MockVersion = {
      ...source,
      versionId: `ver-${nextNumber}-${Date.now()}`,
      versionNumber: nextNumber,
      origin: 'restore',
      restoredFromVersion: versionNumber,
      createdAt: new Date().toISOString(),
    };
    list.push(version);
    VERSIONS.set(id, list);
    return {
      documentId: id,
      version,
      currentVersion: nextNumber,
      restoredFromVersion: versionNumber,
    };
  };
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
