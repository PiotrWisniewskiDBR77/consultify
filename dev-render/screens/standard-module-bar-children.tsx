/**
 * Mock host dla rozszerzenia `StandardModuleBar` o `children` (2026-07-26):
 * fasada ma teraz PRZEJMOWAĆ layout treści (flex-col h-full + scrollowalny
 * content area) identycznie jak `ModuleHub`, żeby migracja hubów
 * (`<ModuleHub>{tresc}</ModuleHub>` → `<StandardModuleBar>{tresc}</StandardModuleBar>`)
 * była mechaniczną podmianą tagu, nie przepisaniem layoutu.
 *
 * Ekran A: `<StandardModuleBar>` Z children — nowa ścieżka, sprawdzamy że
 *   pasek renderuje się jak dotąd, a treść pod nim scrolluje się we własnym
 *   kontenerze (nie ucieka poza viewport, nie dubluje wysokości).
 * Ekran B (niżej, druga sekcja): `<StandardModuleBar>` BEZ children — stara
 *   ścieżka, dowód że peryferyjni konsumenci (MyProjects, vault, itd.) nie
 *   dostali żadnej zmiany zachowania.
 */
import { CheckCircle2, Plus } from 'lucide-react';
import React, { useState } from 'react';

import StandardModuleBar from '../../src/components/standard/StandardModuleBar';

export function StandardModuleBarChildrenScreen(): React.ReactElement {
  const [activeTab, setActiveTab] = useState('list');

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <div>
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
          A — StandardModuleBar Z children (nowa ścieżka, wysokość ograniczona do 420px żeby pokazać
          wewnętrzny scroll)
        </p>
        <div style={{ height: 420, border: '1px dashed #888', overflow: 'hidden' }}>
          <StandardModuleBar
            tabs={[
              { id: 'list', label: 'Lista' },
              { id: 'kpi', label: 'KPI' },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchValue=""
            onSearch={() => {}}
            primaryCta={{ label: 'Nowy rekord', icon: Plus, onClick: () => {} }}
            viewModes={['table', 'grid']}
            viewMode="table"
            onViewModeChange={() => {}}
            chips={[
              { id: 'all', label: 'Wszystkie', count: 24 },
              { id: 'mine', label: 'Moje', count: 3, dot: 'bg-c-info-500' },
            ]}
            activeChip="all"
            onChipChange={() => {}}
          >
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(148,163,184,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCircle2 size={14} style={{ opacity: 0.5 }} />
                <span>
                  Wiersz treści #{i + 1} — jeśli to się scrolluje wewnątrz zielonej ramki, layout
                  dziedziczony po ModuleHub działa poprawnie.
                </span>
              </div>
            ))}
          </StandardModuleBar>
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
          B — StandardModuleBar BEZ children (stara ścieżka, peryferyjni konsumenci:
          MyProjects/AssessmentTable/vault/AgentHubShell) — musi wyglądać tak jak przed zmianą,
          tylko pasek, bez dodatkowego wrappera
        </p>
        <div style={{ border: '1px dashed #888' }}>
          <StandardModuleBar
            tabs={[{ id: 'only', label: 'Jedyna zakładka' }]}
            activeTab="only"
            onTabChange={() => {}}
            primaryCta={{ label: 'Akcja', icon: Plus, onClick: () => {} }}
          />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
          C — primaryCta locked (pilot-lock, dodane 2026-07-26 dla Initiatives) — wyszarzone,
          tooltip z wyjaśnieniem, ale NADAL KLIKALNE (onClick ma dispatchować komunikat, nie ginie
          pod natywnym disabled)
        </p>
        <div style={{ border: '1px dashed #888' }}>
          <StandardModuleBar
            tabs={[{ id: 'only', label: 'Jedyna zakładka' }]}
            activeTab="only"
            onTabChange={() => {}}
            primaryCta={{
              label: 'Nowa inicjatywa',
              icon: Plus,
              onClick: () => console.log('PILOT_LOCK_CLICK_FIRED — onClick nie jest blokowany'),
              locked: true,
              lockedReason: 'Dostępne w kolejnej fazie projektu',
            }}
          />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
          D — statusFilters passthrough (Execution/Audits-style, dodane 2026-07-26) — czysty przekaz
          propsów do ModuleNavBar, zero nowej logiki w fasadzie
        </p>
        <div style={{ border: '1px dashed #888' }}>
          <StandardModuleBar
            tabs={[{ id: 'only', label: 'Jedyna zakładka' }]}
            activeTab="only"
            onTabChange={() => {}}
            statusFilters={[
              { id: 'all', label: 'Wszystkie', color: 'slate' },
              { id: 'on_track', label: 'On track', color: 'green', count: 12 },
              { id: 'at_risk', label: 'At risk', color: 'amber', count: 3 },
            ]}
            activeStatusFilter="on_track"
            onStatusFilterChange={() => {}}
          />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
          E — primaryCtaContent (Interview-style, dodane 2026-07-26) — DWA przyciski naraz w slocie
          CTA (per-tab CTA + flag-gated „+ Nowy"), luk ucieczkowy bo StandardPrimaryCta obsługuje
          tylko jeden
        </p>
        <div style={{ border: '1px dashed #888' }}>
          <StandardModuleBar
            tabs={[{ id: 'only', label: 'Jedyna zakładka' }]}
            activeTab="only"
            onTabChange={() => {}}
            primaryCtaContent={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border border-c-border bg-c-surface text-c-text"
                >
                  Per-tab CTA
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white dark:bg-slate-50 dark:text-navy-950"
                >
                  + Nowy (unified launcher)
                </button>
              </div>
            }
          />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
          F — categoryButtons passthrough (Benefits-style, dodane 2026-07-26) — czysty przekaz do
          ModuleNavBar, pierwsze realne uzycie znalezione przy migracji Fali 2
        </p>
        <div style={{ border: '1px dashed #888' }}>
          <StandardModuleBar
            tabs={[]}
            activeTab=""
            onTabChange={() => {}}
            categoryButtons={[
              {
                id: 'cost',
                label: 'Cost',
                icon: <CheckCircle2 size={14} />,
                count: 5,
                onClick: () => {},
              },
              {
                id: 'time',
                label: 'Time',
                icon: <CheckCircle2 size={14} />,
                count: 2,
                onClick: () => {},
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default StandardModuleBarChildrenScreen;
