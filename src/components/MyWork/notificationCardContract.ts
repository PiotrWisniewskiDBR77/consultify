/**
 * notificationCardContract.ts — MIGRACJA: Notification adoptuje WIĄŻĄCY kontrakt karty (D-8).
 *
 * Wzorzec:      src/components/MyWork/decisionCardContract.ts (POC Decision, commit 738447b039)
 * Przepis:      Harvard/wdrozenie-100/_PRZEPIS_MIGRACJI_NOTIFICATION_2026-07-22.md (§1 deskryptor, §3 decyzje)
 * SSOT modelu:  Harvard/wdrozenie-100/_KANON_KARTY_MODEL_2026-07-22.md (§2.2 katalog, §3.4 sieroty)
 * Typ wiążący:  src/components/standard/cardContract.types.ts (definiujKarteKanoniczna)
 *
 * ── CO TEN PLIK UDOWADNIA ────────────────────────────────────────────────────
 * Kompozycja kart Notification (sierota klasy S — panel skrócony) PŁYNIE PRZEZ
 * kontrakt kanoniczny, nie przez zahardkodowany literał `nModeSections`
 * (NotificationDetailView.tsx:1359-1393). Każda karta lewej nawigacji jest
 * `KanonicznaKarta` (przez fabrykę `definiujKarteKanoniczna`), więc stany
 * niedozwolone są MARTWE TYPEM (brak id/label/roli/kompozycji ⇒ błąd kompilacji).
 * Rdzeń (`whats-happening`+`expected-action`, rola `rdzen`) jest nieusuwalny NIE
 * przez konwencję UI, lecz przez typ: adapter wyprowadza `core:true` wprost z
 * `rola==='rdzen'`, a `useCardLayout.removeCard` przerywa dla `core`
 * (useCardLayout.ts:200).
 *
 * ── ALIASY (dedup, KANON §2.2) ───────────────────────────────────────────────
 * Rdzeń Notification mapuje się na kanon PO KSZTAŁCIE (przepis §1a):
 *   render `whats-happening`  → kanoniczny `executive-summary` (#1),
 *   render `expected-action`  → kanoniczny `artifact-actions`  (#2),
 *   render `history` (panel)  → kanoniczny `activity-log`      (#48).
 * `idWArtefakcie` (cardContract.types.ts:164) niesie różnicę render-id ↔ id
 * kanonicznego, więc katalog pozostaje zdeduplikowany, a layout pokrywa 1:1 to,
 * co NotificationDetailView faktycznie renderuje (ZERO regresji układu).
 *
 * ── WĘŻSZY ZESTAW DOMYŚLNY (D-5, przepis §1a/§6) ─────────────────────────────
 * Dziś lewa nawigacja pokazuje `whats-happening` + (warunkowo) `ai-analysis` +
 * `expected-action`. Kanon: domyślny = RDZEŃ (2 karty); `ai-analysis` schodzi do
 * DODAWALNEJ (picker „Pełny" / „+ Nowa karta"). Treść `ai-analysis` i tak jest
 * warunkowa (`hasAIContext`, NotificationDetailView:1366-1375), więc jej
 * nieobecność w domyślnym zestawie nie psuje ekranu — użytkownik dokłada ją
 * świadomie. `comments` jest POMINIĘTA całkowicie (K2 — powiadomienie to
 * wiadomość systemowa, nie artefakt współpracy), więc nie ma jej w katalogu.
 *
 * ── ★ OTWARTE DECYZJE (DO POTWIERDZENIA PIOTRA — kanon nie zgaduje, §3 przepisu) ─
 *  (1) `ai-analysis` NIE MA kanonicznego id w katalogu 51 (przepis R1). Wybrany
 *      rozsądny domyślny: NOWE kanoniczne id `ai-analysis` z `statusKanonu:
 *      'do-decyzji-piotra'` (zamiast aliasu do `consulting-readout` czy lokalnego
 *      wyjątku). Ma realną generację (`generateAIAnalysis` :1092) ⇒ `rolaAI:'pisze'`.
 *  (2) rola_AI `whats-happening`: kanon `executive-summary` = `pisze` (wymaga
 *      promptu treści), ale w Notification treść bazowa jest systemowo komponowana
 *      z danych powiadomienia; AI tylko asystuje (`applyIfUntouched` :870). Wybór:
 *      `asystuje` (uczciwie — jest realny assist), `statusKanonu:'rozjazd'`.
 *  (3) `expected-action` — rdzeń czy domyślna? Przepis §1a: kanon §3.4 wymienia
 *      jako rdzeń tylko „treść wiadomości". Wybrany domyślny: RDZEŃ (za zadaniem:
 *      „Rdzeń: whats-happening + expected-action").
 *  (4) `prog` per-karta: brak w kodzie ⇒ `do-decyzji-piotra` dla wszystkich (D-1).
 *
 * ── GRANICA MIGRACJI (uczciwość > kompletność) ───────────────────────────────
 * To jest WIĄŻĄCE MINIMALNE (jak POC): typowany deskryptor Notification walidowany
 * wobec kontraktu, z którego WYPROWADZAMY `ArtifactCardSpec` konsumowany przez
 * istniejący `useCardLayout`. NIE zdejmujemy 38 crimson z centrum (osobna fala,
 * decyzja Piotra 07-08 — ta migracja to STRUKTURA, nie kolor). `aiPrompt.szablon`
 * to SKRÓT intencji; pełne template'y generacji żyją w handlerach FE.
 */

import type { ArtifactCardSpec, CardCatalogEntry, CardSet } from '../shared/NModeLayout/cardSets';
import { definiujKarteKanoniczna, type KanonicznaKarta } from '../standard/cardContract.types';

// ─────────────────────────────────────────────────────────────────────────────
// (1) KATALOG KANONICZNY NOTIFICATION — lewa nawigacja (3 karty).
//     Kolejność deklaracji = kolejność wizualna (nModeSections:1359-1393),
//     więc adapter nie zmienia porządku (zero regresji układu).
// ─────────────────────────────────────────────────────────────────────────────

/** RDZEŃ #1 — `executive-summary`, w Notification renderowana jako `whats-happening`. */
const WHATS_HAPPENING = definiujKarteKanoniczna({
  id: 'executive-summary',
  label: { en: "What's Happening", pl: 'Co się dzieje' },
  grupa: 'NOTIFICATION',
  ikona: 'FileText',
  // ★ DO POTWIERDZENIA PIOTRA (§3.2): kanon executive-summary = 'pisze'; tu treść
  // bazowa komponowana systemowo z danych powiadomienia, AI tylko asystuje
  // (applyIfUntouched :870) — brak silnika bazowej treści (:224-227). Uczciwie: 'asystuje'.
  rolaAI: 'asystuje',
  aiPrompt: {
    szablon:
      'Sparsuj dane powiadomienia i zaproponuj draft opisu „co się dzieje" + „dlaczego to ważne"; człowiek edytuje (applyIfUntouched).',
    kluczPromptu: 'notification.whats-happening',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'notification',
      rola: 'rdzen',
      klasa: 'S',
      kolumna: 'left',
      kolejnosc: 0,
      idWArtefakcie: 'whats-happening',
    },
  ],
  // Rozjazd: kanon wskazuje 'pisze', tu 'asystuje' bo brak realnego generatora treści bazowej.
  statusKanonu: {
    stan: 'rozjazd',
    opis: "kanon executive-summary='pisze'; Notification nie ma silnika treści bazowej — AI tylko asystuje",
    dowod: 'NotificationDetailView.tsx:224-227 (puste useState) + :870 (applyIfUntouched)',
  },
});

/**
 * DODAWALNA (warunkowa) — `ai-analysis`. ★ BRAK w katalogu 51 (przepis R1).
 * Wybrany domyślny: NOWE kanoniczne id, `statusKanonu:'do-decyzji-piotra'`.
 */
const AI_ANALYSIS = definiujKarteKanoniczna({
  id: 'ai-analysis',
  label: { en: 'AI Analysis', pl: 'Analiza AI' },
  grupa: 'NOTIFICATION',
  ikona: 'Brain',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Wygeneruj analizę AI kontekstu powiadomienia: rekomendacja, ryzyko/impact, poziom pewności (gdy hasAIContext).',
    kluczPromptu: 'notification.ai-analysis', // handler generateAIAnalysis :1092
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'notification',
      rola: 'dodawalna',
      klasa: 'S',
      kolumna: 'left',
      kolejnosc: 1,
      idWArtefakcie: 'ai-analysis',
    },
  ],
  // ★ DO POTWIERDZENIA PIOTRA: sekcja renderowana (:1368-1373) bez wpisu w katalogu 51.
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: "brak kanonicznego id w katalogu 51 — propozycja NOWEGO id 'ai-analysis' (alt: alias consulting-readout / lokalny wyjątek)",
  },
});

/** RDZEŃ #2 — `artifact-actions`, w Notification renderowana jako `expected-action`. */
const EXPECTED_ACTION = definiujKarteKanoniczna({
  id: 'artifact-actions',
  label: { en: 'Expected Action', pl: 'Oczekiwana akcja' },
  grupa: 'NOTIFICATION',
  ikona: 'CheckSquare',
  // AI proponuje checklistę akcji (generateActionChecklist :462, canExpectedActionAI :1326);
  // człowiek wykonuje/edytuje ⇒ 'asystuje'.
  rolaAI: 'asystuje',
  aiPrompt: {
    szablon:
      'Zaproponuj checklistę oczekiwanych akcji na podstawie treści powiadomienia; człowiek odhacza/edytuje.',
    kluczPromptu: 'notification.expected-action', // handler generateActionChecklist :462
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'notification',
      rola: 'rdzen',
      klasa: 'S',
      kolumna: 'left',
      kolejnosc: 2,
      idWArtefakcie: 'expected-action',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

/**
 * KARTA PRAWEGO PANELU (poza layoutem lewej nawigacji) — deklarowana dla
 * KOMPLETNOŚCI kontraktu (dedup aliasu `history→activity-log`), ale NIE wchodzi
 * do `NOTIFICATION_CARD_SPEC` (prawy panel renderuje ją `rightPanelSections:2547`,
 * nie `useCardLayout`). Wzór: SPEC-N §2.1 — `history`/`activity-log` żyją w panelu.
 */
export const ACTIVITY_LOG = definiujKarteKanoniczna({
  id: 'activity-log',
  label: { en: 'Activity Log', pl: 'Historia aktywności' },
  grupa: 'AUDIT',
  ikona: 'History',
  rolaAI: 'systemowa',
  aiPrompt: {
    none: true,
    reason:
      'log zdarzeń to zapis faktów — treść generowana byłaby fałszem (BrakAiPrompt, przepis §1b)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'notification',
      rola: 'domyslna',
      klasa: 'S',
      kolumna: 'right',
      kolejnosc: 0,
      idWArtefakcie: 'history',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

// POMINIĘTA ŚWIADOMIE (przepis §1c, K2): `comments` (#47) — powiadomienie to
// wiadomość systemowa, nie artefakt współpracy. Sekcja znika CAŁKOWICIE (nie do
// panelu). NIE deklarowana jako karta. `properties` (:2505) = sekcja POWŁOKI
// (ArtifactRightPanel), nie wpis katalogu 51 — również nie deklarowana tutaj.

/**
 * Deskryptor kanoniczny Notification — karty LEWEJ NAWIGACJI (3). Typ elementu to
 * `KanonicznaKarta`, więc cała tablica jest wiążąca (dopisanie karty bez kompletu
 * pól nie skompiluje się). `ACTIVITY_LOG` (prawy panel) świadomie poza tą listą.
 */
export const NOTIFICATION_CARDS: readonly KanonicznaKarta[] = [
  WHATS_HAPPENING,
  AI_ANALYSIS,
  EXPECTED_ACTION,
];

// ─────────────────────────────────────────────────────────────────────────────
// (2) ADAPTER kanon → ArtifactCardSpec (zwężenie do modelu, który konsumuje
//     `useCardLayout`). Alias `idWArtefakcie` staje się render-id; `core` wynika
//     z `rola==='rdzen'`; węższy zestaw domyślny = karty rdzeń.
// ─────────────────────────────────────────────────────────────────────────────

/** Członkostwo karty w Notification (dokładnie jedno na kartę tego deskryptora). */
function notificationMembership(karta: KanonicznaKarta) {
  const m = karta.kompozycja.find((p) => p.artefakt === 'notification');
  if (!m) {
    throw new Error(
      `notificationCardContract: karta ${karta.id} bez przynależności 'notification'`
    );
  }
  return m;
}

/** Id, pod którym Notification RENDERUJE kartę (alias dedup albo id kanoniczny). */
function renderId(karta: KanonicznaKarta): string {
  return notificationMembership(karta).idWArtefakcie ?? karta.id;
}

function toCatalogEntry(karta: KanonicznaKarta): CardCatalogEntry {
  const m = notificationMembership(karta);
  const entry: CardCatalogEntry = {
    id: renderId(karta),
    label: karta.label,
    icon: karta.ikona,
    group: karta.grupa,
  };
  return m.rola === 'rdzen' ? { ...entry, core: true } : entry;
}

/**
 * Buduje `ArtifactCardSpec` Notification z deskryptora kanonicznego (lewa nawigacja).
 *   · catalog  = 3 karty (id = render-id, core z rdzenia),
 *   · default  = RDZEŃ (węższy zestaw D-5 — `whats-happening` + `expected-action`),
 *   · full     = wszystkie 3 (dołożenie `ai-analysis` jednym kliknięciem w managerze).
 */
export function buildNotificationCardSpec(): ArtifactCardSpec {
  const catalog = NOTIFICATION_CARDS.map(toCatalogEntry);

  const defaultCards = NOTIFICATION_CARDS.filter(
    (k) => notificationMembership(k).rola === 'rdzen'
  ).map(renderId);

  const allCards = NOTIFICATION_CARDS.map(renderId);

  const sets: CardSet[] = [
    {
      id: 'default',
      label: { en: 'Core notification', pl: 'Rdzeń powiadomienia' },
      cards: defaultCards,
    },
    { id: 'full', label: { en: 'Full', pl: 'Pełny' }, cards: allCards },
  ];

  return { catalog, sets };
}

/**
 * Stała referencja spec (moduł-const) — wymóg `useCardLayout` (spec musi być stabilny,
 * bo zasila memo warstwy). Wyprowadzona RAZ z deskryptora kanonicznego.
 */
export const NOTIFICATION_CARD_SPEC: ArtifactCardSpec = buildNotificationCardSpec();

/**
 * Render-idy lewej nawigacji w kolejności deklaracji — do lekkiej asercji zgodności
 * w NotificationDetailView (każda sekcja nav ma wpis w katalogu — R2 z planu §9).
 */
export const NOTIFICATION_CARD_RENDER_IDS: readonly string[] = NOTIFICATION_CARDS.map(renderId);
