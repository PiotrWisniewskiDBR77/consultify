/**
 * ArtifactRightPanel — wspólny prawy panel artefaktu (accordion sekcji).
 *
 * SSOT: Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §10.2 / §11.2 (SPEC-A).
 * Powłoka wspólna dla WSZYSTKICH 5 archetypów (A Canvas · B Dokument · C Rekord
 * · D Matryca · E Deck) — to jest dla ARTEFAKTU tym, czym StandardPreview dla LISTY.
 *
 * Sekcje w STAŁEJ kolejności (moduł deklaruje treść, komponent narzuca wygląd) —
 * standard n-Type ETAP 1.3/1.4, wzorzec = karta Inicjatywy:
 *
 *   ① Akcje  ② Właściwości  ③ Powiązania  ④ Źródła i założenia
 *   ⑤ Rezultaty (warunkowo)  ⑥ Komentarze  ⑦ Historia
 *
 * Reguły kolejności/nazewnictwa (obowiązują WSZYSTKIE 6 kart N — Decyzja, Zadanie,
 * Powiadomienie, Wniosek, Narzędzie, Inicjatywa):
 *  - ★ ZMIANA 2026-08-30 (decyzja właściciela po odbiorze `deck-artifact`, zapis
 *    w `docs/program/grafika/KANON_Z_ODBIOROW.md`: „sekcja mieszka w jednym
 *    miejscu w całej aplikacji"). SZEŚĆ sekcji (wszystkie oprócz warunkowych
 *    „Rezultatów") jest OBOWIĄZKOWYCH i WIDOCZNYCH. Sekcja bez treści mówi to
 *    wprost stanem pustym — NIE znika. Poprzednia reguła („sekcja bez
 *    zastosowania może być nieobecna") jest UCHYLONA: to ona pozwoliła trzem
 *    rodzinom artefaktów (Idee, Notatnik, Tabela idei) zgubić „Źródła
 *    i założenia", a Warsztatowi SWOT — „Historię".
 *  - Nazwy sekcji NIE są w gestii wołającego: SSOT =
 *    `ARTIFACT_PANEL_SECTION_LABELS` niżej, a ten komponent NADPISUJE `label`
 *    dla każdego kanonicznego `id`. Dlatego „HISTORIA / AI" i „HISTORIA I AI"
 *    nie mogą już powstać w żadnym module.
 *  - Sekcja historii nazywa się „Historia" — bez „/ AI". AI zostaje jako TYP WPISU
 *    i filtr wewnątrz strumienia, nie w nazwie sekcji.
 *  - Teresa NIGDY nie jest treścią sekcji „Historia" (kontrakt
 *    `ArtifactRailTeresaMode` w `ArtifactRightRail.tsx`: „NIGDY sekcja
 *    akordeonu"). Wzorzec odebrany przez właściciela (`deck-artifact`): wejście
 *    do Teresy to PRZYCISK w sekcji Akcje.
 *  - Domyślnie ROZWINIĘTE: Akcje i Właściwości. Reszta `defaultOpen: false`.
 *  - Kanoniczne id sekcji: patrz `ARTIFACT_PANEL_SECTION_ORDER` niżej.
 *
 * Zasady (jak StandardTable/StandardPreview):
 *  - Moduł podaje `sections` (id + label + treść). Wygląd (nagłówek h-11 L1 +
 *    chevron, ramki, tło, collapse) narzuca ten komponent.
 *  - Wyłącznie tokeny `c-*` (zero navy/slate/hex, zero crimson). Fokus = c-focus.
 *  - Treść sekcji budujemy z prymitywów `shared/PreviewPane/*`
 *    (PreviewActionBar/PreviewRelations/PreviewActivityStrip/PreviewAIHintStrip…) —
 *    ten komponent jest tylko kontenerem-accordion, nie renderuje treści sam.
 *  - Brak Headless UI w projekcie → własny collapsible (useState).
 */
import {
  ChevronDown,
  History,
  Lightbulb,
  Link2,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * KANONICZNA kolejność sekcji prawego panelu (standard n-Type ETAP 1.3).
 * Wzorzec = karta Inicjatywy. Karta może POMINĄĆ sekcję (brak zastosowania),
 * ale NIE MOŻE zmienić kolejności obecnych. Test kolejności czyta tę stałą.
 */
export const ARTIFACT_PANEL_SECTION_ORDER = [
  'actions', // ① Akcje            — defaultOpen: true
  'properties', // ② Właściwości       — defaultOpen: true
  'relations', // ③ Powiązania        — defaultOpen: false
  'evidence', // ④ Źródła i założenia — defaultOpen: false
  'results', // ⑤ Rezultaty (warunkowo) — defaultOpen: false
  'comments', // ⑥ Komentarze        — defaultOpen: false
  'history', // ⑦ Historia (nazwa bez dopisku o AI) — defaultOpen: false
] as const;

export type ArtifactPanelSectionId = (typeof ARTIFACT_PANEL_SECTION_ORDER)[number];

/**
 * ★ SSOT NAZW SEKCJI (2026-08-30). Dopóki nazwy budował każdy moduł u siebie,
 * ta sama sekcja nazywała się „HISTORIA", „HISTORIA / AI" i „HISTORIA I AI" na
 * trzech ekranach naraz (przegląd `docs/program/grafika/PRZEGLAD_PRZED_ODBIOREM.md`
 * §Z-2). Kolejność miała wspólne źródło (`ARTIFACT_PANEL_SECTION_ORDER`) —
 * nazwy nie miały żadnego. Tu jest to jedno miejsce.
 *
 * `ArtifactRightPanel` NADPISUJE `label` wołającego dla każdego kanonicznego
 * `id`; `label` z modułu liczy się wyłącznie dla sekcji SPOZA kanonu.
 */
export const ARTIFACT_PANEL_SECTION_LABELS: Record<
  ArtifactPanelSectionId,
  { pl: string; en: string }
> = {
  actions: { pl: 'Akcje', en: 'Actions' },
  properties: { pl: 'Właściwości', en: 'Properties' },
  relations: { pl: 'Powiązania', en: 'Relations' },
  evidence: { pl: 'Źródła i założenia', en: 'Sources and assumptions' },
  results: { pl: 'Rezultaty', en: 'Results' },
  comments: { pl: 'Komentarze', en: 'Comments' },
  // Bez dopisku „/ AI" ani „i AI" — AI jest TYPEM WPISU w strumieniu, nie nazwą
  // sekcji (SPEC-A §11.2 + decyzja z odbioru `deck-artifact`).
  history: { pl: 'Historia', en: 'History' },
};

/** Ikona kanoniczna sekcji — używana, gdy moduł nie poda własnej. */
const CANONICAL_SECTION_ICONS: Record<ArtifactPanelSectionId, LucideIcon> = {
  actions: Sparkles,
  properties: SlidersHorizontal,
  relations: Link2,
  evidence: ShieldCheck,
  results: Lightbulb,
  comments: MessageSquare,
  history: History,
};

/**
 * SZEŚĆ sekcji obowiązkowych. „Rezultaty" (`results`) zostają warunkowe — są
 * pojęciem tylko tam, gdzie artefakt coś produkuje (karty N, sesja narzędzia),
 * i kanon z odbiorów wymienia sześć nazw, nie siedem.
 */
export const ARTIFACT_PANEL_MANDATORY_SECTIONS: ArtifactPanelSectionId[] =
  ARTIFACT_PANEL_SECTION_ORDER.filter((id) => id !== 'results');

/**
 * Uczciwe stany puste dla sekcji dołożonej automatycznie. Zasada właściciela:
 * „sekcja pusta ma być widoczna i uczciwa, nie ukryta" — komunikat mówi, że
 * czegoś NIE MA, i nie udaje funkcji, której nie ma.
 */
const CANONICAL_SECTION_EMPTY_LABELS: Record<
  ArtifactPanelSectionId,
  { pl: string; en: string }
> = {
  actions: { pl: 'Brak dostępnych akcji.', en: 'No actions available.' },
  properties: { pl: 'Brak właściwości.', en: 'No properties.' },
  relations: { pl: 'Brak powiązań.', en: 'No relations.' },
  evidence: {
    pl: 'Brak zapisanych źródeł i założeń.',
    en: 'No sources or assumptions recorded.',
  },
  results: { pl: 'Brak rezultatów.', en: 'No results.' },
  comments: { pl: 'Brak komentarzy.', en: 'No comments.' },
  history: { pl: 'Brak zapisanej historii.', en: 'No history recorded.' },
};

const CANONICAL_SECTION_IDS = new Set<string>(ARTIFACT_PANEL_SECTION_ORDER);

/**
 * Ile kanonicznych `id` musi zadeklarować wołający, żeby panel został uznany za
 * panel ARTEFAKTU i domknięty do kanonu. Poniżej progu komponent nie rusza
 * niczego — `ArtifactRightPanel` bywa użyty jako czysty akordeon z własnym
 * zestawem `id` (np. `AgentPlanPanel`: plan/progress/approvals/report), a
 * dokładanie mu „Źródeł i założeń" byłoby wymyślaniem funkcji.
 */
const CANONICAL_SHELL_THRESHOLD = 3;

/**
 * Wygląd wzorcowy panelu karty N (ETAP 1.4): JASNY ZAOKRĄGLONY KOMPONENT
 * ODSUNIĘTY OD KRAWĘDZI — nie techniczny sidebar przyklejony do brzegu ekranu.
 *
 * Dwa warianty to ten SAM wygląd w dwóch kontekstach layoutu:
 *  - `_STICKY`  — karta w kolumnie ze scrollem STRONY (Inicjatywa/Decyzja/
 *    Zadanie/Powiadomienie). Wołający owija w `sticky top-6 self-start`,
 *    więc odsunięcie daje wrapper, a max-h liczy się od viewportu.
 *  - `_DOCKED`  — karta w slocie `rightPanel` powłoki `NModeShell` (Wniosek/
 *    Narzędzie). Slot jest pełnowysokościowy i dociśnięty do krawędzi, więc
 *    odsunięcie musi dać sam panel (`m-4`), a max-h liczy się od kontenera.
 *
 * Powłoka NEUTRALNA: wyłącznie tokeny `c-*`, czerwień tylko semantyka krytyczna.
 */
export const ARTIFACT_PANEL_CARD_CLASS_STICKY =
  'rounded-2xl border border-c-border-subtle max-h-[calc(100vh-3rem)]';

export const ARTIFACT_PANEL_CARD_CLASS_DOCKED =
  'rounded-2xl border border-c-border-subtle m-4 max-h-[calc(100%-2rem)]';

export interface ArtifactRightPanelSection {
  /** Stabilny id sekcji (np. 'actions' | 'properties' | 'relations' | 'comments' | 'history'). */
  id: string;
  /** Etykieta nagłówka (już przetłumaczona przez wywołującego). Renderowana jako L1 UPPERCASE. */
  label: string;
  /** Ikona typu sekcji (opcjonalnie, 14px, c-text-muted). */
  icon?: LucideIcon;
  /** Treść sekcji (zwykle złożona z prymitywów PreviewPane). Renderowana gdy sekcja otwarta. */
  children: React.ReactNode;
  /** Czy sekcja jest zwijalna (default true). false = zawsze otwarta, bez chevronu. */
  collapsible?: boolean;
  /** Stan początkowy (default true = otwarta). */
  defaultOpen?: boolean;
  /** Licznik przy nagłówku (np. liczba komentarzy). 0/undefined = brak (chyba że `showZeroBadge`). */
  badge?: number;
  /**
   * Gdy true, `badge: 0` RENDERUJE się jako widoczny licznik „0" zamiast
   * chować się (domyślne zachowanie: 0 = brak licznika). Etap 4 gridu
   * n-Type (_GRID_STABILIZATION_COMMAND_2026-07-24.md §Prawy panel): „puste
   * sekcje mogą być widoczne jako zwinięte z licznikiem 0" — ale WYŁĄCZNIE
   * tam, gdzie wołający świadomie to zadeklaruje (np. sekcja Akcje w
   * Podglądzie, nowo dodane puste Comments/History). Domyślnie `false`, więc
   * WSZYSTKIE istniejące sekcje (Komentarze/Historia/Powiązania na 6 kartach)
   * zachowują dotychczasowe zachowanie 1:1 — licznik 0 nadal chowany.
   */
  showZeroBadge?: boolean;
  /** Gdy true — sekcja pokazuje stan pusty zamiast treści. */
  isEmpty?: boolean;
  /** Tekst stanu pustego (gdy isEmpty). Bez tekstu → neutralny placeholder '—'. */
  emptyLabel?: string;
}

export interface ArtifactRightPanelProps {
  /**
   * Sekcje w kolejności deklaracji. Kanon n-Type (patrz
   * `ARTIFACT_PANEL_SECTION_ORDER`): Akcje · Właściwości · Powiązania ·
   * Źródła i założenia · Rezultaty (warunkowo) · Komentarze · Historia.
   */
  sections: ArtifactRightPanelSection[];
  /**
   * Szerokość panelu. Domyślnie token gridu n-Type
   * (`--ntype-right-panel-width: 320px`) — stała szerokość wspólna dla sześciu
   * kart (SSOT: _GRID_STABILIZATION_COMMAND_2026-07-24). Można nadpisać liczbą
   * (px) tam, gdzie powłoka steruje szerokością własnym stanem.
   */
  width?: number | string;
  /** Dodatkowa klasa kontenera. */
  className?: string;
  /**
   * Aria-label kontenera (a11y). Pominięty → domyślny, PRZETŁUMACZONY podpis
   * (`common.artifactDetailsPanel`, PL/EN wg `i18n.language` — patrz OQ-UI-D
   * platforma, 2026-08-11: żaden dzisiejszy konsument nie podaje tego propa,
   * więc statyczny angielski literał renderował się identycznie na koncie
   * polskim i angielskim; zero callerów ustawiało go jawnie, więc ta zmiana
   * jest bezpieczna wstecznie — poprawia WSZYSTKICH konsumentów naraz).
   */
  ariaLabel?: string;
  /**
   * HP-8 (Harvey-Parity workflow engine): opcjonalny slot NAD sekcjami dla
   * paska stanu draft/review/approved (np. `ArtifactApprovalStatusBar`,
   * src/components/standard/ArtifactApprovalStatusBar.tsx). Czysto addytywne
   * — gdy nieustawione (domyślnie wszędzie dziś), panel renderuje się 1:1
   * jak wcześniej. Wołający decyduje KIEDY go pokazać (typowo za flagą
   * `artifactApprovalUi`, patrz src/utils/artifactApprovalUiFlag.ts) —
   * wygląd/dobór miejsca to praca Vegas po akceptacji zrzutów (DoD §18.1),
   * ten prop tylko udostępnia miejsce w powłoce.
   */
  statusBar?: React.ReactNode;
  /**
   * @deprecated DEC-419 (właściciel, 06.09.2026, karta Inicjatywy): wejście do
   * Teresy z panelu artefaktu zostało usunięte — jedyne wejście jest teraz
   * w Menu 1 (`data-testid="menu1-teresa"`, DEC-404), a karty mają już
   * „Pracuj z AI" (DEC-407). Prop zostaje w typie przez jeden krok, żeby nie
   * wywrócić wołających, którzy jeszcze go przekazują — komponent go IGNORUJE
   * i NIC nie renderuje. Nowi wołający nie powinni go ustawiać.
   */
  teresaEntry?: {
    label: string;
    onOpen: () => void;
    disabled?: boolean;
    disabledReason?: string;
  };
  /**
   * ★ 2026-09-05 (decyzja CTO „jeden prawy panel" na Mapie myśli). Panel
   * renderuje domyślnie WŁASNY `<aside>` — poprawne, gdy jest jedynym
   * korzeniem panelu. Ale konsument, który sam już jest `<aside aria-label>`
   * (np. `IdeaElementInspector`: nagłówek + zakładki Element/Teresa nad tym
   * accordionem), dostawał przez to DWA zagnieżdżone punkty orientacyjne —
   * dla czytnika ekranu to dwa panele zamiast jednego, a dla odbioru
   * „policz `aside`" fałszywe 2 zamiast 1. `renderAs="div"` oddaje ten
   * jeden `<aside>` gospodarzowi. Domyślnie `'aside'` → zero zmiany u
   * wszystkich dotychczasowych konsumentów.
   */
  renderAs?: 'aside' | 'div';
}

const SectionRow: React.FC<{
  section: ArtifactRightPanelSection;
  open: boolean;
  onToggle: () => void;
}> = ({ section, open, onToggle }) => {
  const {
    label,
    icon: Icon,
    children,
    collapsible = true,
    badge,
    showZeroBadge,
    isEmpty,
    emptyLabel,
  } = section;
  const showBadge = typeof badge === 'number' && (badge > 0 || (badge === 0 && showZeroBadge));

  const header = (
    <div className="flex items-center gap-2 min-w-0">
      {Icon ? <Icon size={14} className="shrink-0 text-c-text-muted" /> : null}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted truncate">
        {label}
      </span>
      {showBadge ? (
        <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold tabular-nums text-c-text-muted bg-c-surface-raised">
          {badge}
        </span>
      ) : null}
    </div>
  );

  const body = (
    <div className="px-4 pb-4 pt-1">
      {isEmpty ? (
        <p className="text-xs italic text-c-text-muted py-1.5">{emptyLabel ?? '—'}</p>
      ) : (
        children
      )}
    </div>
  );

  /*
   * `data-artifact-section` — znacznik POMIAROWY, nie styl.
   *
   * Kanon kolejności prawego pasa (`ARTIFACT_PANEL_SECTION_ORDER`: Akcje ·
   * Właściwości · Powiązania · Źródła i założenia · Rezultaty · Komentarze ·
   * Historia) do dziś dawało się sprawdzić tylko czytaniem kodu albo oczami na
   * zrzucie. Właściciel zgłosił rozjazd prawego pasa DWA RAZY (01.09 R2 na
   * sześciu ekranach, 02.09 na czterech), a odpowiedzią za każdym razem była
   * opinia. Ten atrybut pozwala zmierzyć kolejność z żywego DOM-u
   * (`scripts/dev/measure-right-panel-canon.mjs`) i porównać dwa ekrany
   * liczbami, a nie wrażeniem.
   */
  if (!collapsible) {
    return (
      <section
        data-artifact-section={section.id}
        className="border-b border-c-border-subtle last:border-b-0"
      >
        <div className="flex items-center h-11 px-4">{header}</div>
        {body}
      </section>
    );
  }

  return (
    <section
      data-artifact-section={section.id}
      className="border-b border-c-border-subtle last:border-b-0"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 h-11 px-4 transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] focus-visible:ring-inset"
      >
        {header}
        <ChevronDown
          size={16}
          className={`shrink-0 text-c-text-muted transition-transform duration-base ease-standard ${open ? '' : '-rotate-90'} motion-reduce:transition-none`}
        />
      </button>
      {open ? body : null}
    </section>
  );
};

export const ArtifactRightPanel: React.FC<ArtifactRightPanelProps> = ({
  sections: declaredSections,
  width = 'var(--ntype-right-panel-width)',
  className,
  ariaLabel,
  statusBar,
  // DEC-419: `teresaEntry` nie jest już czytany — patrz komentarz przy propie.
  renderAs = 'aside',
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const defaultAriaLabel = t(
    'common.artifactDetailsPanel',
    isPolish ? 'Szczegóły artefaktu' : 'Artifact details'
  );

  /**
   * ★ DOMKNIĘCIE DO KANONU W JEDNYM MIEJSCU (2026-08-30).
   *
   * Trzy rzeczy, których wołający NIE ustala już sam:
   *  1. KOLEJNOŚĆ sekcji kanonu — z `ARTIFACT_PANEL_SECTION_ORDER`;
   *  2. NAZWA sekcji kanonu — z `ARTIFACT_PANEL_SECTION_LABELS`;
   *  3. OBECNOŚĆ sześciu sekcji obowiązkowych — brakująca dokłada się jako
   *     widoczny, zwinięty akordeon z uczciwym stanem pustym.
   *
   * Sekcje spoza kanonu (moduł ma prawo dołożyć własną) lądują NA KOŃCU,
   * w kolejności deklaracji, z własną nazwą — nie mogą wcisnąć się pomiędzy
   * sekcje kanonu. Panel, który nie deklaruje co najmniej
   * `CANONICAL_SHELL_THRESHOLD` kanonicznych `id`, przechodzi 1:1 bez zmian.
   *
   * Dlaczego tutaj, a nie w każdym module: naprawa per artefakt w tym repo
   * ODRASTA — ten sam defekt załatany per wywołanie wrócił po ośmiu tygodniach
   * w dwunastu plikach. `ArtifactRightRail` (flaga `ff_artifact_right_rail`,
   * domyślnie OFF) miał tę normalizację od początku; ścieżka, którą realnie
   * widzi użytkownik, nie miała jej wcale.
   */
  const sections = useMemo<ArtifactRightPanelSection[]>(() => {
    // DEC-419: `teresaEntry` NIE renderuje się już tutaj (patrz komentarz przy
    // propie w interfejsie). Panel przechodzi 1:1 bez wstrzykiwania przycisku.
    const declaredCanonical = declaredSections.filter((section) =>
      CANONICAL_SECTION_IDS.has(section.id)
    );
    if (declaredCanonical.length < CANONICAL_SHELL_THRESHOLD) {
      return declaredSections;
    }

    const label = (id: ArtifactPanelSectionId): string => {
      const entry = ARTIFACT_PANEL_SECTION_LABELS[id];
      return t(`artifactPanel.section.${id}`, isPolish ? entry.pl : entry.en);
    };
    const emptyLabel = (id: ArtifactPanelSectionId): string => {
      const entry = CANONICAL_SECTION_EMPTY_LABELS[id];
      return t(`artifactPanel.sectionEmpty.${id}`, isPolish ? entry.pl : entry.en);
    };

    /**
     * Ranga sortowania. Sekcja kanonu dostaje swój indeks z
     * `ARTIFACT_PANEL_SECTION_ORDER`. Sekcja SPOZA kanonu (moduł ma prawo
     * dołożyć własną) dziedziczy rangę OSTATNIEJ kanonicznej sekcji przed nią
     * w deklaracji + 0.5 — czyli zostaje TAM, GDZIE ją postawiono, zamiast
     * lecieć na koniec panelu. Wypychanie ich na koniec zmierzono na karcie
     * Inicjatywy: sekcja „Rezultaty" (zadeklarowana pod nie-kanonicznym id)
     * przeskoczyła pod „Historię".
     */
    type Ranked = { section: ArtifactRightPanelSection; rank: number; seq: number };
    const ranked: Ranked[] = [];
    let lastRank = -1;
    declaredSections.forEach((section, seq) => {
      const canonIndex = ARTIFACT_PANEL_SECTION_ORDER.indexOf(
        section.id as ArtifactPanelSectionId
      );
      if (canonIndex >= 0) {
        lastRank = canonIndex;
        ranked.push({
          section: { ...section, label: label(section.id as ArtifactPanelSectionId) },
          rank: canonIndex,
          seq,
        });
        return;
      }
      ranked.push({ section, rank: lastRank + 0.5, seq });
    });

    // Domknięcie do sześciu sekcji obowiązkowych. „Rezultaty" zostają
    // warunkowe — nie wymyślamy ich artefaktowi, który nic nie produkuje.
    const declaredIds = new Set(declaredSections.map((section) => section.id));
    ARTIFACT_PANEL_MANDATORY_SECTIONS.forEach((id) => {
      if (declaredIds.has(id)) return;
      ranked.push({
        section: {
          id,
          label: label(id),
          icon: CANONICAL_SECTION_ICONS[id],
          defaultOpen: false,
          isEmpty: true,
          emptyLabel: emptyLabel(id),
          children: null,
        },
        rank: ARTIFACT_PANEL_SECTION_ORDER.indexOf(id),
        seq: -1,
      });
    });

    ranked.sort((a, b) => (a.rank === b.rank ? a.seq - b.seq : a.rank - b.rank));
    return ranked.map((entry) => entry.section);
  }, [declaredSections, isPolish, t]);
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(sections.filter((s) => s.defaultOpen ?? true).map((s) => s.id))
  );

  // Fix (fotograf HP-4): gdy wołający podmienia CAŁY zestaw sekcji między
  // renderami bez remountu (np. AgentPlanPanel: placeholder {id:'loading'} ->
  // {plan, progress, approvals, report} po dociągnięciu danych), `openIds`
  // liczone raz w leniwym inicjalizatorze useState zostawało z id, które już
  // nie istnieją, a nowe id (nawet defaultOpen) startowały jako domknięte.
  // Ten efekt dogania: gdy w sections pojawi się id nieobecne poprzednio,
  // dopisuje je do openIds (jeśli defaultOpen), NIE ruszając id ręcznie
  // zwiniętych/rozwiniętych przez usera. Dla konsumentów ze stałym zestawem
  // id (Insight/Decision/Task — sections budowane ze stałej listy kluczy)
  // zbiór id nigdy się nie zmienia między renderami, więc efekt nic nie robi.
  const sectionIdSetRef = useRef<Set<string>>(new Set(sections.map((s) => s.id)));

  // Fix (Etap 4 gridu n-Type, weryfikacja renderu 2026-07-24): sekcje typu
  // Akcje liczą `defaultOpen` z `readMode` (zwinięta w Podglądzie). Ale
  // `readMode` na kartach n-Type (Task/Decision/Notification/Initiative)
  // startuje z OPTYMISTYCZNYM zgadywaniem (np. `Boolean(taskId)`) i dopiero
  // po async `load*()` dostaje prawdziwą wartość — czyli `defaultOpen` tej
  // SAMEJ sekcji potrafi przeskoczyć false→true (albo odwrotnie) PO
  // pierwszym renderze, zanim user cokolwiek kliknął. Bez tego efektu sekcja
  // zostawała zamrożona w stanie z pierwszego (błędnego) odgadnięcia —
  // zmierzone na żywym renderze karty Zadania: „Akcje" ze świeżymi
  // przyciskami stały ZWINIĘTE, bo pierwszy render zgadł Podgląd.
  // Śledzimy `defaultOpen` per id i, gdy się zmienia, DOGANIAMY openIds —
  // ale TYLKO dla id, których user jeszcze ręcznie nie tknął (`toggle`).
  // Ręczna decyzja usera zawsze wygrywa z odgadywaniem sterowanym z zewnątrz.
  const manuallyToggledRef = useRef<Set<string>>(new Set());
  const defaultOpenByIdRef = useRef<Map<string, boolean>>(
    new Map(sections.map((s) => [s.id, s.defaultOpen ?? true]))
  );

  useEffect(() => {
    const prevIds = sectionIdSetRef.current;
    const prevDefaultOpen = defaultOpenByIdRef.current;
    const newlyAppeared = sections.filter((s) => !prevIds.has(s.id));
    const toOpen = newlyAppeared.filter((s) => s.defaultOpen ?? true);
    const toClose = newlyAppeared.filter((s) => !(s.defaultOpen ?? true));

    const flipped = sections.filter((s) => {
      if (!prevIds.has(s.id)) return false; // obsłużone jako newlyAppeared
      if (manuallyToggledRef.current.has(s.id)) return false; // user decyduje
      const prevWantOpen = prevDefaultOpen.get(s.id) ?? true;
      const wantOpen = s.defaultOpen ?? true;
      return prevWantOpen !== wantOpen;
    });

    if (toOpen.length > 0 || toClose.length > 0 || flipped.length > 0) {
      setOpenIds((prev) => {
        const next = new Set(prev);
        let changed = false;
        toOpen.forEach((s) => {
          if (!next.has(s.id)) {
            next.add(s.id);
            changed = true;
          }
        });
        // Nowo pojawione id z `defaultOpen: false` NIE wymagają zapisu (Set
        // domyślnie ich nie zawiera), ale pętla zostaje dla czytelności /
        // symetrii z `flipped` niżej.
        toClose.forEach((s) => {
          if (next.has(s.id)) {
            next.delete(s.id);
            changed = true;
          }
        });
        flipped.forEach((s) => {
          const wantOpen = s.defaultOpen ?? true;
          if (wantOpen && !next.has(s.id)) {
            next.add(s.id);
            changed = true;
          } else if (!wantOpen && next.has(s.id)) {
            next.delete(s.id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }

    sectionIdSetRef.current = new Set(sections.map((s) => s.id));
    defaultOpenByIdRef.current = new Map(sections.map((s) => [s.id, s.defaultOpen ?? true]));
  }, [sections]);

  const toggle = useCallback((id: string) => {
    manuallyToggledRef.current.add(id);
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const Root = renderAs;
  return (
    <Root
      // Gospodarz z własnym `<aside>` (renderAs="div") niesie już etykietę —
      // nie duplikujemy jej na wewnętrznym kontenerze.
      {...(renderAs === 'aside' ? { 'aria-label': ariaLabel ?? defaultAriaLabel } : {})}
      style={{ width, minWidth: width }}
      className={`shrink-0 h-full overflow-y-auto bg-c-surface border-l border-c-border-subtle ${className ?? ''}`}
    >
      {statusBar ? (
        <div className="border-b border-c-border-subtle px-4 py-3">{statusBar}</div>
      ) : null}
      {sections.map((section) => (
        <SectionRow
          key={section.id}
          section={section}
          open={(section.collapsible ?? true) ? openIds.has(section.id) : true}
          onToggle={() => toggle(section.id)}
        />
      ))}
    </Root>
  );
};

export default ArtifactRightPanel;
