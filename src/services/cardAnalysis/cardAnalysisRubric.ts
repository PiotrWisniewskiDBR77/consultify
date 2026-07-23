/**
 * cardAnalysisRubric — CZYM AI mierzy kartę (ETAP 3 standardu n-Type).
 *
 * Dwa źródła, ZERO wymyślania:
 *
 *  (1) KRYTERIA PER TYP ARTEFAKTU — `ARTIFACT_CRITERIA` niżej. Spisane DOSŁOWNIE
 *      z kontraktu właściciela (2026-07-23). Kontrakt mówi wprost, że kryteria
 *      oceny SĄ RÓŻNE per typ artefaktu, więc nie ma jednej listy dla wszystkich.
 *
 *  (2) CEL KARTY + STANDARD JEJ TREŚCI — NIE są tu przepisywane. Czytamy je
 *      z KANONU KART, który już istnieje i jest wiążący typem:
 *        · `KanonicznaKarta.opis`             → „po co ta karta jest",
 *        · `KanonicznaKarta.aiPrompt.szablon` → „co ta karta ma zawierać",
 *        · `KanonicznaKarta.rolaAI`           → czy AI w ogóle pisze tę treść.
 *      Deskryptory: TASK_CARDS · DECISION_CARDS · NOTIFICATION_CARDS ·
 *      INSIGHT_CARDS · INITIATIVE_CANONICAL_CARDS · TOOL_CARDS.
 *      Duplikowanie tego tutaj oznaczałoby drugi SSOT, który zestarzeje się
 *      w tydzień — dlatego rubryka tylko WYSZUKUJE kartę w kanonie.
 *
 * ── CO ROBIMY, GDY KANON MILCZY ─────────────────────────────────────────────
 * `opis` jest w kanonie polem OPCJONALNYM i dziś wypełnionym częściowo
 * (Decision 0/8, Tool 0/4, Task 3/10, Insight 12, Initiative 11). Rubryka NIE
 * zmyśla wtedy celu karty — zwraca `standardZnany: false` i prompt jawnie mówi
 * modelowi: „kanon nie deklaruje standardu tej karty; oceniaj wobec kryteriów
 * typu artefaktu i nie wymyślaj wymagań". Uczciwość > kompletność.
 *
 * @see src/components/standard/cardContract.types.ts — schemat KanonicznaKarta
 */

import { TOOL_CARDS } from '@/components/DiscoveryTools/toolCards.contract';
import { INITIATIVE_CANONICAL_CARDS } from '@/components/Initiatives/sections/initiativeCardContract';
import { INSIGHT_CARDS } from '@/components/Interview/insightCardContract';
import { DECISION_CARDS } from '@/components/MyWork/decisionCardContract';
import { NOTIFICATION_CARDS } from '@/components/MyWork/notificationCardContract';
import { TASK_CARDS } from '@/components/MyWork/taskCardContract';
import type { KanonicznaKarta } from '@/components/standard/cardContract.types';

import type { CardAnalysisArtifactType } from './cardAnalysisTypes';

// ─────────────────────────────────────────────────────────────────────────────
// (1) KRYTERIA PER TYP ARTEFAKTU — kontrakt właściciela 2026-07-23, dosłownie.
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalysisCriterion {
  /** Stabilny id — wraca w `CardAnalysisFinding.criterionId`, więc nie zmieniać. */
  id: string;
  pl: string;
  en: string;
}

/**
 * Kryteria oceny. Kolejność = kolejność z kontraktu (właściciel czyta je jako listę).
 * Zmiana treści tych wpisów = zmiana kontraktu, nie refactor.
 */
export const ARTIFACT_CRITERIA: Record<CardAnalysisArtifactType, AnalysisCriterion[]> = {
  task: [
    { id: 'description-completeness', pl: 'kompletność opisu', en: 'description completeness' },
    { id: 'scope-clarity', pl: 'jasność zakresu', en: 'scope clarity' },
    { id: 'acceptance-criteria', pl: 'kryteria akceptacji', en: 'acceptance criteria' },
    { id: 'dependencies', pl: 'zależności', en: 'dependencies' },
    { id: 'blocking-risks', pl: 'ryzyka blokady', en: 'blocking risks' },
    { id: 'evidence-completeness', pl: 'kompletność dowodów', en: 'evidence completeness' },
    {
      id: 'source-decision-consistency',
      pl: 'spójność z decyzją źródłową',
      en: 'consistency with the source decision',
    },
  ],

  decision: [
    {
      id: 'options-tradeoffs',
      pl: 'jakość opcji i trade-offów',
      en: 'quality of options and trade-offs',
    },
    { id: 'risk', pl: 'ryzyko', en: 'risk' },
    { id: 'consequences', pl: 'konsekwencje', en: 'consequences' },
    { id: 'approval-readiness', pl: 'gotowość do zatwierdzenia', en: 'readiness for approval' },
  ],

  insight: [
    { id: 'thesis-clarity', pl: 'jasność tezy', en: 'clarity of the thesis' },
    { id: 'evidence-quality', pl: 'jakość dowodów', en: 'quality of evidence' },
    { id: 'confidence-level', pl: 'poziom pewności', en: 'confidence level' },
    { id: 'missing-sources', pl: 'brakujące źródła', en: 'missing sources' },
    { id: 'contradictions', pl: 'sprzeczności', en: 'contradictions' },
    { id: 'potential-impact', pl: 'potencjalny wpływ', en: 'potential impact' },
    { id: 'conversion-readiness', pl: 'gotowość do konwersji', en: 'readiness for conversion' },
  ],

  initiative: [
    { id: 'goal-clarity', pl: 'jasność celu', en: 'clarity of the goal' },
    { id: 'scope-exclusions', pl: 'zakres i wyłączenia', en: 'scope and exclusions' },
    { id: 'kpi-quality', pl: 'jakość KPI', en: 'KPI quality' },
    { id: 'success-criteria', pl: 'kryteria sukcesu', en: 'success criteria' },
    { id: 'task-completeness', pl: 'kompletność zadań', en: 'completeness of tasks' },
    { id: 'dependencies', pl: 'zależności', en: 'dependencies' },
    { id: 'risks', pl: 'ryzyka', en: 'risks' },
    {
      id: 'source-consistency',
      pl: 'zgodność z decyzją/insightem źródłowym',
      en: 'consistency with the source decision/insight',
    },
    { id: 'gate-readiness', pl: 'gotowość do bramy', en: 'readiness for the gate' },
  ],

  tool: [
    { id: 'goal-alignment', pl: 'zgodność treści z celem', en: 'alignment of content with the goal' },
    { id: 'inputs-completeness', pl: 'kompletność wejść', en: 'completeness of inputs' },
    { id: 'process-clarity', pl: 'klarowność procesu', en: 'clarity of the process' },
    { id: 'outcome-quality', pl: 'jakość rezultatu', en: 'quality of the outcome' },
    { id: 'limitations', pl: 'ograniczenia', en: 'limitations' },
    { id: 'session-readiness', pl: 'gotowość do sesji', en: 'readiness for the session' },
  ],

  // Kontrakt właściciela dla Powiadomienia nie wylicza osi tak jak dla pozostałych
  // pięciu — mówi: „treść aktywnej karty względem jej celu — braki, ryzyka,
  // proponowane poprawki". Kryteria są więc TRZY i wprost z tego zdania; nic
  // ponad nie nie dopisujemy.
  notification: [
    {
      id: 'purpose-fit',
      pl: 'treść aktywnej karty względem jej celu',
      en: 'content of the active card against its purpose',
    },
    { id: 'gaps', pl: 'braki', en: 'gaps' },
    { id: 'risks', pl: 'ryzyka', en: 'risks' },
  ],

  // Interview Session jest w rejestrze kart N (registry.ts), ale NIE ma przycisku
  // „Analizuj z AI" w zakresie ETAPU 3 (kontrakt wylicza sześć kart: Decision,
  // Task, Notification, Insight, Tool, Initiative). Wpis istnieje, bo
  // `Record<KartaNKey, …>` wymaga kompletu kluczy — pusta lista jest UCZCIWA:
  // brak zadeklarowanych kryteriów, nie „kryteria domyślne".
  interview: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// (2) CEL KARTY + STANDARD TREŚCI — wyszukanie w kanonie kart.
// ─────────────────────────────────────────────────────────────────────────────

/** Deskryptory kanoniczne per artefakt. Klucz = `KartaNKey`. */
const CARD_DESCRIPTORS: Record<CardAnalysisArtifactType, readonly KanonicznaKarta[]> = {
  task: TASK_CARDS,
  decision: DECISION_CARDS,
  notification: NOTIFICATION_CARDS,
  insight: INSIGHT_CARDS,
  initiative: INITIATIVE_CANONICAL_CARDS,
  tool: TOOL_CARDS,
  interview: [],
};

/**
 * Id, pod którym artefakt RENDERUJE kartę. Kanon dopuszcza alias dedup
 * (`idWArtefakcie`), np. kanoniczne `governance` renderuje się w Decision jako
 * `governance-escalation`. Aktywna sekcja w widoku niesie render-id, więc
 * dopasowanie MUSI iść przez alias, inaczej Decision/Task nie znajdą połowy kart.
 */
function renderIdFor(karta: KanonicznaKarta, artefakt: CardAnalysisArtifactType): string | null {
  const m = karta.kompozycja.find((p) => p.artefakt === artefakt);
  if (!m) return null;
  return m.idWArtefakcie ?? karta.id;
}

/** Cel + standard karty, wyprowadzone z kanonu (nie wymyślone tutaj). */
export interface CardStandard {
  /** Nazwa karty w języku UI. */
  label: string;
  /** „Po co ta karta jest" — `KanonicznaKarta.opis`. Pusty gdy kanon milczy. */
  purpose: string;
  /**
   * „Co ta karta ma zawierać" — `aiPrompt.szablon` dla kart, których treść pisze
   * lub asystuje AI. Dla kart `dane`/`systemowa`/`transakcyjna` kanon deklaruje
   * JAWNY brak z powodem — wtedy tu ląduje ten powód, poprzedzony etykietą.
   */
  standard: string;
  /** Rola AI wobec tej karty — panel/prompt musi wiedzieć, czy AI wolno tu pisać. */
  aiRole: KanonicznaKarta['rolaAI'];
  /**
   * `false` ⇒ kanon nie deklaruje ani `opis`, ani treści promptu. Prompt powie
   * modelowi wprost, żeby nie wymyślał wymagań tej karty.
   */
  standardZnany: boolean;
  /** Status rozjazdu z kanonu — uczciwa flaga, pokazywana w panelu jako notka. */
  statusKanonu: KanonicznaKarta['statusKanonu'];
}

/**
 * Znajduje kartę w kanonie po render-id. Zwraca `null`, gdy karty nie ma
 * w deskryptorze — wtedy wywołujący pracuje na samej etykiecie sekcji
 * i kryteriach typu artefaktu (patrz `buildCardStandard`).
 */
export function findCanonicalCard(
  artifactType: CardAnalysisArtifactType,
  cardId: string
): KanonicznaKarta | null {
  const descriptors = CARD_DESCRIPTORS[artifactType] ?? [];
  return (
    descriptors.find((k) => renderIdFor(k, artifactType) === cardId) ??
    // Zapasowo po id kanonicznym — Initiative renderuje część kart pod camelCase
    // kluczem sekcji, który BYWA równy id kanonicznemu bez wpisu `idWArtefakcie`.
    descriptors.find((k) => k.id === cardId) ??
    null
  );
}

/**
 * Buduje cel+standard karty. `fallbackLabel` (etykieta sekcji z widoku) jest
 * używana, gdy karty nie ma w kanonie — nadal analizujemy, ale MÓWIMY, że
 * standard jest nieznany, zamiast go zmyślić.
 */
export function buildCardStandard(
  artifactType: CardAnalysisArtifactType,
  cardId: string,
  fallbackLabel: string,
  isPolish: boolean
): CardStandard {
  const karta = findCanonicalCard(artifactType, cardId);

  if (!karta) {
    return {
      label: fallbackLabel,
      purpose: '',
      standard: '',
      aiRole: 'asystuje',
      standardZnany: false,
      statusKanonu: {
        stan: 'do-decyzji-piotra',
        opis: `Karta "${cardId}" nie występuje w deskryptorze kanonicznym artefaktu "${artifactType}".`,
      },
    };
  }

  const purpose = karta.opis ? (isPolish ? karta.opis.pl : karta.opis.en) : '';

  const standard =
    'none' in karta.aiPrompt
      ? // Jawny brak promptu — to NIE jest luka, tylko deklaracja („AI tu nie pisze").
        // Niesiemy powód, żeby model wiedział, dlaczego nie ma czego generować.
        `${isPolish ? 'Kanon deklaruje BRAK generacji AI dla tej karty' : 'The canon declares NO AI generation for this card'}: ${karta.aiPrompt.reason}`
      : karta.aiPrompt.szablon;

  return {
    label: isPolish ? karta.label.pl : karta.label.en,
    purpose,
    standard,
    aiRole: karta.rolaAI,
    standardZnany: Boolean(purpose) || !('none' in karta.aiPrompt),
    statusKanonu: karta.statusKanonu,
  };
}

/** Kryteria typu artefaktu w języku UI, jako lista `{ id, text }`. */
export function criteriaFor(
  artifactType: CardAnalysisArtifactType,
  isPolish: boolean
): Array<{ id: string; text: string }> {
  return (ARTIFACT_CRITERIA[artifactType] ?? []).map((c) => ({
    id: c.id,
    text: isPolish ? c.pl : c.en,
  }));
}
