/**
 * Mock host for <InterviewLightShell> — the Interview module light shell.
 *
 * Reuses the REAL component (no re-implementation) and feeds it realistic
 * DBR77 scale-up interview-cycle data shaped exactly like the engine output
 * contracts:
 *   - sessions: rubric shape of `INTERVIEW_RUBRIC_CRITERIA`
 *     (server/src/controllers/InterviewController.ts #48a) — 5 criteria,
 *     0-4 each, 0-20 total, with an overall verdict.
 *   - assignments: inbox rows (assignee, due date, status).
 *   - insights: distilled findings with confidence + evidence count.
 */
import React from 'react';

import InterviewLightShell, {
  type InterviewAssignmentLite,
  type InterviewInsightLite,
  type InterviewSessionLite,
} from '../../src/components/Interview/InterviewLightShell';

const SESSIONS: InterviewSessionLite[] = [
  {
    id: 'sess-1',
    title: 'Sprzedaż i pipeline — dyrektor handlowy',
    respondent: 'Marek Kowalczyk · Dyrektor Sprzedaży',
    status: 'submitted',
    archived: false,
    updatedAtLabel: 'Złożono wczoraj, 18:12',
    questionsAnswered: 18,
    questionsTotal: 18,
    overallVerdict: 'ready_for_approval',
    rubric: [
      { criterion: 'concreteness', score: 4, justification: 'Podaje liczby leadów, konwersję i nazwane etapy pipeline.' },
      { criterion: 'evidence', score: 3, justification: 'Cytuje CRM (HubSpot) jako źródło, bez zrzutu ekranu.' },
      { criterion: 'depth', score: 4, justification: 'Wyjaśnia przyczynę spadku konwersji Q2 (zmiana ICP).' },
      { criterion: 'measurability', score: 4, justification: 'Konwersja 18% → 12%, cykl sprzedaży 42 dni.' },
      { criterion: 'coherence', score: 4, justification: 'Odpowiedzi trzymają się pytań, brak sprzeczności.' },
    ],
  },
  {
    id: 'sess-2',
    title: 'Procesy operacyjne — magazyn centralny',
    respondent: 'Anna Zielińska · Kierownik Operacji',
    status: 'in_progress',
    archived: false,
    updatedAtLabel: 'Edytowano dziś, 09:40',
    questionsAnswered: 11,
    questionsTotal: 20,
    overallVerdict: 'needs_improvement',
    rubric: [
      { criterion: 'concreteness', score: 2, justification: 'Głównie ogólniki ("staramy się dowozić na czas").' },
      { criterion: 'evidence', score: 1, justification: 'Brak odwołania do systemu WMS lub raportu.' },
      { criterion: 'depth', score: 2, justification: 'Krótkie odpowiedzi bez wyjaśnienia mechanizmu.' },
      { criterion: 'measurability', score: 2, justification: 'Jedna liczba (OTIF ~85%) bez okresu odniesienia.' },
      { criterion: 'coherence', score: 3, justification: 'Na temat, ale niepełne.' },
    ],
  },
  {
    id: 'sess-3',
    title: 'Finanse i kontroling — CFO',
    respondent: 'Piotr Nowak · CFO',
    status: 'approved',
    archived: false,
    updatedAtLabel: 'Zatwierdzono 3 dni temu',
    questionsAnswered: 22,
    questionsTotal: 22,
    overallVerdict: 'ready_for_approval',
    rubric: [
      { criterion: 'concreteness', score: 4 },
      { criterion: 'evidence', score: 4 },
      { criterion: 'depth', score: 3 },
      { criterion: 'measurability', score: 4 },
      { criterion: 'coherence', score: 4 },
    ],
  },
  {
    id: 'sess-4',
    title: 'Kultura i ludzie — HR Business Partner',
    respondent: 'Katarzyna Wójcik · HRBP',
    status: 'sent_back',
    archived: false,
    updatedAtLabel: 'Odesłano 2 dni temu',
    questionsAnswered: 14,
    questionsTotal: 16,
    overallVerdict: 'insufficient',
    rubric: [
      { criterion: 'concreteness', score: 1 },
      { criterion: 'evidence', score: 0 },
      { criterion: 'depth', score: 1 },
      { criterion: 'measurability', score: 1 },
      { criterion: 'coherence', score: 2 },
    ],
  },
  {
    id: 'sess-5',
    title: 'Technologia i dane — CTO',
    respondent: 'Tomasz Lis · CTO',
    status: 'assigned',
    archived: false,
    updatedAtLabel: 'Przypisano tydzień temu',
    questionsAnswered: 0,
    questionsTotal: 19,
    overallVerdict: 'empty',
    rubric: [
      { criterion: 'concreteness', score: 0 },
      { criterion: 'evidence', score: 0 },
      { criterion: 'depth', score: 0 },
      { criterion: 'measurability', score: 0 },
      { criterion: 'coherence', score: 0 },
    ],
  },
  {
    id: 'sess-6',
    title: 'Strategia i konkurencja — CEO (Q1 2026)',
    respondent: 'Jan Kaczmarek · CEO',
    status: 'completed',
    archived: true,
    updatedAtLabel: 'Zakończono 4 miesiące temu',
    questionsAnswered: 24,
    questionsTotal: 24,
    overallVerdict: 'ready_for_approval',
    rubric: [
      { criterion: 'concreteness', score: 4 },
      { criterion: 'evidence', score: 3 },
      { criterion: 'depth', score: 4 },
      { criterion: 'measurability', score: 3 },
      { criterion: 'coherence', score: 4 },
    ],
  },
  {
    id: 'sess-7',
    title: 'Marketing i marka — Head of Marketing (Q1 2026)',
    respondent: 'Ewa Sobczak · Head of Marketing',
    status: 'completed',
    archived: true,
    updatedAtLabel: 'Zakończono 4 miesiące temu',
    questionsAnswered: 17,
    questionsTotal: 17,
    overallVerdict: 'needs_improvement',
    rubric: [
      { criterion: 'concreteness', score: 3 },
      { criterion: 'evidence', score: 2 },
      { criterion: 'depth', score: 3 },
      { criterion: 'measurability', score: 2 },
      { criterion: 'coherence', score: 3 },
    ],
  },
];

const ASSIGNMENTS: InterviewAssignmentLite[] = [
  {
    id: 'as-1',
    title: 'Technologia i dane — CTO',
    assignee: 'Tomasz Lis',
    dueLabel: 'Termin: jutro',
    overdue: false,
    status: 'assigned',
  },
  {
    id: 'as-2',
    title: 'Procesy operacyjne — magazyn centralny',
    assignee: 'Anna Zielińska',
    dueLabel: 'Termin: za 3 dni',
    overdue: false,
    status: 'in_progress',
  },
  {
    id: 'as-3',
    title: 'Kultura i ludzie — HR Business Partner',
    assignee: 'Katarzyna Wójcik',
    dueLabel: 'Termin minął 2 dni temu',
    overdue: true,
    status: 'sent_back',
  },
  {
    id: 'as-4',
    title: 'Łańcuch dostaw — Head of Supply Chain',
    assignee: 'Rafał Duda',
    dueLabel: 'Termin minął 5 dni temu',
    overdue: true,
    status: 'assigned',
  },
  {
    id: 'as-5',
    title: 'Sprzedaż i pipeline — dyrektor handlowy',
    assignee: 'Marek Kowalczyk',
    dueLabel: 'Złożono, czeka na przegląd',
    overdue: false,
    status: 'submitted',
  },
];

const INSIGHTS: InterviewInsightLite[] = [
  {
    id: 'ins-1',
    title: 'Konwersja pipeline spadła z 18% do 12% po zmianie ICP w Q2',
    category: 'Sprzedaż',
    summary:
      'Zespół sprzedaży zmienił profil klienta docelowego bez rewalidacji lejka — nowy ICP generuje więcej leadów, ale niższą jakość. Wymaga rekalibracji kryteriów kwalifikacji.',
    confidencePct: 88,
    evidenceCount: 3,
    sourceSessionTitle: 'Sprzedaż i pipeline — dyrektor handlowy',
  },
  {
    id: 'ins-2',
    title: 'OTIF magazynu ok. 85%, ale bez rozbicia na przyczyny opóźnień',
    category: 'Operacje',
    summary:
      'Wskaźnik terminowości dostaw podano bez segmentacji (dostawca vs. transport vs. kompletacja) — potrzebny dowód źródłowy z WMS przed wpisaniem do raportu jako fakt.',
    confidencePct: 42,
    evidenceCount: 1,
    sourceSessionTitle: 'Procesy operacyjne — magazyn centralny',
  },
  {
    id: 'ins-3',
    title: 'Marża EBITDA 24,6% powyżej mediany sektora (18-21%)',
    category: 'Finanse',
    summary:
      'CFO potwierdził liczbę z audytowanego sprawozdania FY2025 i podał źródło porównania sektorowego (raport branżowy Q4 2025).',
    confidencePct: 94,
    evidenceCount: 4,
    sourceSessionTitle: 'Finanse i kontroling — CFO',
  },
  {
    id: 'ins-4',
    title: 'Rotacja w zespole operacyjnym niezmierzona — sygnał jakościowy tylko',
    category: 'Ludzie',
    summary:
      'Odpowiedź HRBP nie zawierała liczby ani okresu odniesienia — sesja odesłana do uzupełnienia przed użyciem w raporcie.',
    confidencePct: 21,
    evidenceCount: 0,
    sourceSessionTitle: 'Kultura i ludzie — HR Business Partner',
  },
];

const LINEAGE_SOURCES = [
  { label: 'Rubryka oceny', detail: 'INTERVIEW_RUBRIC_CRITERIA · wersja oxford-v1 · 5 kryteriów × 0-4' },
  { label: 'Cykl wywiadów', detail: 'DBR77 FY2026 · 7 sesji · 5 respondentów C-level/HRBP' },
];

export function InterviewLightScreen(): React.ReactElement {
  const noop = () => {};
  return (
    <InterviewLightShell
      cycleName="Cykl wywiadów DBR77 · FY2026"
      sessions={SESSIONS}
      assignments={ASSIGNMENTS}
      insights={INSIGHTS}
      lineageSources={LINEAGE_SOURCES}
      lastUpdatedLabel="Zaktualizowano dziś, 09:40 · sesja Anna Zielińska"
      onNewSession={noop}
      onOpenChat={noop}
    />
  );
}

export default InterviewLightScreen;
