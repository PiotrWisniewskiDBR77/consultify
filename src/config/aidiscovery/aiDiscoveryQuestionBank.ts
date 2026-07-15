/**
 * AI Discovery — laddered, branching question bank (OXFORD O3).
 *
 * Pattern mirror of src/config/ambitiondecomposer/ambitionQuestionBank.ts /
 * src/config/swot/dynamicSwotQuestionBank.ts: every question node is pure
 * data, the answer to a question determines the next question (branching),
 * and the SAME bank drives both the wizard UI and the AI mentor prompt.
 *
 * AI Discovery ladders by the discipline a candidate use case must survive
 * before it is a fundable bet, not a demo:
 *   L1 claim               — locate the use case as the sponsor would pitch it
 *   L2 forced data-proof   — FORCE evidence the data actually exists (loops back
 *                            on itself until a real sample is named — see
 *                            'aid-data-force')
 *   L3 quantification      — annual value at stake + a named business owner
 *   L4 sequencing          — lighthouse-first + explicit moonshot deferral
 */

export type AiDiscoveryQuestionLevel = 1 | 2 | 3 | 4;

export const AI_DISCOVERY_QUESTION_LEVEL_LABEL: Record<
  AiDiscoveryQuestionLevel,
  { pl: string; en: string }
> = {
  1: { pl: 'Roszczenie use case', en: 'Use case claim' },
  2: { pl: 'Wymuszony dowód danych', en: 'Forced data proof' },
  3: { pl: 'Kwantyfikacja', en: 'Quantification' },
  4: { pl: 'Sekwencja', en: 'Sequencing' },
};

export interface AiDiscoveryAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextAiDiscoveryQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface AiDiscoveryQuestionNode {
  id: string;
  level: AiDiscoveryQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  probeEn?: string;
  probePl?: string;
  answerOptions: AiDiscoveryAnswerOption[];
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// L1 — CLAIM: locate the use case
// ---------------------------------------------------------------------------

const AI_DISCOVERY_QUESTIONS: AiDiscoveryQuestionNode[] = [
  {
    id: 'aid-surface',
    level: 1,
    intentEn: 'Locate the use case the way the sponsor would pitch it to the board.',
    intentPl: 'Zlokalizować use case tak, jak przedstawiłby go sponsor na zarządzie.',
    textEn:
      'State the AI use case exactly as the sponsor would pitch it. Is it a named business decision or process it changes, or a technology looking for a problem?',
    textPl:
      'Podaj use case AI dokładnie tak, jak przedstawiłby go sponsor. Czy to nazwana decyzja biznesowa lub proces, który zmienia, czy technologia szukająca problemu?',
    probeEn: 'If the model were perfect tomorrow, whose daily decision changes and how?',
    probePl: 'Gdyby model był jutro idealny, czyja codzienna decyzja i jak by się zmieniła?',
    answerOptions: [
      {
        key: 'named-decision',
        labelEn: 'Named — a specific decision/process it changes',
        labelPl: 'Nazwane — konkretna decyzja/proces, który zmienia',
        consultantSignalEn: 'Grounded in a decision — check whether the data behind it is proven.',
        consultantSignalPl:
          'Ugruntowane w decyzji — sprawdź, czy dane za tym stojące są dowiedzione.',
      },
      {
        key: 'tech-first',
        labelEn: 'Tech-first — "we should use AI for X" with no named decision',
        labelPl: 'Od technologii — "powinniśmy użyć AI do X" bez nazwanej decyzji',
        consultantSignalEn:
          'A solution looking for a problem — force the data-proof question harder before funding it.',
        consultantSignalPl:
          'Rozwiązanie szukające problemu — mocniej wymuś pytanie o dowód danych przed finansowaniem.',
      },
    ],
    branches: {
      'named-decision': 'aid-data-check',
      'tech-first': 'aid-data-force',
    },
    defaultNextId: 'aid-data-check',
  },

  // -------------------------------------------------------------------------
  // L2 — FORCED DATA PROOF
  // -------------------------------------------------------------------------

  {
    id: 'aid-data-check',
    level: 2,
    intentEn: 'Every AI use case is a bet on data that may not actually exist yet.',
    intentPl: 'Każdy use case AI to zakład na dane, których może jeszcze nie być.',
    textEn:
      'Have you pulled a real sample of the data this needs, or are you assuming it exists in the shape you need?',
    textPl:
      'Czy pobraliście realną próbkę danych, których to wymaga, czy zakładacie, że istnieją w potrzebnym kształcie?',
    probeEn: 'If you pulled 100 rows today, what is the chance they are clean enough to use?',
    probePl:
      'Gdybyście dziś pobrali 100 wierszy, jaka jest szansa, że są wystarczająco czyste do użycia?',
    answerOptions: [
      {
        key: 'sample-pulled',
        labelEn: 'Yes — a real sample was pulled and checked',
        labelPl: 'Tak — realna próbka została pobrana i sprawdzona',
        consultantSignalEn: 'Data readiness proven — safe to quantify value as a fact.',
        consultantSignalPl:
          'Gotowość danych dowiedziona — bezpiecznie kwantyfikować wartość jako fakt.',
      },
      {
        key: 'assumed',
        labelEn: 'No — we are assuming the data is there',
        labelPl: 'Nie — zakładamy, że dane tam są',
        consultantSignalEn: 'Ungrounded data assumption — route to the forced-proof question.',
        consultantSignalPl:
          'Nieugruntowane założenie o danych — skieruj do wymuszonego pytania o dowód.',
      },
    ],
    branches: {
      'sample-pulled': 'aid-quantify',
      assumed: 'aid-data-force',
    },
    defaultNextId: 'aid-quantify',
  },
  {
    id: 'aid-data-force',
    level: 2,
    intentEn:
      'A use case built on an assumed dataset is the most expensive way to learn it was missing.',
    intentPl:
      'Use case zbudowany na założonym zbiorze danych to najdroższy sposób, żeby odkryć, że go nie było.',
    textEn:
      'Pull a real, even tiny, sample of the required data and name what you found — row count, missing fields, quality issues. "It should be in the CRM" does not count.',
    textPl:
      'Pobierzcie realną, choćby małą, próbkę wymaganych danych i nazwijcie, co znaleźliście — liczbę wierszy, brakujące pola, problemy jakości. "Powinno to być w CRM" się nie liczy.',
    probeEn: 'If the sample is genuinely unavailable, who owns getting one within a week?',
    probePl: 'Jeśli próbka jest naprawdę niedostępna, kto odpowiada za jej zdobycie w tydzień?',
    answerOptions: [
      {
        key: 'sample-found',
        labelEn: 'Found it — a real sample now exists with named findings',
        labelPl: 'Znaleziono — realna próbka teraz istnieje z nazwanymi wnioskami',
        consultantSignalEn: 'Data proof satisfied — proceed to quantification.',
        consultantSignalPl: 'Dowód danych spełniony — przejdź do kwantyfikacji.',
      },
      {
        key: 'still-assumed',
        labelEn: 'Still assumed — no sample pulled',
        labelPl: 'Wciąż założone — brak pobranej próbki',
        consultantSignalEn:
          'Not satisfied — loop back, the ladder cannot quantify value on data no one has actually looked at.',
        consultantSignalPl:
          'Niespełnione — wracamy, drabinka nie może kwantyfikować wartości na danych, których nikt realnie nie sprawdził.',
      },
    ],
    // Deliberately loops back to itself: the forced-data-proof discipline
    // does not let the session quantify value on an unverified assumption.
    branches: {
      'sample-found': 'aid-quantify',
      'still-assumed': 'aid-data-force',
    },
    defaultNextId: 'aid-data-force',
  },

  // -------------------------------------------------------------------------
  // L3 — QUANTIFICATION: annual value + named owner
  // -------------------------------------------------------------------------

  {
    id: 'aid-quantify',
    level: 3,
    intentEn: 'An unowned value estimate is a slide, not a business case.',
    intentPl: 'Nieprzypisana estymacja wartości to slajd, nie biznesowy case.',
    textEn:
      'What is the annual business value at stake if this ships, and who is the named business owner who will act on the output?',
    textPl:
      'Jaka jest roczna wartość biznesowa w grze, jeśli to wdrożycie, i kto jest nazwanym właścicielem biznesowym, który zadziała na podstawie wyniku?',
    probeEn: 'If the owner left the company tomorrow, would this use case still ship?',
    probePl: 'Gdyby właściciel odszedł z firmy jutro, czy ten use case nadal by wdrożono?',
    answerOptions: [
      {
        key: 'value-and-owner',
        labelEn: 'Yes — both value and owner are named',
        labelPl: 'Tak — nazwane są i wartość, i właściciel',
        consultantSignalEn: 'Fully quantified and owned — ready to sequence.',
        consultantSignalPl: 'W pełni skwantyfikowane i przypisane — gotowe do sekwencjonowania.',
      },
      {
        key: 'value-no-owner',
        labelEn: 'Value estimated but no named owner yet',
        labelPl: 'Wartość oszacowana, ale brak nazwanego właściciela',
        consultantSignalEn:
          'Governance gap — keep this explicit; a valuable use case with no owner rarely ships.',
        consultantSignalPl:
          'Luka zarządcza — trzymaj to jawnie; wartościowy use case bez właściciela rzadko się wdraża.',
      },
    ],
    branches: {
      'value-and-owner': 'aid-sequence',
      'value-no-owner': 'aid-sequence',
    },
    defaultNextId: 'aid-sequence',
  },

  // -------------------------------------------------------------------------
  // L4 — SEQUENCING: lighthouse-first + moonshot deferral
  // -------------------------------------------------------------------------

  {
    id: 'aid-sequence',
    level: 4,
    intentEn: 'A first AI use case that fails publicly closes the door on the whole portfolio.',
    intentPl: 'Pierwszy use case AI, który publicznie zawiedzie, zamyka drzwi dla całego portfela.',
    textEn:
      'Is this the lighthouse (data-ready, feasible, credibility-buying) case to ship first, or a moonshot that should wait for delivery capability to exist?',
    textPl:
      'Czy to jest "latarnia" (dane gotowe, wykonalne, budujące wiarygodność) do wdrożenia pierwszej, czy moonshot, który powinien poczekać na zdolność dostawy?',
    probeEn: 'What specifically must be true before a moonshot enters the roadmap?',
    probePl: 'Co konkretnie musi być prawdą, zanim moonshot wejdzie do roadmapy?',
    answerOptions: [
      {
        key: 'lighthouse',
        labelEn: 'Lighthouse — ship first',
        labelPl: 'Latarnia — wdrożyć jako pierwszą',
        consultantSignalEn: 'Sequence leads with this case — no capability gate needed first.',
        consultantSignalPl:
          'Sekwencja zaczyna od tego case — nie trzeba bramki zdolności najpierw.',
      },
      {
        key: 'moonshot-defer',
        labelEn: 'Moonshot — defer with a named condition',
        labelPl: 'Moonshot — odroczyć z nazwanym warunkiem',
        consultantSignalEn:
          'Capability gap named — the sequence must defer this case behind a stated condition.',
        consultantSignalPl:
          'Nazwana luka zdolności — sekwencja musi odroczyć ten case za wypowiedzianym warunkiem.',
      },
    ],
    branches: {
      lighthouse: null,
      'moonshot-defer': null,
    },
    defaultNextId: null,
  },
];

export const AI_DISCOVERY_QUESTION_BANK: AiDiscoveryQuestionNode[] = AI_DISCOVERY_QUESTIONS;

export function getAiDiscoveryQuestion(id: string): AiDiscoveryQuestionNode | undefined {
  return AI_DISCOVERY_QUESTION_BANK.find((q) => q.id === id);
}

export function getAiDiscoveryQuestionsByLevel(
  level: AiDiscoveryQuestionLevel
): AiDiscoveryQuestionNode[] {
  return AI_DISCOVERY_QUESTION_BANK.filter((q) => q.level === level);
}

/** The first question of the ladder — always the use-case surface question. */
export const AI_DISCOVERY_QUESTION_ROOT_ID = 'aid-surface';

/**
 * Resolves the next question id from the current question + the answer key
 * the user (or AI) picked. Falls back to `defaultNextId` for unknown/omitted
 * answer keys, and returns `undefined` if `fromId` is not in the bank.
 */
export function getNextAiDiscoveryQuestionId(
  fromId: string,
  answerKey: string
): string | null | undefined {
  const node = getAiDiscoveryQuestion(fromId);
  if (!node) return undefined;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/**
 * True when a question node is a forced loop — i.e. at least one answer
 * branches back to the SAME question id. The ladder cannot silently skip
 * past this node; the discipline is enforced by the graph shape itself.
 */
export function isForcedLoopAiDiscoveryQuestion(id: string): boolean {
  const node = getAiDiscoveryQuestion(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildAiDiscoveryQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań ma 4 poziomy: L1 roszczenie use case (nazwana decyzja czy technologia od rozwiązania) -> L2 wymuszony dowód danych (założenie o danych MUSI zostać zweryfikowane realną próbką, inaczej pytanie "aid-data-force" wraca do siebie) -> L3 kwantyfikacja (wartość roczna + nazwany właściciel) -> L4 sekwencja (latarnia najpierw, moonshot odroczony z warunkiem).`;
  }
  return `The question ladder has 4 levels: L1 use case claim (named decision or a solution looking for a problem) -> L2 forced data proof (a data assumption MUST be verified with a real sample, otherwise question "aid-data-force" loops back on itself) -> L3 quantification (annual value + named owner) -> L4 sequencing (lighthouse first, moonshot deferred with a condition).`;
}
