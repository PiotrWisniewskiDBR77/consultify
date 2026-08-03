/**
 * decisionCardContract.ts — POC: Decision adoptuje WIĄŻĄCY kontrakt karty (D-8).
 *
 * SSOT modelu:  Harvard/wdrozenie-100/_KANON_KARTY_MODEL_2026-07-22.md (§2.2 C+E, §3)
 * Kontrakt:     Harvard/wdrozenie-100/_KONTRAKT_KARTY_SSOT_2026-07-22.md (§9 plan POC-first)
 * Typ wiążący:  src/components/standard/cardContract.types.ts (definiujKarteKanoniczna)
 *
 * ── CO TEN PLIK UDOWADNIA ────────────────────────────────────────────────────
 * Kompozycja kart Decision PŁYNIE PRZEZ kontrakt kanoniczny, nie przez luźny
 * literał w `cardSets.ts`. Każda z 8 kart jest zadeklarowana jako `KanonicznaKarta`
 * (przez fabrykę `definiujKarteKanoniczna`), więc stany niedozwolone są MARTWE TYPEM:
 *   · brak id/label/roli/kompozycji            → błąd kompilacji,
 *   · rola 'pisze'/'asystuje' bez `aiPrompt`    → błąd kompilacji,
 *   · rola 'dane'/'systemowa'/'transakcyjna'    → MUSI jawnie nazwać brak promptu.
 * Rdzeń (`context-problem`, rola `rdzen`) jest nieusuwalny NIE przez konwencję UI,
 * lecz przez typ: adapter wyprowadza `core:true` wprost z `rola==='rdzen'`, a
 * `useCardLayout.removeCard` przerywa dla `core` (useCardLayout.ts:190). Rdzeń nie
 * ma jak zniknąć z katalogu, bo krotka `KompozycjaKarty` jest NIEPUSTA.
 *
 * ── ALIASY (dedup, KANON §2.2 E) ─────────────────────────────────────────────
 * Dwie karty Decision to karty WSPÓLNE pod kanonicznym id, renderowane w Decision
 * pod id-aliasem. `idWArtefakcie` (cardContract.types.ts) niesie tę różnicę:
 *   kanoniczny `governance`   → render `governance-escalation` (cardSets.ts:444),
 *   kanoniczny `attachments`  → render `resources-links`       (cardSets.ts:456).
 * Adapter mapuje `idWArtefakcie ?? id` na id sekcji, więc layout pokrywa 1:1 to, co
 * DecisionDetailView faktycznie renderuje (notionSections:1218-1247 + prawy panel) —
 * ZERO regresji, a katalog kanoniczny pozostaje zdeduplikowany.
 *
 * ── WĘŻSZY ZESTAW DOMYŚLNY (D-5) ─────────────────────────────────────────────
 * Dziś `DECISION_SPEC.sets[0]` = wszystkie 8 (cardSets.ts:468-482). Kanon: domyślny =
 * RDZEŃ + kluczowe treści decyzji (4 karty rodziny DECISION, KANON §2.2 C); reszta
 * (governance, attachments, comments, activity-log) → dodawalna z managera. `comments`
 * i `activity-log` i tak żyją w PRAWYM panelu (SPEC-N §2.1), więc ich nieobecność w
 * domyślnym zestawie lewej nawigacji nie zmienia nic na ekranie.
 *
 * ── GRANICA POC (uczciwość > kompletność) ────────────────────────────────────
 * To jest WIĄŻĄCE MINIMALNE: typowany deskryptor Decision walidowany wobec kontraktu,
 * z którego WYPROWADZAMY `ArtifactCardSpec` konsumowany przez istniejący `useCardLayout`.
 * NIE zastępujemy `cardSets.ts`/`useCardLayout` typem kanonicznym w całym runtime — to
 * PEŁNA adopcja (opis niżej), świadomie odłożona:
 *   · `useCardLayout` nadal operuje na `CardCatalogEntry` (id/label/icon/core), nie na
 *     `KanonicznaKarta`; adapter jest zwężeniem (rzutuje bogatszy typ na uboższy).
 *   · `aiPrompt.szablon` to SKRÓT intencji; PEŁNY template generacji żyje w handlerach FE
 *     (generateAlternativesAI/generateRisksAI/generateConsequenceScenariosAI) i serwisach —
 *     pełna adopcja importuje je tu i wiąże `kluczPromptu` ze slotem generacji.
 *   · `prog` = `do-decyzji-piotra` dla wszystkich (KONTRAKT §2: brak progu per-karta w
 *     kodzie; reguły treści Decision są MARTWE — bez callera, §3.3). D-1 otwarte.
 */

import type { ArtifactCardSpec, CardCatalogEntry, CardSet } from '../shared/NModeLayout/cardSets';
import { definiujKarteKanoniczna, type KanonicznaKarta } from '../standard/cardContract.types';

// ─────────────────────────────────────────────────────────────────────────────
// (1) KATALOG KANONICZNY DECISION — 8 kart, każda walidowana wobec kontraktu.
//     Kolejność deklaracji = kolejność wizualna (notionSections + prawy panel),
//     więc adapter nie zmienia porządku (zero regresji układu).
// ─────────────────────────────────────────────────────────────────────────────

/** RDZEŃ — nieusuwalny (rola `rdzen` ⇒ core:true w adapterze). */
const CONTEXT_PROBLEM = definiujKarteKanoniczna({
  id: 'context-problem',
  label: { en: 'Decision Scope', pl: 'Zakres decyzji' },
  grupa: 'DECISION',
  ikona: 'FileText',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Opisz zakres i problem decyzji: kontekst, granice, co jest przedmiotem rozstrzygnięcia.',
    kluczPromptu: 'decision.context-problem',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'decision', rola: 'rdzen', klasa: 'L', kolumna: 'left', kolejnosc: 0 }],
  statusKanonu: { stan: 'czysta' },
});

const OPTIONS_TRADEOFFS = definiujKarteKanoniczna({
  id: 'options-tradeoffs',
  label: { en: 'Options & Trade-offs', pl: 'Opcje i trade-offy' },
  grupa: 'DECISION',
  ikona: 'GitCompare',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Wygeneruj opcje decyzyjne i ich trade-offy (zalety/wady, koszt, ryzyko każdej).',
    kluczPromptu: 'decision.options', // handler 'options' → generateAlternativesAI
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'decision', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 1 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const RISK_IMPACT = definiujKarteKanoniczna({
  id: 'risk-impact',
  label: { en: 'Risk & Impact', pl: 'Ryzyko i wpływ' },
  grupa: 'DECISION',
  ikona: 'ShieldAlert',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Przeanalizuj ryzyka i wpływ wybranej opcji: prawdopodobieństwo, skutek, mitygacja.',
    kluczPromptu: 'decision.risk', // handler 'risk' → generateRisksAI
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'decision', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 2 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const CONSEQUENCES = definiujKarteKanoniczna({
  id: 'consequences',
  label: { en: 'Consequences', pl: 'Konsekwencje' },
  grupa: 'DECISION',
  ikona: 'Clock',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Konsekwencje braku decyzji w 3 scenariuszach (pesymistyczny/neutralny/optymistyczny), horyzont d7/d30/d90.',
    kluczPromptu: 'decision.consequences', // handler 'consequences' → generateConsequenceScenariosAI
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'decision', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 3 },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `governance` (#51) — w Decision renderowana jako `governance-escalation`. */
const GOVERNANCE = definiujKarteKanoniczna({
  id: 'governance',
  label: { en: 'RACI & Escalation', pl: 'RACI i eskalacja' },
  grupa: 'CONTROL',
  ikona: 'Users',
  rolaAI: 'asystuje',
  aiPrompt: {
    szablon: 'Zaproponuj macierz RACI i ścieżkę eskalacji; człowiek zatwierdza role i progi.',
    kluczPromptu: 'decision.raci', // handler 'raci'
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'decision',
      rola: 'dodawalna',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 4,
      idWArtefakcie: 'governance-escalation',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `attachments` (#49) — w Decision renderowana jako `resources-links`. */
const ATTACHMENTS = definiujKarteKanoniczna({
  id: 'attachments',
  label: { en: 'Attachments & Links', pl: 'Załączniki i powiązania' },
  grupa: 'CONTROL',
  ikona: 'Paperclip',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason:
      'pliki i powiązania wskazuje użytkownik — AI nie ma czego wygenerować (DecisionDetailView:1284)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'decision',
      rola: 'dodawalna',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 5,
      idWArtefakcie: 'resources-links',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `comments` (#47) — prawy panel (SPEC-N §2.1), nie sekcja lewej nawigacji. */
const COMMENTS = definiujKarteKanoniczna({
  id: 'comments',
  label: { en: 'Comments', pl: 'Komentarze' },
  grupa: 'AUDIT',
  ikona: 'MessageSquare',
  rolaAI: 'transakcyjna',
  aiPrompt: {
    none: true,
    reason: 'strumień komentarzy użytkowników — nie generacja treści',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'decision', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 6 },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `activity-log` (#48) — prawy panel (SPEC-N §2.1). */
const ACTIVITY_LOG = definiujKarteKanoniczna({
  id: 'activity-log',
  label: { en: 'Activity Log', pl: 'Logi aktywności' },
  grupa: 'AUDIT',
  ikona: 'History',
  rolaAI: 'systemowa',
  aiPrompt: {
    none: true,
    reason:
      'log zdarzeń jest zapisem faktów, treść generowana byłaby fałszem (DecisionDetailView:1290)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'decision', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 7 },
  ],
  statusKanonu: { stan: 'czysta' },
});

/**
 * Deskryptor kanoniczny Decision — 8 kart. Typ elementu to `KanonicznaKarta`, więc
 * cała tablica jest wiążąca: dopisanie karty bez kompletu pól nie skompiluje się.
 */
export const DECISION_CARDS: readonly KanonicznaKarta[] = [
  CONTEXT_PROBLEM,
  OPTIONS_TRADEOFFS,
  RISK_IMPACT,
  CONSEQUENCES,
  GOVERNANCE,
  ATTACHMENTS,
  COMMENTS,
  ACTIVITY_LOG,
];

// ─────────────────────────────────────────────────────────────────────────────
// (2) ADAPTER kanon → ArtifactCardSpec (zwężenie do modelu, który konsumuje
//     `useCardLayout`). Alias `idWArtefakcie` staje się id sekcji; `core` wynika
//     z `rola==='rdzen'`; węższy zestaw domyślny = karty rdzeń+domyślna.
// ─────────────────────────────────────────────────────────────────────────────

/** Członkostwo karty w Decision (dokładnie jedno na kartę tego deskryptora). */
function decisionMembership(karta: KanonicznaKarta) {
  const m = karta.kompozycja.find((p) => p.artefakt === 'decision');
  if (!m) {
    // Niewyrażalne dla tego deskryptora (wszystkie karty należą do 'decision'),
    // ale strzeżemy adapter, gdyby ktoś dołożył kartę bez przynależności Decision.
    throw new Error(`decisionCardContract: karta ${karta.id} bez przynależności 'decision'`);
  }
  return m;
}

/** Id, pod którym Decision RENDERUJE kartę (alias dedup albo id kanoniczny). */
function renderId(karta: KanonicznaKarta): string {
  return decisionMembership(karta).idWArtefakcie ?? karta.id;
}

function toCatalogEntry(karta: KanonicznaKarta): CardCatalogEntry {
  const m = decisionMembership(karta);
  const entry: CardCatalogEntry = {
    id: renderId(karta),
    label: karta.label,
    icon: karta.ikona,
    group: karta.grupa,
  };
  // `core` tylko dla rdzenia — utrzymujemy kształt `CardCatalogEntry` (core?: boolean).
  return m.rola === 'rdzen' ? { ...entry, core: true } : entry;
}

/**
 * Buduje `ArtifactCardSpec` Decision z deskryptora kanonicznego.
 *   · catalog  = wszystkie 8 kart (id = render-id, core z rdzenia),
 *   · default  = RDZEŃ + domyślne (węższy zestaw D-5),
 *   · full     = wszystkie 8 (przywrócenie pełni jednym kliknięciem w managerze).
 */
export function buildDecisionCardSpec(): ArtifactCardSpec {
  const catalog = DECISION_CARDS.map(toCatalogEntry);

  const defaultCards = DECISION_CARDS.filter((k) => {
    const rola = decisionMembership(k).rola;
    return rola === 'rdzen' || rola === 'domyslna';
  }).map(renderId);

  const allCards = DECISION_CARDS.map(renderId);

  const sets: CardSet[] = [
    { id: 'default', label: { en: 'Core decision', pl: 'Rdzeń decyzji' }, cards: defaultCards },
    { id: 'full', label: { en: 'Full', pl: 'Pełny' }, cards: allCards },
  ];

  return { catalog, sets };
}

/**
 * Stała referencja spec (moduł-const) — wymóg `useCardLayout` (spec musi być stabilny,
 * bo zasila memo warstwy). Wyprowadzona RAZ z deskryptora kanonicznego.
 */
export const DECISION_CARD_SPEC: ArtifactCardSpec = buildDecisionCardSpec();

/**
 * Render-idy w kolejności deklaracji — do lekkiej asercji zgodności w DecisionDetailView
 * (każda sekcja renderowana ma wpis w katalogu i odwrotnie — R2 z planu §9).
 */
export const DECISION_CARD_RENDER_IDS: readonly string[] = DECISION_CARDS.map(renderId);
