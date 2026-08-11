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
 *  - Sekcja BEZ ZASTOSOWANIA może być NIEOBECNA (lepiej brak niż pusty akordeon
 *    udający funkcję), ale sekcje OBECNE zachowują powyższą kolejność.
 *  - Sekcja historii nazywa się „Historia" — bez „/ AI". AI zostaje jako TYP WPISU
 *    i filtr wewnątrz strumienia, nie w nazwie sekcji.
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
import { ChevronDown, type LucideIcon } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

  if (!collapsible) {
    return (
      <section className="border-b border-c-border-subtle last:border-b-0">
        <div className="flex items-center h-11 px-4">{header}</div>
        {body}
      </section>
    );
  }

  return (
    <section className="border-b border-c-border-subtle last:border-b-0">
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
  sections,
  width = 'var(--ntype-right-panel-width)',
  className,
  ariaLabel,
  statusBar,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const defaultAriaLabel = t(
    'common.artifactDetailsPanel',
    isPolish ? 'Szczegóły artefaktu' : 'Artifact details'
  );
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

  return (
    <aside
      aria-label={ariaLabel ?? defaultAriaLabel}
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
    </aside>
  );
};

export default ArtifactRightPanel;
