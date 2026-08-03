/**
 * Dev-render host — EKRAN PORÓWNAWCZY stopek preview czterech zakładek My Work
 * (Ideas · Inbox · Tasks · Decisions) PO zmianie wariantów z commita 2d38fd2293
 * („jeden zestaw wariantow przyciskow — skutek, nie ekran").
 *
 * CEL ODBIORU: właściciel ma na JEDNYM zrzucie zobaczyć, że ta sama akcja wygląda
 * tak samo w każdej zakładce, a wariant wynika ze SKUTKU akcji, nie z ekranu
 * (kanon docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md §7.3b).
 *
 * CO JEST PRAWDZIWE, A CO ZŁOŻONE TUTAJ — uczciwie:
 *  • Prawdziwe są WSZYSTKIE prymitywy: PreviewMetaCard · PreviewDetailsSection ·
 *    PreviewAIHintStrip · PreviewRelations · PreviewActionBar · ConvertToOutputMenu,
 *    importowane z `@/components/shared/PreviewPane` i `@/components/MyWork`.
 *    Zero przepisywania, zero atrap wyglądu — kolory pigułek liczy realny
 *    `actionPillClass()` z `previewStyles.ts`.
 *  • Złożone tutaj są tylko KOMPOZYCJE stopek. Produkcyjne stopki to domknięcia
 *    wewnątrz czterech wielkich komponentów listowych (InboxContent 1500+ linii,
 *    MyTasksListContent 2600+), zależnych od store'ów, API i sesji — nie da się
 *    ich zamontować pojedynczo bez backendu. `actionRows` poniżej są przepisane
 *    1:1 z produkcji (etykiety zPL, ikony, warianty, skróty, układ wierszy /
 *    `columns`), z odnośnikiem plik:linia przy każdej zakładce.
 *
 * Parametry URL (poza ?theme, ?lang z harnessu):
 *   ?legenda=0   ukrywa pasek legendy skutek→wariant (czysty zrzut samych stopek)
 */
import {
  AlarmClockOff,
  Archive,
  Bell,
  Bookmark,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Inbox as InboxIcon,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Pause,
  Presentation,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ConvertToOutputMenu } from '@/components/MyWork/ConvertToOutputMenu';
import {
  actionPillClass,
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';

const noop = () => undefined;

// ── Legenda: skutek akcji → wariant (kanon §7.3b, tabela rozstrzygająca) ─────
const LEGENDA: {
  wariant: 'emerald' | 'red' | 'amber' | 'neutral' | 'primary';
  skutek: string;
  przyklad: string;
}[] = [
  { wariant: 'emerald', skutek: 'Zamyka sprawę pozytywnie', przyklad: 'Zrobione · Zatwierdź' },
  { wariant: 'red', skutek: 'Odrzuca formalnie / usuwa', przyklad: 'Odrzuć · Usuń' },
  { wariant: 'amber', skutek: 'Podnosi pilność', przyklad: 'Eskaluj' },
  { wariant: 'neutral', skutek: 'Wszystko pozostałe', przyklad: 'Dziś · Deleguj · Zapisz' },
  { wariant: 'primary', skutek: 'Jedyna główna akcja preview', przyklad: 'Konwertuj' },
];

// ═══════════════════════════════════════════════════════════════════════════
// ZAKŁADKA 1 — IDEAS (Ideas → widok tabeli)
// Źródło: src/components/MyWork/IdeasTableContent.tsx:634-652 + strip 664-676
// ═══════════════════════════════════════════════════════════════════════════
const IDEAS_PILLS: MetaPill[] = [
  { label: 'Etap', value: 'Rośnie', tone: 'success' },
  { label: 'Narzędzie', value: 'Mind Map', tone: 'info' },
  { label: 'Właściciel', value: 'Anna Kowalska', tone: 'neutral' },
];

const IDEAS_RELATIONS: RelationItem[] = [
  { label: 'Notatka z zarządu 09.07', icon: FileText, onClick: noop, type: 'note' },
  { label: 'Model finansowy DACH', icon: FileSpreadsheet, onClick: noop, type: 'model' },
];

const IDEAS_ACTIONS: ActionRow[] = [
  {
    columns: 2,
    buttons: [
      { label: 'Konwertuj', icon: Sparkles, onClick: noop, colorScheme: 'primary' },
      { label: 'Otwórz Flow', icon: Workflow, onClick: noop, colorScheme: 'neutral' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ZAKŁADKA 2 — INBOX
// Źródło: src/components/MyWork/InboxContent.tsx:1396-1460 (dwa wiersze)
// ═══════════════════════════════════════════════════════════════════════════
const INBOX_PILLS: MetaPill[] = [
  { label: 'Źródło', value: 'E-mail', tone: 'neutral' },
  { label: 'Priorytet', value: 'Wysoki', tone: 'warning' },
  { label: 'Od', value: 'Marek Zieliński', tone: 'neutral' },
];

const INBOX_RELATIONS: RelationItem[] = [
  { label: 'Projekt ZPUE — DRD', icon: Target, onClick: noop, type: 'project' },
  { label: 'Warsztat 24.07', icon: CalendarClock, onClick: noop, type: 'meeting' },
];

const INBOX_ACTIONS: ActionRow[] = [
  {
    buttons: [
      {
        label: 'Dziś',
        icon: Zap,
        onClick: noop,
        colorScheme: 'neutral',
        flex: true,
        shortcut: 'T',
      },
      {
        label: 'Tydzień',
        icon: CalendarClock,
        onClick: noop,
        colorScheme: 'neutral',
        flex: true,
        shortcut: 'W',
      },
      {
        label: 'Później',
        icon: Calendar,
        onClick: noop,
        colorScheme: 'neutral',
        flex: true,
        shortcut: 'L',
      },
    ],
  },
  {
    columns: 4,
    buttons: [
      // 'Zrobione' zamyka sprawe pozytywnie — ten sam skutek co Tasks.'Zrobione' ponizej,
      // wiec ten sam wariant emerald (§7.3b). Bylo 'neutral' — rozjazd znaleziony i naprawiony
      // w InboxContent.tsx po zgloszeniu Piotra 2026-07-21 na tym wlasnie ekranie.
      {
        label: 'Zrobione',
        icon: CheckCircle2,
        onClick: noop,
        colorScheme: 'emerald',
        shortcut: 'D',
      },
      { label: 'Zapisz', icon: Bookmark, onClick: noop, colorScheme: 'neutral', shortcut: 'S' },
      { label: 'Notatka', icon: FileText, onClick: noop, colorScheme: 'neutral', shortcut: 'N' },
      { label: 'Odrzuć', icon: Archive, onClick: noop, colorScheme: 'neutral', shortcut: 'X' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ZAKŁADKA 3 — TASKS
// Źródło: src/components/MyWork/MyTasksListContent.tsx:2594-2628 (dwa wiersze)
// ═══════════════════════════════════════════════════════════════════════════
const TASKS_PILLS: MetaPill[] = [
  { label: 'Status', value: 'W toku', tone: 'info' },
  { label: 'Termin', value: '23.07', tone: 'warning' },
  { label: 'Przypisane', value: 'Piotr Wiśniewski', tone: 'neutral' },
];

const TASKS_RELATIONS: RelationItem[] = [
  { label: 'Inicjatywa: Onboarding 21→7 dni', icon: Target, onClick: noop, type: 'initiative' },
  { label: 'Decyzja: pilot Logistics', icon: ListChecks, onClick: noop, type: 'decision' },
];

const TASKS_ACTIONS: ActionRow[] = [
  {
    buttons: [
      {
        label: 'Dziś',
        icon: Zap,
        onClick: noop,
        colorScheme: 'neutral',
        flex: true,
        shortcut: 'T',
      },
      {
        label: 'Odłóż',
        icon: Pause,
        onClick: noop,
        colorScheme: 'neutral',
        flex: true,
        shortcut: 'Z',
      },
    ],
  },
  {
    buttons: [
      {
        label: 'Zrobione',
        icon: CheckCircle2,
        onClick: noop,
        colorScheme: 'emerald',
        flex: true,
        shortcut: 'D',
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ZAKŁADKA 4 — DECISIONS
// Źródło: src/components/MyWork/DecisionPreviewPanel.tsx (Zatwierdź/Odrzuć w
//   PreviewActionBar) + ręczny wiersz Odłóż + menu "..." (Więcej info/Deleguj/
//   Przypomnij/Eskaluj), POZA ActionBar. Skonsolidowane 2026-07-21 — zgloszenie
//   Piotra: stopka miala 7 widocznych przyciskow w 3 wierszach (DOKTRYNA_GESTOSCI
//   §1/§15). Teraz: 3 zawsze widoczne + 4 w overflow.
// ═══════════════════════════════════════════════════════════════════════════
const DECISIONS_PILLS: MetaPill[] = [
  { label: 'Status', value: 'Czeka na Ciebie', tone: 'warning' },
  { label: 'Wpływ', value: 'Wysoki', tone: 'danger' },
  { label: 'Termin', value: '22.07', tone: 'neutral' },
];

const DECISIONS_RELATIONS: RelationItem[] = [
  { label: 'Diagnoza Logistics BU', icon: FileText, onClick: noop, type: 'assessment' },
  { label: 'Prezentacja dla zarządu', icon: Presentation, onClick: noop, type: 'deck' },
];

// Zgloszenie Piotra 2026-07-21: stopka Decision miala 7 widocznych przyciskow
// w 3 wierszach — lamie DOKTRYNA_GESTOSCI.md §1 (<=5 widocznych, 6+ -> overflow)
// i §15 ("gesty i plytki, nie plaski wysyp"). Naprawione w DecisionPreviewPanel.tsx:
// zostaja widoczne Zatwierdz/Odrzuc/Odloz (3), reszta (Wiecej info/Deleguj/
// Przypomnij/Eskaluj) przeniesiona do menu "...". Ten mockup odwzorowuje NOWY stan.
const DECISIONS_ACTIONS: ActionRow[] = [
  {
    buttons: [
      {
        label: 'Zatwierdź',
        icon: Check,
        onClick: noop,
        colorScheme: 'emerald',
        flex: true,
        shortcut: 'A',
      },
      { label: 'Odrzuć', icon: X, onClick: noop, colorScheme: 'red', flex: true, shortcut: 'R' },
    ],
  },
];

// ── Rusztowanie kolumny ─────────────────────────────────────────────────────
const Kolumna: React.FC<{
  ikona: React.ElementType;
  zakladka: string;
  tytul: string;
  zrodlo: string;
  children: React.ReactNode;
}> = ({ ikona: Ikona, zakladka, tytul, zrodlo, children }) => (
  <section className="flex min-w-0 flex-col rounded-2xl border border-c-border-subtle bg-c-surface-raised">
    <header className="flex items-start gap-2 border-b border-c-border-subtle px-3.5 py-3">
      <Ikona size={16} className="mt-0.5 shrink-0 text-c-text-muted" />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-c-text-primary">{zakladka}</div>
        <div className="mt-0.5 truncate text-[11px] text-c-text-muted" title={tytul}>
          {tytul}
        </div>
        <div className="mt-1 font-mono text-[10px] leading-tight text-c-text-muted/70">
          {zrodlo}
        </div>
      </div>
    </header>
    <div className="flex flex-1 flex-col gap-2.5 p-3.5">{children}</div>
  </section>
);

export const Preview4ZakladkiScreen: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const pokazLegende = params.get('legenda') !== '0';

  return (
    <MemoryRouter initialEntries={['/my-work']}>
      <div className="min-h-screen bg-c-surface p-6">
        <div className="mx-auto max-w-[1600px]">
          {/* ── Nagłówek ── */}
          <header className="mb-5">
            <h1 className="text-lg font-semibold text-c-text-primary">
              Stopki preview — cztery zakładki My Work obok siebie
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-c-text-secondary">
              Ta sama akcja ma wyglądać tak samo w każdej zakładce. O wariancie decyduje{' '}
              <strong className="font-semibold text-c-text-primary">skutek akcji</strong> — co
              przycisk robi z rekordem — a nie to, na którym ekranie stoi. Rodzina planowania (Dziś
              · Tydzień · Później · Odłóż) idzie w całości na neutral; „Zrobione" i „Zatwierdź" to
              ten sam skutek, więc ten sam zielony; „primary" występuje maksymalnie raz na preview.
            </p>
          </header>

          {/* ── Legenda skutek → wariant ── */}
          {pokazLegende ? (
            <div className="mb-6 rounded-2xl border border-c-border-subtle bg-c-surface-raised p-3.5">
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                Skutek akcji → wariant (kanon §7.3b)
              </div>
              <div className="flex flex-wrap items-stretch gap-x-6 gap-y-3">
                {LEGENDA.map((l) => (
                  <div key={l.wariant} className="flex items-center gap-2.5">
                    <span className={actionPillClass(l.wariant, 'pointer-events-none')}>
                      {l.wariant}
                    </span>
                    <span className="text-[11px] leading-tight text-c-text-secondary">
                      {l.skutek}
                      <span className="block text-c-text-muted">{l.przyklad}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── Cztery kolumny ── */}
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* ─────────── IDEAS ─────────── */}
            <Kolumna
              ikona={Lightbulb}
              zakladka="Ideas"
              tytul="Wejście na rynek DACH — mapa hipotez"
              zrodlo="IdeasTableContent.tsx:634"
            >
              <PreviewMetaCard pills={IDEAS_PILLS} trailing={<Meta>11.07.2026</Meta>} />
              <PreviewDetailsSection
                compact
                label="Szczegóły"
                text={
                  'Gałęzie: popyt mid-market, konkurencja lokalna, kanały sprzedaży, ryzyka regulacyjne. Priorytet na Q3: zwalidować popyt zanim ruszy budowa oferty.'
                }
              />
              <PreviewAIHintStrip
                hints={['Rozwiń pomysł', 'Znajdź ryzyka', 'Zaproponuj następny krok']}
              />
              <PreviewRelations items={IDEAS_RELATIONS} emptyLabel="Brak powiązań" />
              {/* „Co dalej" — widoczny create-strip (§7.3a), nie ukryty dropdown */}
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                  Co dalej
                </div>
                <ConvertToOutputMenu
                  sourceType="idea"
                  sourceId="idea-dach-001"
                  sourceTitle="Wejście na rynek DACH — mapa hipotez"
                  onConvertComplete={noop}
                  variant="inline"
                />
              </div>
              <PreviewActionBar rows={IDEAS_ACTIONS} />
            </Kolumna>

            {/* ─────────── INBOX ─────────── */}
            <Kolumna
              ikona={InboxIcon}
              zakladka="Inbox"
              tytul="ZPUE prosi o przesunięcie warsztatu"
              zrodlo="InboxContent.tsx:1396"
            >
              <PreviewMetaCard pills={INBOX_PILLS} trailing={<Meta>dziś 09:14</Meta>} />
              <PreviewDetailsSection
                compact
                label="Szczegóły"
                text={
                  'Klient prosi o przesunięcie warsztatu diagnostycznego z 24.07 na pierwszy tydzień sierpnia — kolizja z audytem ISO. Pyta też, czy da się skrócić sesję do pół dnia.'
                }
              />
              <PreviewAIHintStrip
                hints={['Streść wątek', 'Zaproponuj odpowiedź', 'Wyciągnij zadania']}
              />
              <PreviewRelations items={INBOX_RELATIONS} emptyLabel="Brak powiązań" />
              <PreviewActionBar rows={INBOX_ACTIONS} />
            </Kolumna>

            {/* ─────────── TASKS ─────────── */}
            <Kolumna
              ikona={ListChecks}
              zakladka="Tasks"
              tytul="Karta inicjatywy — onboarding 21→7 dni"
              zrodlo="MyTasksListContent.tsx:2594"
            >
              <PreviewMetaCard pills={TASKS_PILLS} trailing={<Meta>za 2 dni</Meta>} />
              <PreviewDetailsSection
                compact
                label="Szczegóły"
                text={
                  'Spisać zakres, właściciela i mierniki dla inicjatywy skrócenia onboardingu. Wejście: wnioski z warsztatu 09.07 i dane z trzech ostatnich wdrożeń.'
                }
              />
              <PreviewAIHintStrip
                hints={['Rozbij na podzadania', 'Oszacuj czas', 'Kto powinien to robić']}
              />
              <PreviewRelations items={TASKS_RELATIONS} emptyLabel="Brak powiązań" />
              <PreviewActionBar rows={TASKS_ACTIONS} />
            </Kolumna>

            {/* ─────────── DECISIONS ─────────── */}
            <Kolumna
              ikona={ListChecks}
              zakladka="Decisions"
              tytul="Pilot DRD w segmencie Logistics — Q3"
              zrodlo="DecisionPreviewPanel.tsx:402"
            >
              <PreviewMetaCard pills={DECISIONS_PILLS} trailing={<Meta>22.07.2026</Meta>} />
              <PreviewDetailsSection
                compact
                label="Szczegóły"
                text={
                  'Czy uruchamiamy pilota w Logistics BU już w Q3, czy czekamy na domknięcie diagnozy Manufacturing. Koszt wejścia 180 tys. zł, zwrot szacowany na 4 kwartały.'
                }
              />
              <PreviewAIHintStrip
                hints={['Argumenty za i przeciw', 'Ryzyka odroczenia', 'Kto jeszcze decyduje']}
              />
              <PreviewRelations items={DECISIONS_RELATIONS} emptyLabel="Brak powiązań" />
              <PreviewActionBar rows={DECISIONS_ACTIONS} />
              {/* Odłóż: produkcja renderuje to RĘCZNIE (DecisionPreviewPanel.tsx) —
                  ma wlasny dropdown presetow czasu (1h/4h/jutro/tydzien), ktorego
                  generyczny overflow nie odwzorowuje. Menu "..." obok NIE jest
                  juz reczna kopia — to PRAWDZIWY PreviewActionBar.overflowActions,
                  ten sam kod co w produkcji (naprawione 2026-07-21 po zgloszeniu
                  Piotra: trzecia reczna kopia tego samego menu w jednym wieczorze
                  byla dokladnie tym, czego ten prop mial nie dopuscic). */}
              <div className="flex gap-2">
                <button onClick={noop} className={actionPillClass('neutral', 'flex-1')}>
                  <AlarmClockOff size={14} />
                  Odłóż
                </button>
                <PreviewActionBar
                  rows={[]}
                  overflowLabel="More actions"
                  overflowActions={[
                    {
                      label: 'Więcej info',
                      icon: MessageSquare,
                      onClick: noop,
                      colorScheme: 'neutral',
                    },
                    { label: 'Deleguj', icon: UserPlus, onClick: noop, colorScheme: 'neutral' },
                    { label: 'Przypomnij', icon: Bell, onClick: noop, colorScheme: 'neutral' },
                    { label: 'Eskaluj', icon: TrendingUp, onClick: noop, colorScheme: 'amber' },
                  ]}
                />
              </div>
            </Kolumna>
          </div>

          {/* ── Inwentarz wariantów ── */}
          <footer className="mt-6 rounded-2xl border border-c-border-subtle bg-c-surface-raised px-4 py-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              Co widać na tym zrzucie
            </div>
            <ul className="space-y-1 text-[12px] leading-relaxed text-c-text-secondary">
              <li>
                • <strong className="text-c-text-primary">Dziś</strong> jest neutralne w Inboxie i w
                Tasks — ten sam przycisk, ten sam wygląd (wcześniej: primary w Inboxie, emerald w
                Tasks).
              </li>
              <li>
                • <strong className="text-c-text-primary">Zrobione</strong> (Tasks) i{' '}
                <strong className="text-c-text-primary">Zatwierdź</strong> (Decisions) to ten sam
                skutek — jeden zielony emerald, nie dwa odcienie.
              </li>
              <li>
                • <strong className="text-c-text-primary">Konwertuj</strong> to jedyny primary na
                całym zrzucie — granatowo-biały kontrast, nie crimson.
              </li>
              <li>
                • Cała rodzina planowania (Dziś · Tydzień · Później · Odłóż · Przypomnij · Deleguj ·
                Zapisz · Notatka) jest neutralna.
              </li>
              <li>
                • <strong className="text-c-text-primary">Decisions</strong>: 7 widocznych
                przycisków w 3 wierszach → 3 (Zatwierdź/Odrzuć/Odłóż) + menu „…" (Więcej
                info/Deleguj/Przypomnij/Eskaluj) — zgodnie z DOKTRYNA_GESTOSCI §1 (≤5 widocznych).
              </li>
            </ul>
          </footer>
        </div>
      </div>
    </MemoryRouter>
  );
};

const Meta: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[11px] tabular-nums text-c-text-muted">{children}</span>
);

export default Preview4ZakladkiScreen;
