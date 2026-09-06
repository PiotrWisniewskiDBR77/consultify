/**
 * ArtifactRightRail — JEDEN WSPÓLNY SYSTEM prawego pasa artefaktu.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * PO CO ISTNIEJE
 * ═══════════════════════════════════════════════════════════════════════
 * Zmierzone 2026-08-30 (`docs/program/grafika/ANALIZA_PRAWY_PANEL.md` §6):
 * w aplikacji jest JEDENAŚCIE prawych szyn — cztery na kanonicznym
 * `ArtifactRightPanel`, siedem z własną budową. Miejsce Teresy jest inne
 * w każdej z nich:
 *
 *   notatnik → przycisk-wyjście „Open Teresa" w sekcji Historii
 *   idee     → sekcja akordeonu (`IdeaTeresaSection`)
 *   czat     → cały prawy pas
 *   Word     → ikona na szynie narzędzi  ← JEDYNY poprawny
 *
 * Rozstrzygnięcie właściciela z 2026-08-30 (zatwierdzone, architektoniczne):
 *
 *   „Teresa staje się jedną z ikon na stałej szynie prawego pasa — tak jak
 *   jest już w Wordzie. Rozciągamy wzorzec z Worda na całą strukturę."
 *
 * ★★★ ZASTĄPIONE 2026-09-01 — „JEDNA TERESA, W SWOIM OKNIE" ★★★
 * Właściciel odrzucił dokładnie TEN wzorzec (tryb ② „Teresa" poniżej — czat
 * pełnej wysokości na szynie) przy odbiorze prototypu `-idea-teresa`/
 * `-notatka-teresa`: „nie wiem dlaczego teresa jest w oknie narzędzia skoro
 * jest osobna teresa" / „przecież teresa ma okno swoje". Nowa decyzja
 * (docs/program/grafika/KANON_Z_ODBIOROW.md, wpis 2026-09-01): czat NIE
 * wchodzi na szynę w ŻADNEJ formie, ani jako sekcja akordeonu, ani jako
 * tryb pełnej wysokości opisany niżej. Panel artefaktu dostaje wyłącznie
 * JEDEN przycisk-wejście do głównego okna Teresy (sekcja „Akcje").
 * ★ WYKONANE (dyżur 169): tryb ② NIE JEST JUŻ RENDEROWANY — ani jako ikona
 * na szynie, ani jako panel. `TeresaModePanel` i `ArtifactRailTeresaMode`
 * zostają w pliku jako MARTWY mechanizm (usunięte jest wołanie, nie kod).
 * ★ DEC-419 (właściciel, 06.09.2026, karta Inicjatywy): przycisk-wejście
 * w sekcji „Akcje" USUNIĘTY TAKŻE. Jedyne wejście do Teresy jest teraz
 * w Menu 1 (DEC-404), karty mają już „Pracuj z AI" (DEC-407) — drugi
 * przycisk był duplikatem. `teresa.entryLabel`/`teresa.footerAction` zostają
 * w typie (dotychczasowi wołający — `IdeaRightPanel`, `NotebookRightRail` —
 * jeszcze je przekazują), ale nie mają już żadnego skutku wizualnego.
 *
 * Ten komponent jest dla PRAWEGO PASA tym, czym `StandardTable` dla listy:
 * **moduł deklaruje TREŚĆ, komponent narzuca WYGLĄD.** Moduł nie ma tu
 * żadnej swobody wizualnej — nie podaje klas, szerokości, kolejności ikon
 * ani podpisów sekcji kanonu.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * KONSTRUKCJA
 * ═══════════════════════════════════════════════════════════════════════
 *   ┌───────────────────────────┬────┐
 *   │                           │ ▣  │ ← ① Artefakt (akordeon 7 sekcji;
 *   │   PANEL (jeden naraz)     │ ⌸  │      wejście do Teresy jest w Menu 1,
 *   │                           │    │      DEC-419 — panel go nie niesie)
 *   └───────────────────────────┴────┘   ← ③ tryby zależne od typu
 *
 *   ② „Teresa" jako tryb szyny NIE ISTNIEJE od 2026-09-01 (patrz wyżej).
 *
 * Szyna ikon 56 px jest STAŁA — nie chowa się razem z panelem. Gdyby się
 * chowała, doktryna D17 („wszystko korzysta z panelu Teresy, zawsze po
 * prawej") przestawałaby obowiązywać w chwili, w której ktoś zwinie panel.
 *
 * Kolejność trybów jest NARZUCONA i niezmienna: Artefakt → tryby zależne od
 * typu (w kolejności deklaracji modułu). Teresa nie jest już trybem.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DLACZEGO TERESA NIE JEST ÓSMĄ SEKCJĄ AKORDEONU
 * ═══════════════════════════════════════════════════════════════════════
 * Rozmowa potrzebuje pełnej wysokości i własnego pola pisania. Wciśnięta
 * w akordeon obok sześciu zwijanych sekcji przestaje być rozmową, a staje
 * się widżetem — i dokładnie tak wygląda dziś w Ideach. Teresa jest TRYBEM
 * pasa, nie jego sekcją. Ten komponent nie pozwala jej zadeklarować inaczej:
 * treść Teresy nie przechodzi przez `sections`.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * NA CZYM STOI (świadome ponowne użycie, nie nowy wynalazek)
 * ═══════════════════════════════════════════════════════════════════════
 *  - `RightRail` (`src/components/shared/ExecutiveModuleShell/RightRail.tsx`)
 *    — realna szyna 56 px, ta sama, która stoi dziś pod Wordem (Document
 *    Studio), Deck Builderem, Tabelami/Excelem i czterema płótnami Idei.
 *    Używamy jej z `collapsible={false}` — pasek ikon zawsze widoczny.
 *    Zbudowanie własnej szyny dałoby DWUNASTĄ prawą szynę w aplikacji,
 *    czyli dokładnie ten defekt, który ten plik ma zlikwidować.
 *  - `ArtifactRightPanel` (`./ArtifactRightPanel`) — kanoniczny akordeon
 *    siedmiu sekcji. Kolejność czytamy z `ARTIFACT_PANEL_SECTION_ORDER`
 *    (jedno źródło, patrz Krok 1 §7 analizy) — bez własnej kopii listy.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * BEZPIECZEŃSTWO
 * ═══════════════════════════════════════════════════════════════════════
 * Ten komponent NIE włącza się sam. Powierzchnia montuje go za flagą
 * `isArtifactRightRailEnabled()` (`src/utils/artifactRightRailFlag.ts`,
 * domyślnie OFF). Dziś zadeklarowana jest DOKŁADNIE JEDNA powierzchnia:
 * prawa szyna Notatnika. Pozostałe dziesięć szyn nietknięte.
 *
 * Tokeny: wyłącznie `c-*`. Zero crimson (`primary-*` = #85182F) — czerwień
 * tylko dla semantyki krytycznej. Fokus = `c-focus`.
 *
 * DŁUG ODZIEDZICZONY (świadomie NIE naprawiany tutaj): sam `RightRail`
 * maluje kontener klasami `bg-white dark:bg-navy-900` / `border-slate-200
 * dark:border-navy-700` zamiast `c-*`. Przepisanie ich zmieniłoby piksele
 * pięciu ŻYWYCH modułów (Word, Deck, Excel, Tabele, Idee) w jednym ruchu —
 * to złamałoby zakaz masowego włączania (CLAUDE.md #9). Do osobnego kroku,
 * po akcepcie tej formuły.
 */
import { Bot, LayoutGrid, type LucideIcon, Send, Sparkles, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  RightRail,
  type RightRailToolDescriptor,
} from '@/components/shared/ExecutiveModuleShell/RightRail';

import {
  ARTIFACT_PANEL_SECTION_ORDER,
  type ArtifactPanelSectionId,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from './ArtifactRightPanel';

/** Stałe id dwóch trybów, których moduł nie może przemianować ani przestawić. */
export const ARTIFACT_RAIL_MODE_ARTIFACT = 'artefakt';
export const ARTIFACT_RAIL_MODE_TERESA = 'teresa';

/** Domyślna szerokość otwartego panelu (px) — jak dzisiejsza szyna Notatnika. */
const DEFAULT_PANEL_WIDTH = 360;

/**
 * Sekcje domyślnie ROZWINIĘTE (kanon SPEC-A §11.2): pierwsze dwie służą
 * bieżącej pracy. Pozostałe pięć startuje zwinięte — moduł nie decyduje.
 */
const DEFAULT_OPEN_SECTIONS: readonly string[] = ['actions', 'properties'];

type SectionCaption = { label: string; en: string };

/**
 * PODPISY SEKCJI KANONU — narzucone przez powłokę, nie przez moduł.
 *
 * Trzy środkowe NAZYWAJĄ KIERUNEK (§2 analizy). Powód jest zmierzony:
 * Powiązania używa 14 powierzchni, Źródła 8, Rezultaty 4 — nie dlatego, że
 * dwie ostatnie są zbędne, tylko dlatego, że budujący nie wiedział, gdzie
 * co wstawić, więc wstawiał wszystko w „Powiązania" (jedyna nazwa, która
 * pasuje do wszystkiego). Kierunek w podpisie rozstrzyga spór o miejsce,
 * zanim powstanie:
 *   Źródła i założenia → wstecz (na czym to oparto)
 *   Rezultaty          → naprzód (co z tego powstało)
 *   Powiązania         → wszerz (z czym to sąsiaduje)
 */
const SECTION_CAPTIONS: Record<ArtifactPanelSectionId, SectionCaption> = {
  actions: { label: 'Akcje', en: 'Actions' },
  properties: { label: 'Właściwości', en: 'Properties' },
  relations: {
    label: 'Powiązania — z czym to sąsiaduje',
    en: 'Relations — what this sits next to',
  },
  evidence: {
    label: 'Źródła i założenia — na czym to oparto',
    en: 'Sources and assumptions — what this is based on',
  },
  results: { label: 'Rezultaty — co z tego powstało', en: 'Results — what came out of this' },
  comments: { label: 'Komentarze', en: 'Comments' },
  // Bez dopisku „i AI" — AI zostaje TYPEM WPISU w strumieniu, nie nazwą
  // sekcji (kanon SPEC-A §11.2).
  history: { label: 'Historia', en: 'History' },
};

const CANONICAL_SECTION_IDS = new Set<string>(ARTIFACT_PANEL_SECTION_ORDER);

/* ------------------------------------------------------------------ */
/*  KONTRAKT — co deklaruje moduł                                      */
/* ------------------------------------------------------------------ */

/** ① Tryb Artefakt — akordeon siedmiu sekcji kanonu. */
export interface ArtifactRailArtifactMode {
  /**
   * Sekcje kanonu. Moduł podaje `id` + `children` (treść). Powłoka sama
   * ustawia KOLEJNOŚĆ (`ARTIFACT_PANEL_SECTION_ORDER`), PODPIS (kierunkowy
   * dla trzech środkowych) i stan początkowy (rozwinięte tylko Akcje
   * i Właściwości). `label` podany przez moduł jest ignorowany dla sekcji
   * kanonu i używany wyłącznie dla sekcji spoza kanonu.
   *
   * Sekcja BEZ ZASTOSOWANIA może być pominięta (lepiej brak niż pusty
   * akordeon udający funkcję) — kolejność obecnych zostaje.
   */
  sections: ArtifactRightPanelSection[];
  /** Pasek stanu draft/review/approved nad sekcjami (opcjonalnie). */
  statusBar?: React.ReactNode;
  /**
   * Licznik na ikonie szyny. UWAGA: `RightRail` maluje go na CZERWONO
   * (`bg-danger-500`), więc jest to sygnał KRYTYCZNY, nie zwykły licznik.
   * Do neutralnego „jest tu coś" służy `dotTone` (kropka semantyczna).
   */
  badge?: string | number;
  dotTone?: RightRailToolDescriptor['dotTone'];
}

/** Jedna wiadomość w strumieniu Teresy. Powłoka renderuje, moduł deklaruje. */
export interface ArtifactRailTeresaMessage {
  id: string;
  role: 'teresa' | 'user';
  text?: string;
  /**
   * Gdy podane — renderuje się jako wyróżniony callout „Założenie Teresy",
   * a nie jako zwykły dymek. §5 analizy: notatka utworzona przez Teresę bez
   * jawnego założenia jest twierdzeniem bez pokrycia.
   */
  assumption?: string;
  timestamp?: string;
}

/** Chip komendy kontekstowej nad strumieniem Teresy. */
export interface ArtifactRailTeresaCommand {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

/** ② Tryb Teresa — pełna wysokość, własne pole pisania. NIGDY sekcja akordeonu. */
export interface ArtifactRailTeresaMode {
  /** Jednozdaniowy kontekst pod nagłówkiem, np. `Notatka „Warsztat 3"`. */
  contextLabel?: string;
  commands?: ArtifactRailTeresaCommand[];
  messages?: ArtifactRailTeresaMessage[];
  /** Tekst stanu pustego strumienia. Bez niego — neutralny domyślny. */
  emptyLabel?: string;
  /**
   * Wysyłka wiadomości. BRAK handlera = pole pisania renderuje się
   * WYŁĄCZONE z jawnym powodem (`composeDisabledReason`) — powierzchnia,
   * która nie ma dokąd wysłać, nie udaje, że ma. Standard stanów akcji:
   * wyłączone musi powiedzieć DLACZEGO, nigdy milczeć.
   */
  onSend?: (text: string) => void;
  composeDisabledReason?: string;
  /** Realna akcja w stopce, gdy inline wysyłki jeszcze nie ma. */
  footerAction?: { label: string; icon?: LucideIcon; onClick: () => void };
  badge?: string | number;
  dotTone?: RightRailToolDescriptor['dotTone'];
  /**
   * @deprecated DEC-419 (właściciel, 06.09.2026, karta Inicjatywy): do 06.09
   * karmiła przycisk-wejście w sekcji „Akcje" („Zapytaj Teresę o tę notatkę" /
   * „…o tę ideę"). Ten przycisk USUNIĘTY — jedyne wejście jest teraz w Menu 1
   * (DEC-404). Pole zostaje w typie (dotychczasowi wołający jeszcze je
   * przekazują), ale `ArtifactRightRail` go już nie czyta.
   */
  entryLabel?: string;
}

/**
 * ③ Tryb zależny od typu — „po artefakcie", nie „o artefakcie".
 * Wzory z produktu: Kontrola jakości (Word `qa`), Struktura (Excel),
 * Slajdy/Media (Deck). Powłoka daje ramę i pełną wysokość; treść jest
 * specyficzna dla archetypu, więc podaje ją moduł.
 */
export interface ArtifactRailTypeMode {
  /** Stabilne id. Nie może kolidować z `artefakt` / `teresa`. */
  id: string;
  label: string;
  icon: LucideIcon;
  content: React.ReactNode;
  /** Podtytuł pod nagłówkiem trybu (jedno zdanie). */
  contextLabel?: string;
  /** Czerwony licznik krytyczny — patrz uwaga przy `ArtifactRailArtifactMode.badge`. */
  badge?: string | number;
  dotTone?: RightRailToolDescriptor['dotTone'];
  disabled?: boolean;
  disabledReason?: string;
}

export interface ArtifactRightRailProps {
  /** ① Tryb Artefakt. Pominięty = brak tej ikony na szynie. */
  artifact?: ArtifactRailArtifactMode;
  /** ② Tryb Teresa. Pominięty = brak tej ikony na szynie. */
  teresa?: ArtifactRailTeresaMode;
  /** ③ Tryby zależne od typu, w kolejności deklaracji — zawsze PO Teresie. */
  typeModes?: ArtifactRailTypeMode[];
  /** Tytuł nad panelem (zwykle nazwa artefaktu). Bez niego — brak nagłówka. */
  title?: string;
  /** Gdy podane, nagłówek dostaje przycisk zamknięcia pasa. */
  onClose?: () => void;
  /** Który tryb otwiera się na start. Domyślnie pierwszy zadeklarowany. */
  defaultModeId?: string;
  /** Sterowanie z zewnątrz (opcjonalne). Podane = komponent nie trzyma stanu. */
  activeModeId?: string | null;
  onModeChange?: (id: string | null) => void;
  /** Szerokość otwartego panelu (px). Domyślnie 360. */
  panelWidth?: number;
  onResizePanel?: (nextWidth: number) => void;
  ariaLabel?: string;
  testId?: string;
}

/* ------------------------------------------------------------------ */
/*  TERESA — panel trybu (powłoka narzuca cały wygląd)                 */
/* ------------------------------------------------------------------ */

const AssumptionCallout: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-start gap-2 rounded-lg border border-c-warning/40 bg-c-warning/[0.08] px-2.5 py-2">
    <Sparkles size={13} className="mt-0.5 shrink-0 text-c-warning" aria-hidden="true" />
    <p className="text-xs leading-snug text-c-text-secondary">{text}</p>
  </div>
);

/**
 * ⚠️ MARTWY OD 2026-09-01 — świadomie NIE usunięty.
 * Kompletny, działający panel czatu na szynie; nie jest już przez nic wołany
 * (decyzja „jedna Teresa, w swoim oknie"). Zostaje jako zapis TEGO, co zostało
 * odrzucone — żeby nikt nie odtworzył go od zera, myśląc, że go nie było.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TeresaModePanel: React.FC<{ mode: ArtifactRailTeresaMode }> = ({ mode }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const canSend = typeof mode.onSend === 'function';
  const messages = mode.messages ?? [];
  const FooterIcon = mode.footerAction?.icon;

  const submit = () => {
    const value = draft.trim();
    if (!canSend || value.length === 0) return;
    mode.onSend?.(value);
    setDraft('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-c-surface" data-testid="artifact-rail-teresa">
      <div className="shrink-0 border-b border-c-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-c-ai" aria-hidden="true" />
          <span className="text-sm font-semibold text-c-text">Teresa</span>
        </div>
        {mode.contextLabel ? (
          <p className="mt-1 text-[11px] text-c-text-muted">{mode.contextLabel}</p>
        ) : null}
      </div>

      {mode.commands && mode.commands.length > 0 ? (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-c-border-subtle px-4 py-2.5">
          {mode.commands.map((command) => {
            const CommandIcon = command.icon;
            const tooltip =
              command.disabled && command.disabledReason
                ? `${command.label} — ${command.disabledReason}`
                : command.label;
            return (
              <button
                key={command.id}
                type="button"
                onClick={command.disabled ? undefined : command.onClick}
                disabled={command.disabled}
                title={tooltip}
                className="inline-flex items-center gap-1.5 rounded-full border border-c-border-subtle bg-c-surface-raised px-2.5 py-1 text-[11px] text-c-text-secondary transition-colors hover:bg-c-surface-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
              >
                {CommandIcon ? (
                  <CommandIcon size={12} className="text-c-text-muted" aria-hidden="true" />
                ) : null}
                {command.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-xs italic text-c-text-muted">
            {mode.emptyLabel ??
              t('artifactRail.teresa.empty', 'Ten artefakt nie ma jeszcze rozmowy z Teresą.')}
          </p>
        ) : (
          messages.map((message) =>
            message.assumption ? (
              <div key={message.id} className="flex justify-start">
                <div className="max-w-[85%]">
                  <AssumptionCallout text={message.assumption} />
                </div>
              </div>
            ) : (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-snug ${
                    message.role === 'user'
                      ? 'bg-c-focus/10 text-c-text'
                      : 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            )
          )
        )}
      </div>

      <div className="shrink-0 border-t border-c-border-subtle p-3">
        {mode.footerAction ? (
          <button
            type="button"
            onClick={mode.footerAction.onClick}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-c-ai/30 bg-c-ai/[0.06] px-3 py-2 text-[12.5px] font-semibold text-c-ai transition-colors hover:bg-c-ai/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
            data-testid="artifact-rail-teresa-footer-action"
          >
            {FooterIcon ? <FooterIcon size={14} aria-hidden="true" /> : null}
            {mode.footerAction.label}
          </button>
        ) : null}
        {/* Powód wyłączenia jest WIDOCZNY, nie schowany w placeholderze —
            długie zdanie w polu jednowierszowym jest ucinane, a wyłączona
            powierzchnia musi powiedzieć DLACZEGO, nie tylko zblednąć. */}
        {!canSend && mode.composeDisabledReason ? (
          <p className="mb-1.5 text-[11px] italic leading-snug text-c-text-muted">
            {mode.composeDisabledReason}
          </p>
        ) : null}
        <div
          className={`flex items-end gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2 ${
            canSend ? '' : 'opacity-60'
          }`}
        >
          <textarea
            rows={1}
            value={draft}
            disabled={!canSend}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={
              canSend
                ? t('artifactRail.teresa.placeholder', 'Napisz do Teresy…')
                : t('artifactRail.teresa.composeUnavailable', 'Pisanie niedostępne')
            }
            title={canSend ? undefined : mode.composeDisabledReason}
            aria-label={t('artifactRail.teresa.composeLabel', 'Wiadomość do Teresy')}
            className="min-h-[20px] flex-1 resize-none bg-transparent text-xs text-c-text placeholder:text-c-text-muted focus:outline-none disabled:cursor-not-allowed"
            data-testid="artifact-rail-teresa-compose"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canSend || draft.trim().length === 0}
            aria-label={t('artifactRail.teresa.send', 'Wyślij')}
            title={canSend ? undefined : mode.composeDisabledReason}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-c-focus text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          >
            <Send size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  TRYB ZALEŻNY OD TYPU — wspólna rama, treść od modułu               */
/* ------------------------------------------------------------------ */

const TypeModePanel: React.FC<{ mode: ArtifactRailTypeMode }> = ({ mode }) => {
  const Icon = mode.icon;
  return (
    <div
      className="flex h-full min-h-0 flex-col bg-c-surface"
      data-testid={`artifact-rail-type-${mode.id}`}
    >
      <div className="shrink-0 border-b border-c-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-c-text-muted" aria-hidden="true" />
          <span className="text-sm font-semibold text-c-text">{mode.label}</span>
        </div>
        {mode.contextLabel ? (
          <p className="mt-1 text-[11px] text-c-text-muted">{mode.contextLabel}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{mode.content}</div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  POWŁOKA                                                            */
/* ------------------------------------------------------------------ */

/**
 * Normalizacja sekcji kanonu: kolejność z `ARTIFACT_PANEL_SECTION_ORDER`,
 * podpisy z `SECTION_CAPTIONS`, stan początkowy z `DEFAULT_OPEN_SECTIONS`.
 * Sekcje spoza kanonu (moduł ma prawo dołożyć własną) lądują NA KOŃCU,
 * w kolejności deklaracji, i zachowują swój podpis — ale nie mogą wcisnąć
 * się pomiędzy sekcje kanonu.
 */
function normalizeSections(
  sections: ArtifactRightPanelSection[],
  caption: (id: ArtifactPanelSectionId) => string
): ArtifactRightPanelSection[] {
  const canonical: ArtifactRightPanelSection[] = [];
  ARTIFACT_PANEL_SECTION_ORDER.forEach((id) => {
    const declared = sections.find((section) => section.id === id);
    if (!declared) return;
    canonical.push({
      ...declared,
      label: caption(id),
      defaultOpen: DEFAULT_OPEN_SECTIONS.includes(id),
    });
  });
  const extra = sections
    .filter((section) => !CANONICAL_SECTION_IDS.has(section.id))
    .map((section) => ({ ...section, defaultOpen: section.defaultOpen ?? false }));
  return [...canonical, ...extra];
}

export const ArtifactRightRail: React.FC<ArtifactRightRailProps> = ({
  artifact,
  teresa,
  typeModes,
  title,
  onClose,
  defaultModeId,
  activeModeId,
  onModeChange,
  panelWidth = DEFAULT_PANEL_WIDTH,
  onResizePanel,
  ariaLabel,
  testId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const caption = useCallback(
    (id: ArtifactPanelSectionId) => {
      const entry = SECTION_CAPTIONS[id];
      return t(`artifactRail.section.${id}`, isPolish ? entry.label : entry.en);
    },
    [isPolish, t]
  );

  // KOLEJNOŚĆ TRYBÓW jest narzucona: Artefakt → Teresa → tryby typu.
  const tools = useMemo<RightRailToolDescriptor[]>(() => {
    const list: RightRailToolDescriptor[] = [];
    if (artifact) {
      list.push({
        id: ARTIFACT_RAIL_MODE_ARTIFACT,
        label: t('artifactRail.mode.artifact', isPolish ? 'Artefakt' : 'Artifact'),
        icon: LayoutGrid,
        badge: artifact.badge,
        dotTone: artifact.dotTone,
        testId: 'artifact-rail-tool-artefakt',
      });
    }
    /*
      ★ 2026-09-01: IKONA „Teresa" NIE JEST JUZ REJESTROWANA NA SZYNIE.
      Decyzja wlasciciela „JEDNA TERESA, W SWOIM OKNIE" (KANON_Z_ODBIOROW.md)
      odrzucila czat na szynie w KAZDEJ formie — takze ten tryb pelnej
      wysokosci. `TeresaModePanel` i `ArtifactRailTeresaMode` zostaja w pliku
      jako martwy mechanizm (usuwamy WOLANIE, nie kod), a z calego trybu ma
      dzis skutek wylacznie `entryLabel` + `footerAction` — renderowane jako
      przycisk-wejscie w sekcji „Akcje" panelu artefaktu (patrz
      `sectionsWithTeresaEntry` nizej).
    */
    (typeModes ?? []).forEach((mode) => {
      list.push({
        id: mode.id,
        label: mode.label,
        icon: mode.icon,
        badge: mode.badge,
        dotTone: mode.dotTone,
        disabled: mode.disabled,
        disabledReason: mode.disabledReason,
        testId: `artifact-rail-tool-${mode.id}`,
      });
    });
    return list;
  }, [artifact, isPolish, t, teresa, typeModes]);

  const firstEnabledId = tools.find((tool) => !tool.disabled)?.id ?? null;
  const initialId =
    defaultModeId && tools.some((tool) => tool.id === defaultModeId && !tool.disabled)
      ? defaultModeId
      : firstEnabledId;

  const [uncontrolledId, setUncontrolledId] = useState<string | null>(initialId);
  const isControlled = activeModeId !== undefined;
  const currentId = isControlled ? (activeModeId ?? null) : uncontrolledId;

  const selectMode = useCallback(
    (id: string | null) => {
      if (!isControlled) setUncontrolledId(id);
      onModeChange?.(id);
    },
    [isControlled, onModeChange]
  );

  const normalizedSections = useMemo(
    () => (artifact ? normalizeSections(artifact.sections, caption) : []),
    [artifact, caption]
  );

  /*
    ★ DEC-419 (właściciel, 06.09.2026, karta Inicjatywy) — WEJŚCIE Z SEKCJI
    „AKCJE" USUNIĘTE. Do 06.09 powłoka wstrzykiwała tu `TeresaEntryButton`
    jako pierwszy element sekcji „Akcje" (wzór `prawy-pas-jedna-formula.tsx`).
    Jedyne wejście do Teresy jest teraz w Menu 1 (`data-testid="menu1-teresa"`,
    DEC-404), karty mają już „Pracuj z AI" (DEC-407) — drugi przycisk był
    duplikatem. `teresa.entryLabel`/`teresa.footerAction` zostają w typie
    (wołający je jeszcze przekazują), ale NIE MAJĄ już skutku wizualnego.
  */
  const panelBody = useMemo<React.ReactNode>(() => {
    if (currentId === ARTIFACT_RAIL_MODE_ARTIFACT && artifact) {
      return (
        <ArtifactRightPanel
          sections={normalizedSections}
          statusBar={artifact.statusBar}
          width="100%"
          className="border-l-0"
          ariaLabel={
            ariaLabel ?? t('artifactRail.artifactPanelLabel', isPolish ? 'Artefakt' : 'Artifact')
          }
        />
      );
    }
    /* ★ 2026-09-01: tryb „Teresa" nie ma juz wlasnego panelu — patrz
       komentarz przy `tools`. `TeresaModePanel` zostaje niewolany. */
    const typeMode = (typeModes ?? []).find((mode) => mode.id === currentId);
    if (typeMode) return <TypeModePanel mode={typeMode} />;
    return null;
  }, [ariaLabel, artifact, currentId, isPolish, normalizedSections, t, typeModes]);

  const panelContent =
    panelBody === null ? null : (
      <div className="flex h-full min-h-0 flex-col bg-c-surface">
        {title ? (
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-c-border-subtle px-4">
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-c-text">
              {title}
            </span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('artifactRail.close', isPolish ? 'Zamknij panel' : 'Close panel')}
                title={t('artifactRail.close', isPolish ? 'Zamknij panel' : 'Close panel')}
                className="rounded-md p-1 text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                data-testid="artifact-rail-close"
              >
                <X size={15} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">{panelBody}</div>
      </div>
    );

  return (
    <RightRail
      tools={tools}
      activeToolId={currentId}
      onSelectTool={selectMode}
      panelContent={panelContent}
      panelWidth={panelWidth}
      // Pasek ikon ZAWSZE widoczny — `collapsible={false}` jest REGUŁĄ tej
      // formuły, nie wyjątkiem jednego modułu (patrz nagłówek pliku).
      collapsed={false}
      collapsible={false}
      onToggleCollapse={() => undefined}
      onResize={onResizePanel}
      testId={testId ?? 'artifact-right-rail'}
    />
  );
};

export default ArtifactRightRail;
