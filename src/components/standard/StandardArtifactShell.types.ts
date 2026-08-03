/**
 * StandardArtifactShell — KONTRAKT TYPOWY karty N (SPEC-N §5.1).
 *
 * SSOT: Harvard/wdrozenie-100/_SPEC_N_KARTY_2026-07-21.md
 *       (§2.1–2.7 defekty, §5.1 tabela „reguła → realizacja w typie", §5B bramka)
 * Plan: Harvard/wdrozenie-100/_PLAN_WDROZENIA_KART_N_2026-07-21.md, FALA F / pakiet F1.
 *
 * PO CO TEN PLIK ISTNIEJE
 * SPEC-N §0: „`StandardTable` nie da się obejść, a `NModeShell` — da się, i obchodzi go
 * 8 kart na 8". Ten plik nie opisuje reguł — czyni stany niedozwolone NIEWYRAŻALNYMI.
 * Każdy typ niżej odpowiada jednemu realnemu defektowi z inwentarza A1, nie domysłowi.
 *
 * CZEGO TU NIE MA (świadomie, fala F = fundament)
 *  · Zero zmian w `NModeShell` — ta warstwa go OPAKOWUJE. Nic, co dziś działa, nie rusza się.
 *  · Zero migracji którejkolwiek z 7 kart — to fale M1–M7 (plan §3).
 *  · Zero renderu `NModeCardState` przez powłokę: `aiContract` jest DEKLARACJĄ, którą czyta
 *    walidacja dev i (docelowo) test zgodności §5.3. Sekcja renderuje swój stan sama,
 *    dokładnie jak dziś — inaczej fundament zmieniałby wygląd 7 kart naraz, bez zrzutów.
 */

import type React from 'react';

import type { NModeCardStateProps } from '@/components/shared/NModeLayout/NModeCardState';
import type { NModeToolbarProps } from '@/components/shared/NModeLayout/NModeToolbar';
import type {
  NModeAction,
  NModeAIContextAction,
  NModeHeaderConfig,
  NModeHeaderPrimaryAction,
  NModePropertyField,
  NModeSection,
} from '@/components/shared/NModeLayout/types';
import type { PresentationMode } from '@/hooks/usePresentationMode';

import type { ArtifactRightPanelSection } from './ArtifactRightPanel';
import type { KartaNKey, KartaNKlasa } from './registry';

// ─────────────────────────────────────────────────────────────────────────────
// (c) ZAREZERWOWANE ID SEKCJI — SPEC-N §2.1
// „`comments` · `history` · `activity-log` NIE MOGĄ być sekcją lewej kolumny —
//  należą wyłącznie do prawego panelu." Dziś łamią to Decision (renderuje komentarze
//  DWA RAZY naraz), Task i Notification.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identyfikatory zabronione w lewej nawigacji.
 *
 * Trzy pierwsze to literalna lista ze SPEC-N §2.1. Pozostałe to warianty zapisu tego
 * samego pojęcia (kod używa `activityLog`/`activity`) — ZAŁOŻENIE do weryfikacji przez
 * nadzorcę: bez nich karta obchodzi regułę zmianą wielkości litery, co jest dokładnie
 * tym rodzajem obejścia, przed którym ten kontrakt ma bronić.
 */
export type ZarezerwowaneSekcjeId =
  | 'comments'
  | 'history'
  | 'activity-log'
  | 'activityLog'
  | 'activitylog'
  | 'activity_log'
  | 'activity';

/**
 * Typ-znacznik błędu kompilacji. Nie da się go spełnić żadną tablicą sekcji — dlatego
 * użycie zarezerwowanego id kończy się błędem BUDOWY, nie uwagą w code review.
 * Nazwa pola jest komunikatem: to ona pojawi się w błędzie tsc.
 */
export interface BladZarezerwowanegoIdSekcji<Zle extends string> {
  readonly BLAD_SPEC_N_2_1__id_zarezerwowane_dla_prawego_panelu: Zle;
}

/**
 * Warta: zwraca `unknown` (neutralne dla intersekcji), gdy tablica sekcji jest czysta,
 * a typ-znacznik błędu, gdy zawiera zarezerwowane id.
 *
 * `[X] extends [never]` zamiast `X extends never` — bez opakowania w krotkę warunek
 * rozdzielałby się po `never` i cały typ redukowałby się do `never` (klasyczna pułapka
 * typów warunkowych), przez co bramka milcząco przestałaby działać.
 *
 * ZASIĘG (uczciwie): łapie id znane jako LITERAŁY — czyli tablice pisane w miejscu wywołania
 * (parametr `const` w komponencie zachowuje literały). Gdy karta buduje sekcje dynamicznie
 * i `id` rozszerza się do `string`, `Extract<string, …>` daje `never` → typ przepuszcza,
 * BEZ fałszywego alarmu. Ten przypadek łapie dopiero `walidujKontrakt` w dev (runtime).
 */
export type SprawdzZarezerwowaneId<S extends readonly { readonly id: string }[]> = [
  Extract<S[number]['id'], ZarezerwowaneSekcjeId>,
] extends [never]
  ? unknown
  : BladZarezerwowanegoIdSekcji<Extract<S[number]['id'], ZarezerwowaneSekcjeId>>;

// ─────────────────────────────────────────────────────────────────────────────
// (b) PRIMARY — dokładnie jeden, brak musi być JAWNY — SPEC-N §2.3
// 3 karty z 8 mają ZERO primary; Tool Document renderował DWA równoważne CTA.
// Łamanie idzie w obie strony, więc konwencja („pamiętaj o jednym primary") nie działa.
// ─────────────────────────────────────────────────────────────────────────────

/** Jedyny przycisk-primary karty (Menu 1). `id` jest wymagane dla anty-duplikacji §2.6. */
export interface PrimaryActionConfig extends NModeHeaderPrimaryAction {
  /** Stabilny identyfikator akcji — klucz kontroli duplikatów (§2.6). */
  readonly id: string;
}

/**
 * Świadomy brak primary. Wymaga UZASADNIENIA — „karta bez primary" przestaje być
 * przeoczeniem i staje się decyzją, którą widać w kodzie i w code review.
 */
export interface SwiadomyBrakPrimary {
  readonly intentionallyNone: true;
  /** Dlaczego ta karta nie ma primary. Puste/ogólnikowe = ostrzeżenie w dev. */
  readonly reason: string;
}

export type PrimaryActionSlot = PrimaryActionConfig | SwiadomyBrakPrimary;

// ─────────────────────────────────────────────────────────────────────────────
// (d) KONTRAKT AI PER SEKCJA — wymagany, nie opt-in — SPEC-N §2.5
// Dziś: Initiative 13/26 sekcji, Decision 4/8, Task 4/10 — reszta MILCZY.
// Milczenie przestaje być możliwe: pole jest wymagane, a brak trzeba nazwać.
// ─────────────────────────────────────────────────────────────────────────────

/** Jawne wykluczenie sekcji z mechaniki AI (np. statyczna baza wiedzy w karcie Tool). */
export interface BrakKontraktuAI {
  readonly none: true;
  /** Dlaczego ta sekcja nie ma stanu AI. Puste/ogólnikowe = ostrzeżenie w dev. */
  readonly reason: string;
}

/**
 * Kontrakt AI sekcji: albo pełne propsy `NModeCardState`
 * (`empty → generating → ai-draft → edited → done → error` + pasek
 * `Regeneruj · Edytuj · Zaakceptuj`), albo jawne `{ none, reason }`.
 */
export type AiContractSlot = NModeCardStateProps | BrakKontraktuAI;

// ─────────────────────────────────────────────────────────────────────────────
// SEKCJA LEWEJ KOLUMNY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deklaracja sekcji lewej nawigacji = `NModeSection` + WYMAGANY `aiContract`.
 * `id` jest zwykłym `string`; zakaz zarezerwowanych id egzekwuje
 * `SprawdzZarezerwowaneId` na poziomie CAŁEJ tablicy (patrz `sections` w propsach).
 */
export interface StandardSekcjaDef extends Omit<NModeSection, 'id'> {
  readonly id: string;
  /** SPEC-N §2.5 — bez tego pola sekcja się nie skompiluje. */
  readonly aiContract: AiContractSlot;
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) PRAWY PANEL — WYMAGANY, o stałych kluczach — SPEC-N §2.2
// 5 kart z 8 nie ma go w ogóle. Initiative — największa karta — trzyma właściwości
// jako poziomą siatkę 7 pól pod nagłówkiem. To nie „zła kolejność sekcji", tylko
// brak całej struktury. Rekord o stałych kluczach zamiast `{id,label}[]` odbiera
// wołającemu możliwość pomylenia KOLEJNOŚCI i pominięcia sekcji po cichu.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Treść jednej sekcji panelu.
 *
 * Świadomie ODEBRANE wołającemu (komponent narzuca wygląd — reguła „standard jest kodem"):
 *  · `id`          — wynika z klucza rekordu, nie da się go przestawić,
 *  · `defaultOpen` — SPEC-N §2.2 R3: wszystko zwinięte poza „Akcje",
 *  · `collapsible` — jednolite dla wszystkich sekcji panelu.
 */
export type PanelSekcjaTresc = Omit<
  ArtifactRightPanelSection,
  'id' | 'defaultOpen' | 'collapsible'
> & {
  /**
   * SPEC-N §2.6 (anty-duplikacja) — id akcji, które ta sekcja renderuje. Panel podaje je
   * DEKLARATYWNIE, bo jego treść to dowolny `ReactNode`, którego powłoka nie umie
   * przeszukać. Podane → dev wykrywa akcję istniejącą jednocześnie w nagłówku i panelu
   * (dziś: Save w Task i Decision, Export i AI Consultant w Insight, Delegate w Decision).
   * Pominięte → tej kontroli po prostu nie ma; nic nie udaje, że jest.
   */
  readonly actionIds?: readonly string[];
};

/**
 * Jawne pominięcie sekcji panelu — jedyna droga do „tej sekcji tu nie ma".
 * Klucz pozostaje WYMAGANY, więc milczenie dalej jest niemożliwe; zmienia się tylko to,
 * że brak trzeba nazwać i uzasadnić.
 *
 * Powód istnienia: korekta K2 z planu (Notification = wiadomość systemowa, nie artefakt
 * współpracy → bez Komentarzy). Bez tego wariantu K2 zderza się ze SPEC-N §2.2 i ktoś
 * rozwiązałby konflikt, czyniąc całe pole opcjonalnym — czyli kasując bramkę.
 */
export interface PominietaSekcjaPanelu {
  readonly pominieta: true;
  /** Dlaczego tej sekcji nie ma na tej karcie. Puste/ogólnikowe = ostrzeżenie w dev. */
  readonly reason: string;
}

export type PanelSekcjaSlot = PanelSekcjaTresc | PominietaSekcjaPanelu;

/**
 * Prawy panel jako REKORD O STAŁYCH KLUCZACH (SPEC-N §2.2, §5.1).
 *
 * Kolejność renderu narzuca komponent, nie kolejność deklaracji:
 *   Akcje · Właściwości · Powiązania · Źródła i założenia · [Rezultaty] ·
 *   Komentarze · Historia   (kanon n-Type = ARTIFACT_PANEL_SECTION_ORDER).
 *
 * `evidence` — JEDYNE dozwolone rozszerzenie poza piątkę, zawsze między Powiązaniami
 * a Komentarzami (SPEC-N §2.2). Obowiązuje karty, których treść pisze AI: Insight
 * i Initiative (§4A, P2 rozstrzygnięte przez Piotra: TAK).
 */
export interface RightPanelSections {
  readonly actions: PanelSekcjaSlot;
  readonly properties: PanelSekcjaSlot;
  readonly relations: PanelSekcjaSlot;
  /** Warstwa dowodowa (§4A). Jedyne opcjonalne pole rekordu. */
  readonly evidence?: PanelSekcjaSlot;
  readonly comments: PanelSekcjaSlot;
  readonly history: PanelSekcjaSlot;
}

/** Kanoniczna kolejność sekcji panelu — SSOT dla renderu i dla testu §5.3. */
export const KOLEJNOSC_SEKCJI_PANELU = [
  'actions',
  'properties',
  'relations',
  'evidence',
  'comments',
  'history',
] as const;

export type IdSekcjiPanelu = (typeof KOLEJNOSC_SEKCJI_PANELU)[number];

// ─────────────────────────────────────────────────────────────────────────────
// NAGŁÓWEK — wycofany prop martwy TYPEM — SPEC-N §2.7
// „Deprecated propy powłoki muszą być martwe typem (`never`), nie komentarzem.
//  Komentarz »Do not use for persistence state« nie powstrzymał Notification
//  przed nadużyciem."
// ─────────────────────────────────────────────────────────────────────────────

export type ArtifactHeaderConfig = Omit<NModeHeaderConfig, 'draftSavedLabel' | 'primaryAction'> & {
  /**
   * WYCOFANY (SPEC-N §2.7). Wskaźnik zapisu żyje w `saveState`/`lastSavedLabel`,
   * status cyklu życia — w treści karty. Typ `never` czyni nadużycie niemożliwym.
   */
  readonly draftSavedLabel?: never;
};

// ─────────────────────────────────────────────────────────────────────────────
// (e) KLASA WIELKOŚCI — SPEC-N §2.1
// „Artefakt klasy S deklaruje MAKSYMALNIE 4 sekcje. Powyżej = to jest klasa L."
// Task deklaruje S i ma 10 sekcji — sprzeczność wywracająca drabinę otwierania §12.2.
// UWAGA: wg korekty K1 planu Decision i Task IDĄ na klasę L, więc limit ich nie dotknie;
// reguła istnieje dla kart S (dziś: Tool, Notification) i dla każdej przyszłej.
// ─────────────────────────────────────────────────────────────────────────────

/** SPEC-N §2.1 — maksymalna liczba sekcji lewej kolumny dla klasy S (drawer). */
export const LIMIT_SEKCJI_KLASY_S = 4;

// ─────────────────────────────────────────────────────────────────────────────
// PROPSY POWŁOKI
// ─────────────────────────────────────────────────────────────────────────────

export interface StandardArtifactShellProps<
  S extends readonly StandardSekcjaDef[] = readonly StandardSekcjaDef[],
> {
  /**
   * Klucz karty w rejestrze (`registry.ts`, SPEC-N §5.4). Powłoka wymaga go, żeby karta
   * spoza rejestru nie mogła powstać, a ostrzeżenia dev umiały powiedzieć KTÓRA karta.
   */
  readonly karta: KartaNKey;

  /** (e) Klasa wielkości. Dla 'S' liczba sekcji jest walidowana (limit 4) w dev. */
  readonly klasa: KartaNKlasa;

  /** Nagłówek karty (bez wycofanego `draftSavedLabel`, bez `primaryAction` — ten ma slot). */
  readonly header: ArtifactHeaderConfig;

  /** (b) Jeden primary ALBO jawny, uzasadniony brak. Bez wartości domyślnej. */
  readonly primaryAction: PrimaryActionSlot;

  /**
   * (c) Sekcje lewej kolumny. Intersekcja z wartą typu: tablica zawierająca
   * `comments`/`history`/`activity-log` NIE KOMPILUJE SIĘ.
   */
  readonly sections: S & SprawdzZarezerwowaneId<S>;

  /** (a) Prawy panel — POLE WYMAGANE, rekord o stałych kluczach. */
  readonly rightPanel: RightPanelSections;

  readonly activeSection: string;
  readonly onSectionChange: (sectionId: string) => void;
  /** Podane → lewa nawigacja staje się przeciągalna (SPEC-N §2.1 „zmiana kolejności"). */
  readonly onSectionReorder?: (sectionIds: string[]) => void;

  /**
   * SPEC-N §2.7 — GĘSTOŚĆ widoku (N/C). Świadomie NIE nazywa się `presentationMode`:
   * „Present" znaczyło dwie różne rzeczy (gęstość i pełny ekran) pod jedną ikoną
   * w Initiative. Tryb pełnoekranowy nie jest sprawą tej powłoki i nie ma tu slotu.
   */
  readonly densityMode: PresentationMode;
  readonly onDensityModeChange: (mode: PresentationMode) => void;
  // ETAP 1.1 standardu n-Type (2026-07-23): `showDensitySwitcher` USUNIĘTY.
  // Karta N ma JEDEN widok, więc powłoka standardowa nigdy nie renderuje
  // przełącznika N/C w Menu 1 — nie ma czego konfigurować. `densityMode`
  // zostaje: nadal steruje gęstością centrum, tylko bez przełącznika w nagłówku.

  /** Pasek właściwości pod nagłówkiem. Pominięty → metadane żyją w panelu (§2.2). */
  readonly properties?: readonly NModePropertyField[];
  readonly propertiesMaxColumns?: number;

  /** Akcje drugorzędne paska (nie primary). Ich `id` wchodzą do kontroli duplikatów §2.6. */
  readonly headerActions?: readonly NModeAction[];
  readonly headerActionsVisible?: boolean;
  readonly aiContextActions?: readonly NModeAIContextAction[];
  readonly toolAIActions?: readonly NModeAction[];

  /**
   * (f) Toolbar — JEDYNA droga budowy (SPEC-N §2.4). Slot przyjmuje element
   * `<NModeToolbar …>`; powłoka nie eksportuje surowego `renderActionBar`, więc bespoke
   * `<div>` i `createPortal` poza powłokę (dzisiejszy Tool Document) nie mają którędy wejść.
   */
  readonly toolbar?: React.ReactElement<NModeToolbarProps>;

  /** Szerokość prawego panelu w px (kanon §11.2: 320–420, domyślnie 360). */
  readonly panelWidth?: number;
  /** Slot NAD sekcjami panelu (pasek draft/review/approved — `ArtifactApprovalStatusBar`). */
  readonly panelStatusBar?: React.ReactNode;
  readonly panelAriaLabel?: string;

  readonly buildArtifactCode?: (type: string, id: string) => string;
  readonly loading?: boolean;
  readonly reducedMotion?: boolean;
  readonly motionDuration?: number;

  /**
   * Nakładki: modale, dialogi, toasty — renderowane obok powłoki, w OBU gęstościach.
   * To NAZWANY slot, nie `children`: nie wolno nim budować toolbara ani nagłówka
   * (bramka `check-artefakt.sh` z pakietu F4 blokuje solid-CTA i `createPortal`
   * w plikach 7 kart).
   */
  readonly nakladki?: React.ReactNode;

  /**
   * (f) Powłoka NIE przyjmuje `children` — treść wchodzi wyłącznie nazwanymi slotami.
   * `never` sprawia, że `<StandardArtifactShell>cokolwiek</StandardArtifactShell>`
   * jest błędem kompilacji.
   */
  readonly children?: never;
  /** (f) Świadomie martwe: dowolny renderer paska akcji. Używaj slotu `toolbar`. */
  readonly renderActionBar?: never;
  /** (f) Świadomie martwe: cel portalu. SPEC-N §2.4 — wyjście poza powłokę ma być niemożliwe. */
  readonly portalTarget?: never;
}
