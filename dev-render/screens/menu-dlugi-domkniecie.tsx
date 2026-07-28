/**
 * Dev-render: AGT-015 §6 render-verify dla 4 długów Menu ("D1-D4").
 *
 * POWÓD ISTNIENIA — ograniczenie istniejącego harnessu: `?screen=agent-hub`
 * montuje `AgentHubShell` BEZ `HubBarSlotsProvider` (patrz `agent-hub.tsx`),
 * więc CAŁE Menu 2 (segmented "Moje procesy|Szablony", chip "Folder", CTA
 * "Nowy agent") jest wtedy NIEWIDOCZNE — te elementy istnieją WYŁĄCZNIE jako
 * `useHubBarSlot` rejestracja, którą normalnie konsumuje `MyWorkHub`
 * (jedyny realny provider w apce, 4152-liniowy komponent zbyt ciężki do
 * pełnego zamockowania w tym zadaniu). Ten ekran zakłada REALNY
 * `HubBarSlotsProvider` (`src/components/shared/HubBarSlots.tsx`) i
 * odtwarza Menu 2 TYMI SAMYMI klasami/JSX co `MyWorkHub.tsx` (CTA_BASE/
 * CTA_TONE, blok ok. linii 4291-4299) — 1:1 kopia, nie reimplementacja —
 * żeby faktycznie zobaczyć:
 *   D1 — ikonę na CTA "Nowy agent" (PlayCircle, `hubBarSlot.primaryCta.icon`)
 *   D2 — etykietę CTA + etykietę empty-state (oba "Nowy agent"/"New agent")
 *   D4 — trigger "Folder" → "Nowy folder…" → `FolderCreateDialog`, W OBU
 *        wariantach (Run agent: poziom wybieralny; Vault: `fixedScope`)
 *
 * URL:
 *   ?screen=menu-dlugi-domkniecie
 *   [&empty=1 → agent-hub startuje z ZERO planów (pokazuje empty-state)]
 *   [&theme=light|dark]
 */
import { PlayCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { HubBarSlotsProvider, useHubBar } from '@/components/shared/HubBarSlots';

import { installAgentHubFetchMock } from '../mocks/agentHubMocks';

// Canon §15.2/§19.1 — 1:1 kopia z MyWorkHub.tsx (CTA_BASE/CTA_TONE.violet),
// żeby ten harness pokazywał DOKŁADNIE to, co user zobaczy w realnym hubie.
const CTA_BASE =
  'inline-flex items-center justify-center gap-2 h-9 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
const CTA_TONE_VIOLET =
  'border-navy-700/20 bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 dark:border-white/20 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]';

const AgentHubShell = React.lazy(() =>
  import('@/components/AIChat/AgentHubShell').then((m) => ({ default: m.AgentHubShell }))
);
const VaultDocumentsView = React.lazy(() =>
  import('@/views/vault/VaultDocumentsView').then((m) => ({ default: m.VaultDocumentsView }))
);

function FakeMenu2Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-c-border-subtle bg-c-surface px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
        Menu 2 huba (odtworzone 1:1 z MyWorkHub.tsx — proof harness, nie produkcja)
      </span>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

/** Konsument slotu — 1:1 blok z `MyWorkHub.tsx` ok. linii 4286-4310. */
function HubBarConsumer() {
  const slot = useHubBar();
  return (
    <FakeMenu2Bar>
      {slot.filterControls}
      {slot.primaryCta ? (
        <button
          onClick={slot.primaryCta.onClick}
          disabled={slot.primaryCta.disabled}
          className={`${CTA_BASE} ${CTA_TONE_VIOLET} disabled:opacity-60 disabled:cursor-not-allowed`}
          data-testid={slot.primaryCta.testId || 'mywork-action-button'}
        >
          {slot.primaryCta.icon ? <slot.primaryCta.icon size={16} /> : null}
          <span>{slot.primaryCta.label}</span>
        </button>
      ) : null}
    </FakeMenu2Bar>
  );
}

function AgentHubProof(): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const empty = new URLSearchParams(window.location.search).get('empty') === '1';
    installAgentHubFetchMock({ emptyPlans: empty });
    setReady(true);
  }, []);

  if (!ready) return <div className="h-full w-full bg-c-bg" />;

  return (
    <HubBarSlotsProvider>
      <HubBarConsumer />
      <div className="h-[560px] overflow-hidden">
        <React.Suspense fallback={<div className="p-8 text-sm text-c-text-muted">Loading…</div>}>
          <AgentHubShell />
        </React.Suspense>
      </div>
    </HubBarSlotsProvider>
  );
}

function VaultProof(): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void import('@/services/api').then(({ Api }) => {
      const api = Api as unknown as Record<string, unknown>;
      api.getKnowledgeDocuments = async () => [];
      api.getMyProjectMemberships = async () => [{ id: 'proj-1', name: 'Transformacja DBR77' }];
      let vaultFolders: Array<{ id: string; name: string }> = [{ id: 'folder-1', name: 'Zarząd' }];
      api.getVaultFolders = async () => vaultFolders.map((f) => ({ ...f }));
      api.createVaultFolder = async (payload: { name: string }) => {
        const created = { id: `folder-${vaultFolders.length + 1}`, name: payload.name };
        vaultFolders = [...vaultFolders, created];
        return created;
      };
      api.deleteVaultFolder = async () => undefined;
      setReady(true);
    });
  }, []);

  if (!ready) return <div className="h-full w-full bg-c-bg" />;

  return (
    <HubBarSlotsProvider>
      <HubBarConsumer />
      <div className="h-[420px] overflow-hidden">
        <React.Suspense fallback={<div className="p-8 text-sm text-c-text-muted">Loading…</div>}>
          <VaultDocumentsView
            safe={{
              id: 'safe-proj-1',
              name: 'Transformacja DBR77',
              type: 'project',
              projectId: 'proj-1',
            }}
            onBack={() => undefined}
          />
        </React.Suspense>
      </div>
    </HubBarSlotsProvider>
  );
}

export default function MenuDlugiDomkniecieScreen(): React.ReactElement {
  return (
    <div className="h-screen w-screen overflow-y-auto bg-c-bg p-4 space-y-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
        <PlayCircle size={16} className="text-c-text-muted" />
        AGT-015 §6 — D1 ikona · D2 „Nowy agent" · D4 FolderCreateDialog (Run agent, poziom
        wybieralny)
      </div>
      <div className="rounded-xl border border-c-border-subtle overflow-hidden">
        <AgentHubProof />
      </div>

      <div className="pt-4 text-sm font-semibold text-c-text">
        D4 FolderCreateDialog — Vault (poziom narzucony przez sejf, `fixedScope`)
      </div>
      <div className="rounded-xl border border-c-border-subtle overflow-hidden">
        <VaultProof />
      </div>
    </div>
  );
}
