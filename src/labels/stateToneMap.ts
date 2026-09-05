/**
 * stateToneMap — SSOT dla "jaki KOLOR ma stan/kategoria", oddzielone od "jaki TEKST".
 *
 * PO CO (P6_CZERWIEN_I_1440.md §4.1): audyt Award 2026-09-05 znalazł czerwień (`text-danger-*`/
 * `bg-danger-*`) użytą dla stanów SPOKOJNYCH — kategoria "Oceny" w Narzędziach, status
 * "Nieaktywny" — czyli dokładnie to, przed czym ostrzega `CLAUDE.md` (Pułapka nr 1: czerwień
 * TYLKO semantyka krytyczna). `text-danger-*`/`bg-danger-*` w kodzie wygląda identycznie
 * niezależnie od tego, czy autor naprawdę chciał "to jest błąd", czy po prostu skopiował klasę
 * z sąsiedniego elementu — ten plik zmusza do wyboru TONU (znaczenia), nie klasy (wyglądu),
 * więc "przypadkowy crimson" przestaje być możliwy do przypadkowego napisania.
 *
 * Pięć wariantów z `docs/ui-standards/TRIADA_KANON.md` pkt 32 / `TABLE_AND_PREVIEW_CANON.md`
 * §7.3b — NIE tworzymy nowej palety, tylko domenowe mapowanie NA te pięć:
 *   - 'primary'  — granatowy, główny/wyróżniony (NIGDY crimson/`c-accent`).
 *   - 'positive' — emerald, sukces/gotowe/aktywne.
 *   - 'warning'  — amber, wymaga uwagi ale nie jest awarią.
 *   - 'critical' — red/danger, WYŁĄCZNIE realny błąd/blokada/przeterminowanie.
 *   - 'neutral'  — spokojny stan / kategoria bez ładunku emocjonalnego (domyślny fallback).
 *
 * Współdzielony z pakietem P4 (`P4_KODY_TECHNICZNE_W_UI.md`): P4 robi ETYKIETY tekstowe
 * (`reportStatusLabels.ts`), ten plik robi TON/KOLOR — to dwa różne pytania o ten sam stan,
 * celowo rozdzielone (można zmienić tekst bez dotykania koloru i odwrotnie).
 *
 * Zgodne z istniejącym mostem `statusChipTone()` (`src/components/ui/primitives/chips/
 * EntityStatusChip.tsx`) który już klasyfikuje `inactive`/`final` jako `neutral` dla tabel ze
 * statusem RAW encji — ten plik NIE zastępuje tego mostu, obsługuje przypadki poza jego zakresem
 * (kategorie narzędzi, warianty niebędące statusem encji z tabeli).
 */

export type StateTone = 'positive' | 'critical' | 'warning' | 'neutral' | 'primary';

/** Domena = "jaki rodzaj stanu/kategorii to jest" — każda domena ma własną mapę wartość→ton. */
export type StateToneDomain =
  | 'discoveryToolCategory'
  | 'discoveryToolActive'
  | 'reportStatus'
  | 'genericLifecycle';

type ToneByValue = Record<string, StateTone>;

/** Normalizacja: małe litery, spacje/myślniki → `_`, przycięcie białych znaków. */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

const DOMAIN_TONES: Record<StateToneDomain, ToneByValue> = {
  // Kategorie narzędzi w hubie Discovery (DiscoveryToolsHub.tsx CATEGORY_META) — kategoria
  // NIE jest stanem błędu, więc żadna z nich nie dostaje 'critical'. "Oceny" (`licensed`)
  // było błędnie `danger` — audyt A §N2, `narzedzia/01e-root-oceny.png`.
  discoveryToolCategory: {
    all: 'neutral',
    strategic: 'neutral',
    operational: 'neutral',
    digital: 'neutral',
    automation: 'warning',
    licensed: 'neutral',
  },
  // Stan włączenia narzędzia (KnownToolPreviewV3.tsx `tool.isActive`). "Nieaktywny" to spokojny
  // stan cyklu życia (narzędzie po prostu nie jest włączone), nie awaria — audyt A §N2,
  // `narzedzia/07-operational-row-open.png`.
  discoveryToolActive: {
    active: 'positive',
    inactive: 'neutral',
  },
  // Statusy raportu w Ocenie (AssessmentHub.tsx REPORT_STATUS_CONFIG). `final` bywał indygo —
  // wariant wycofany kanonem (TRIADA_KANON.md pkt 32) — mapowany tu na `neutral` jako bezpieczny
  // domyślny ton zgodny z już istniejącym mostem `statusChipTone()` (`final` → `neutral`).
  // UWAGA: rzeczywista podmiana koloru w AssessmentHub.tsx (moduł 04_ASSESSMENT, zamrożony
  // 05.09) wymaga POTWIERDZENIA właściciela przed wdrożeniem (P6 §5 krok 2) — ta mapa sama w
  // sobie niczego nie zmienia w UI, dopóki nikt jej nie użyje w tamtym pliku.
  reportStatus: {
    draft: 'neutral',
    generating: 'warning',
    pending_approval: 'warning',
    approved: 'positive',
    final: 'neutral',
  },
  // Ogólny cykl życia (do reużycia poza Narzędziami/Oceną, gdy ktoś potrzebuje tej samej reguły).
  genericLifecycle: {
    active: 'positive',
    inactive: 'neutral',
    draft: 'neutral',
    // Terminalne stany cyklu życia — nic się nie zepsuło, pozycja po prostu wypadła z obiegu.
    // Zgodne z `statusChipTone()` (EntityStatusChip.tsx): cancelled/archived/expired = neutral.
    cancelled: 'neutral',
    archived: 'neutral',
    expired: 'neutral',
    error: 'critical',
    blocked: 'critical',
    overdue: 'critical',
    failed: 'critical',
  },
};

/**
 * Zwraca WARIANT tonu (nie klasę CSS) dla wartości w danej domenie.
 * Nieznana wartość → 'neutral' (bezpieczny fallback, nigdy 'critical' po cichu).
 */
export function toneForState(domain: StateToneDomain, value: string | null | undefined): StateTone {
  if (!value) return 'neutral';
  const map = DOMAIN_TONES[domain];
  return map[normalize(value)] ?? 'neutral';
}

/**
 * Warstwa CSS: mapuje WARIANT na klasy tokenów kanonu (jasny/ciemny). Osobna od `toneForState`
 * celowo — zmiana wyglądu tonu nie wymaga przeglądu logiki domenowej i odwrotnie.
 */
// UWAGA (CLAUDE.md Pułapka nr 1): `primary-*`/`bg-primary` w tailwind.config = Harvard Crimson
// (#85182F), NIE granatowy — mimo że kanon NAZYWA piąty wariant "primary". Dlatego 'primary' tutaj
// renderuje się przez `navy-*`/kontrast biel-granat (wzorzec 1:1 z `previewStyles.ts` COLOR_MAP.primary,
// VISUAL_STANDARD.md §5.1: "primary action = neutral high-contrast, never crimson") — NIGDY przez klasę
// `primary-*`, bo to dokładnie odtworzyłoby crimson pod inną nazwą zmiennej.
export const STATE_TONE_TEXT_CLASS: Record<StateTone, string> = {
  primary: 'text-navy-900 dark:text-white',
  positive: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
  critical: 'text-danger-700 dark:text-danger-400',
  neutral: 'text-slate-600 dark:text-slate-300',
};

export const STATE_TONE_DOT_CLASS: Record<StateTone, string> = {
  primary: 'bg-navy-700 dark:bg-white',
  positive: 'bg-emerald-400',
  warning: 'bg-amber-400',
  critical: 'bg-danger-400',
  neutral: 'bg-slate-400 dark:bg-slate-500',
};

/** Wariant "cichego chipa z kropką" (kanon A9 Kanban) — tło + tekst, dla pigułek stanu. */
export const STATE_TONE_CHIP_CLASS: Record<StateTone, string> = {
  primary: 'bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950',
  positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  critical: 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
};
