/**
 * cardContract.types.ts — KONTRAKT KANONICZNEJ KARTY (ZALĄŻEK / decyzja D-8).
 *
 * SSOT modelu: Harvard/wdrozenie-100/_KANON_KARTY_MODEL_2026-07-22.md (§1 schemat,
 *              §2 katalog zunifikowany, §3 kompozycja, §4 ten plik).
 * Kontekst:    Harvard/wdrozenie-100/_KONTRAKT_KARTY_SSOT_2026-07-22.md (tabela master),
 *              Harvard/wdrozenie-100/_DWA_SYSTEMY_KART_MAPA_2026-07-22.md (cardSets vs Initiative).
 * Bramka:      scripts/check-artefakt-struktura.mjs (egzekwowanie strukturalne — §4.4 dokumentu).
 *
 * ── PO CO TEN PLIK ISTNIEJE ─────────────────────────────────────────────────
 * Decyzja Piotra D-7: JEDEN kanon karty, best-of z dwóch dzisiejszych systemów —
 *   • System A `cardSets.ts`  : czyste dane `{id,label,core,group}` + zestawy nazwane,
 *                               egzekwowany „core" w UI (NModeCardManager). Słaby model.
 *   • System B Initiative     : katalog w DB `initiative_section_types` + `ai_prompt_template`
 *                               per sekcja + szablony `visible_sections` per-instancja. Bogaty
 *                               model, BRAK egzekwowanego „core" (529_...sql — 0 kolumn is_core).
 * Ten typ jest NADZBIOREM obu: kształt danych z B (label PL/EN, opis, prompt AI, kolumna,
 * kolejność, org-scope), egzekwowanie „nieusuwalny/kompozycja" z A, rozszerzone o rolę AI,
 * próg (placeholder) i klasę artefaktu S/L.
 *
 * Decyzja Piotra D-8: kontrakt WIĄŻĄCY, jak `StandardTable` dla list — nie da się go obejść.
 * SPEC-N §0: „`StandardTable` nie da się obejść, a `NModeShell` — da się, i obchodzi go 8/8".
 * Ten plik nie OPISUJE reguł — czyni stany niedozwolone NIEWYRAŻALNYMI:
 *   karta bez `id` / `label` / `rolaAI` / `kompozycji`  →  BŁĄD KOMPILACJI (nie uwaga w review).
 *
 * ── CZEGO TU NIE MA (świadomie — to ZALĄŻEK / POC, nie migracja) ─────────────
 *  · Zero danych — plik jest CZYSTYM TYPEM. Nie eksportuje żadnego katalogu kart.
 *  · Zero importu z któregokolwiek z 7 artefaktów. NIE jest podpięty pod render.
 *    Reużywa TYLKO typów `KartaNKey` / `KartaNKlasa` z siostrzanego rejestru powłoki
 *    (`./registry`) — jeden SSOT klasy S/L i klucza artefaktu, bez dublowania.
 *  · Zero zmian w produkcie. Wpięcie (adapter cardSets→kanon, adapter DB→kanon) i bramka
 *    runtime = OSOBNY etap PO akcepcie Piotra, POC-first (CLAUDE.md reguła #9: nie hurtem).
 */

import type { KartaNKey, KartaNKlasa } from './registry';

// ─────────────────────────────────────────────────────────────────────────────
// (1) ETYKIETA DWUJĘZYCZNA — jak `CardCatalogEntry.label` (cardSets.ts:37)
//     ROZSZERZONA o `opis` z Systemu B (`description`/`description_pl`, 529_...sql:21-22),
//     którego System A nie ma (DWA_SYSTEMY §2 „Tylko System B: opisy kart").
// ─────────────────────────────────────────────────────────────────────────────

export interface EtykietaDwujezyczna {
  readonly en: string;
  readonly pl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// (2) ROLA AI — pole, którego DZIŚ NIE MA JAKO DEKLARACJA
//     (KONTRAKT §2: „rola_AI … brak jednej deklaracji"). Prompty istnieją tylko
//     w DB Initiative i w rozsypanych serwisach generacji. Kanon czyni z niej pole.
//
//     'pisze'         — AI materializuje treść karty (Insight/Initiative content).
//     'asystuje'      — AI podpowiada, człowiek prowadzi (np. governance/RACI).
//     'dane'          — karta czysto danymi (attachments, tags, timeline).
//     'systemowa'     — generowana przez system, bez promptu (activity-log/history).
//     'transakcyjna'  — strumień akcji użytkownika (comments).
// ─────────────────────────────────────────────────────────────────────────────

export type RolaAI = 'pisze' | 'asystuje' | 'dane' | 'systemowa' | 'transakcyjna';

// ── Slot promptu AI — nadzbiór B (`ai_prompt_template`, 529_...sql:38) ──────────
// Wzorzec 1:1 z `AiContractSlot` (StandardArtifactShell.types.ts:132): albo treść,
// albo JAWNY brak z powodem. „Milczenie przestaje być możliwe" (SPEC-N §2.5).

export interface AiPromptTresc {
  /** Szablon promptu generacji (odpowiednik `ai_prompt_template` z DB Initiative). */
  readonly szablon: string;
  /** Opcjonalny klucz promptu w katalogu serwera (gdy prompt trzymany poza kanonem). */
  readonly kluczPromptu?: string;
}

export interface BrakAiPrompt {
  readonly none: true;
  /** Dlaczego ta karta nie ma promptu. Puste/ogólnikowe = ostrzeżenie w dev. */
  readonly reason: string;
}

export type AiPromptSlot = AiPromptTresc | BrakAiPrompt;

// ─────────────────────────────────────────────────────────────────────────────
// (3) SPÓJNOŚĆ ROLA↔PROMPT — niewyrażalny stan „AI pisze, ale nie ma promptu"
//     Dziś rozjazd: Initiative 13/26 sekcji z promptem, Decision 4/8, Task 4/10 —
//     „reszta MILCZY" (StandardArtifactShell.types.ts:116-117). Kanon wiąże jedno z drugim.
//
//     • rola 'pisze' | 'asystuje'            ⇒ prompt WYMAGANY (AiPromptTresc)
//     • rola 'dane' | 'systemowa' | 'transakcyjna' ⇒ prompt = JAWNY brak (BrakAiPrompt)
//     Ominięcie którejkolwiek strony = błąd kompilacji (dyskryminowana unia).
// ─────────────────────────────────────────────────────────────────────────────

interface KartaPiszacaAI {
  readonly rolaAI: 'pisze' | 'asystuje';
  /** Karta, której treść tworzy AI, MUSI podać prompt — bez tego się nie skompiluje. */
  readonly aiPrompt: AiPromptTresc;
}

interface KartaBezGeneracjiAI {
  readonly rolaAI: 'dane' | 'systemowa' | 'transakcyjna';
  /** Karta bez generacji MUSI jawnie nazwać brak promptu (nie milczeć). */
  readonly aiPrompt: BrakAiPrompt;
}

/** Rola AI spójna z promptem — jedna z dwóch dozwolonych kombinacji, nic pomiędzy. */
export type RolaAISpojna = KartaPiszacaAI | KartaBezGeneracjiAI;

// ─────────────────────────────────────────────────────────────────────────────
// (4) PRÓG KOMPLETNOŚCI — PLACEHOLDER NA DECYZJĘ PIOTRA (D-1/D-2/D-3)
//     KONTRAKT §2 „★ Najważniejsza prawda o progu": w całym kodzie NIE MA progu
//     per-karta. Są tylko: scoring CAŁEJ karty ≥90 (Insight/Initiative,
//     cardContentFormulaValidator.ts:59) i doradcze minima pól (cardContentValidator.ts).
//     Kanon NIE wymyśla liczby — koduje BRAK decyzji jako pełnoprawny wariant.
// ─────────────────────────────────────────────────────────────────────────────

export type ProgKompletnosci =
  /** Domyślnie: brak progu per-karta w kodzie → czeka na Piotra (D-1). */
  | { readonly rodzaj: 'do-decyzji-piotra' }
  /** Bramka scoringu CAŁEJ karty (dziś ≥90 dla insight/initiative). Kontekst, nie per-pole. */
  | { readonly rodzaj: 'scoring-calosci'; readonly prog: number; readonly dowod: string }
  /** Doradcze minimum pola (np. successCriteria≥4) — dziś „ADVISORY ONLY, never to block". */
  | { readonly rodzaj: 'doradczy'; readonly opis: string; readonly dowod: string }
  /** Przyszłość: twardy próg per-karta, gdy Piotr zdecyduje (D-1/D-3). */
  | { readonly rodzaj: 'per-karta'; readonly prog: number };

// ─────────────────────────────────────────────────────────────────────────────
// (5) KOMPOZYCJA per artefakt — best-of: „core" z A + widoczność/kolumna/kolejność z B
//     A: `core:true` (cardSets.ts:48) egzekwowane w UI (useCardLayout.ts:190).
//     B: `column_position` left/right (529_...sql:26), `default_order` (…:24), szablony.
//     Ta sama karta kanoniczna może należeć do WIELU artefaktów z RÓŻNĄ rolą (dedup §2).
//
//     'rdzen'          — nieusuwalna (tylko chowana). = `core:true` z A.
//     'domyslna'       — w zestawie domyślnym `sets[0]` / `DEFAULT_VISIBLE=true`.
//     'dodawalna'      — w katalogu, poza domyślnym (zestaw „full"/biblioteka).
//     'ukryta-domyslna'— w katalogu, `DEFAULT_VISIBLE=false` (np. pilot, watchers).
// ─────────────────────────────────────────────────────────────────────────────

export type RolaKompozycji = 'rdzen' | 'domyslna' | 'dodawalna' | 'ukryta-domyslna';

export interface PrzynaleznoscArtefaktu {
  /** Który z 7 artefaktów (KartaNKey — SSOT: standard/registry.ts). */
  readonly artefakt: KartaNKey;
  /** Rola kompozycyjna karty W TYM artefakcie. */
  readonly rola: RolaKompozycji;
  /**
   * Klasa artefaktu S/L (SSOT: `REJESTR_KART_N[artefakt].klasa`). Denormalizowana tu,
   * by karta niosła klasę wprost (pole schematu wg zadania). Bramka
   * `check-artefakt-struktura.mjs` egzekwuje `klasa === REJESTR_KART_N[artefakt].klasa`
   * — rozjazd = FLAGA (§4.4 dokumentu). Klasa S ⇒ artefakt ≤4 sekcje lewej kolumny.
   */
  readonly klasa: KartaNKlasa;
  /** Kolumna layoutu (nadzbiór B — `column_position`). Domyślnie 'left'. */
  readonly kolumna?: 'left' | 'right';
  /** Kolejność w kolumnie (nadzbiór B — `default_order`). */
  readonly kolejnosc?: number;
  /**
   * Id sekcji tak, jak RENDERUJE ją TEN artefakt — gdy różni się od kanonicznego
   * `id` (rozwiązanie aliasu dedup, KANON §2.2). Kanoniczny `governance` renderuje
   * się w Decision jako `governance-escalation` (`cardSets.ts:444`), `attachments`
   * jako `resources-links` (`cardSets.ts:456`). Adapter kompozycji mapuje
   * `idWArtefakcie ?? karta.id` na id sekcji artefaktu, więc layout kart nadal
   * pokrywa 1:1 to, co artefakt renderuje (zero regresji), a katalog kanoniczny
   * pozostaje zdeduplikowany. Pominięty ⇒ artefakt renderuje kartę pod jej
   * kanonicznym `id`.
   */
  readonly idWArtefakcie?: string;
}

/**
 * Lista przynależności = KOMPOZYCJA karty. NIEPUSTA KROTKA: karta MUSI należeć do
 * ≥1 artefaktu z określoną rolą kompozycyjną. Pusta lista (karta „bez kompozycji")
 * = błąd kompilacji — dokładnie stan, przed którym broni kontrakt (D-4/D-5/D-6).
 */
export type KompozycjaKarty = readonly [PrzynaleznoscArtefaktu, ...PrzynaleznoscArtefaktu[]];

// ─────────────────────────────────────────────────────────────────────────────
// (6) STATUS ROZJAZDU — uczciwa flaga z audytu (KONTRAKT §3, ROZJAZD, DWA_SYSTEMY §3)
//     Karta kanoniczna nie udaje, że wszystko jest czyste. Rozjazdy (competencyRequirements
//     bez wiersza DB, initiativeTeam dublujący team, raciEscalation vs klucz `raci`)
//     są NAZWANE w danych, nie schowane.
// ─────────────────────────────────────────────────────────────────────────────

export type StatusKanonu =
  /** Karta zdrowa: id/label/prompt spójne między kodem a DB. */
  | { readonly stan: 'czysta' }
  /** Kod istnieje, ale rozjazd z DB/innym źródłem (np. brak wiersza seed). */
  | { readonly stan: 'rozjazd'; readonly opis: string; readonly dowod: string }
  /** Martwa: dubluje inną kartę lub brak konsumenta (initiativeTeam, linkedItems, watchers). */
  | { readonly stan: 'martwa'; readonly kanonicznyZamiennik: string; readonly dowod: string }
  /** Tylko w DOC (material-quality, traceability) — czeka na decyzję Piotra (luka czy backlog). */
  | { readonly stan: 'do-decyzji-piotra'; readonly opis: string };

// ─────────────────────────────────────────────────────────────────────────────
// (7) SCHEMAT KANONICZNEJ KARTY — złożenie wszystkiego
//     Pola WYMAGANE (pominięcie = błąd tsc): id · label · grupa · ikona · prog ·
//     kompozycja · (rolaAI + aiPrompt, przez RolaAISpojna) · statusKanonu.
// ─────────────────────────────────────────────────────────────────────────────

interface KanonicznaKartaBaza {
  /**
   * Kanoniczny identyfikator. MUSI równać się id sekcji renderowanej przez artefakt
   * (cardSets.ts:35 „Card id MUST equal the section id"). Kod = prawda (ROZJAZD §0.1),
   * więc kanon przyjmuje id z kodu (camelCase Initiative, kebab reszta).
   */
  readonly id: string;
  /** Dwujęzyczna etykieta (nadzbiór A `label` + B `name`/`name_pl`). */
  readonly label: EtykietaDwujezyczna;
  /** Opis „co karta ma zawierać" (nadzbiór B `description`/`description_pl`). Opcjonalny w seed. */
  readonly opis?: EtykietaDwujezyczna;
  /** Grupa/kubełek (A `group`, B `category`) — np. 'CONTENT', 'BETWEEN THE LINES', 'CONTROL'. */
  readonly grupa: string;
  /** lucide-react icon id (A `icon`; B `icon`/`icon_color`/`icon_bg`). */
  readonly ikona: string;
  /** Próg kompletności — placeholder na decyzję Piotra (patrz ProgKompletnosci). */
  readonly prog: ProgKompletnosci;
  /** Kompozycja: do których artefaktów należy i z jaką rolą (niepusta krotka). */
  readonly kompozycja: KompozycjaKarty;
  /** Status rozjazdu — uczciwa flaga (czysta/rozjazd/martwa/do-decyzji). */
  readonly statusKanonu: StatusKanonu;
  /** Czy karta org-customizowalna (nadzbiór B `organization_id`). Domyślnie false. */
  readonly orgCustomizowalna?: boolean;
}

/**
 * KANONICZNA KARTA — pełny schemat. To jest typ, który KAŻDA karta w systemie musi
 * spełniać (D-8, egzekwowanie wiążące).
 *
 * Intersekcja z `RolaAISpojna` sprawia, że:
 *   · brak `id`         → błąd (pole wymagane w bazie),
 *   · brak `label`      → błąd (pole wymagane w bazie),
 *   · brak `rolaAI`     → błąd (żadna gałąź RolaAISpojna nie pasuje),
 *   · brak `kompozycji` → błąd (`KompozycjaKarty` to krotka niepusta),
 *   · rola 'pisze' bez `aiPrompt` treści → błąd (spójność rola↔prompt).
 */
export type KanonicznaKarta = KanonicznaKartaBaza & RolaAISpojna;

// ─────────────────────────────────────────────────────────────────────────────
// (8) BRANDOWANE TYPY-BŁĘDY — legibilny komunikat tsc (wzorzec z
//     StandardArtifactShell.types.ts:67 `BladZarezerwowanegoIdSekcji`).
//     Same wymagane pola już blokują pominięcia; te aliasy nadają błędom CZYTELNĄ nazwę,
//     gdy kanon jest używany w pozycji generycznej (adapter/factory).
// ─────────────────────────────────────────────────────────────────────────────

/** Typ-znacznik: karta bez wymaganego pola. Nazwa pola = treść błędu w tsc. */
export interface BladNiekompletnejKarty<BrakujacePole extends string> {
  readonly BLAD_KANON_KARTY__brak_wymaganego_pola: BrakujacePole;
}

/**
 * Warta kompletności: zwraca `unknown` (neutralne dla intersekcji), gdy `T` ma komplet
 * pól `KanonicznaKarta`; typ-znacznik błędu, gdy brakuje któregoś z rdzennych pól.
 *
 * `[X] extends [never]` w krotce — ta sama ochrona przed rozdziałem po `never`, co
 * `SprawdzZarezerwowaneId` (StandardArtifactShell.types.ts:84-88), inaczej bramka
 * milcząco redukowałaby się do `never`.
 */
export type SprawdzKomplet<T> = [T] extends [KanonicznaKarta]
  ? unknown
  : BladNiekompletnejKarty<'id | label | grupa | ikona | rolaAI | aiPrompt | prog | kompozycja | statusKanonu'>;

// ─────────────────────────────────────────────────────────────────────────────
// (9) FABRYKA — jedyna droga zadeklarowania karty kanonicznej
//     Wymusza kształt w miejscu wywołania i zachowuje literały (jak `definiujKarte`
//     w konwencji domu). NIE tworzy żadnych danych — to tylko strażnik typu do adapterów
//     fazy kompozycji. Zero konsumentów w tym pliku (zalążek).
// ─────────────────────────────────────────────────────────────────────────────

export function definiujKarteKanoniczna<const T extends KanonicznaKarta>(
  karta: T & SprawdzKomplet<T>
): T {
  return karta;
}

// ─────────────────────────────────────────────────────────────────────────────
// (10) PRZYKŁAD REFERENCYJNY (w komentarzu — plik pozostaje bez danych/konsumentów).
//      Pokazuje, co SIĘ SKOMPILUJE i co NIE — dowód, że stany niedozwolone są martwe typem.
//
//   ✅ POPRAWNA (karta „AI pisze" z promptem, rdzeń Insight klasy L):
//      definiujKarteKanoniczna({
//        id: 'executive-summary',
//        label: { en: 'Executive Summary', pl: 'Podsumowanie' },
//        grupa: 'INSIGHT',
//        ikona: 'Star',
//        rolaAI: 'pisze',
//        aiPrompt: { szablon: '…prompt materializacji…' },
//        prog: { rodzaj: 'scoring-calosci', prog: 90,
//                dowod: 'cardContentFormulaValidator.ts:59' },
//        kompozycja: [{ artefakt: 'insight', rola: 'rdzen', klasa: 'L' }],
//        statusKanonu: { stan: 'czysta' },
//      });
//
//   ❌ NIE KOMPILUJE — brak `rolaAI` (żadna gałąź RolaAISpojna nie pasuje):
//      definiujKarteKanoniczna({ id:'x', label:{en:'X',pl:'X'}, grupa:'G', ikona:'I',
//        aiPrompt:{none:true,reason:'…'}, prog:{rodzaj:'do-decyzji-piotra'},
//        kompozycja:[{artefakt:'task',rola:'domyslna',klasa:'L'}],
//        statusKanonu:{stan:'czysta'} });   // Error: brak 'rolaAI'
//
//   ❌ NIE KOMPILUJE — `rolaAI:'pisze'` z JAWNYM brakiem promptu (niespójność rola↔prompt):
//      { rolaAI:'pisze', aiPrompt:{none:true,reason:'…'} }   // Error: aiPrompt musi być treścią
//
//   ❌ NIE KOMPILUJE — pusta `kompozycja` (karta bez przynależności):
//      { …, kompozycja: [] }   // Error: KompozycjaKarty to krotka niepusta
// ─────────────────────────────────────────────────────────────────────────────
