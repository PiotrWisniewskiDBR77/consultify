/**
 * PROTOTYP DO AKCEPTU (CLAUDE.md #7) — prawy pas jako JEDNA FORMUŁA.
 *
 * SSOT decyzji: docs/program/grafika/ANALIZA_PRAWY_PANEL.md §3/§4/§7 +
 * uzupełnienie „dokumenty" na końcu tego pliku (2026-08-30). Cytat
 * właściciela, dziś zatwierdzony jako rozstrzygnięcie architektoniczne:
 *
 *   „Teresa staje się jedną z ikon na stałej szynie prawego pasa — tak jak
 *   jest już w Wordzie. Rozciągamy wzorzec z Worda na całą strukturę."
 *
 * Wzorzec źródłowy (istnieje i działa): rail narzędzi Studia Dokumentów —
 * src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:2778-2890
 * (`sources · properties · qa · TERESA · comments · activity`). Ten harness
 * NIE wymyśla nowego mechanizmu — składa go z dwóch REALNYCH komponentów,
 * które już dziś obsługują ten dokładny wzorzec gdzie indziej:
 *
 *   - `RightRail` (src/components/shared/ExecutiveModuleShell/RightRail.tsx)
 *     — stała 56px szyna ikon. `collapsible={false}` używamy świadomie: to
 *     ta sama flaga, którą Idee dostały 2026-07-28 („niech ciągle będzie i
 *     przyzwyczaja, że tu są ikony") — tu robimy z niej REGUŁĘ formuły, nie
 *     wyjątek jednego modułu.
 *   - `ArtifactRightPanel` (src/components/standard/ArtifactRightPanel.tsx)
 *     — kanoniczny akordeon 7 sekcji (`ARTIFACT_PANEL_SECTION_ORDER`,
 *     import z SSOT, zero własnej kopii listy — patrz Krok 1 §7 analizy).
 *
 * Nowy element (bo dziś nie istnieje NIGDZIE jako pełnoprawny tryb pasa,
 * tylko jako przycisk-wyjście w notatniku i akordeon-sekcja w ideach):
 * `TeresaRailPanel` — pełna wysokość, własne pole pisania, chipy komend
 * kontekstowych (wzorowane na `IdeaTeresaSection`), strumień wiadomości z
 * jawnym wyróżnieniem ZAŁOŻEŃ przyjętych przez Teresę (§5 analizy: „sekcja
 * Źródła i założenia jest najważniejsza i dziś jej nie ma" — Teresa musi te
 * założenia jawnie pokazywać, nie tylko sekcja Ewidencji).
 *
 * DECYZJA „jeden ekran czy dwa" (patrz zadanie robotnika): JEDEN plik,
 * JEDNA funkcja budująca sekcje (`buildArtifactSections`), wołana z DWOMA
 * różnymi zestawami danych (notatka/idea). To silniejszy dowód „jednej
 * formuły" niż dwa ekrany, które MOGŁYBY się rozjechać w kodzie, nawet
 * gdyby wizualnie wyglądały podobnie — tu jest fizycznie ta sama ścieżka
 * kodu. Zarejestrowany 5×: `?screen=prawy-pas-jedna-formula` (interaktywny,
 * przełącznik klikany przez Piotra) + 4 warianty ze stałym stanem
 * początkowym (`-notatka-artefakt` / `-notatka-teresa` / `-idea-artefakt` /
 * `-idea-teresa`) do deterministycznych zrzutów skryptowych — bez tego
 * `grafika-zrzuty.mjs` nie potrafi kliknąć przełącznika przed zrzutem, a
 * wszystkie 4 kombinacje wołane pod tym samym `?screen=` nadpisywałyby
 * sobie nawzajem plik wyjściowy (nazwa pliku = nazwa ekranu).
 *
 * Kanon (obowiązkowy, patrz zlecenie): 7 sekcji w kolejności z
 * `ARTIFACT_PANEL_SECTION_ORDER`, domyślnie rozwinięte WYŁĄCZNIE Akcje i
 * Właściwości, podpisy trzech środkowych sekcji nazywają kierunek, zero
 * crimson, wyłącznie tokeny c-*. Treść notatki/idei z §5 analizy.
 *
 * Bez store/API/logowania — statyczne mocki. Motyw/lang sterowane globalnie
 * przez harness (`?theme=`, `?lang=`), patrz dev-render/main.tsx.
 */
import type { LucideIcon } from 'lucide-react';
import {
  AlarmClock,
  Archive,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  FileText,
  Layers,
  LayoutGrid,
  Link2,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Users,
  Wand2,
  Wrench,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import {
  RightRail,
  type RightRailToolDescriptor,
} from '../../src/components/shared/ExecutiveModuleShell/RightRail';
import {
  type ActionButton,
  type ActivityEvent,
  PreviewActionBar,
  PreviewActivityStrip,
  PreviewRelations,
  PreviewStructuredList,
  type RelationItem,
} from '../../src/components/shared/PreviewPane';
import {
  ARTIFACT_PANEL_SECTION_ORDER,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '../../src/components/standard/ArtifactRightPanel';

// ═══════════════════════════════════════════════════════════════════════
// DANE MOCK — jedna kształt (ObjectData) dla notatki i idei. Ta sama forma
// = dowód, że różnica jest wyłącznie w TREŚCI, nie w STRUKTURZE panelu.
// ═══════════════════════════════════════════════════════════════════════

type ObjectType = 'notatka' | 'idea';
type RailMode = 'artefakt' | 'teresa';

interface ActionSpec {
  label: string;
  icon: LucideIcon;
}

interface CommentSpec {
  author: string;
  text: string;
  resolved: boolean;
  time: string;
}

interface TeresaMessage {
  role: 'teresa' | 'user';
  text: string;
  /** Gdy podane — renderuje się jako wyróżniony callout „Założenie Teresy". */
  assumption?: string;
}

interface ObjectData {
  type: ObjectType;
  title: string;
  subtitle: string;
  actions: ActionSpec[];
  properties: { label: string; value: React.ReactNode }[];
  relationGroups: { title: string; items: RelationItem[] }[];
  evidenceSources: { id: string; label: React.ReactNode; note?: React.ReactNode }[];
  evidenceAssumptions: string[];
  results: RelationItem[];
  resultsEmptyNote: string;
  comments: CommentSpec[];
  history: ActivityEvent[];
  teresaCommands: { label: string; icon: LucideIcon }[];
  teresaMessages: TeresaMessage[];
  centrumParagraphs: string[];
}

const NOTATKA: ObjectData = {
  type: 'notatka',
  title: 'Warsztat 3: migracja danych klienta',
  subtitle: 'Notatka · źródło: rozmowa (Fireflies, 24 min)',
  actions: [
    { label: 'Zamień w zadanie', icon: ClipboardList },
    { label: 'Zamień w inicjatywę', icon: Layers },
    { label: 'Dodaj przypomnienie', icon: AlarmClock },
    { label: 'Udostępnij', icon: Share2 },
    { label: 'Archiwizuj', icon: Archive },
  ],
  properties: [
    { label: 'Właściciel', value: 'Anna Kowalska' },
    { label: 'Utworzono', value: '24 sie 2026, 14:12' },
    { label: 'Źródło', value: 'Rozmowa (transkrypcja)' },
    { label: 'Przypomnienie', value: <span className="text-c-text-muted">brak</span> },
    { label: 'Widoczność', value: 'Projekt „Ekspansja DE"' },
  ],
  relationGroups: [
    {
      title: 'Notatki linkowane',
      items: [
        { id: 'n2', label: 'Warsztat 2: model kosztowy', icon: FileText, type: 'note' },
        { id: 'n5', label: 'Decyzje: wybór partnera', icon: FileText, type: 'note' },
      ],
    },
    {
      title: 'Projekt',
      items: [{ id: 'p1', label: 'Ekspansja DE', icon: Layers, type: 'project' }],
    },
    {
      title: 'Osoby wspomniane',
      items: [
        { id: 'u1', label: 'Anna Kowalska', icon: Users, type: 'person' },
        { id: 'u2', label: 'Marek Nowak (klient)', icon: Users, type: 'person' },
      ],
    },
  ],
  evidenceSources: [
    {
      id: 'src-1',
      label: 'Warsztat 3 z zespołem klienta',
      note: 'Fireflies · 24 min · transkrypcja',
    },
    { id: 'src-2', label: 'Model kosztowy v2.xlsx', note: 'załącznik' },
  ],
  evidenceAssumptions: [
    'Teresa założyła, że „migracja" odnosi się do danych klienta w CRM, nie w ERP — do potwierdzenia przez właściciela.',
  ],
  results: [{ id: 'r1', label: 'Zdefiniować standard MDM', icon: ClipboardList, type: 'task' }],
  resultsEmptyNote: 'Decyzje i dokumenty: jeszcze nic nie powstało z tej notatki.',
  comments: [
    {
      author: 'Marek Nowak',
      text: 'Czy to obejmuje też dane historyczne sprzed migracji do CRM?',
      resolved: false,
      time: '25 sie, 08:40',
    },
    {
      author: 'Anna Kowalska',
      text: 'Dodałam link do modelu kosztowego w źródłach.',
      resolved: true,
      time: '25 sie, 09:10',
    },
  ],
  history: [
    {
      id: 'h1',
      description: 'Anna Kowalska utworzyła notatkę.',
      timestamp: '2026-08-24T14:12:00Z',
      userName: 'Anna Kowalska',
    },
    {
      id: 'h2',
      description: 'Teresa wygenerowała podsumowanie z rozmowy (typ: AI).',
      timestamp: '2026-08-24T14:13:00Z',
      userName: 'Teresa',
    },
    {
      id: 'h3',
      description: 'Anna Kowalska edytowała sekcję „Otwarte pytania".',
      timestamp: '2026-08-25T09:02:00Z',
      userName: 'Anna Kowalska',
    },
  ],
  teresaCommands: [
    { label: 'Uzupełnij puste', icon: Wand2 },
    { label: 'Streść', icon: Sparkles },
    { label: 'Kontrola jakości', icon: CheckCircle2 },
    { label: 'Kontynuuj', icon: RefreshCw },
  ],
  teresaMessages: [
    {
      role: 'teresa',
      text: 'Podsumowałam warsztat: 3 otwarte pytania, 1 ryzyko (dane historyczne), zero podjętych decyzji.',
    },
    {
      role: 'teresa',
      text: '',
      assumption:
        'Założenie: „migracja" dotyczy danych klienta w CRM. Popraw, jeśli chodzi też o ERP.',
    },
    { role: 'user', text: 'Popraw — dotyczy też ERP.' },
    {
      role: 'teresa',
      text: 'Zaktualizowałam zakres. Chcesz, żebym zamieniła pytanie o dane historyczne w zadanie z terminem?',
    },
  ],
  centrumParagraphs: [
    'Warsztat 3 zamknął pytanie, czy migrację da się zrobić bez wcześniejszego uporządkowania klucza klienta w [[Warsztat 2: model kosztowy]].',
    'Zespół klienta (Marek Nowak) potwierdził, że dane historyczne sprzed 2024 żyją wyłącznie w starym systemie ERP — nie ma ich w CRM.',
    'Otwarte: kto odpowiada za walidację jakości danych po migracji? Do ustalenia na warsztacie 4.',
  ],
};

const IDEA: ObjectData = {
  type: 'idea',
  title: 'Ekspansja DE — mapa hipotez',
  subtitle: 'Idea · Mapa myśli · 14 gałęzi',
  actions: [
    { label: 'Zamień gałąź w zadanie', icon: ClipboardList },
    { label: 'Zbuduj z tego dokument', icon: FileText },
    { label: 'Uruchom narzędzie', icon: Play },
    { label: 'Udostępnij', icon: Share2 },
  ],
  properties: [
    { label: 'Właściciel', value: 'Piotr W.' },
    { label: 'Liczba gałęzi', value: '14' },
    { label: 'Narzędzie źródłowe', value: 'Mind Map' },
    { label: 'Widoczność', value: 'Projekt „Ekspansja DE"' },
    { label: 'Wersja', value: '6 · zapis 25 sie, 11:40' },
  ],
  relationGroups: [
    {
      title: 'Idee siostrzane',
      items: [
        { id: 'i2', label: 'Ekspansja FR — mapa hipotez', icon: Sparkles, type: 'idea' },
        { id: 'i3', label: 'Model wejścia — warianty', icon: Sparkles, type: 'idea' },
      ],
    },
    {
      title: 'Inicjatywa',
      items: [{ id: 'init-1', label: 'Ekspansja DE', icon: Layers, type: 'initiative' }],
    },
    {
      title: 'Projekt',
      items: [{ id: 'p1', label: 'Ekspansja DE', icon: Layers, type: 'project' }],
    },
  ],
  evidenceSources: [
    { id: 'src-1', label: '6 wywiadów klienckich', note: '4 z 6 potwierdzają lukę w kanałach' },
    { id: 'src-2', label: 'Raport branżowy 2026 — TAM DE', note: 'założenie rynkowe' },
  ],
  evidenceAssumptions: [
    'TAM DE = 3,2× rynku krajowego, przyjęte z raportu branżowego — nie zweryfikowane własnym badaniem.',
    'Czego NIE wiemy: brak potwierdzonych barier regulacyjnych — gałąź oznaczona jako hipoteza, nie fakt.',
  ],
  results: [
    { id: 'r1', label: 'Zweryfikować bariery regulacyjne DE', icon: ClipboardList, type: 'task' },
    { id: 'r2', label: 'Ekspansja DE (inicjatywa powiązana)', icon: Layers, type: 'initiative' },
  ],
  resultsEmptyNote: 'Dokumenty i raport: jeszcze nic nie zbudowano z tej mapy.',
  comments: [
    {
      author: 'Piotr W.',
      text: 'Gałąź „kanały" wymaga więcej danych, zanim uznamy ją za dojrzałą.',
      resolved: false,
      time: '23 sie, 16:05',
    },
  ],
  history: [
    {
      id: 'h1',
      description: 'Piotr W. utworzył mapę.',
      timestamp: '2026-08-20T10:00:00Z',
      userName: 'Piotr W.',
    },
    {
      id: 'h2',
      description: 'Teresa zaproponowała gałąź „bariery regulacyjne DE" (typ: AI).',
      timestamp: '2026-08-22T12:30:00Z',
      userName: 'Teresa',
    },
    {
      id: 'h3',
      description: 'Piotr W. dodał węzeł „ryzyka".',
      timestamp: '2026-08-25T11:40:00Z',
      userName: 'Piotr W.',
    },
  ],
  teresaCommands: [
    { label: 'Uzupełnij puste', icon: Wand2 },
    { label: 'Synteza', icon: Sparkles },
    { label: 'Kontrola jakości', icon: CheckCircle2 },
    { label: 'Kontynuuj', icon: RefreshCw },
  ],
  teresaMessages: [
    {
      role: 'teresa',
      text: 'Rozważ gałąź „bariery regulacyjne DE" — brakuje jej na mapie, a padła w 2 z 6 wywiadów.',
    },
    { role: 'user', text: 'Dodaj ją jako hipotezę, nie fakt.' },
    {
      role: 'teresa',
      text: '',
      assumption:
        'Założenie: skoro temat padł tylko w 2 z 6 wywiadów, oznaczam gałąź jako hipotezę niskiej pewności — popraw, jeśli masz mocniejsze źródło.',
    },
    { role: 'teresa', text: 'Węzły „kanały" i „popyt" wyglądają na powiązane — połączyć je?' },
  ],
  centrumParagraphs: [],
};

const OBJECTS: Record<ObjectType, ObjectData> = { notatka: NOTATKA, idea: IDEA };

// ═══════════════════════════════════════════════════════════════════════
// BUDOWA SEKCJI — JEDNA funkcja, wołana dla notatki i dla idei. To jest
// literalny dowód „jednej formuły" w kodzie, nie tylko na zrzucie.
// ═══════════════════════════════════════════════════════════════════════

const KeyValueList: React.FC<{ rows: { label: string; value: React.ReactNode }[] }> = ({
  rows,
}) => (
  <div className="flex flex-col divide-y divide-c-border-subtle">
    {rows.map((row) => (
      <div key={row.label} className="flex items-start justify-between gap-3 py-1.5">
        <span className="shrink-0 text-[11px] uppercase tracking-wider text-c-text-muted">
          {row.label}
        </span>
        <span className="text-right text-xs text-c-text">{row.value}</span>
      </div>
    ))}
  </div>
);

const AssumptionCallout: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-start gap-2 rounded-lg border border-c-warning/40 bg-c-warning/[0.08] px-2.5 py-2">
    <Sparkles size={13} className="mt-0.5 shrink-0 text-c-warning" />
    <p className="text-xs leading-snug text-c-text-secondary">{text}</p>
  </div>
);

const CommentThread: React.FC<{ comments: CommentSpec[] }> = ({ comments }) => (
  <div className="flex flex-col gap-2">
    {comments
      .slice()
      .sort((a, b) => Number(a.resolved) - Number(b.resolved)) // nierozstrzygnięte na wierzchu
      .map((c, i) => (
        <div
          key={i}
          className={`rounded-lg border px-2.5 py-2 ${
            c.resolved
              ? 'border-c-border-subtle bg-c-surface-raised opacity-70'
              : 'border-c-border bg-c-surface-raised'
          }`}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-c-text">{c.author}</span>
            <span className="text-[10px] text-c-text-muted">{c.time}</span>
          </div>
          <p className="text-xs leading-snug text-c-text-secondary">{c.text}</p>
          {!c.resolved ? (
            <span className="mt-1 inline-block rounded-full bg-c-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-c-warning">
              nierozstrzygnięte
            </span>
          ) : null}
        </div>
      ))}
  </div>
);

function buildArtifactSections(data: ObjectData): ArtifactRightPanelSection[] {
  const byId: Partial<Record<ArtifactRightPanelSection['id'], ArtifactRightPanelSection>> = {
    actions: {
      id: 'actions',
      label: 'Akcje',
      icon: Sparkles,
      defaultOpen: true,
      children: (
        <PreviewActionBar
          rows={[
            {
              columns: 2,
              buttons: data.actions.map(
                (a): ActionButton => ({
                  label: a.label,
                  icon: a.icon,
                  colorScheme: 'neutral',
                  onClick: () => undefined,
                })
              ),
            },
          ]}
        />
      ),
    },
    properties: {
      id: 'properties',
      label: 'Właściwości',
      icon: Layers,
      defaultOpen: true,
      children: <KeyValueList rows={data.properties} />,
    },
    relations: {
      id: 'relations',
      label: 'Powiązania — z czym to sąsiaduje',
      icon: Link2,
      defaultOpen: false,
      children: (
        <div className="flex flex-col gap-2">
          {data.relationGroups.map((g) => (
            <PreviewRelations key={g.title} title={g.title} items={g.items} />
          ))}
        </div>
      ),
    },
    evidence: {
      id: 'evidence',
      label: 'Źródła i założenia — na czym to oparto',
      icon: FileSearch,
      defaultOpen: false,
      children: (
        <div className="flex flex-col gap-3">
          <PreviewStructuredList
            title="Źródła"
            items={data.evidenceSources.map((s) => ({ id: s.id, label: s.label, note: s.note }))}
          />
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              Założenia przyjęte przez Teresę
            </div>
            <div className="flex flex-col gap-2">
              {data.evidenceAssumptions.map((a, i) => (
                <AssumptionCallout key={i} text={a} />
              ))}
            </div>
          </div>
        </div>
      ),
    },
    results: {
      id: 'results',
      label: 'Rezultaty — co z tego powstało',
      icon: CheckCircle2,
      defaultOpen: false,
      isEmpty: data.results.length === 0,
      emptyLabel: data.resultsEmptyNote,
      children: (
        <div className="flex flex-col gap-2">
          <PreviewRelations items={data.results} title="Powstało z tego artefaktu" />
          <p className="text-[11px] italic text-c-text-muted">{data.resultsEmptyNote}</p>
        </div>
      ),
    },
    comments: {
      id: 'comments',
      label: 'Komentarze',
      icon: MessageSquare,
      defaultOpen: false,
      badge: data.comments.filter((c) => !c.resolved).length,
      isEmpty: data.comments.length === 0,
      emptyLabel: 'Brak komentarzy.',
      children: <CommentThread comments={data.comments} />,
    },
    history: {
      id: 'history',
      label: 'Historia',
      icon: RefreshCw,
      defaultOpen: false,
      children: <PreviewActivityStrip events={data.history} initialCount={5} />,
    },
  };
  return ARTIFACT_PANEL_SECTION_ORDER.map((id) => byId[id]).filter(
    (s): s is ArtifactRightPanelSection => s !== undefined
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TERESA — tryb pasa, pełna wysokość, własne pole pisania (nowość — dziś
// nie istnieje jako samodzielny panel nigdzie, patrz nagłówek pliku).
// ═══════════════════════════════════════════════════════════════════════

const TeresaRailPanel: React.FC<{ data: ObjectData }> = ({ data }) => (
  <div className="flex h-full flex-col bg-c-surface">
    <div className="border-b border-c-border-subtle px-4 py-3">
      <div className="flex items-center gap-2">
        <Bot size={15} className="text-c-focus-solid" />
        <span className="text-sm font-semibold text-c-text">Teresa</span>
      </div>
      <p className="mt-1 text-[11px] text-c-text-muted">
        kontekst: {data.type === 'notatka' ? 'Notatka' : 'Idea'} „{data.title}"
      </p>
    </div>

    <div className="flex flex-wrap gap-1.5 border-b border-c-border-subtle px-4 py-2.5">
      {data.teresaCommands.map((c) => (
        <span
          key={c.label}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-c-border-subtle bg-c-surface-raised px-2.5 py-1 text-[11px] text-c-text-secondary hover:bg-c-surface"
        >
          <c.icon size={12} className="text-c-text-muted" />
          {c.label}
        </span>
      ))}
    </div>

    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
      {data.teresaMessages.map((m, i) =>
        m.assumption ? (
          <div key={i} className="flex justify-start">
            <div className="max-w-[85%]">
              <AssumptionCallout text={m.assumption} />
            </div>
          </div>
        ) : (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-snug ${
                m.role === 'user'
                  ? 'bg-c-focus/10 text-c-text'
                  : 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary'
              }`}
            >
              {m.text}
            </div>
          </div>
        )
      )}
    </div>

    <div className="border-t border-c-border-subtle p-3">
      <div className="flex items-end gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2">
        <textarea
          rows={1}
          readOnly
          placeholder="Napisz do Teresy…"
          className="min-h-[20px] flex-1 resize-none bg-transparent text-xs text-c-text placeholder:text-c-text-muted focus:outline-none"
        />
        <button
          type="button"
          aria-label="Wyślij"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-c-focus text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════
// CENTRUM (mock) — treść po lewej, żeby prawy pas miał realny kontekst
// szerokości. Nie jest przedmiotem tego prototypu.
// ═══════════════════════════════════════════════════════════════════════

const NotatkaCentrum: React.FC<{ data: ObjectData }> = ({ data }) => (
  <div className="mx-auto max-w-[640px] px-8 py-8">
    <h1 className="mb-1 text-xl font-bold text-c-text">{data.title}</h1>
    <p className="mb-6 text-xs text-c-text-muted">{data.subtitle}</p>
    {data.centrumParagraphs.map((p, i) => (
      <p key={i} className="mb-3 text-sm leading-relaxed text-c-text-secondary">
        {p}
      </p>
    ))}
  </div>
);

const IdeaCentrum: React.FC<{ data: ObjectData }> = ({ data }) => (
  <div className="relative flex h-full items-center justify-center overflow-hidden bg-c-surface-raised">
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          'radial-gradient(circle, color-mix(in srgb, var(--c-border) 60%, transparent) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    />
    <div className="relative flex flex-col items-center gap-3">
      <div className="rounded-xl border border-c-border bg-c-surface px-5 py-3 text-sm font-medium text-c-text shadow-sm">
        {data.title.split(' — ')[0]}
      </div>
      <div className="flex gap-3">
        {['popyt', 'konkurencja', 'kanały', 'ryzyka'].map((n) => (
          <div
            key={n}
            className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-xs text-c-text-secondary"
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════
// SZYNA — ikony w kolejności Artefakt · Teresa · narzędzie zależne od typu.
// Trzecia ikona świadomie NIEAKTYWNA dla notatki/idei — kanon dziś nie
// definiuje dla nich takiego narzędzia (przykłady z analizy: Kontrola
// jakości w Wordzie, Struktura w Excelu). Pokazana wyłączona, żeby było
// widać, że formuła REZERWUJE na to miejsce, a nie że go brakuje.
// ═══════════════════════════════════════════════════════════════════════

function buildRailTools(objType: ObjectType): RightRailToolDescriptor[] {
  return [
    { id: 'artefakt', label: 'Artefakt', icon: LayoutGrid },
    { id: 'teresa', label: 'Teresa', icon: Bot },
    {
      id: 'typ-narzedzie',
      label: 'Narzędzie zależne od typu',
      icon: Wrench,
      disabled: true,
      disabledReason: `${objType === 'notatka' ? 'Notatka' : 'Idea'} nie ma dziś dodatkowego narzędzia „po artefakcie" (wzór: Kontrola jakości w Wordzie, Struktura w Excelu) — miejsce w formule zarezerwowane, świadomie puste.`,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// EKRAN
// ═══════════════════════════════════════════════════════════════════════

export interface PrawyPasJednaFormulaScreenProps {
  initialObjectType?: ObjectType;
  initialRailMode?: RailMode;
  /** false = brak przełącznika na ekranie (warianty do zrzutów skryptowych). */
  interactive?: boolean;
}

export function PrawyPasJednaFormulaScreen({
  initialObjectType = 'notatka',
  initialRailMode = 'artefakt',
  interactive = true,
}: PrawyPasJednaFormulaScreenProps): React.ReactElement {
  const [objectType, setObjectType] = useState<ObjectType>(initialObjectType);
  const [railMode, setRailMode] = useState<RailMode>(initialRailMode);
  const data = OBJECTS[objectType];

  const tools = useMemo(() => buildRailTools(objectType), [objectType]);
  const sections = useMemo(() => buildArtifactSections(data), [data]);

  const panelContent =
    railMode === 'artefakt' ? (
      <ArtifactRightPanel sections={sections} width="100%" className="border-l-0" />
    ) : (
      <TeresaRailPanel data={data} />
    );

  return (
    <div className="flex h-screen w-screen flex-col bg-c-surface" data-testid="jedna-formula-root">
      <div className="flex h-12 items-center gap-3 border-b border-c-border-subtle px-4">
        <span className="text-sm font-semibold text-c-text">Prawy pas — jedna formuła</span>
        <span className="text-c-text-muted">·</span>
        <span className="text-xs text-c-text-muted">
          {objectType === 'notatka' ? 'Notatka' : 'Idea'} · tryb:{' '}
          {railMode === 'artefakt' ? 'Artefakt' : 'Teresa'}
        </span>
        {interactive ? (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-c-border-subtle">
              {(['notatka', 'idea'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setObjectType(t)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    objectType === t
                      ? 'bg-c-focus/10 text-c-focus-solid'
                      : 'text-c-text-secondary hover:bg-c-surface-raised'
                  }`}
                  data-testid={`toggle-obiekt-${t}`}
                >
                  {t === 'notatka' ? 'Notatka' : 'Idea'}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-lg border border-c-border-subtle">
              {(['artefakt', 'teresa'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRailMode(m)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    railMode === m
                      ? 'bg-c-focus/10 text-c-focus-solid'
                      : 'text-c-text-secondary hover:bg-c-surface-raised'
                  }`}
                  data-testid={`toggle-tryb-${m}`}
                >
                  {m === 'artefakt' ? 'Artefakt' : 'Teresa'}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          {objectType === 'notatka' ? <NotatkaCentrum data={data} /> : <IdeaCentrum data={data} />}
        </div>
        <RightRail
          tools={tools}
          activeToolId={railMode === 'artefakt' ? 'artefakt' : 'teresa'}
          onSelectTool={(id) => {
            if (id === 'artefakt' || id === 'teresa') setRailMode(id);
          }}
          panelContent={panelContent}
          panelWidth={380}
          collapsed={false}
          onToggleCollapse={() => undefined}
          collapsible={false}
          testId="jedna-formula-rail"
        />
      </div>
    </div>
  );
}

export default PrawyPasJednaFormulaScreen;
