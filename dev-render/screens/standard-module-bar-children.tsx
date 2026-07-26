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
    <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
          A — StandardModuleBar Z children (nowa ścieżka, wysokość ograniczona
          do 420px żeby pokazać wewnętrzny scroll)
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
                <span>Wiersz treści #{i + 1} — jeśli to się scrolluje wewnątrz zielonej ramki, layout dziedziczony po ModuleHub działa poprawnie.</span>
              </div>
            ))}
          </StandardModuleBar>
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
          B — StandardModuleBar BEZ children (stara ścieżka, peryferyjni
          konsumenci: MyProjects/AssessmentTable/vault/AgentHubShell) — musi
          wyglądać tak jak przed zmianą, tylko pasek, bez dodatkowego wrappera
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
          C — primaryCta zablokowane (doktryna „uprawnienia bramkują akcje",
          dodane 2026-07-26 dla Initiatives-style pilot lock) — wyszarzone,
          nie znika, tooltip z wyjaśnieniem przy hover
        </p>
        <div style={{ border: '1px dashed #888' }}>
          <StandardModuleBar
            tabs={[{ id: 'only', label: 'Jedyna zakładka' }]}
            activeTab="only"
            onTabChange={() => {}}
            primaryCta={{
              label: 'Nowa inicjatywa',
              icon: Plus,
              onClick: () => {},
              disabled: true,
              disabledReason: 'Dostępne w kolejnej fazie projektu',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default StandardModuleBarChildrenScreen;
