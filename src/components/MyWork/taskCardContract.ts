/**
 * taskCardContract.ts — MIGRACJA: Task adoptuje WIĄŻĄCY kontrakt karty (D-8).
 *
 * SSOT modelu:  Harvard/wdrozenie-100/_KANON_KARTY_MODEL_2026-07-22.md (§2.2, §3)
 * Kontrakt:     Harvard/wdrozenie-100/_KONTRAKT_KARTY_SSOT_2026-07-22.md (§9 plan POC-first)
 * Przepis:      Harvard/wdrozenie-100/_PRZEPIS_MIGRACJI_TASK_2026-07-22.md (§1 deskryptor, §3 R1-R7)
 * Typ wiążący:  src/components/standard/cardContract.types.ts (definiujKarteKanoniczna)
 * Wzorzec 1:1:  src/components/MyWork/decisionCardContract.ts (POC, commit 738447b039)
 *
 * ── CO TEN PLIK UDOWADNIA (bliźniak Decision) ─────────────────────────────────
 * Kompozycja kart Task PŁYNIE PRZEZ kontrakt kanoniczny, nie przez luźny literał
 * w `cardSets.ts` (TASK_SPEC). Każda z 10 kart Taska jest zadeklarowana jako
 * `KanonicznaKarta` (przez fabrykę `definiujKarteKanoniczna`), więc stany
 * niedozwolone są MARTWE TYPEM:
 *   · brak id/label/roli/kompozycji            → błąd kompilacji,
 *   · rola 'pisze'/'asystuje' bez `aiPrompt`    → błąd kompilacji,
 *   · rola 'dane'/'systemowa'/'transakcyjna'    → MUSI jawnie nazwać brak promptu.
 * Rdzeń (`description-scope`, rola `rdzen`) jest nieusuwalny NIE przez konwencję UI,
 * lecz przez typ: adapter wyprowadza `core:true` wprost z `rola==='rdzen'`, a
 * `useCardLayout.removeCard` przerywa dla `core` (useCardLayout.ts:200). Rdzeń nie
 * ma jak zniknąć z katalogu, bo krotka `KompozycjaKarty` jest NIEPUSTA.
 *
 * ── ŹRÓDŁO ROLI_AI: KOD, NIE DOMYSŁ ──────────────────────────────────────────
 * Przewaga Taska nad Decision (przepis §0): rola_AI + prompt/brak SĄ JUŻ
 * zadeklarowane per karta w kodzie — `TASK_AI_CARD_META` (kontrakt realny) +
 * `TASK_AI_CONTRACT_NONE` (jawny brak) w TaskDetailView.tsx:250-285. Deskryptor
 * przepisuje je, nie zgaduje. Prompty żywe: `TASK_SECTION_PROMPTS`
 * (server/src/services/taskSectionGenerationService.ts:101-142), klucze przez
 * `CARD_BACKEND_KEY` (TaskDetailView.tsx:367-372): description-scope→strategy,
 * checklist→execution, dependencies→dependencies, evidence→evidence.
 *
 * ── ★ TRZY KARTY POZA BINARNYM TYPEM (R1) — DO POTWIERDZENIA PIOTRA ───────────
 * Typ `RolaAISpojna` (cardContract.types.ts:91-104) jest binarny: `pisze|asystuje
 * ⇒ prompt`; `dane|systemowa|transakcyjna ⇒ brak`. Trzy karty Taska w kodzie NIE
 * mieszczą się wprost (przepis §3-R1). Ponieważ zadanie ZABRANIA edycji samego
 * typu (opcja (b) z przepisu dotyka wszystkich 7 artefaktów → osobny krok przez
 * POC), modeluję je W RAMACH istniejącego typu, jako ROZSĄDNY DOMYŚLNY:
 *
 *   1. `governance` — kod: CONTRACT_NONE (RACI = decyzja człowieka). Kanon: to
 *      karta WSPÓLNA #51, którą Decision (bliźniak) już deklaruje `asystuje` +
 *      prompt RACI. Jedna karta = jedna rola globalnie (rola_AI to pole karty,
 *      nie przynależności — cardContract.types.ts:236), więc dla SPÓJNOŚCI z
 *      Decision modeluję `asystuje` + prompt „zaproponuj RACI, człowiek
 *      zatwierdza". statusKanonu: 'czysta' (zgodne z bliźniakiem).
 *      → DO POTWIERDZENIA: czy Task ma dziedziczyć model Decision (asystuje), czy
 *        pozostać przy „podpowiedź bez treści" (wymaga wariantu typu = opcja (b)).
 *
 *   2. `implementation` / 3. `risk-alternatives` — kod: AI pisze AD-HOC
 *      (generateIdeasAI / generateRisksAI), ale BEZ klucza backendu i BEZ promptu
 *      w TASK_SECTION_PROMPTS. AI realnie MATERIALIZUJE treść → honest-canonical
 *      rola = `pisze`. `aiPrompt.szablon` niesie SKRÓT intencji (pełny handler
 *      żyje w FE), a `kluczPromptu` jest POMINIĘTY (opcjonalny) — bo klucza
 *      backendu jeszcze nie ma. Rozjazd nazywam JAWNIE w `statusKanonu:'rozjazd'`.
 *      → DO POTWIERDZENIA: opcja (a) przepisu — dorobić klucz backendu + prompt
 *        (→ czyste `pisze` z `kluczPromptu`), czy zostawić ad-hoc jako dług.
 *
 * ── ROZJAZD ROLI `dependencies` (R2) — DO POTWIERDZENIA PIOTRA ────────────────
 * Kanon §2.2 #50 deklaruje `dependencies` jako `dane` (wspólna z Initiative). W
 * Tasku ma REALNY prompt (`TASK_SECTION_PROMPTS.dependencies`) → w Tasku jest
 * `pisze`. Deskryptor idzie za KODEM (`pisze`, bo Task naprawdę generuje tę
 * kartę) i nazywa rozjazd w `statusKanonu:'rozjazd'`.
 *   → DO POTWIERDZENIA: kanoniczna rola `dependencies` = `dane` czy `pisze`;
 *     jedna rola globalna czy rozszczepienie na przynależność.
 *
 * ── ALIAS (dedup, KANON §2.2) ────────────────────────────────────────────────
 * Jedna karta Taska renderuje się pod id-aliasem: kanoniczny `attachments` (#49)
 * → render `attachments-links` (cardSets.ts:541; TaskDetailView taskNSections).
 * `idWArtefakcie` niesie tę różnicę; adapter mapuje `idWArtefakcie ?? id` na id
 * sekcji, więc layout pokrywa 1:1 to, co TaskDetailView renderuje — ZERO regresji,
 * a katalog kanoniczny pozostaje zdeduplikowany. Uwaga: alias `governance-escalation`
 * należy do DECISION, NIE do Taska — Task renderuje kanoniczny `governance` wprost.
 *
 * ── WĘŻSZY ZESTAW DOMYŚLNY (D-5) — DO POTWIERDZENIA PIOTRA ────────────────────
 * Dziś `TASK_SPEC.sets[0]` = wszystkie 10 (cardSets.ts:553-569). Kanon §8.3 dla
 * Taska nie zawęża domyślnego (zawężenie = opcjonalne D-5). Ponieważ zadanie
 * wymaga „WĘŻSZY default + picker" (jak POC), proponuję domyślny = RDZEŃ +
 * kręgosłup wykonania (description-scope, checklist, dependencies, evidence = 4
 * karty). Reszta (implementation, risk-alternatives, governance, attachments,
 * comments, activity-log) → dodawalna z managera „Pełny". `comments`/`activity-log`
 * i tak żyją w PRAWYM panelu (SPEC-N §2.1), więc ich nieobecność w domyślnym
 * zestawie lewej nawigacji nie zmienia nic na ekranie.
 *   → DO POTWIERDZENIA: zawęzić domyślny Taska do 4 kart, czy zostawić „wszystkie".
 *
 * ── GRANICA MIGRACJI (uczciwość > kompletność, jak POC) ───────────────────────
 * To jest WIĄŻĄCE MINIMALNE: typowany deskryptor Taska walidowany wobec kontraktu,
 * z którego WYPROWADZAMY `ArtifactCardSpec` konsumowany przez istniejący
 * `useCardLayout`. NIE zastępujemy `cardSets.ts`/`useCardLayout` typem kanonicznym
 * w całym runtime — to pełna adopcja, świadomie odłożona (adapter jest zwężeniem
 * bogatszego typu na uboższy `CardCatalogEntry`). `prog` = `do-decyzji-piotra` dla
 * wszystkich (KONTRAKT §2: brak progu per-karta; minima pól ADVISORY,
 * cardContentValidator.ts:21-22). D-1/D-3 otwarte.
 */

import type { ArtifactCardSpec, CardCatalogEntry, CardSet } from '../shared/NModeLayout/cardSets';
import { definiujKarteKanoniczna, type KanonicznaKarta } from '../standard/cardContract.types';

// ─────────────────────────────────────────────────────────────────────────────
// (1) KATALOG KANONICZNY TASK — 10 kart, każda walidowana wobec kontraktu.
//     Kolejność deklaracji = kolejność wizualna (taskNSections lewej nawigacji +
//     comments/activity-log prawego panelu), więc adapter nie zmienia porządku.
// ─────────────────────────────────────────────────────────────────────────────

/** RDZEŃ — nieusuwalny (rola `rdzen` ⇒ core:true w adapterze). Jedyny core:true w Tasku. */
const DESCRIPTION_SCOPE = definiujKarteKanoniczna({
  id: 'description-scope',
  label: { en: 'Description & Scope', pl: 'Opis i zakres' },
  grupa: 'TASK',
  ikona: 'FileText',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Napisz kartę STRATEGIA: zadanie jako REZULTAT + why (link do celu inicjatywy) + mierzalny outcome.',
    kluczPromptu: 'task.strategy', // CARD_BACKEND_KEY['description-scope']='strategy' → TASK_SECTION_PROMPTS.strategy
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'task', rola: 'rdzen', klasa: 'L', kolumna: 'left', kolejnosc: 0 }],
  statusKanonu: { stan: 'czysta' },
});

/**
 * ★ R1 — AI pisze AD-HOC (generateIdeasAI), brak klucza backendu w TASK_SECTION_PROMPTS.
 * Modeluję `pisze` (AI realnie materializuje treść) + szablon-intencja bez `kluczPromptu`.
 * Rozjazd nazwany w statusKanonu. DO POTWIERDZENIA: dorobić klucz backendu (opcja a).
 */
const IMPLEMENTATION = definiujKarteKanoniczna({
  id: 'implementation',
  label: { en: 'Implementation Ideas', pl: 'Pomysły realizacji' },
  grupa: 'TASK',
  ikona: 'Sparkles',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Zaproponuj pomysły realizacji zadania (podejścia, kroki, warianty wykonania).',
    // kluczPromptu POMINIĘTY: generateIdeasAI działa ad-hoc, brak wpisu w CARD_BACKEND_KEY / TASK_SECTION_PROMPTS.
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'task', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 1 }],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'AI pisze ad-hoc (Create Ideas → generateIdeasAI) bez maszyny stanów; brak klucza backendu i promptu w TASK_SECTION_PROMPTS — kanon modeluje `pisze`, ale kluczPromptu nie istnieje. DO POTWIERDZENIA (R1).',
    dowod: 'TaskDetailView.tsx:262-267 (TASK_AI_CONTRACT_NONE.implementation)',
  },
});

/**
 * ★ R1 — jak IMPLEMENTATION (generateRisksAI ad-hoc). Modeluję `pisze` + rozjazd.
 */
const RISK_ALTERNATIVES = definiujKarteKanoniczna({
  id: 'risk-alternatives',
  label: { en: 'Risk & Alternatives', pl: 'Ryzyko i alternatywy' },
  grupa: 'TASK',
  ikona: 'ShieldAlert',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Przeanalizuj ryzyka realizacji i alternatywne podejścia; wskaż trade-offy.',
    // kluczPromptu POMINIĘTY: generateRisksAI ad-hoc, brak klucza backendu.
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'task', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 2 }],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'AI pisze ad-hoc (Analyze risks → generateRisksAI) bez maszyny stanów; brak klucza backendu — jak `implementation`. DO POTWIERDZENIA (R1).',
    dowod: 'TaskDetailView.tsx:268-273 (TASK_AI_CONTRACT_NONE.risk-alternatives)',
  },
});

const CHECKLIST = definiujKarteKanoniczna({
  id: 'checklist',
  label: { en: 'Checklist', pl: 'Lista kontrolna' },
  grupa: 'TASK',
  ikona: 'CheckSquare',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Napisz kartę WYKONANIE: kryteria akceptacji (definition of done) jako sprawdzalne kroki.',
    kluczPromptu: 'task.execution', // CARD_BACKEND_KEY['checklist']='execution'
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'task', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 3 }],
  statusKanonu: { stan: 'czysta' },
});

/**
 * WSPÓLNA `dependencies` (#50, z Initiative). ★ R2 — kanon §2.2 mówi `dane`, kod
 * Taska ma prompt → `pisze`. Deskryptor idzie za kodem, rozjazd nazwany.
 */
const DEPENDENCIES = definiujKarteKanoniczna({
  id: 'dependencies',
  label: { en: 'Dependencies', pl: 'Zależności' },
  grupa: 'TASK',
  ikona: 'Link2',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Napisz kartę ZALEŻNOŚCI: co musi być gotowe zanim zadanie ruszy/skończy się (co/od kogo/dlaczego blokuje).',
    kluczPromptu: 'task.dependencies', // CARD_BACKEND_KEY['dependencies']='dependencies'
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'task', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 4 }],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'Rola per artefakt: kanon §2.2 #50 = `dane` (wspólna z Initiative), Task ma realny prompt → `pisze`. Jedna karta = jedna rola globalnie. DO POTWIERDZENIA (R2).',
    dowod: 'TaskDetailView.tsx:257,370; taskSectionGenerationService.ts:135; kanon §2.2 #50',
  },
});

const EVIDENCE = definiujKarteKanoniczna({
  id: 'evidence',
  label: { en: 'Evidence', pl: 'Dowody' },
  grupa: 'TASK',
  ikona: 'Eye',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Napisz kartę DOWODY: konkretne artefakty/pomiary potwierdzające wykonanie zadania.',
    kluczPromptu: 'task.evidence', // CARD_BACKEND_KEY['evidence']='evidence'
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'task', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 5 }],
  statusKanonu: { stan: 'czysta' },
});

/**
 * WSPÓLNA `governance` (#51). ★ R1 — kod Taska: CONTRACT_NONE. Decision (bliźniak)
 * już deklaruje `asystuje` + prompt RACI. Dla SPÓJNOŚCI jednej karty globalnej
 * modeluję `asystuje` + prompt (człowiek zatwierdza). Task renderuje KANONICZNY
 * `governance` wprost (BEZ aliasu — alias `governance-escalation` należy do Decision).
 */
const GOVERNANCE = definiujKarteKanoniczna({
  id: 'governance',
  label: { en: 'RACI & Escalation', pl: 'RACI i eskalacja' },
  grupa: 'CONTROL',
  ikona: 'Users',
  rolaAI: 'asystuje',
  aiPrompt: {
    szablon: 'Zaproponuj macierz RACI i ścieżkę eskalacji; człowiek zatwierdza role i progi.',
    kluczPromptu: 'task.raci', // spójne z decyzją bliźniaka (decision.raci); handler „Generate RACI"
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'task', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 6 }],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `attachments` (#49) — w Task renderowana jako `attachments-links` (ALIAS). */
const ATTACHMENTS = definiujKarteKanoniczna({
  id: 'attachments',
  label: { en: 'Attachments & Links', pl: 'Załączniki i powiązania' },
  grupa: 'CONTROL',
  ikona: 'Paperclip',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason:
      'Załączniki i powiązania to fakty (pliki, linki do obiektów) — AI ich nie pisze (TaskDetailView:281-283)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'task',
      rola: 'dodawalna',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 7,
      idWArtefakcie: 'attachments-links',
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
  kompozycja: [{ artefakt: 'task', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 8 }],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `activity-log` (#48) — prawy panel (SPEC-N §2.1). */
const ACTIVITY_LOG = definiujKarteKanoniczna({
  id: 'activity-log',
  label: { en: 'Activity Log', pl: 'Aktywność' },
  grupa: 'AUDIT',
  ikona: 'History',
  rolaAI: 'systemowa',
  aiPrompt: {
    none: true,
    reason: 'log zdarzeń jest zapisem faktów, treść generowana byłaby fałszem',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'task', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 9 }],
  statusKanonu: { stan: 'czysta' },
});

/**
 * Deskryptor kanoniczny Task — 10 kart. Typ elementu to `KanonicznaKarta`, więc
 * cała tablica jest wiążąca: dopisanie karty bez kompletu pól nie skompiluje się.
 */
export const TASK_CARDS: readonly KanonicznaKarta[] = [
  DESCRIPTION_SCOPE,
  IMPLEMENTATION,
  RISK_ALTERNATIVES,
  CHECKLIST,
  DEPENDENCIES,
  EVIDENCE,
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

/** Członkostwo karty w Task (dokładnie jedno na kartę tego deskryptora). */
function taskMembership(karta: KanonicznaKarta) {
  const m = karta.kompozycja.find((p) => p.artefakt === 'task');
  if (!m) {
    // Niewyrażalne dla tego deskryptora (wszystkie karty należą do 'task'),
    // ale strzeżemy adapter, gdyby ktoś dołożył kartę bez przynależności Task.
    throw new Error(`taskCardContract: karta ${karta.id} bez przynależności 'task'`);
  }
  return m;
}

/** Id, pod którym Task RENDERUJE kartę (alias dedup albo id kanoniczny). */
function renderId(karta: KanonicznaKarta): string {
  return taskMembership(karta).idWArtefakcie ?? karta.id;
}

function toCatalogEntry(karta: KanonicznaKarta): CardCatalogEntry {
  const m = taskMembership(karta);
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
 * Buduje `ArtifactCardSpec` Task z deskryptora kanonicznego.
 *   · catalog  = wszystkie 10 kart (id = render-id, core z rdzenia),
 *   · default  = RDZEŃ + domyślne (węższy zestaw D-5 — 4 karty),
 *   · full     = wszystkie 10 (przywrócenie pełni jednym kliknięciem w managerze).
 */
export function buildTaskCardSpec(): ArtifactCardSpec {
  const catalog = TASK_CARDS.map(toCatalogEntry);

  const defaultCards = TASK_CARDS.filter((k) => {
    const rola = taskMembership(k).rola;
    return rola === 'rdzen' || rola === 'domyslna';
  }).map(renderId);

  const allCards = TASK_CARDS.map(renderId);

  const sets: CardSet[] = [
    { id: 'default', label: { en: 'Core task', pl: 'Rdzeń zadania' }, cards: defaultCards },
    { id: 'full', label: { en: 'Full', pl: 'Pełny' }, cards: allCards },
  ];

  return { catalog, sets };
}

/**
 * Stała referencja spec (moduł-const) — wymóg `useCardLayout` (spec musi być stabilny,
 * bo zasila memo warstwy). Wyprowadzona RAZ z deskryptora kanonicznego.
 */
export const TASK_CARD_SPEC: ArtifactCardSpec = buildTaskCardSpec();

/**
 * Render-idy w kolejności deklaracji — do lekkiej asercji zgodności w TaskDetailView
 * (każda sekcja renderowana ma wpis w katalogu i odwrotnie — R3 z przepisu §3).
 */
export const TASK_CARD_RENDER_IDS: readonly string[] = TASK_CARDS.map(renderId);
