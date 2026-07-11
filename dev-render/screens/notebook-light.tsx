/**
 * Mock host for <NotebookLightShell> — the Notebook module light shell.
 *
 * Reuses the REAL component (no re-implementation) and feeds it realistic
 * DBR77 scale-up notes shaped like the real Notebook data (maturity/
 * verification/tags/blocks/sources/convertedTo) — same split as
 * `finance-light.tsx` vs `FinanceLightShell.tsx`.
 */
import React from 'react';

import NotebookLightShell, {
  type NotebookLightNoteLite,
} from '../../src/components/MyWork/NotebookLightShell';

const NOTES: NotebookLightNoteLite[] = [
  {
    id: 'n1',
    title: 'Rentowność Segmentu B spada trzeci kwartał z rzędu',
    maturity: 'mature',
    verification: 'verified',
    pinned: true,
    tags: ['finanse', 'segment-b', 'insight'],
    updatedLabel: '12 min temu',
    summary: 'Marża EBITDA Segmentu B: 24,6% → 19,1% w 3 kwartały.',
    blocks: [
      { type: 'heading', level: 1, text: 'Obserwacja' },
      {
        type: 'paragraph',
        text: 'Segment B (usługi wdrożeniowe) traci marżę mimo stabilnego przychodu — koszt dostawy rośnie szybciej niż cena kontraktowa. To trzeci kwartał spadku z rzędu.',
      },
      { type: 'heading', level: 2, text: 'Dane źródłowe' },
      {
        type: 'bullet',
        items: [
          'Marża EBITDA Segmentu B: Q4 2025 = 24,6%, Q1 2026 = 22,0%, Q2 2026 = 19,1%',
          'Utilizacja konsultantów spadła z 78% do 69%',
          'Rotacja zespołu wdrożeniowego: 3 odejścia w Q2 (senior PM ×2)',
        ],
      },
      { type: 'heading', level: 2, text: 'Hipoteza' },
      {
        type: 'paragraph',
        text: 'Utrata dwóch senior PM wymusiła przesunięcie juniorów do ról wymagających więcej nadgodzin i korekt — stąd rosnący koszt dostawy przy tej samej cenie kontraktowej.',
      },
    ],
    sources: [
      { label: 'Pakiet sprawozdań', detail: 'Import Excel · DBR77_FY2025_statements.xlsx' },
      { label: 'Rozmowa', detail: 'QBR Segment B · 2026-07-08 · Fireflies' },
    ],
    convertedTo: [{ type: 'Insight' }],
    backlinksCount: 3,
    pendingAIProposals: 1,
  },
  {
    id: 'n2',
    title: 'Ryzyko: churn Klienta X w Q3',
    maturity: 'growing',
    verification: 'disputed',
    pinned: true,
    tags: ['ryzyko', 'klient-x'],
    updatedLabel: '1 godz. temu',
    summary: 'NPS spadł z 42 do 18 po incydencie SLA w maju.',
    blocks: [
      { type: 'heading', level: 1, text: 'Sygnały ostrzegawcze' },
      {
        type: 'bullet',
        items: [
          'NPS Klienta X: 42 (styczeń) → 18 (czerwiec)',
          'Sponsor projektu zmienił się dwukrotnie w 2026',
          '2 eskalacje SLA w maju, jedna nierozwiązana >14 dni',
        ],
      },
      {
        type: 'paragraph',
        text: 'Zespół sprzedaży twierdzi, że renewal jest "pewny" — dane z operacji mówią co innego. Stąd status "zakwestionowana": potrzebujemy rozmowy z klientem przed decyzją o eskalacji do zarządu.',
      },
    ],
    sources: [{ label: 'CRM', detail: 'HubSpot · konto Klient X · eksport 2026-07-10' }],
    convertedTo: [],
    backlinksCount: 1,
  },
  {
    id: 'n3',
    title: 'Notatki ze spotkania Zarządu — 2026-07-09',
    maturity: 'seed',
    verification: 'unverified',
    tags: ['zarząd', 'spotkanie'],
    updatedLabel: 'wczoraj',
    blocks: [
      { type: 'heading', level: 1, text: 'Decyzje' },
      {
        type: 'bullet',
        items: [
          'Zatwierdzono budżet na automatyzację onboardingu (180k PLN)',
          'Wstrzymano rekrutację na Segment B do wyjaśnienia marży',
        ],
      },
      { type: 'heading', level: 1, text: 'Otwarte pytania' },
      { type: 'paragraph', text: 'Kto przejmuje relację z Klientem X po odejściu PM? Do ustalenia do piątku.' },
    ],
    sources: [{ label: 'Nagranie', detail: 'Fireflies · Zarząd 2026-07-09 · 47 min' }],
    convertedTo: [{ type: 'Decision' }, { type: 'Task' }],
  },
  {
    id: 'n4',
    title: 'Obserwacja: onboarding wymaga automatyzacji',
    maturity: 'growing',
    verification: 'verified',
    tags: ['proces', 'onboarding'],
    updatedLabel: '2 dni temu',
    summary: 'Ręczny onboarding = 6,5 dnia roboczego na klienta.',
    blocks: [
      {
        type: 'paragraph',
        text: 'Śledziliśmy 8 ostatnich onboardingów — ręczny proces zajmuje średnio 6,5 dnia roboczego, z czego 40% to powtarzalne kroki administracyjne (zakładanie kont, konfiguracja szablonów).',
      },
      { type: 'heading', level: 2, text: 'Rekomendacja' },
      { type: 'paragraph', text: 'Zautomatyzować kroki 1-4 checklisty — szacowana oszczędność 2,5 dnia na klienta.' },
    ],
    sources: [],
    convertedTo: [{ type: 'Initiative' }],
    backlinksCount: 2,
  },
  {
    id: 'n5',
    title: 'Meeting notes: QBR Q2 z Radą Nadzorczą',
    maturity: 'mature',
    verification: 'verified',
    tags: ['qbr', 'rada-nadzorcza'],
    updatedLabel: '5 dni temu',
    blocks: [
      { type: 'heading', level: 1, text: 'Podsumowanie' },
      {
        type: 'paragraph',
        text: 'Przychód Q2 zgodny z planem (+2,1%), EBITDA poniżej planu (-3,4 pp) głównie przez Segment B. Rada poprosiła o plan naprawczy do końca lipca.',
      },
    ],
    sources: [{ label: 'Prezentacja', detail: 'QBR_Q2_2026.pptx · wersja finalna' }],
    convertedTo: [{ type: 'Report' }],
  },
];

export function NotebookLightScreen(): React.ReactElement {
  const noop = () => {};
  return (
    <NotebookLightShell
      notebookName="Notatki DBR77"
      notes={NOTES}
      initialActiveNoteId="n1"
      onAskAI={noop}
      onConvert={noop}
      onExpandDocument={noop}
      onVersionHistory={noop}
      onDeleteNote={noop}
      onNewNote={noop}
    />
  );
}

export default NotebookLightScreen;
