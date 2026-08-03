/**
 * toolCards.contract.ts — MIGRACJA: Tool adoptuje WIĄŻĄCY kontrakt karty (D-6/D-8).
 *
 * SSOT modelu:  Harvard/wdrozenie-100/_KANON_KARTY_MODEL_2026-07-22.md (§2.2, §3.4)
 * Przepis:      Harvard/wdrozenie-100/_PRZEPIS_MIGRACJI_TOOL_2026-07-22.md (§1.1, KROK T1)
 * Typ wiążący:  src/components/standard/cardContract.types.ts (definiujKarteKanoniczna)
 * Wzorzec POC:  src/components/MyWork/decisionCardContract.ts (commit 738447b039)
 *
 * ── CO TEN PLIK UDOWADNIA ────────────────────────────────────────────────────
 * Kompozycja „kart" centrum Tool (4 statyczne sekcje bazy wiedzy) PŁYNIE PRZEZ
 * kontrakt kanoniczny, nie przez luźny literał sekcji w komponencie. Każda z 4
 * sekcji jest zadeklarowana jako `KanonicznaKarta` (przez fabrykę
 * `definiujKarteKanoniczna`), więc stany niedozwolone są MARTWE TYPEM:
 *   · brak id/label/roli/kompozycji            → błąd kompilacji,
 *   · rola 'dane' bez jawnego `BrakAiPrompt`    → błąd kompilacji (milczenie zabronione),
 *   · rola 'pisze'/'asystuje' bez `aiPrompt`    → błąd kompilacji.
 *
 * ── KLASYFIKACJA TOOL (przepis §0, potwierdzona kodem) ───────────────────────
 * Tool = SIEROTA read-only, klasa S (registry.ts:85-90). Centrum = katalog metody
 * doradczej CZYTANY, nie redagowany: treść z `Api.getKnownTool`, identyczna dla
 * każdego użytkownika/projektu, BEZ generacji AI (KnownToolDetailView.tsx:1290-1303).
 * Dlatego:
 *   · ZERO rdzenia treści — żadna sekcja nie jest „nieusuwalną kartą-treścią pisaną
 *     przez AI". Wszystkie 4 mają `rolaAI:'dane'` + jawny `BrakAiPrompt` (nie milczą).
 *     Rdzeń (`rola:'rdzen'` ⇒ core:true) NIE występuje — i to jest POPRAWNY stan
 *     katalogu read-only, nie luka (przepis §1.1 uwaga: „Zero rdzenia").
 *   · ZERO aliasów — Tool wniósł 0 kart do rachunku 65→51; żadna sekcja nie jest
 *     dublem karty wspólnej (comments/attachments/governance…). Brak `idWArtefakcie`.
 *
 * ── WĘŻSZY ZESTAW DOMYŚLNY (przepis KROK T1 · KANON §3.4 „minimalny zestaw") ──
 * Rdzeń metody doradczej = Cel · Proces · Rezultat (co / jak / z jakim skutkiem).
 * `example` (Przykład) jest ILUSTRACJĄ — wartościowa, lecz nie-esencjalna → wystawiona
 * jako `dodawalna` (poza zestawem domyślnym, obecna w zestawie „Pełny"). To daje
 * węższy zestaw domyślny (3) + picker do pełni (4), analogicznie do POC Decision
 * (4 z 8). Kolejność 0-3 = kolejność wizualna sekcji (KnownToolDetailView.tsx:1462-1487),
 * więc adapter nie zmienia porządku (zero regresji układu).
 *   ★ DO POTWIERDZENIA PIOTRA: czy `example` ma być domyślnie ukryta (dziś w kodzie
 *     wszystkie 4 są zawsze widoczne — statyczny NModeShell, bez pickera). Rozsądny
 *     domyślny wybrany wg KANON §2.2 C (rdzeń=esencja); alternatywa: wszystkie 4
 *     domyślne (bez zwężenia). Propozycja, nie fakt.
 *
 * ── GRANICA MIGRACJI (uczciwość > kompletność, przepis KROK T1) ──────────────
 * To jest WIĄŻĄCE MINIMALNE: typowany deskryptor Tool walidowany wobec kontraktu,
 * z którego WYPROWADZAMY `ArtifactCardSpec` (`buildToolCardSpec`). NIE wpinamy go
 * dziś w render — i to jest zamierzone, INACZEJ NIŻ w POC Decision:
 *   · `KnownToolDetailView` renderuje centrum przez `NModeShell` z tablicą statycznych
 *     `NModeSection` (KnownToolDetailView.tsx:199, :1462-1487) — NIE przez `useCardLayout`
 *     (którego Decision używa i w który POC wpiął `spec`). Tool nie ma dziś warstwy
 *     managera kart ani pickera; wpięcie deskryptora = wprowadzenie useCardLayout do
 *     Tool = net-new mechanika, NIE zakres tej fali (struktura, nie budowa pickera).
 *   · Deskryptor jest więc ZALĄŻKIEM: zero konsumentów w runtime, zero zmiany widoku,
 *     zero flagi do przełączenia (stan bezpieczniejszy niż flaga OFF — brak ścieżki
 *     runtime w ogóle). Gdy powstanie warstwa managera kart Tool, `buildToolCardSpec`
 *     wpina się jak `DECISION_CARD_SPEC` w useCardLayout — ZA FLAGĄ (np.
 *     VITE_VF1_TOOL_CARD_CONTRACT / dev URL ?cardContract=1), jak POC.
 *     ★ DO POTWIERDZENIA PIOTRA: nazwa flagi + czy Tool w ogóle dostaje picker
 *       (read-only katalog może zostać bez managera — wtedy deskryptor pełni rolę
 *       kontraktu-dokumentacji, a nie źródła runtime).
 *   · `prog` = `do-decyzji-piotra` dla wszystkich (KONTRAKT §2: brak progu per-karta
 *     w kodzie; Tool nie ma reguł treści). D-1 otwarte.
 *   · Crimson w centrum (28 naruszeń, baseline przepis §4) POZOSTAJE — to osobna fala
 *     (decyzja Piotra 07-08: struktura ≠ kolor). Ten plik dodaje 0 crimson.
 */

import type { ArtifactCardSpec, CardCatalogEntry, CardSet } from '../shared/NModeLayout/cardSets';
import { definiujKarteKanoniczna, type KanonicznaKarta } from '../standard/cardContract.types';

// ─────────────────────────────────────────────────────────────────────────────
// (1) KATALOG KANONICZNY TOOL — 4 sekcje centrum, każda walidowana wobec kontraktu.
//     Id/label/ikona ⇐ NModeSection centrum (KnownToolDetailView.tsx:1462-1487).
//     Grupa ⇐ kubełki `groupLabels` (:1273-1283): goal=Przegląd, process/outcomes=
//     Jak to działa, example=Przykład. Kolejność deklaracji = kolejność wizualna.
// ─────────────────────────────────────────────────────────────────────────────

/** Cel — czym jest narzędzie i po co (Przegląd). Read-only, treść z API bazy wiedzy. */
const GOAL = definiujKarteKanoniczna({
  id: 'goal',
  label: { en: 'Goal', pl: 'Cel' },
  grupa: 'OVERVIEW',
  ikona: 'Target',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason:
      'statyczna baza wiedzy — treść z Api.getKnownTool, identyczna dla każdego użytkownika/projektu, nie generacja AI (KnownToolDetailView.tsx:1290-1303)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'tool', rola: 'domyslna', klasa: 'S', kolumna: 'left', kolejnosc: 0 }],
  statusKanonu: { stan: 'czysta' },
});

/** Proces — jak metoda przebiega (Jak to działa). */
const PROCESS = definiujKarteKanoniczna({
  id: 'process',
  label: { en: 'Process', pl: 'Proces' },
  grupa: 'HOW-IT-WORKS',
  ikona: 'CheckCircle2',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'statyczna baza wiedzy — treść z Api.getKnownTool, nie generacja AI',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'tool', rola: 'domyslna', klasa: 'S', kolumna: 'left', kolejnosc: 1 }],
  statusKanonu: { stan: 'czysta' },
});

/** Rezultat — z jakim skutkiem (Jak to działa). */
const OUTCOMES = definiujKarteKanoniczna({
  id: 'outcomes',
  label: { en: 'Outcomes', pl: 'Rezultat' },
  grupa: 'HOW-IT-WORKS',
  ikona: 'Lightbulb',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'statyczna baza wiedzy — treść z Api.getKnownTool, nie generacja AI',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'tool', rola: 'domyslna', klasa: 'S', kolumna: 'left', kolejnosc: 2 }],
  statusKanonu: { stan: 'czysta' },
});

/**
 * Przykład — ilustracja zastosowania (Przykład). DODAWALNA: poza węższym zestawem
 * domyślnym, obecna w „Pełny" (patrz nagłówek: rdzeń metody = Cel/Proces/Rezultat).
 * ★ DO POTWIERDZENIA PIOTRA (propozycja zwężenia, nie fakt z kodu).
 */
const EXAMPLE = definiujKarteKanoniczna({
  id: 'example',
  label: { en: 'Example', pl: 'Przykład' },
  grupa: 'EXAMPLE',
  ikona: 'FileText',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'statyczna baza wiedzy — treść z Api.getKnownTool, nie generacja AI',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'tool', rola: 'dodawalna', klasa: 'S', kolumna: 'left', kolejnosc: 3 }],
  statusKanonu: { stan: 'czysta' },
});

/**
 * Deskryptor kanoniczny Tool — 4 sekcje. Typ elementu to `KanonicznaKarta`, więc
 * cała tablica jest wiążąca: dopisanie sekcji bez kompletu pól nie skompiluje się.
 * ★ Klasa S = limit 4 sekcji lewej kolumny (registry.ts:88-90) — trafiony 4/4;
 *   dodanie 5. sekcji treści złamie klasę S (przepis R3).
 */
export const TOOL_CARDS: readonly KanonicznaKarta[] = [GOAL, PROCESS, OUTCOMES, EXAMPLE];

// ─────────────────────────────────────────────────────────────────────────────
// (2) ADAPTER kanon → ArtifactCardSpec (zwężenie do modelu, który konsumowałby
//     `useCardLayout`, gdyby Tool zyskał manager kart). `core` z `rola==='rdzen'`
//     (tu: żadna — Tool jest read-only, zero rdzenia); węższy zestaw domyślny =
//     karty rdzeń+domyślna; „Pełny" = wszystkie 4.
// ─────────────────────────────────────────────────────────────────────────────

/** Członkostwo sekcji w Tool (dokładnie jedno na sekcję tego deskryptora). */
function toolMembership(karta: KanonicznaKarta) {
  const m = karta.kompozycja.find((p) => p.artefakt === 'tool');
  if (!m) {
    throw new Error(`toolCards.contract: karta ${karta.id} bez przynależności 'tool'`);
  }
  return m;
}

/** Id, pod którym Tool RENDERUJE sekcję (Tool nie ma aliasów ⇒ zawsze id kanoniczny). */
function renderId(karta: KanonicznaKarta): string {
  return toolMembership(karta).idWArtefakcie ?? karta.id;
}

function toCatalogEntry(karta: KanonicznaKarta): CardCatalogEntry {
  const m = toolMembership(karta);
  const entry: CardCatalogEntry = {
    id: renderId(karta),
    label: karta.label,
    icon: karta.ikona,
    group: karta.grupa,
  };
  // `core` tylko dla rdzenia — dla Tool nieosiągalne (żadna sekcja nie jest 'rdzen'),
  // ale utrzymujemy szew: gdyby Piotr wskazał rdzeń, ta gałąź zadziała bez zmian.
  return m.rola === 'rdzen' ? { ...entry, core: true } : entry;
}

/**
 * Buduje `ArtifactCardSpec` Tool z deskryptora kanonicznego.
 *   · catalog  = wszystkie 4 sekcje (id kanoniczny, brak core — Tool read-only),
 *   · default  = RDZEŃ + domyślne = Cel/Proces/Rezultat (węższy zestaw, 3),
 *   · full     = wszystkie 4 (Przykład dołącza — jedno kliknięcie w managerze).
 */
export function buildToolCardSpec(): ArtifactCardSpec {
  const catalog = TOOL_CARDS.map(toCatalogEntry);

  const defaultCards = TOOL_CARDS.filter((k) => {
    const rola = toolMembership(k).rola;
    return rola === 'rdzen' || rola === 'domyslna';
  }).map(renderId);

  const allCards = TOOL_CARDS.map(renderId);

  const sets: CardSet[] = [
    { id: 'default', label: { en: 'Core method', pl: 'Rdzeń metody' }, cards: defaultCards },
    { id: 'full', label: { en: 'Full', pl: 'Pełny' }, cards: allCards },
  ];

  return { catalog, sets };
}

/**
 * Stała referencja spec (moduł-const) — wymóg `useCardLayout` (spec musi być stabilny,
 * bo zasila memo warstwy). Wyprowadzona RAZ z deskryptora kanonicznego. Dziś BEZ
 * konsumenta (zalążek — patrz nagłówek „GRANICA MIGRACJI").
 */
export const TOOL_CARD_SPEC: ArtifactCardSpec = buildToolCardSpec();

/**
 * Render-idy w kolejności deklaracji — do lekkiej asercji zgodności (każda sekcja
 * renderowana ma wpis w katalogu i odwrotnie), gdy powstanie wpięcie w render.
 */
export const TOOL_CARD_RENDER_IDS: readonly string[] = TOOL_CARDS.map(renderId);
