/**
 * Dev-render host ETAPU 3 standardu n-Type — panel „Analizuj z AI".
 *
 * PO CO (CLAUDE.md #7): właściciel NIGDY nie jest pierwszym testerem
 * wizualnym. Ten harness montuje PRAWDZIWY `NCardAIAnalysisPanel` i PRAWDZIWY
 * `NModeMenu2` z `Menu2AIButton` — bez logowania, bez backendu, bez bazy —
 * na deterministycznym wyniku analizy, żeby zrzut dało się zrobić przed
 * pokazaniem czegokolwiek Piotrowi.
 *
 * DLACZEGO MOCK WYNIKU, A NIE ŻYWE WYWOŁANIE: panel dostaje `CardAnalysisResult`
 * jako prop — nie woła sam LLM-a. Podanie gotowego wyniku sprawdza DOKŁADNIE
 * to, co ma sprawdzić zrzut (cztery szuflady, kolejność, akcje na zmianie,
 * różnica przed/po, stany zastosowano/odrzucono, blokada „Zastosuj" gdy pole
 * nie jest zapisywalne), a nie kondycję klucza API.
 *
 * URL: ?screen=ntype-analizuj-ai[&theme=light|dark][&lang=pl|en]
 */
import React, { useState } from 'react';

import { NCardAIAnalysisPanel } from '../../src/components/shared/NModeLayout/NCardAIAnalysisPanel';
import {
  Menu2AIButton,
  Menu2HowToButton,
  NModeMenu2,
} from '../../src/components/shared/NModeLayout/NModeMenu2';
import type { CardAnalysisChange, CardAnalysisResult } from '../../src/services/cardAnalysis';

const MOCK: CardAnalysisResult = {
  artifactType: 'task',
  cardId: 'description-scope',
  cardLabel: 'Opis i zakres',
  completeness: 46,
  verdict:
    'Karta opisuje CO robimy, ale nie mówi KIEDY jest zrobiona — bez kryteriów akceptacji zadania nie da się odebrać.',
  generatedAt: '2026-07-23T10:00:00.000Z',
  gaps: [
    {
      id: 'gap-0',
      title: 'Brak kryteriów akceptacji',
      detail:
        'Karta nie zawiera ani jednego warunku, po którym odbierający pozna, że zadanie jest ukończone.',
      criterionId: 'acceptance-criteria',
      severity: 'high',
    },
    {
      id: 'gap-1',
      title: 'Zakres bez wyłączeń',
      detail:
        'Opis mówi co wchodzi, nie mówi co świadomie NIE wchodzi — to najczęstsze źródło sporu przy odbiorze.',
      criterionId: 'scope-clarity',
      severity: 'medium',
    },
  ],
  risks: [
    {
      id: 'risk-0',
      title: 'Rezultat opisany jako czynność, nie stan końcowy',
      detail:
        '„Analiza kosztów magazynu" to praca do wykonania, nie wynik. Bez liczby, jednostki i kierunku zmiany nie da się stwierdzić, czy cel osiągnięto.',
      criterionId: 'description-completeness',
      severity: 'high',
    },
    {
      id: 'risk-1',
      title: 'Niespójność z decyzją źródłową',
      detail:
        'Decyzja źródłowa zawęża zakres do jednego zakładu, a opis zadania mówi o „obu lokalizacjach".',
      criterionId: 'source-decision-consistency',
      severity: 'medium',
    },
  ],
  suggestions: [
    {
      id: 'sug-0',
      title: 'Dopisz warunek brzegowy dla danych wejściowych',
      detail: 'Wskaż, z jakiego okresu pochodzą dane i co robimy, gdy są niekompletne.',
      criterionId: 'scope-clarity',
      severity: 'low',
    },
  ],
  changes: [
    {
      id: 'chg-0',
      fieldId: 'expectedOutcome',
      fieldLabel: 'Oczekiwany rezultat',
      rationale: 'Zamiana czynności na mierzalny stan końcowy (kryterium: kompletność opisu).',
      currentValue: 'Analiza kosztów magazynu',
      proposedValue:
        'Ranking 3 pozycji kosztowych magazynu gotowy, z udziałem % w koszcie całkowitym (szacunek: dane z 12 miesięcy, do walidacji z controllingiem).',
      mode: 'replace',
      severity: 'high',
      criterionId: 'description-completeness',
    },
    {
      id: 'chg-1',
      fieldId: 'description',
      fieldLabel: 'Opis i zakres',
      rationale: 'Uzupełnienie brakujących wyłączeń zakresu.',
      currentValue:
        'Przegląd kosztów magazynowania w obu lokalizacjach, z rekomendacją obszarów do optymalizacji.',
      proposedValue: 'Poza zakresem: koszty transportu zewnętrznego oraz umowy najmu powierzchni.',
      mode: 'append',
      severity: 'medium',
      criterionId: 'scope-clarity',
    },
    {
      id: 'chg-2',
      // Celowo pole SPOZA listy zapisywalnych — sprawdzamy, że panel pokazuje
      // uczciwy powód i „Kopiuj treść" zamiast martwego „Zastosuj".
      fieldId: 'evidence-readonly',
      fieldLabel: 'Dowody',
      rationale: 'Dowód odbioru powinien być wskazany zanim zadanie ruszy.',
      proposedValue: 'Protokół odbioru podpisany przez kierownika magazynu.',
      currentValue: '',
      mode: 'append',
      severity: 'low',
      criterionId: 'evidence-completeness',
    },
  ],
};

/** Pola zapisywalne karty — `evidence-readonly` świadomie POZA listą. */
const WRITABLE = ['description', 'expectedOutcome'];

export default function NTypeAnalizujAiScreen(): React.ReactElement {
  const isPolish = new URLSearchParams(window.location.search).get('lang') !== 'en';
  const [open, setOpen] = useState(true);
  const [readMode, setReadMode] = useState(false);
  const [applied, setApplied] = useState<string[]>([]);

  const handleApply = (change: CardAnalysisChange): boolean => {
    if (readMode) return false;
    if (!WRITABLE.includes(change.fieldId)) return false;
    setApplied((prev) => [...prev, `${change.fieldId} (${change.mode})`]);
    return true;
  };

  return (
    <div className="h-full w-full bg-c-bg p-6">
      {/* Kolumna „karty" — zwężona, żeby panel po prawej nie zasłaniał treści. */}
      <div className="mr-[400px] flex flex-col gap-4">
        <h1 className="text-sm font-semibold text-c-text">
          ETAP 3 n-Type — „Analizuj z AI": menu 2 + panel wyników
        </h1>

        <NModeMenu2
          isPolish={isPolish}
          readMode={readMode}
          onReadModeChange={setReadMode}
          howToButton={<Menu2HowToButton variant="howTo" isPolish={isPolish} />}
          aiButton={
            <Menu2AIButton
              isPolish={isPolish}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            />
          }
        />

        <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
          <p className="text-xs text-c-text-secondary">
            Panel po prawej pokazuje wynik dla AKTYWNEJ KARTY „Opis i zakres" (Zadanie). Kolejność
            szuflad jest wiążąca: Braki · Ryzyka · Sugestie · Proponowane zmiany.
          </p>
          <ul className="mt-3 list-disc pl-5 text-xs text-c-text-muted">
            <li>Zmiana „Oczekiwany rezultat" — pole zapisywalne → „Zastosuj" aktywne.</li>
            <li>
              Zmiana „Dowody" — pole poza listą zapisywalnych → „Zastosuj" wyłączone + „Kopiuj
              treść".
            </li>
            <li>Przełącz „Podgląd" w menu 2 → wszystkie „Zastosuj" gasną z powodem.</li>
          </ul>
          <p className="mt-3 text-xs text-c-text">
            Zastosowane w tej sesji harnessu:{' '}
            <span className="font-mono">{applied.length ? applied.join(', ') : '—'}</span>
          </p>
        </div>
      </div>

      <NCardAIAnalysisPanel
        open={open}
        onClose={() => setOpen(false)}
        loading={false}
        result={MOCK}
        onRerun={() => undefined}
        onApplyChange={handleApply}
        writableFieldIds={WRITABLE}
        readMode={readMode}
        isPolish={isPolish}
        topOffsetClass="top-0"
      />
    </div>
  );
}
