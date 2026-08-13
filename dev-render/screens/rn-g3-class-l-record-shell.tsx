/**
 * RN-G3 tor PLATFORMY, punkt zakresu 1 — DEMONSTRACJA przepisu powłoki klasy L
 * (archetyp C „Rekord", ARTIFACT_ANATOMY_STANDARD.md §11.2/§13.1) dla pełnych
 * narzędzi KPI/ROI/OKR, złożonej WYŁĄCZNIE z istniejących prymitywów
 * `src/components/standard/**` — zero nowego standardu, zero zmian w
 * `NModeLayout/**` (poza allowlistą tego toru).
 *
 * Dlaczego ten ekran istnieje jako SYNTETYCZNA demonstracja, nie host
 * realnego komponentu (wbrew doktrynie harnessu „montuj REALNY komponent"):
 * żaden z trzech torów domenowych (KPI/ROI/OKR) nie zbudował jeszcze
 * pełnostronicowego widoku rekordu (Set/Case/Scorecard) — to ich praca w
 * toku, poza allowlistą tego toru. Ten ekran dowodzi, że przepis
 * kompozycyjny (patrz nagłówek `ArtifactBreadcrumb.tsx`) faktycznie się
 * renderuje i wygląda zgodnie ze standardem, ZANIM którakolwiek domena go
 * użyje — to jest dokładnie dowód wymagany przez zadanie („zrzuty nowej
 * powłoki klasy L"), nie podmiana niczyjej realnej pracy.
 *
 * Recepta (skopiuj 1:1 do realnego ekranu domeny):
 *   1. `ArtifactBreadcrumb` (NOWY, `src/components/standard/ArtifactBreadcrumb.tsx`)
 *      — element ㉛ Menu 1, którego `NModeHeader` nie ma.
 *   2. `NModeShell` (`src/components/shared/NModeLayout`, JUŻ ISTNIEJE, ZERO
 *      bramki rejestru — w przeciwieństwie do `StandardArtifactShell`, który
 *      jest scoped do INNEGO programu, SPEC-N „Karty N").
 *   3. `ArtifactRightPanel` + `ArtifactPropertiesTable` (JUŻ ISTNIEJĄ,
 *      `src/components/standard/`) — prawy panel akordeonowy, użyte wprost.
 *   4. Kebab Menu 1 = `extraOverflowItems` (już w `NModeHeaderConfig`).
 *   5. Wspólne stany = `SaveStateIndicator`/`TeresaUnavailableNotice`
 *      (`src/components/shared/states/`, punkt zakresu 4 tego toru).
 *
 * URL params: ?screen=rn-g3-class-l-record-shell&lang=pl|en&theme=light|dark
 *   &save=idle|saving|saved|error|conflict  (SaveStateIndicator w panelu)
 *   &teresa=1                                (pokazuje TeresaUnavailableNotice)
 */
import { AlertTriangle, Gauge, History, LineChart, ListChecks, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ArtifactBreadcrumb } from '../../src/components/standard/ArtifactBreadcrumb';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '../../src/components/standard/ArtifactRightPanel';
import { ArtifactPropertiesTable } from '../../src/components/standard/ArtifactPropertiesTable';
import { NModeShell } from '../../src/components/shared/NModeLayout/NModeShell';
import type { NModeSection } from '../../src/components/shared/NModeLayout/types';
import {
  SaveStateIndicator,
  type SaveStatus,
} from '../../src/components/shared/states/SaveState';
import { TeresaUnavailableNotice } from '../../src/components/shared/states/TeresaState';

const params = new URLSearchParams(window.location.search);
const saveParam = (params.get('save') || 'idle') as SaveStatus;
const showTeresa = params.get('teresa') === '1';

export default function RnG3ClassLRecordShell(): React.ReactElement {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [activeSection, setActiveSection] = useState('przeglad');

  const sections: NModeSection[] = [
    {
      id: 'przeglad',
      icon: Gauge,
      label: { pl: 'Przegląd', en: 'Overview' },
      component: (
        <div className="space-y-3">
          <p className="text-sm text-c-text-secondary">
            {isPolish
              ? 'Sekcja treści centrum — klasa L dopuszcza dowolną liczbę sekcji (tu: 5, patrz nawigacja po lewej). Archetyp Rekord: pola formularza / karty metryk.'
              : 'Center content section — class L allows any number of sections (here: 5, see left nav). Record archetype: form fields / metric cards.'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: isPolish ? 'Wartość bieżąca' : 'Current value', value: '87.4%' },
              { label: isPolish ? 'Cel' : 'Target', value: '95%' },
              { label: isPolish ? 'Odchylenie' : 'Deviation', value: '-7.6 pp' },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-c-border-subtle p-4">
                <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
                  {m.label}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-c-text">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'definicja',
      icon: ListChecks,
      label: { pl: 'Definicja', en: 'Definition' },
      component: (
        <p className="text-sm text-c-text-secondary">
          {isPolish ? 'Formuła, jednostka, cykl pomiaru.' : 'Formula, unit, measurement cadence.'}
        </p>
      ),
    },
    {
      id: 'pomiary',
      icon: LineChart,
      label: { pl: 'Pomiary', en: 'Measurements' },
      component: (
        <p className="text-sm text-c-text-secondary">
          {isPolish ? 'Historia pomiarów z proweniencją.' : 'Measurement history with provenance.'}
        </p>
      ),
    },
    {
      id: 'odchylenia',
      icon: AlertTriangle,
      label: { pl: 'Odchylenia', en: 'Deviations' },
      component: (
        <p className="text-sm text-c-text-secondary">
          {isPolish
            ? 'Sprawy odchyleń krytycznych + akcje naprawcze.'
            : 'Critical deviation cases + corrective actions.'}
        </p>
      ),
    },
    {
      id: 'historia',
      icon: History,
      label: { pl: 'Historia', en: 'History' },
      component: (
        <p className="text-sm text-c-text-secondary">
          {isPolish ? 'Dziennik zdarzeń i zmian wersji.' : 'Event log and version changes.'}
        </p>
      ),
    },
  ];

  const propertiesSection: ArtifactRightPanelSection = {
    id: 'properties',
    label: isPolish ? 'Właściwości' : 'Properties',
    defaultOpen: true,
    children: (
      <ArtifactPropertiesTable
        propertyLabel={isPolish ? 'Właściwość' : 'Property'}
        valueLabel={isPolish ? 'Wartość' : 'Value'}
        rows={[
          { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: 'user-anna-kowalska' },
          { id: 'process', label: isPolish ? 'Proces' : 'Process', value: 'proc-production' },
          {
            id: 'cadence',
            label: isPolish ? 'Cykl pomiaru' : 'Cadence',
            value: isPolish ? 'Miesięczny' : 'Monthly',
          },
        ]}
      />
    ),
  };

  const actionsSection: ArtifactRightPanelSection = {
    id: 'actions',
    label: isPolish ? 'Akcje' : 'Actions',
    defaultOpen: true,
    children: (
      <div className="space-y-2">
        {showTeresa ? <TeresaUnavailableNotice compact /> : null}
        <SaveStateIndicator status={saveParam} />
      </div>
    ),
  };

  const relationsSection: ArtifactRightPanelSection = {
    id: 'relations',
    label: isPolish ? 'Powiązania' : 'Relations',
    isEmpty: true,
    emptyLabel: isPolish ? 'Brak powiązań' : 'No relations',
    children: null,
  };

  const commentsSection: ArtifactRightPanelSection = {
    id: 'comments',
    label: isPolish ? 'Komentarze' : 'Comments',
    isEmpty: true,
    emptyLabel: isPolish ? 'Brak komentarzy' : 'No comments',
    children: null,
  };

  const historySection: ArtifactRightPanelSection = {
    id: 'history',
    label: isPolish ? 'Historia' : 'History',
    icon: Sparkles,
    isEmpty: true,
    emptyLabel: isPolish ? 'Brak wpisów' : 'No entries',
    children: null,
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-c-bg">
      <ArtifactBreadcrumb
        items={[
          { label: isPolish ? 'Rejestr KPI' : 'KPI Registry', onClick: () => {} },
          { label: 'OEE-LINIA-PAKOWANIA' },
        ]}
      />
      <div className="min-h-0 flex-1">
        <NModeShell
          header={{
            title: 'OEE-LINIA-PAKOWANIA',
            onTitleChange: () => {},
            artifactId: 'kpi-1',
            artifactType: 'kpi',
            onSave: () => {},
            onClose: () => {},
            statusLabel: isPolish ? 'Aktywny' : 'Active',
            statusTone: 'approved',
            primaryAction: {
              label: { pl: 'Zapisz pomiar', en: 'Record measurement' },
              onClick: () => {},
            },
            extraOverflowItems: [
              {
                id: 'export',
                label: isPolish ? 'Eksportuj' : 'Export',
                icon: History,
                onClick: () => {},
              },
            ],
          }}
          sections={sections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          presentationMode="n"
          onPresentationModeChange={() => {}}
          rightPanel={
            <ArtifactRightPanel
              sections={[
                actionsSection,
                propertiesSection,
                relationsSection,
                commentsSection,
                historySection,
              ]}
              className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
            />
          }
        />
      </div>
    </div>
  );
}
