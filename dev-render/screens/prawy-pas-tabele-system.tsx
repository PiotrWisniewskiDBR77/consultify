/**
 * Dev-render: TABELE na wspólnym prawym pasie, tryb ARTEFAKT (kanon).
 *
 * Po co: CLAUDE.md #7 — właściciel nigdy nie jest pierwszym testerem
 * wizualnym. Ten harness renderuje REALNY `TabeleMelsView` (nie kopię, nie
 * prototyp) za flagami `?ff_melsTabele=1&ff_artifact_right_rail=1` — trzeci
 * krok rozwożenia formuły z Notatnika/Idei (`prawy-pas-notatnik-system.tsx`,
 * `prawy-pas-idea-system.tsx`, wzór 1:1), na trudniejszej powierzchni: tu
 * Tabele NIE mają dziś żadnej sekcji „o artefakcie" (7 istniejących narzędzi
 * — Search…Analytics — to w całości „po artefakcie"), więc dodajemy ÓSMY,
 * PIERWSZY tool `'artefakt'` (`buildTabeleRightRailTools` w
 * `TabeleRightRail.tsx`), reszta zostaje 1:1.
 *
 * `TabeleMelsView` jest z definicji prezentacyjny (patrz nagłówek pliku
 * źródłowego) — nie woła API sam, więc mockujemy WYŁĄCZNIE dane wejściowe
 * (`preview`, `rightRailPanels` dla siedmiu istniejących narzędzi jako proste
 * placeholdery), nie komponent. `preview.tabeleRelations` REALNIE zasila
 * sekcję kanonu „Powiązania" trybu Artefakt — to jest dowód kontraktu, nie
 * atrapa.
 *
 * Zarejestrowany 2× (artefakt / po-artefakcie-search) — `grafika-zrzuty.mjs`
 * nie klika UI, więc każdy tryb do zrzutu potrzebuje własnego wejścia.
 */
import React from 'react';

import type { ArtifactPreview } from '../../src/components/AIChat/KimiWorkspace/KimiWorkspaceShell';
import { TabeleMelsView } from '../../src/components/AIChat/KimiWorkspace/tabeleShell/TabeleMelsView';
import type { TabeleRightRailPanelRenderers } from '../../src/components/AIChat/KimiWorkspace/tabeleShell/TabeleRightRail';

const TABLE_TITLE = 'Portfel inicjatyw DE — tabela operacyjna';

const MOCK_PREVIEW: ArtifactPreview & { type: 'tabele' } = {
  type: 'tabele',
  title: TABLE_TITLE,
  fileName: 'portfel-inicjatyw-de.csv',
  summary: 'Tabela operacyjna zbudowana z wywiadów partnerskich DE.',
  kpiItems: [
    { label: 'Rekordy', value: '24' },
    { label: 'Relacje', value: '2' },
  ],
  tableData: {
    columns: ['Nazwa', 'Właściciel', 'Status'],
    rows: Array.from({ length: 24 }, (_, i) => ({ id: `rec-${i}`, cells: [] })),
  },
  tabeleSchemaFields: [
    { fieldId: 'f1', name: 'Nazwa', fieldType: 'text' },
    { fieldId: 'f2', name: 'Właściciel', fieldType: 'text' },
    { fieldId: 'f3', name: 'Status', fieldType: 'select' },
    { fieldId: 'f4', name: 'Rynek docelowy', fieldType: 'relation' },
  ],
  tabeleRelations: [
    {
      fieldId: 'f4',
      fieldName: 'Rynek docelowy',
      targetTableId: 'tbl-markets',
      targetTableName: 'Rynki',
      targetCount: 6,
    },
    {
      fieldId: 'f5',
      fieldName: 'Inicjatywa nadrzędna',
      targetTableId: 'tbl-initiatives',
      targetTableName: 'Inicjatywy',
      targetCount: 3,
    },
  ],
} as unknown as ArtifactPreview & { type: 'tabele' };

// Placeholdery dla siedmiu istniejących narzędzi „po artefakcie" — realna
// treść żyje w innych powierzchniach (silnik), tu tylko dowód, że tryb
// Artefakt nie wypycha ani nie zmienia reszty szyny.
const MOCK_PANELS: TabeleRightRailPanelRenderers = {
  search: <div className="p-4 text-xs text-c-text-muted">Search records — placeholder.</div>,
  aiEditor: <div className="p-4 text-xs text-c-text-muted">AI Editor — placeholder.</div>,
  qaReport: <div className="p-4 text-xs text-c-text-muted">QA Report — placeholder.</div>,
  sourcePack: <div className="p-4 text-xs text-c-text-muted">Source Pack — placeholder.</div>,
  layout: <div className="p-4 text-xs text-c-text-muted">Layout — placeholder.</div>,
  share: <div className="p-4 text-xs text-c-text-muted">Share — placeholder.</div>,
  analytics: <div className="p-4 text-xs text-c-text-muted">Analytics — placeholder.</div>,
};

export interface PrawyPasTabeleSystemScreenProps {
  /**
   * Który tool szyny ma być aktywny na starcie. `'closed'` NIE podaje
   * `activeRightRailToolId` w ogóle (prop pominięty, nie `null`/`undefined`
   * jawnie) — dowód OFF-identyczności rail-strip niezależny od nowego,
   * harness-owego propa sterującego (którego produkcja nigdy nie podaje).
   */
  tryb?: 'artefakt' | 'search' | 'closed';
}

export default function PrawyPasTabeleSystemScreen({
  tryb = 'artefakt',
}: PrawyPasTabeleSystemScreenProps): React.ReactElement {
  return (
    <div className="h-screen w-screen bg-c-bg">
      <TabeleMelsView
        preview={MOCK_PREVIEW}
        confidentiality="internal"
        governanceVerdict="approved"
        qaFindingsCount={2}
        sourcePackCount={5}
        rightRailPanels={MOCK_PANELS}
        onBack={() => undefined}
        persistRailState={false}
        // `grafika-zrzuty.mjs` nie klika UI — `activeRightRailToolId` steruje
        // deterministycznie, który tool szyny jest otwarty na zrzucie.
        // Pominięte w PRODUKCJI (`TabeleView.tsx` tego nie podaje) = szyna
        // zostaje niesterowana jak dziś; tu, w harnessie, ustawiamy ją na
        // sztywno — poza wariantem `'closed'` (patrz JSDoc propa wyżej).
        {...(tryb === 'closed' ? {} : { activeRightRailToolId: tryb })}
      />
    </div>
  );
}
