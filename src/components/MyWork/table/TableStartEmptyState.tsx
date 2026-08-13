/**
 * TableStartEmptyState — pusty stan „jak w ogóle zbudować tę tabelę".
 *
 * Zgłoszenie właściciela (2026-07-28): „no totalnie nie wiem jak zbudować
 * tabelę", „dodałem kolumnę cos ale nie wiem jak mam sprawić aby ta tabela
 * powstała". Legacy widok „Tabela" w `IdeaTableTool` przy zerowej liczbie
 * wierszy rysował sam nagłówek kolumn i pustkę — ani zdania o tym, co dalej.
 *
 * RÓŻNICA WOBEC SĄSIADÓW (świadomie trzy różne komponenty, nie jeden):
 *   • `EmptyFilterStateView` — „filtr wyciął wszystko" (dane SĄ),
 *   • `ViewSetupEmptyState`  — „ten WIDOK potrzebuje konkretnej kolumny"
 *     (4 powody × 4 akcje; wzorzec, z którego bierzemy kształt: nazwij powód
 *     i PODAJ DZIAŁAJĄCE WYJŚCIE, nigdy sam opis problemu),
 *   • ten plik              — „tabela jest pusta i nie wiem, od czego zacząć".
 * Trzy różne przyczyny, trzy różne zestawy akcji — sklejenie ich w jeden
 * komponent kosztowałoby dokładnie to, co zgubiło właściciela: konkret.
 *
 * TRZY ŚCIEŻKI STARTU (decyzja właściciela — nie kreator wielokrokowy, nie same
 * podpowiedzi inline). Każda musi REALNIE zbudować tabelę, nie tylko coś otworzyć:
 *   1. „Z szablonu"  → `FrameworkGenerator`: 6 gotowych ram konsultingowych,
 *      wstawia KOLUMNY + WIERSZE (SWOT · Interesariusze · Rejestr ryzyk · Plan
 *      działań · Benchmarking · Porter).
 *   2. „Z AI"        → `AITableAssistant`: opisz po ludzku, dostajesz propozycję
 *      kolumn i wierszy do zatwierdzenia.
 *   3. „Pusta z sugerowanymi kolumnami" → odsłania komplet kolumn startowych i
 *      od razu dokłada 3 puste wiersze: tabela POWSTAJE w tym samym kliknięciu.
 * Czwarta, cichsza droga („Wczytaj CSV") zostaje linkiem pod spodem — funkcja,
 * którą pusty stan miał od zawsze, nie może zniknąć przy przebudowie.
 *
 * TOKENY: wyłącznie `c-*` (automatyczne light/dark), zero crimson — rodzina
 * tailwinda o nazwie zaczynającej się od „prim…" to w tym projekcie karmazyn
 * zarezerwowany dla semantyki krytycznej (CLAUDE.md UI pkt 3). Wyróżnienie
 * ścieżki zalecanej = obwódka `c-focus`.
 */
import { Columns3, FileSpreadsheet, LayoutTemplate, Rows3, Sparkles, Table2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface TableStartEmptyStateProps {
  /** Read-only — pokazujemy tylko wyjaśnienie, bez dróg budowania. */
  locked?: boolean;
  /** Ścieżka 1 — otwiera generator ram (kolumny + wiersze). */
  onStartFromTemplate: () => void;
  /** Ścieżka 2 — otwiera asystenta AI tabeli. */
  onStartWithAI: () => void;
  /** Ścieżka 3 — zakłada kolumny startowe + 3 puste wiersze OD RAZU. */
  onStartBlank: () => void;
  /** Cichsza droga — plik CSV/TSV. */
  onImportCSV?: () => void;
  /**
   * TB-P1-02 — czwarta, cicha droga: otwiera kreator pola wprost, bez
   * zakładania żadnych wierszy/kolumn startowych. Dla użytkownika, który
   * wie dokładnie jakich pól potrzebuje (np. Obszar/Koszt/Korzyść/Ryzyko/
   * Właściciel) i nie chce przechodzić przez żadną z trzech ścieżek wyżej.
   */
  onAddField?: () => void;
}

interface PathCard {
  id: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  recommended?: boolean;
  testId: string;
}

export const TableStartEmptyState: React.FC<TableStartEmptyStateProps> = ({
  locked = false,
  onStartFromTemplate,
  onStartWithAI,
  onStartBlank,
  onImportCSV,
  onAddField,
}) => {
  const { t } = useTranslation();

  const paths: PathCard[] = [
    {
      id: 'template',
      icon: LayoutTemplate,
      title: t('ideas.table.start.template.title', 'Z szablonu'),
      description: t(
        'ideas.table.start.template.description',
        'Gotowa rama konsultingowa — SWOT, rejestr ryzyk, plan działań. Wstawia kolumny i przykładowe wiersze, które podmieniasz na swoje.'
      ),
      action: t('ideas.table.start.template.action', 'Wybierz szablon'),
      onClick: onStartFromTemplate,
      recommended: true,
      testId: 'table-start-template',
    },
    {
      id: 'ai',
      icon: Sparkles,
      title: t('ideas.table.start.ai.title', 'Z AI'),
      description: t(
        'ideas.table.start.ai.description',
        'Napisz jednym zdaniem, co chcesz śledzić. AI zaproponuje kolumny i pierwsze wiersze — zatwierdzasz albo poprawiasz.'
      ),
      action: t('ideas.table.start.ai.action', 'Opisz tabelę'),
      onClick: onStartWithAI,
      testId: 'table-start-ai',
    },
    {
      id: 'blank',
      icon: Rows3,
      title: t('ideas.table.start.blank.title', 'Pusta z sugerowanymi kolumnami'),
      description: t(
        'ideas.table.start.blank.description',
        'Nazwa, Status, Priorytet, Właściciel i trzy puste wiersze. Tabela powstaje od razu — resztę dokładasz sam.'
      ),
      action: t('ideas.table.start.blank.action', 'Zacznij pustą'),
      onClick: onStartBlank,
      testId: 'table-start-blank',
    },
  ];

  return (
    <div
      data-testid="table-start-empty-state"
      className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-12"
    >
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-c-surface-raised ring-1 ring-c-border-subtle shadow-inner"
        aria-hidden
      >
        <Table2 className="h-8 w-8 text-c-text-secondary" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold tracking-tight text-c-text">
        {t('ideas.table.start.headline', 'Ta tabela jest jeszcze pusta')}
      </h3>
      <p className="mt-2 max-w-lg text-center text-sm leading-relaxed text-c-text-muted">
        {locked
          ? t(
              'ideas.table.start.lockedDescription',
              'Tabela nie ma jeszcze wierszy, a widok jest tylko do odczytu — nic tu nie zbudujesz.'
            )
          : t(
              'ideas.table.start.description',
              'Wybierz jedną z trzech dróg — każda zakłada kolumny i wiersze od razu, bez wypełniania formularza.'
            )}
      </p>

      {!locked && (
        <>
          <div className="mt-8 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
            {paths.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={p.onClick}
                  data-testid={p.testId}
                  className={`group flex flex-col items-start gap-2 rounded-2xl border bg-c-surface p-4 text-left transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                    p.recommended ? 'border-c-focus' : 'border-c-border-subtle'
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-c-surface-raised ring-1 ring-c-border-subtle">
                    <Icon className="h-4 w-4 text-c-text-secondary" strokeWidth={1.75} />
                  </span>
                  <span className="text-sm font-semibold text-c-text">{p.title}</span>
                  <span className="text-xs leading-relaxed text-c-text-muted">{p.description}</span>
                  <span className="mt-auto pt-2 text-xs font-semibold text-c-text">
                    {p.action} →
                  </span>
                </button>
              );
            })}
          </div>

          {(onImportCSV || onAddField) && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-1">
              {onAddField && (
                <button
                  type="button"
                  onClick={onAddField}
                  data-testid="table-start-add-field"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <Columns3 className="h-3.5 w-3.5 shrink-0" />
                  {t('ideas.table.newColumn', 'Dodaj pole')}
                </button>
              )}
              {onImportCSV && (
                <button
                  type="button"
                  onClick={onImportCSV}
                  data-testid="table-start-import-csv"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                  {t('ideas.table.start.importCsv', 'Mam już dane w pliku — wczytaj CSV')}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TableStartEmptyState;
