/**
 * interviewCardContract.ts — MIGRACJA: Interview adoptuje WIĄŻĄCY kontrakt karty (D-8).
 *
 * SSOT modelu:  Harvard/wdrozenie-100/_KANON_KARTY_MODEL_2026-07-22.md
 * Przepis:      Harvard/wdrozenie-100/_PRZEPIS_MIGRACJI_INTERVIEW_2026-07-22.md
 * Wzorzec:      src/components/MyWork/decisionCardContract.ts (POC Decision, 738447b039)
 * Typ wiążący:  src/components/standard/cardContract.types.ts (definiujKarteKanoniczna)
 *
 * ── CO TEN PLIK UDOWADNIA ────────────────────────────────────────────────────
 * Kompozycja sekcji-kart Interview PŁYNIE PRZEZ kontrakt kanoniczny, nie przez
 * luźną tablicę `NModeSection[]` budowaną inline w InterviewWorkspace. Każda z 8
 * kart jest zadeklarowana jako `KanonicznaKarta` (przez fabrykę
 * `definiujKarteKanoniczna`), więc stany niedozwolone są MARTWE TYPEM:
 *   · brak id/label/roli/kompozycji            → błąd kompilacji,
 *   · rola 'pisze'/'asystuje' bez `aiPrompt`    → błąd kompilacji,
 *   · rola 'dane'/'systemowa'/'transakcyjna'    → MUSI jawnie nazwać brak promptu.
 * Rdzeń (`interview-questions`, rola `rdzen`) jest nieusuwalny NIE przez konwencję
 * UI, lecz przez typ: adapter wyprowadza `core:true` wprost z `rola==='rdzen'`, a
 * `useCardLayout.removeCard` przerywa dla `core` (useCardLayout.ts:200). Rdzeń nie
 * ma jak zniknąć z katalogu, bo krotka `KompozycjaKarty` jest NIEPUSTA.
 *
 * ── SIEROTA + REDUKCJA (przepis §0) ──────────────────────────────────────────
 * Interview to SIEROTA (D-6): nie ma cardSets, nie jest w katalogu 51 kanonicznych
 * id. Zbiera SUROWIEC — produkt-treść żyje w artefakcie Insight (pełne karty). Stąd
 * REDUKCJA (6 nowych id `interview-*` spoza katalogu 51) jest UZASADNIONA i wpisana
 * w kontrakt jawnie, nie „poza standardem".
 *
 * ── ALIASY / KARTY WSPÓLNE (dedup, KANON §2.2 E) ─────────────────────────────
 * Interview renderuje sekcję o id `evidence` = „Pliki i linki" (załączniki). To NIE
 * jest kanoniczny `evidence` (#46 = Task „Dowody", treść pisana AI) — to dwa różne
 * sensy pod tym samym stringiem (RYZYKO R3). Kanoniczny nośnik = `attachments` (#49),
 * renderowany w Interview jako `evidence` przez `idWArtefakcie`. `stakeholders` to
 * karta WSPÓLNA (#35, zbiega się z Initiative RACI) — tu tylko lista osób, id
 * kanoniczny = render-id (bez aliasu).
 *
 * ── DO POTWIERDZENIA PIOTRA (rozsądny domyślny wg _KANON, oznaczony) ──────────
 * D-1 `evidence` → kanoniczny `attachments` (#49) — WYBRANE; alt: osobny `interview-files`.
 * D-2 sieroty `interview-*` = nowe id spoza katalogu 51 — WYBRANE „lokalne poza 51";
 *     alt: powiększyć katalog kanoniczny.
 * D-3 `rolaAI` dla overview/questions = `asystuje` z kluczem promptu (serwis), jak POC;
 *     alt: `systemowa`/`dane` + akcja-AI w toolbarze.
 * D-4 `interview-summary` = `dodawalna` (nie w wężrszym default, bo renderowana
 *     WARUNKOWO tylko `!isAssignmentMode`, przepis R6) — alt: `ukryta-domyslna`.
 * D-5 węższy zestaw domyślny = rodzina INTERVIEW (overview + questions[rdzeń] + notes);
 *     kontekst i podsumowanie = dodawalne — alt: inny podział.
 *
 * ── GRANICA PAKIETU (uczciwość > kompletność, przepis §KROK 3 wariant A) ──────
 * Typ `NModeSection` (shared/NModeLayout/types.ts) NIE MA pól `core`/`aiContract`
 * (RYZYKO R2) — a ten pakiet NIE MA prawa dotykać powłoki. Dlatego kontrakt żyje
 * OBOK sekcji (wariant A): deskryptor → `INTERVIEW_CARD_SPEC` konsumowany przez
 * istniejący `useCardLayout` (ten sam szew co POC Decision). Pełna adopcja
 * (`aiContract` na sekcji) krzyżuje granicę powłoki → osobny pakiet.
 */

import type { ArtifactCardSpec, CardCatalogEntry, CardSet } from '../shared/NModeLayout/cardSets';
import { definiujKarteKanoniczna, type KanonicznaKarta } from '../standard/cardContract.types';

// ─────────────────────────────────────────────────────────────────────────────
// (1) KATALOG KANONICZNY INTERVIEW — 8 kart, każda walidowana wobec kontraktu.
//     Kolejność deklaracji = kolejność wizualna sekcji (base[] w
//     InterviewWorkspace:2778 + summary:2846), więc adapter nie zmienia porządku.
//     render-id (idWArtefakcie) = dokładne id sekcji, jakie renderuje Interview.
// ─────────────────────────────────────────────────────────────────────────────

const OVERVIEW = definiujKarteKanoniczna({
  id: 'interview-overview',
  label: { en: 'Overview', pl: 'Podgląd' },
  grupa: 'INTERVIEW',
  ikona: 'BarChart3',
  rolaAI: 'asystuje',
  aiPrompt: {
    szablon: 'Oceń jakość odpowiedzi wywiadu i podaj rekomendacje uzupełnień; człowiek prowadzi.',
    kluczPromptu: 'interview.overview-review', // serwis runAiQualityReview (InterviewWorkspace:2898)
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'interview',
      rola: 'domyslna',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 0,
      idWArtefakcie: 'overview',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** RDZEŃ — nieusuwalny (rola `rdzen` ⇒ core:true w adapterze). Serce narzędzia. */
const QUESTIONS = definiujKarteKanoniczna({
  id: 'interview-questions',
  label: { en: 'Questions', pl: 'Pytania' },
  grupa: 'INTERVIEW',
  ikona: 'FileText',
  rolaAI: 'asystuje',
  aiPrompt: {
    szablon:
      'Prowadź wywiad pytanie-po-pytaniu w trybie konwersacyjnym; parsuj wypowiedzi do odpowiedzi.',
    kluczPromptu: 'interview.questions-assist', // tryb konwersacyjny (ConversationalPanel, :2899)
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'interview',
      rola: 'rdzen',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 1,
      idWArtefakcie: 'questions',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

const NOTES = definiujKarteKanoniczna({
  id: 'interview-notes',
  label: { en: 'Notes', pl: 'Notatki' },
  grupa: 'INTERVIEW',
  ikona: 'FileText',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'notatki własne konsultanta — zapis ręczny, bez generacji (InterviewWorkspace:2902)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'interview',
      rola: 'domyslna',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 2,
      idWArtefakcie: 'notes',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `attachments` (#49) — w Interview renderowana jako `evidence` (RYZYKO R3). */
const ATTACHMENTS = definiujKarteKanoniczna({
  id: 'attachments',
  label: { en: 'Files & links', pl: 'Pliki i linki' },
  grupa: 'CONTEXT',
  ikona: 'Paperclip',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'pliki i linki wgrywa człowiek; AI ich nie tworzy (InterviewWorkspace:2903)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'interview',
      rola: 'dodawalna',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 3,
      idWArtefakcie: 'evidence',
    },
  ],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'id sekcji `evidence` koliduje z kanonicznym `evidence` (#46 Task „Dowody"); tu = załączniki',
    dowod: 'InterviewWorkspace.tsx:2808 vs cardContract katalog #46',
  },
});

const COMPANY_FACTS = definiujKarteKanoniczna({
  id: 'interview-company-facts',
  label: { en: 'Company facts', pl: 'Fakty' },
  grupa: 'CONTEXT',
  ikona: 'Building2',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'twarde dane o firmie — źródło zewnętrzne, nie model (InterviewWorkspace:2904)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'interview',
      rola: 'dodawalna',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 4,
      idWArtefakcie: 'company-facts',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `stakeholders` (#35) — zbiega się z Initiative RACI; tu tylko lista osób. */
const STAKEHOLDERS = definiujKarteKanoniczna({
  id: 'stakeholders',
  label: { en: 'Stakeholders', pl: 'Interesariusze' },
  grupa: 'CONTEXT',
  ikona: 'Users',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'lista osób — dane wprowadzane ręcznie (InterviewWorkspace:2905)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    // Render-id == kanoniczny id (brak aliasu).
    { artefakt: 'interview', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 5 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const OPEN_GAPS = definiujKarteKanoniczna({
  id: 'interview-open-gaps',
  label: { en: 'Open gaps', pl: 'Luki' },
  grupa: 'CONTEXT',
  ikona: 'AlertTriangle',
  rolaAI: 'systemowa',
  aiPrompt: {
    none: true,
    reason:
      'luki = pytania bez odpowiedzi, liczone przez system, nie pisane (InterviewWorkspace:2906)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'interview',
      rola: 'dodawalna',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 6,
      idWArtefakcie: 'open-gaps',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

/**
 * `interview-summary` — AI wyprowadza fakty z odpowiedzi. Renderowana WARUNKOWO
 * (tylko `!isAssignmentMode`, InterviewWorkspace:2844), dlatego `dodawalna`, nie w
 * węższym zestawie domyślnym (D-4). W trybie assignment sekcja nie istnieje —
 * `applyToSections` pomija id layoutu bez odpowiadającej sekcji (useCardLayout:303).
 */
const SUMMARY = definiujKarteKanoniczna({
  id: 'interview-summary',
  label: { en: 'Summary', pl: 'Podsumowanie' },
  grupa: 'SUMMARY',
  ikona: 'Sparkles',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Wyprowadź TYLKO fakty (bez rekomendacji/planów) z odpowiedzi wywiadu.',
    kluczPromptu: 'interview.summary-generate', // podsumowanie faktów (InterviewWorkspace:2900)
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'interview',
      rola: 'dodawalna',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 7,
      idWArtefakcie: 'summary',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

/**
 * Deskryptor kanoniczny Interview — 8 kart. Typ elementu to `KanonicznaKarta`, więc
 * cała tablica jest wiążąca: dopisanie karty bez kompletu pól nie skompiluje się.
 */
export const INTERVIEW_CARDS: readonly KanonicznaKarta[] = [
  OVERVIEW,
  QUESTIONS,
  NOTES,
  ATTACHMENTS,
  COMPANY_FACTS,
  STAKEHOLDERS,
  OPEN_GAPS,
  SUMMARY,
];

// ─────────────────────────────────────────────────────────────────────────────
// (2) ADAPTER kanon → ArtifactCardSpec (zwężenie do modelu, który konsumuje
//     `useCardLayout`). Alias `idWArtefakcie` staje się id sekcji; `core` wynika
//     z `rola==='rdzen'`; węższy zestaw domyślny = karty rdzeń+domyślna.
// ─────────────────────────────────────────────────────────────────────────────

/** Członkostwo karty w Interview (dokładnie jedno na kartę tego deskryptora). */
function interviewMembership(karta: KanonicznaKarta) {
  const m = karta.kompozycja.find((p) => p.artefakt === 'interview');
  if (!m) {
    throw new Error(`interviewCardContract: karta ${karta.id} bez przynależności 'interview'`);
  }
  return m;
}

/** Id, pod którym Interview RENDERUJE kartę (alias dedup albo id kanoniczny). */
function renderId(karta: KanonicznaKarta): string {
  return interviewMembership(karta).idWArtefakcie ?? karta.id;
}

function toCatalogEntry(karta: KanonicznaKarta): CardCatalogEntry {
  const m = interviewMembership(karta);
  const entry: CardCatalogEntry = {
    id: renderId(karta),
    label: karta.label,
    icon: karta.ikona,
    group: karta.grupa,
  };
  return m.rola === 'rdzen' ? { ...entry, core: true } : entry;
}

/**
 * Buduje `ArtifactCardSpec` Interview z deskryptora kanonicznego.
 *   · catalog  = wszystkie 8 kart (id = render-id, core z rdzenia),
 *   · default  = RDZEŃ + domyślne (węższy zestaw D-5: rodzina INTERVIEW),
 *   · full     = wszystkie 8 (przywrócenie pełni jednym kliknięciem w pickerze).
 */
export function buildInterviewCardSpec(): ArtifactCardSpec {
  const catalog = INTERVIEW_CARDS.map(toCatalogEntry);

  const defaultCards = INTERVIEW_CARDS.filter((k) => {
    const rola = interviewMembership(k).rola;
    return rola === 'rdzen' || rola === 'domyslna';
  }).map(renderId);

  const allCards = INTERVIEW_CARDS.map(renderId);

  const sets: CardSet[] = [
    { id: 'default', label: { en: 'Core interview', pl: 'Rdzeń wywiadu' }, cards: defaultCards },
    { id: 'full', label: { en: 'Full', pl: 'Pełny' }, cards: allCards },
  ];

  return { catalog, sets };
}

/**
 * Stała referencja spec (moduł-const) — wymóg `useCardLayout` (spec musi być stabilny,
 * bo zasila memo warstwy). Wyprowadzona RAZ z deskryptora kanonicznego.
 */
export const INTERVIEW_CARD_SPEC: ArtifactCardSpec = buildInterviewCardSpec();

/**
 * Render-idy w kolejności deklaracji — do lekkiej asercji zgodności w
 * InterviewWorkspace (każda sekcja renderowana ma wpis w katalogu i odwrotnie — R2).
 */
export const INTERVIEW_CARD_RENDER_IDS: readonly string[] = INTERVIEW_CARDS.map(renderId);
