/**
 * Mock host for <InsightLightShell> — the Insight artifact light shell.
 *
 * Reuses the REAL component (no re-implementation) and feeds it realistic
 * DBR77 interview content shaped like the V6 engine output contracts
 * (InsightViewer.tsx: InsightTheme / InsightIssue / InsightOpportunity /
 * InsightSignal / InsightEvidenceMapEntry) — McKinsey-grade thesis+evidence,
 * not placeholder lorem ipsum (owner note #57).
 */
import React from 'react';

import InsightLightShell, {
  type InsightEvidenceMapEntryLite,
  type InsightIssueLite,
  type InsightOpportunityLite,
  type InsightPropertyLite,
  type InsightSignalLite,
  type InsightSourceLite,
  type InsightThemeLite,
} from '../../src/components/Interview/InsightLightShell';

const THEMES: InsightThemeLite[] = [
  {
    title: 'Wiedza produktowa uwięziona w 3 osobach',
    description:
      'Sześciu na siedmiu rozmówców wskazało, że krytyczna wiedza o konfiguracji maszyn CNC istnieje wyłącznie w głowach dwóch mistrzów zmiany i jednego technologa — brak spisanych procedur, brak backupu przy nieobecności.',
    strength: 'strong',
    confidence: 'high',
    evidenceCount: 9,
    sourceLabel: 'Wywiady: Produkcja, Utrzymanie Ruchu',
  },
  {
    title: 'Dział sprzedaży pracuje na 4 niezsynchronizowanych arkuszach',
    description:
      'Zespół handlowy prowadzi lejek w Excelu równolegle z CRM — dane rozjeżdżają się co tydzień, prognoza sprzedaży różni się między wersjami arkuszy nawet o 15%.',
    strength: 'strong',
    confidence: 'high',
    evidenceCount: 6,
    sourceLabel: 'Wywiady: Sprzedaż',
  },
  {
    title: 'Rosnące oczekiwanie zespołu wobec automatyzacji raportowania',
    description:
      'W czterech rozmowach pojawił się samodzielnie temat „chcielibyśmy, żeby raport generował się sam" — sygnał gotowości zespołu na zmianę, nie tylko presja z góry.',
    strength: 'moderate',
    confidence: 'medium',
    evidenceCount: 4,
    sourceLabel: 'Wywiady: Finanse, Zarząd',
  },
];

const ISSUES: InsightIssueLite[] = [
  {
    title: 'Brak procedury przekazania zmiany na linii produkcyjnej',
    description:
      'Przy zmianie mistrza zmiany nie istnieje formalny protokół przekazania — trzech rozmówców opisało incydenty przestoju spowodowane brakiem informacji o niedokończonej partii.',
    severity: 'high',
    confidence: 'high',
    evidenceCount: 5,
    sourceLabel: 'Wywiady: Produkcja',
  },
  {
    title: 'Reklamacje klientów nie są systematycznie kategoryzowane',
    description:
      'Dział obsługi klienta rejestruje reklamacje w mailu bez wspólnej taksonomii przyczyn — zarząd nie ma widoczności, które defekty się powtarzają.',
    severity: 'medium',
    confidence: 'medium',
    evidenceCount: 3,
    sourceLabel: 'Wywiady: Obsługa Klienta',
  },
  {
    title: 'Plan wdrożenia ERP nie uwzględnia migracji danych historycznych',
    description:
      'Zespół IT potwierdził, że harmonogram wdrożenia nie ma dedykowanego etapu na czyszczenie i migrację 6 lat danych magazynowych.',
    severity: 'low',
    confidence: 'low',
    evidenceCount: 2,
    sourceLabel: 'Wywiady: IT',
  },
];

const OPPORTUNITIES: InsightOpportunityLite[] = [
  {
    title: 'Spisanie procedur konfiguracji CNC jako pierwszy quick win',
    description:
      'Nagranie i spisanie wiedzy dwóch mistrzów zmiany w formie checklisty zredukowałoby ryzyko przestoju i skróciło onboarding nowego operatora z ~6 do ~2 tygodni.',
    impact: 'high',
    confidence: 'high',
    evidenceCount: 7,
    sourceLabel: 'Wywiady: Produkcja, HR',
  },
  {
    title: 'Jeden zsynchronizowany lejek sprzedażowy w CRM',
    description:
      'Konsolidacja 4 arkuszy do jednego źródła prawdy w CRM eliminuje rozbieżności prognozy i daje zarządowi wiarygodny widok pipeline w czasie rzeczywistym.',
    impact: 'high',
    confidence: 'medium',
    evidenceCount: 5,
    sourceLabel: 'Wywiady: Sprzedaż, Zarząd',
  },
  {
    title: 'Automatyczny raport tygodniowy z danych produkcyjnych',
    description:
      'Zespół sam zgłasza gotowość — pilotaż na jednym raporcie (OEE linii 3) zbudowałby zaufanie do dalszej automatyzacji przy niskim koszcie wdrożenia.',
    impact: 'medium',
    confidence: 'medium',
    evidenceCount: 4,
    sourceLabel: 'Wywiady: Finanse, Produkcja',
  },
];

const SIGNALS: InsightSignalLite[] = [
  {
    title: 'Rozbieżność między deklaracją zarządu a odczuciem zespołu produkcji',
    description:
      'Zarząd deklaruje „mamy dobrą dokumentację procesów", operatorzy linii mówią wprost „nic nie jest spisane" — sprzeczność wymaga wyjaśnienia przed publikacją raportu.',
    type: 'contradiction',
  },
  {
    title: 'Napięcie między sprzedażą a produkcją o realność terminów',
    description:
      'Sprzedaż obiecuje terminy klientom bez konsultacji z produkcją — czterokrotnie wspomniane jako źródło frustracji po obu stronach.',
    type: 'tension',
  },
  {
    title: 'Luka w danych o rentowności per klient',
    description:
      'Nikt z rozmówców nie potrafił wskazać, gdzie znaleźć rentowność pojedynczego zlecenia — sygnał, że decyzje cenowe zapadają bez tej informacji.',
    type: 'gap',
  },
  {
    title: 'Pojawiający się wzorzec: młodsi pracownicy sami sięgają po narzędzia AI',
    description:
      'W trzech niezależnych rozmowach (Sprzedaż, Marketing, Finanse) osoby z krótszym stażem wspomniały o samodzielnym testowaniu ChatGPT do swoich zadań — oddolny sygnał gotowości.',
    type: 'emerging_pattern',
  },
];

const EVIDENCE_MAP: InsightEvidenceMapEntryLite[] = [
  {
    questionText: 'Co się dzieje, gdy mistrz zmiany, który zna konfigurację maszyny, jest nieobecny?',
    answerSnippet: '„Wtedy szukamy kogoś, kto pamięta ustawienia. Czasem dzwonimy do niego do domu."',
    linkedThemes: ['Wiedza produktowa uwięziona w 3 osobach'],
    linkedIssues: ['Brak procedury przekazania zmiany na linii produkcyjnej'],
  },
  {
    questionText: 'Jak prowadzicie lejek sprzedażowy na co dzień?',
    answerSnippet: '„Mam swój Excel, szef ma swój, a w CRM wpisuję to raz w miesiącu, jak mam czas."',
    linkedThemes: ['Dział sprzedaży pracuje na 4 niezsynchronizowanych arkuszach'],
    linkedIssues: [],
  },
  {
    questionText: 'Czy zespół sam proponował usprawnienia w raportowaniu?',
    answerSnippet: '„Tak, mówiliśmy, że fajnie by było, żeby to się samo generowało co poniedziałek."',
    linkedThemes: ['Rosnące oczekiwanie zespołu wobec automatyzacji raportowania'],
    linkedIssues: [],
  },
  {
    questionText: 'Jak rejestrujecie reklamacje klientów?',
    answerSnippet: '„Wpadają mailem, odpisujemy, ale nie mamy wspólnej listy powodów."',
    linkedThemes: [],
    linkedIssues: ['Reklamacje klientów nie są systematycznie kategoryzowane'],
  },
];

const PROPERTIES: InsightPropertyLite[] = [
  { label: 'Typ analizy', value: 'Between the lines (V6)' },
  { label: 'Sesje źródłowe', value: '7' },
  { label: 'Tokeny użyte', value: '48 200' },
  { label: 'Czas generowania', value: '38 s' },
  { label: 'Status recenzji', value: 'W przeglądzie' },
];

const SOURCES: InsightSourceLite[] = [
  { label: 'Wywiady: Produkcja', detail: '3 sesje · mistrz zmiany, operator, technolog' },
  { label: 'Wywiady: Sprzedaż', detail: '2 sesje · handlowiec, kierownik sprzedaży' },
  { label: 'Wywiady: Zarząd, Finanse, IT', detail: '2 sesje · CFO, kierownik IT' },
];

export function InsightLightScreen(): React.ReactElement {
  const noop = () => {};
  return (
    <InsightLightShell
      insightTitle="Diagnoza organizacyjna — DBR77 Sp. z o.o."
      analysisTypeLabel="Between the lines"
      status="in_review"
      sourceSessionCount={7}
      themes={THEMES}
      issues={ISSUES}
      opportunities={OPPORTUNITIES}
      signals={SIGNALS}
      evidenceMap={EVIDENCE_MAP}
      properties={PROPERTIES}
      sources={SOURCES}
      lastUpdatedLabel="Zaktualizowano dziś, 11:20 · analiza V6"
      onExportReport={noop}
      onOpenChat={noop}
    />
  );
}

export default InsightLightScreen;
