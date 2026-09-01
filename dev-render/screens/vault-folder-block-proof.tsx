/**
 * Dev-render: ★ VLT-FOLDERS proof — DRUGI select (folder) na klocku
 * "Vault-kontekst" w AgentPlanCanvas.
 *
 * Mounts `AgentPlanCanvas` (src/components/AIChat/AgentPlanCanvas.tsx)
 * BEZPOŚREDNIO (nie przez cały AgentPlanPanel — ten harness ma własny
 * overlay palety klocków, który przesłania canvas), z jednym blokiem
 * `vault-kontekst` już mającym wybrany sejf ("Mój sejf") — dzięki temu DRUGI
 * select (folder wewnątrz sejfu) jest od razu widoczny bez klikania.
 *
 * Mockuje WYŁĄCZNIE `Api.getVaultSafes`/`Api.getVaultFolders` (patch metod,
 * nie window.fetch) — bez logowania, backendu i bazy.
 */
import React, { useState } from 'react';

import { AgentPlanCanvas, type PlanSchemaBlock } from '../../src/components/AIChat/AgentPlanCanvas';
import { Api } from '../../src/services/api';

type ApiShape = Record<string, unknown>;

const SAFES = [
  { id: 'user', type: 'user' as const, projectId: null, name: 'Mój sejf' },
  { id: 'organization', type: 'organization' as const, projectId: null, name: 'Sejf organizacji' },
  {
    id: 'project:proj-elkomtech',
    type: 'project' as const,
    projectId: 'proj-elkomtech',
    name: 'Elkomtech',
  },
];

const FOLDERS_BY_SAFE: Record<string, Array<{ id: string; name: string }>> = {
  'user:': [
    { id: 'folder-inbox', name: 'Inbox' },
    { id: 'folder-szkice', name: 'Szkice' },
  ],
  'organization:': [{ id: 'folder-polityki', name: 'Polityki' }],
  'project:proj-elkomtech': [{ id: 'folder-diagnoza', name: 'Diagnoza AiR' }],
};

(() => {
  const api = Api as unknown as ApiShape;
  api.getVaultSafes = async () => SAFES;
  api.getVaultFolders = async (filters: { scope: string; projectId?: string | null }) => {
    const key = filters.scope === 'project' ? `project:${filters.projectId}` : `${filters.scope}:`;
    return FOLDERS_BY_SAFE[key] || [];
  };
})();

const INITIAL_BLOCKS: PlanSchemaBlock[] = [
  {
    id: 'block-1',
    kind: 'vault-kontekst',
    name: 'Kontekst z Vault',
    toolName: 'search_knowledge_base',
    toolInput: {
      vault_safe_id: 'user',
      vault_scope: 'user',
      vault_project_id: null,
      vault_safe_name: 'Mój sejf',
    },
  },
  {
    id: 'block-2',
    kind: 'vault-kontekst',
    name: 'Kontekst projektu',
    toolName: 'search_knowledge_base',
    toolInput: {
      vault_safe_id: 'project:proj-elkomtech',
      vault_scope: 'project',
      vault_project_id: 'proj-elkomtech',
      vault_safe_name: 'Elkomtech',
      vault_folder_id: 'folder-diagnoza',
      vault_folder_name: 'Diagnoza AiR',
    },
  },
];

// Produkcja: AgentPlanPanel.tsx:504-540 — warsztat 3-kolumnowy: lewa kolumna
// AgentWorkshopControls (320px, token --ntype-right-panel-width), środek
// `flex min-w-0 flex-1 flex-col` z AgentPlanCanvas, prawa kolumna
// AgentWorkshopPalette (320px). Ten harness NIE montuje realnych
// AgentWorkshopControls/AgentWorkshopPalette (patrz komentarz u góry pliku —
// paleta w tym harnessie przesłaniała canvas), ale odtwarza te same
// proporcje/szerokości, żeby środkowa kolumna miała realną (nie sztucznie
// zawężoną max-w-2xl) szerokość flex-1.
function SimulatedWorkshopColumn({
  label,
  side,
}: {
  label: string;
  side: 'left' | 'right';
}): React.ReactElement {
  return (
    <div
      className={`hidden w-80 shrink-0 bg-c-surface-raised/40 p-3 text-[11px] text-c-text-muted md:block ${
        side === 'left' ? 'border-r border-c-border-subtle' : 'border-l border-c-border-subtle'
      }`}
    >
      {label} (320px — nie część tego dowodu, symulowana szerokość realnej kolumny)
    </div>
  );
}

export default function VaultFolderBlockProofScreen(): React.ReactElement {
  const [blocks, setBlocks] = useState<PlanSchemaBlock[]>(INITIAL_BLOCKS);

  return (
    <div className="flex h-screen w-screen items-stretch overflow-hidden bg-c-bg">
      <SimulatedWorkshopColumn label="AgentWorkshopControls" side="left" />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-c-bg p-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-c-text-muted">
          VLT-FOLDERS — klocek "Vault-kontekst": select Poziom + DRUGI select Folder
        </h2>
        <p className="mb-4 text-[11px] text-c-text-muted">
          Blok 1 (Mój sejf, bez folderu wybranego) — folder pusty do wyboru. Blok 2 (Elkomtech,
          folder "Diagnoza AiR" już wybrany) — dowód, że etykieta karty pokazuje "sejf / folder".
        </p>
        <AgentPlanCanvas blocks={blocks} onChange={setBlocks} />
      </div>
      <SimulatedWorkshopColumn label="AgentWorkshopPalette" side="right" />
    </div>
  );
}
