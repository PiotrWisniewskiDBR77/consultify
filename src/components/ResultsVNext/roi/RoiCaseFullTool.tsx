/**
 * RoiCaseFullTool — JEDNA KARTA N sprawy ROI (klasa L, archetyp Rekord).
 *
 * ── DECYZJA WŁAŚCICIELA (2026-08-30) — DLACZEGO TEN PLIK WYGLĄDA INACZEJ ──
 * Poprzednia wersja tego pliku była cienkim przełącznikiem CZTERECH FAZ
 * (Budowa sprawy → Decyzja → Realizacja wartości → Wnioski), z których każda
 * rysowała własny pełnoekranowy rejestr: okruszki + Menu 2 (podwidoki) +
 * Menu 3 (pigułki faz). Właściciel odrzucił ten układ na trzech ekranach pod
 * rząd:
 *
 *   „ROI to jedna analiza i powinna mieć formułę N-karty. […] to menu, które
 *   teraz masz, już się nie wciśnie — byłoby to czwarte menu, a to byłoby
 *   zupełnie niepotrzebne. […] Każda jedna analiza ROI, łącznie z modelem,
 *   to jest po prostu jedna karta."
 *
 * Zatwierdzona formuła: prototyp `dev-render/screens/roi-jedna-karta.tsx`
 * (ta sama co `wskaznik-jedna-karta` i `cel-jedna-karta`). Przepis powłoki:
 * `dev-render/screens/rn-g3-class-l-record-shell.tsx` — `ArtifactBreadcrumb`
 * + `NModeShell` + `ArtifactRightPanel`, zero nowego standardu.
 *
 * ── CO TO ZMIENIA MECHANICZNIE ────────────────────────────────────────────
 * Pasek faz (Menu 3) PRZESTAJE ISTNIEĆ jako menu — cztery fazy stają się
 * pięcioma sekcjami lewej nawigacji karty, nazwanymi narracją właściciela
 * (`RoiCaseCardSections.ts`). Menu 2 zostaje rzędem zakładek WEWNĄTRZ sekcji.
 * Zamiast trzech pasków menu jest jeden pasek tożsamości (Menu 1) + jeden
 * rząd zakładek. Cztery warsztaty (`RoiCaseModelWorkspace`,
 * `RoiCaseDecisionWorkspace`, `RoiCaseRealizeValueWorkspace`,
 * `RoiCaseLearnWorkspace`) renderują DOKŁADNIE tę samą treść co dotąd —
 * dostają tylko `cardMode` i oddają sterowanie zakładką karcie. Ani jedna
 * tabela, modal, mutacja czy blokada cyklu życia nie została przepisana.
 *
 * ŻADEN PODWIDOK NIE ZNIKNĄŁ: 16 zakładek czterech warsztatów jest wypisane
 * w `ROI_CARD_SECTIONS`; siedemnasty (`pir-outcome`) to trzeci odrzucony
 * ekran — `RoiPirOutcomesTab` zawężony do TEJ sprawy, postawiony obok `pir`
 * w sekcji „Wnioski i rekomendacja".
 *
 * ── CZEGO ŚWIADOMIE NIE MA ────────────────────────────────────────────────
 * Menu 1 nie dostaje wymyślonego przycisku głównego. Przejścia cyklu życia
 * (submit/approve/reject/…) mają JEDNĄ implementację — kebab wiersza w
 * `ResultsRoiHub.tsx` — i decyzja „nie robimy drugiej kopii" obowiązuje dalej
 * (była w nagłówku poprzedniej wersji tego pliku). Jedyny primary widoczny
 * naraz to `primaryCta` paska zakładek bieżącego podwidoku („Nowe założenie",
 * „Opublikuj prognozę", „Zaplanuj przegląd"…), który już istniał i działa.
 * Prawy panel pokazuje TYLKO to, co ROI API naprawdę zwraca; sekcje bez
 * źródła danych (Komentarze, Historia) są jawnie puste, a nie zmyślone.
 */
import { ExternalLink, FileText, History as HistoryIcon, Link2, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { ArtifactBreadcrumb } from '@/components/standard/ArtifactBreadcrumb';
import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import type { NModeSection } from '@/components/shared/NModeLayout';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';

import type { RoiCaseListItem } from './roiApi';
import { RoiCaseModelWorkspace } from './RoiCaseModelWorkspace';
import { RoiCaseDecisionWorkspace } from './RoiCaseDecisionWorkspace';
import { RoiCaseRealizeValueWorkspace } from './RoiCaseRealizeValueWorkspace';
import { RoiCaseLearnWorkspace } from './RoiCaseLearnWorkspace';
import { RoiPirOutcomesTab } from './RoiPirOutcomesTab';
import {
  ROI_CARD_SECTIONS,
  ROI_PHASE_ENTRY_SECTION,
  buildRoiCardSectionTabs,
  getRoiCardSection,
  type RoiCardSectionDef,
} from './RoiCaseCardSections';
import type { RoiCasePhase } from './RoiCasePhaseNav';
import {
  ROI_STATUS_TONE,
  formatRoiDate,
  getRoiCaseLockInfo,
  humanizeActionType,
  roiGranularityLabel,
  roiStatusLabel,
} from './roiRegistryMappers';

export interface RoiCaseFullToolProps {
  roiCase: RoiCaseListItem;
  isPolish: boolean;
  onBack: () => void;
  /** Optional — pozwala wołającemu (m.in. harnessowi dev-render) wskazać
   * fazę startową adresem. Kontrakt bez zmian: faza mapuje się teraz na
   * sekcję wejściową karty (`ROI_PHASE_ENTRY_SECTION`). */
  initialPhase?: RoiCasePhase;
}

/**
 * Ton pigułki statusu Menu 1. `ROI_STATUS_TONE` ma pięć wartości domenowych,
 * `NModeHeader` — pięć powłokowych. Mapowanie jest jawne, żeby żaden status
 * nie wpadł po cichu na `neutral`; `warning` idzie na `review`, bo powłoka nie
 * ma tonu ostrzegawczego, a `review` to jedyny ton „coś czeka na człowieka".
 */
const STATUS_TONE_TO_HEADER: Record<
  (typeof ROI_STATUS_TONE)[keyof typeof ROI_STATUS_TONE],
  'draft' | 'review' | 'approved' | 'rejected' | 'neutral'
> = {
  neutral: 'neutral',
  info: 'review',
  warning: 'review',
  success: 'approved',
  danger: 'rejected',
};

export const RoiCaseFullTool: React.FC<RoiCaseFullToolProps> = ({ roiCase, isPolish, onBack, initialPhase = 'build' }) => {
  const [activeSection, setActiveSection] = useState<string>(ROI_PHASE_ENTRY_SECTION[initialPhase]);
  /** Aktywny podwidok per sekcja — przełączenie sekcji nie gubi zakładki,
   * na której użytkownik był poprzednio (ta sama zasada co w warsztatach,
   * które trzymały własny `tab` przez cały czas życia fazy). */
  const [tabBySection, setTabBySection] = useState<Record<string, string>>({});

  const section: RoiCardSectionDef = getRoiCardSection(activeSection) ?? ROI_CARD_SECTIONS[0];
  const activeTab = tabBySection[section.id] ?? section.subviews[0].id;
  const subview = section.subviews.find((v) => v.id === activeTab) ?? section.subviews[0];

  const cardMode = useMemo(
    () => ({
      tabs: buildRoiCardSectionTabs(section, isPolish),
      activeTab,
      onTabChange: (id: string) => setTabBySection((prev) => ({ ...prev, [section.id]: id })),
    }),
    [section, isPolish, activeTab]
  );

  /** Treść centrum = warsztat właściciela bieżącego podwidoku, w trybie karty.
   * Fazy `phase`/`onPhaseChange` zostają w sygnaturach warsztatów (inni
   * wołający ich używają), ale w trybie karty są martwe — pasek faz się nie
   * renderuje. */
  const canvas = (() => {
    const shared = { roiCase, isPolish, onBack, onPhaseChange: () => undefined, cardMode };
    switch (subview.phase) {
      case 'decision':
        return <RoiCaseDecisionWorkspace {...shared} phase="decision" />;
      case 'realize':
        return <RoiCaseRealizeValueWorkspace {...shared} phase="realize" />;
      case 'learn':
        return <RoiCaseLearnWorkspace {...shared} phase="learn" />;
      case 'pir-outcome':
        return <RoiPirOutcomesTab isPolish={isPolish} onlyCaseId={roiCase.caseId} cardMode={cardMode} />;
      default:
        return <RoiCaseModelWorkspace {...shared} phase="build" />;
    }
  })();

  /** Lewa nawigacja — pięć sekcji narracji. Licznik przy sekcji to UCZCIWA
   * liczba podwidoków, które sekcja niesie (fakt strukturalny), nigdy
   * podrobiona miara biznesowa — ta sama zasada, którą niósł
   * `ROI_PHASE_SUBVIEW_COUNT` w pasku faz. */
  const sections: NModeSection[] = ROI_CARD_SECTIONS.map((s) => ({
    id: s.id,
    icon: SECTION_ICON[s.id],
    label: { pl: s.label.pl, en: s.label.en },
    badge: s.subviews.length,
    component: s.id === section.id ? <div className="h-full min-h-0">{canvas}</div> : null,
  }));

  const rightPanelSections = buildRoiCardRightPanel(roiCase, isPolish);

  return (
    <div className="flex h-full min-h-0 flex-col bg-c-bg" data-testid="roi-case-card">
      <ArtifactBreadcrumb
        items={[
          { label: isPolish ? 'Rejestr ROI' : 'ROI registry', onClick: onBack },
          { label: roiCase.title },
        ]}
      />
      <div className="min-h-0 flex-1">
        <NModeShell
          presentationMode="n"
          onPresentationModeChange={() => undefined}
          showModeSwitcher={false}
          hideToolbarWhenEmpty
          header={{
            sticky: true,
            title: roiCase.title,
            onTitleChange: () => undefined,
            titleReadOnly: true,
            artifactId: roiCase.caseId,
            artifactType: 'analysis',
            onSave: () => undefined,
            /** Karta nie jest edytorem pola-po-polu — zapis dzieje się w
             * modalach podwidoków, które mają własne stany zapisu. Wskaźnik
             * zapisu Menu 1 byłby tu kłamstwem, więc go gasimy. */
            hideSaveState: true,
            onClose: onBack,
            statusLabel: roiStatusLabel(roiCase.status, isPolish),
            statusTone: STATUS_TONE_TO_HEADER[ROI_STATUS_TONE[roiCase.status]],
          }}
          sections={sections}
          activeSection={section.id}
          onSectionChange={setActiveSection}
          rightPanel={
            <ArtifactRightPanel
              sections={rightPanelSections}
              className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
              ariaLabel={isPolish ? 'Szczegóły sprawy ROI' : 'ROI case details'}
            />
          }
        />
      </div>
    </div>
  );
};

const SECTION_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
  zalozenia: FileText,
  model: Sparkles,
  wynik: ShieldCheck,
  'wyniki-po-wdrozeniu': ExternalLink,
  wnioski: FileText,
};

/**
 * Prawy panel — kolejność kanonu `ARTIFACT_PANEL_SECTION_ORDER`
 * (Akcje · Właściwości · Powiązania · Źródła i założenia · Komentarze ·
 * Historia). Wypełniony WYŁĄCZNIE tym, co `RoiCaseListItem` naprawdę niesie;
 * reszta jest jawnie pusta, bo ROI API nie ma dziś ani komentarzy, ani dziennika
 * zdarzeń sprawy (sprawdzone w `roiApi.ts` — zero takich endpointów).
 */
function buildRoiCardRightPanel(roiCase: RoiCaseListItem, isPolish: boolean): ArtifactRightPanelSection[] {
  const lock = getRoiCaseLockInfo(roiCase.status);
  const lockReason = lock ? (isPolish ? lock.reason.pl : lock.reason.en) : null;

  return [
    {
      id: 'actions',
      label: isPolish ? 'Akcje' : 'Actions',
      icon: ShieldCheck,
      defaultOpen: true,
      children: (
        <div className="flex flex-col gap-2 text-xs leading-relaxed text-c-text-secondary">
          {lockReason ? (
            <p data-testid="roi-card-lock-note">
              <span className="font-medium text-c-text">{isPolish ? 'Sprawa zablokowana do edycji.' : 'Case locked for editing.'}</span>{' '}
              {lockReason}
            </p>
          ) : (
            <p>
              {isPolish
                ? 'Działania na danych sprawy znajdziesz w pasku zakładek bieżącej sekcji.'
                : 'Data actions live in the tab bar of the current section.'}
            </p>
          )}
          <p>
            {isPolish
              ? 'Przejścia cyklu życia (zgłoszenie, akceptacja, odrzucenie) wykonuje się z menu wiersza w rejestrze ROI — jest tam jedna implementacja, bez kopii w karcie.'
              : 'Lifecycle transitions (submit, approve, reject) run from the row menu in the ROI registry — one implementation, no copy in the card.'}
          </p>
        </div>
      ),
    },
    {
      id: 'properties',
      label: isPolish ? 'Właściwości' : 'Properties',
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          propertyLabel={isPolish ? 'Właściwość' : 'Property'}
          valueLabel={isPolish ? 'Wartość' : 'Value'}
          rows={[
            { id: 'caseId', label: isPolish ? 'Numer sprawy' : 'Case id', value: roiCase.caseId, mono: true },
            { id: 'status', label: 'Status', value: roiStatusLabel(roiCase.status, isPolish) },
            { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: roiCase.ownerUserId },
            { id: 'currency', label: isPolish ? 'Waluta' : 'Currency', value: roiCase.currency },
            { id: 'granularity', label: isPolish ? 'Ziarno analizy' : 'Granularity', value: roiGranularityLabel(roiCase.granularity, isPolish) },
            {
              id: 'window',
              label: isPolish ? 'Okres analizy' : 'Analysis window',
              value:
                roiCase.analysisStart || roiCase.analysisEnd
                  ? `${formatRoiDate(roiCase.analysisStart, isPolish)} – ${formatRoiDate(roiCase.analysisEnd, isPolish)}`
                  : isPolish
                    ? 'Nie ustalono'
                    : 'Not set',
            },
            {
              id: 'nextAction',
              label: isPolish ? 'Następny krok' : 'Next action',
              value: roiCase.nextActionType
                ? `${humanizeActionType(roiCase.nextActionType, isPolish)} · ${formatRoiDate(roiCase.nextActionDueAt, isPolish)}`
                : isPolish
                  ? 'Brak'
                  : 'None',
            },
            { id: 'nextReview', label: isPolish ? 'Następny przegląd' : 'Next review', value: formatRoiDate(roiCase.nextReviewAt, isPolish), mono: true },
            { id: 'updatedAt', label: isPolish ? 'Ostatnia aktualizacja' : 'Last updated', value: formatRoiDate(roiCase.updatedAt, isPolish), mono: true },
          ]}
        />
      ),
    },
    {
      id: 'relations',
      label: isPolish ? 'Powiązania' : 'Relations',
      icon: Link2,
      defaultOpen: false,
      badge: roiCase.initiativeId ? 1 : 0,
      isEmpty: !roiCase.initiativeId,
      emptyLabel: isPolish ? 'Brak powiązań' : 'No relations',
      children: roiCase.initiativeId ? (
        <ul className="flex flex-col gap-1.5 text-xs text-c-text-secondary">
          <li>
            <span className="font-medium text-c-text">{isPolish ? 'Inicjatywa' : 'Initiative'}</span> — {roiCase.initiativeId}
          </li>
        </ul>
      ) : null,
    },
    {
      id: 'evidence',
      label: isPolish ? 'Źródła i założenia' : 'Sources & assumptions',
      icon: FileText,
      defaultOpen: false,
      children: (
        <p className="text-xs leading-relaxed text-c-text-secondary">
          {isPolish
            ? 'Baseline, polityka kalkulacji i pełna lista założeń tej sprawy mieszkają w sekcji „Założenia" tej karty — panel nie duplikuje ich, żeby istniała jedna wersja prawdy.'
            : 'Baseline, calculation policy and the full assumption list live in this card’s "Assumptions" section — the panel does not duplicate them, so there is one version of the truth.'}
        </p>
      ),
    },
    {
      id: 'comments',
      label: isPolish ? 'Komentarze' : 'Comments',
      icon: MessageSquare,
      defaultOpen: false,
      isEmpty: true,
      emptyLabel: isPolish ? 'ROI nie ma dziś komentarzy sprawy' : 'ROI has no case comments yet',
      children: null,
    },
    {
      id: 'history',
      label: isPolish ? 'Historia' : 'History',
      icon: HistoryIcon,
      defaultOpen: false,
      isEmpty: true,
      emptyLabel: isPolish ? 'ROI nie ma dziś dziennika zdarzeń sprawy' : 'ROI has no case activity log yet',
      children: null,
    },
  ];
}

export default RoiCaseFullTool;
