/**
 * SMED Planner — laddered, branching question bank (OXFORD O3).
 *
 * Doctrine: docs/standards/CONCLUSION_LAYER_STANDARD.md (W2) + Harvard/wdrozenie-100/
 * _PROJEKT_C_OXFORD.md §O3 ("q-banki głębokie... insight staircase"). Pattern
 * mirror of src/config/ambitiondecomposer/ambitionQuestionBank.ts: every
 * question node is pure data, the answer determines the next question
 * (branching), and the SAME bank drives both the wizard UI and the AI mentor
 * prompt (single source of truth).
 *
 * Where Ambition Decomposer ladders by the cascade an ambition must survive,
 * SMED ladders by the discipline a changeover STEP must survive before it is
 * counted, ranked, or improved:
 *   L1 surface       — classify the step (internal/external) with a stated reason
 *   L2 evidence       — is the internal classification a real constraint, or habit?
 *                        (forced loop: an unclassified/assumed step cannot advance —
 *                        see 'smed-classify-force' below)
 *   L3 quantification — minutes × frequency, and where the minute figure comes from
 *   L4 risk/capability — what is missing to convert/shorten safely, and who holds the gain
 */

export type SmedQuestionLevel = 1 | 2 | 3 | 4;

export const SMED_QUESTION_LEVEL_LABEL: Record<SmedQuestionLevel, { pl: string; en: string }> = {
  1: { pl: 'Klasyfikacja', en: 'Classification' },
  2: { pl: 'Dowód', en: 'Evidence' },
  3: { pl: 'Kwantyfikacja', en: 'Quantification' },
  4: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
};

export interface SmedAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextSmedQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (steers the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface SmedQuestionNode {
  id: string;
  level: SmedQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  /** Follow-up probe when the answer is vague. */
  probeEn?: string;
  probePl?: string;
  answerOptions: SmedAnswerOption[];
  /**
   * answerKey -> next question id. `null` means the ladder is complete for
   * this path. Missing key falls back to `defaultNextId`.
   */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

const SMED_QUESTIONS: SmedQuestionNode[] = [
  // ---------------------------------------------------------------------
  // L1 — SURFACE: classify the step
  // ---------------------------------------------------------------------
  {
    id: 'smed-surface',
    level: 1,
    intentEn: 'The whole SMED method starts with an honest internal/external split.',
    intentPl: 'Cała metoda SMED zaczyna się od uczciwego podziału wewnętrzna/zewnętrzna.',
    textEn:
      'State whether this changeover step happens with the machine stopped (internal) or could run while it is still producing (external) — and give the reason for the classification.',
    textPl:
      'Podaj, czy ta czynność przezbrojenia dzieje się przy zatrzymanej maszynie (wewnętrzna), czy mogłaby biec w trakcie pracy (zewnętrzna) — i podaj powód klasyfikacji.',
    probeEn: 'If you cannot state a reason, the classification is probably a guess, not a fact.',
    probePl: 'Jeśli nie potrafisz podać powodu, klasyfikacja jest raczej zgadywaniem niż faktem.',
    answerOptions: [
      {
        key: 'classified-with-reason',
        labelEn: 'Classified, with a stated reason',
        labelPl: 'Sklasyfikowana, z podanym powodem',
        consultantSignalEn:
          'A real classification exists — check whether the reason is a constraint or habit.',
        consultantSignalPl:
          'Klasyfikacja jest realna — sprawdź, czy powód to ograniczenie czy nawyk.',
      },
      {
        key: 'unclassified-or-assumed',
        labelEn: 'Not classified yet, or assumed internal by default',
        labelPl: 'Jeszcze nie sklasyfikowana, albo domyślnie założona jako wewnętrzna',
        consultantSignalEn: 'Cannot be quantified or improved yet — force classification first.',
        consultantSignalPl:
          'Nie da się jeszcze skwantyfikować ani usprawnić — najpierw wymuś klasyfikację.',
      },
    ],
    branches: {
      'classified-with-reason': 'smed-evidence-check',
      'unclassified-or-assumed': 'smed-classify-force',
    },
    defaultNextId: 'smed-classify-force',
  },

  // ---------------------------------------------------------------------
  // L2 — EVIDENCE (forced classification + constraint vs habit)
  // ---------------------------------------------------------------------
  {
    id: 'smed-classify-force',
    level: 2,
    intentEn: 'An unclassified step misleads every downstream minute count and ranking.',
    intentPl: 'Niesklasyfikowana czynność zafałszowuje każdy późniejszy rachunek minut i ranking.',
    textEn:
      'This step has not been classified yet — you cannot quantify or improve a changeover step whose internal/external status is unknown. Classify it now, with a stated reason.',
    textPl:
      'Ta czynność nie jest jeszcze sklasyfikowana — nie da się skwantyfikować ani usprawnić czynności przezbrojenia o nieznanym statusie wewnętrzna/zewnętrzna. Sklasyfikuj ją teraz, z podanym powodem.',
    probeEn: 'Watch a real changeover and note the exact moment the machine stops and restarts.',
    probePl:
      'Obejrzyj realne przezbrojenie i zanotuj dokładny moment zatrzymania i ponownego startu maszyny.',
    answerOptions: [
      {
        key: 'classified',
        labelEn: 'Done — classified with a reason',
        labelPl: 'Gotowe — sklasyfikowana z powodem',
        consultantSignalEn: 'Classification satisfied — move to checking the reason quality.',
        consultantSignalPl: 'Klasyfikacja spełniona — przejdź do sprawdzenia jakości powodu.',
      },
      {
        key: 'still-unclassified',
        labelEn: 'Still not classified',
        labelPl: 'Wciąż niesklasyfikowana',
        consultantSignalEn:
          'Not classified — loop back, the ladder cannot advance on an unknown step.',
        consultantSignalPl:
          'Brak klasyfikacji — wracamy, drabinka nie może iść dalej na nieznanej czynności.',
      },
    ],
    // Deliberately loops back to itself: an unclassified step blocks the ladder,
    // mirroring the ambition decomposer's forced-decomposition loop.
    branches: {
      classified: 'smed-evidence-check',
      'still-unclassified': 'smed-classify-force',
    },
    defaultNextId: 'smed-classify-force',
  },
  {
    id: 'smed-evidence-check',
    level: 2,
    intentEn:
      'Most "forced downtime" is habit, not physics — without evidence the classification is wishful.',
    intentPl:
      'Większość „wymuszonego postoju" to nawyk, nie fizyka — bez dowodu klasyfikacja jest życzeniowa.',
    textEn:
      'Is the internal classification backed by a physical/quality constraint you can point to (or a documented pilot), or could it also be team habit dressed up as a constraint?',
    textPl:
      'Czy klasyfikacja wewnętrzna jest poparta ograniczeniem fizycznym/jakościowym, które potrafisz wskazać (albo udokumentowanym pilotażem), czy to może nawyk zespołu przebrany za ograniczenie?',
    probeEn:
      'Would the classification survive a skeptical engineer asking "why not while it runs?"',
    probePl:
      'Czy klasyfikacja przetrwałaby sceptycznego inżyniera pytającego „dlaczego nie w trakcie pracy?"',
    answerOptions: [
      {
        key: 'constraint-confirmed',
        labelEn: 'Confirmed — a real constraint or pilot backs it',
        labelPl: 'Potwierdzone — realne ograniczenie lub pilotaż to popiera',
        consultantSignalEn: 'Evidence-backed — safe to treat as a fact when quantifying.',
        consultantSignalPl: 'Poparte dowodem — bezpiecznie traktować jako fakt przy kwantyfikacji.',
      },
      {
        key: 'possibly-habit',
        labelEn: 'Not sure — might be habit, not tested',
        labelPl: 'Nie jestem pewien — może to nawyk, nietestowany',
        consultantSignalEn:
          'Flag as a conversion candidate to challenge before locking the classification.',
        consultantSignalPl:
          'Oznacz jako kandydata do konwersji do zakwestionowania przed utrwaleniem klasyfikacji.',
      },
    ],
    branches: {
      'constraint-confirmed': 'smed-quant-entry',
      'possibly-habit': 'smed-quant-entry',
    },
    defaultNextId: 'smed-quant-entry',
  },

  // ---------------------------------------------------------------------
  // L3 — QUANTIFICATION: minutes × frequency, sourced
  // ---------------------------------------------------------------------
  {
    id: 'smed-quant-entry',
    level: 3,
    intentEn:
      'Minutes × frequency turn "it takes a while" into a counted loss of production capacity.',
    intentPl:
      'Minuty × częstotliwość zamieniają „długo trwa" w policzoną utratę zdolności produkcyjnej.',
    textEn:
      'How many minutes does this step take, and at what changeover frequency — what does it really cost across a year?',
    textPl:
      'Ile minut zajmuje ta czynność i przy jakiej częstotliwości przezbrojeń — ile realnie kosztuje w skali roku?',
    probeEn: 'If you do not know the frequency, who owns the changeover log that would tell you?',
    probePl:
      'Jeśli nie znasz częstotliwości, kto jest właścicielem dziennika przezbrojeń, który by to pokazał?',
    answerOptions: [
      {
        key: 'quantified',
        labelEn: 'Yes — minutes and frequency are both named',
        labelPl: 'Tak — minuty i częstotliwość są nazwane',
        consultantSignalEn: 'Quantified — now check the source behind the minute figure.',
        consultantSignalPl: 'Skwantyfikowane — teraz sprawdź źródło liczby minut.',
      },
      {
        key: 'not-quantified',
        labelEn: 'Not yet — only a rough sense of duration',
        labelPl: 'Jeszcze nie — mam tylko przybliżone wyczucie czasu',
        consultantSignalEn:
          'Keep this step as "estimated, unmeasured" until a real duration lands.',
        consultantSignalPl:
          'Trzymaj tę czynność jako „szacowana, niemierzona", dopóki nie ma realnego czasu.',
      },
    ],
    branches: {
      quantified: 'smed-quant-source',
      'not-quantified': 'smed-quant-source',
    },
    defaultNextId: 'smed-quant-source',
  },
  {
    id: 'smed-quant-source',
    level: 3,
    intentEn: 'A minute figure must come from measurement, not memory, or be labelled an estimate.',
    intentPl:
      'Liczba minut musi pochodzić z pomiaru, nie z pamięci, albo być oznaczona jako szacunek.',
    textEn:
      'Where does that minute figure come from — a stopwatch/video measurement, or an estimate from memory? If it is an estimate, mark it explicitly, do not present it as measured.',
    textPl:
      'Skąd bierze się ta liczba minut — pomiar stoperem/wideo, czy szacunek z pamięci? Jeśli to szacunek, oznacz to jawnie, nie przedstawiaj jako zmierzone.',
    probeEn:
      'Would this number survive being challenged by the operator who actually runs the step?',
    probePl:
      'Czy ta liczba przetrwałaby wyzwanie ze strony operatora, który faktycznie wykonuje tę czynność?',
    answerOptions: [
      {
        key: 'measured',
        labelEn: 'Measured — stopwatch, video, or system log',
        labelPl: 'Zmierzona — stoper, wideo albo log systemowy',
        consultantSignalEn: 'Measured — safe to treat as a fact in the ranking and W2 sequence.',
        consultantSignalPl:
          'Zmierzona — bezpiecznie traktować jako fakt w rankingu i sekwencji W2.',
      },
      {
        key: 'estimated',
        labelEn: 'Estimated — from memory or a rough guess',
        labelPl: 'Szacowana — z pamięci albo z grubsza',
        consultantSignalEn:
          'Flag as estimated/unconfirmed — the invented-number guard must catch this if unlabeled.',
        consultantSignalPl:
          'Oznacz jako szacowana/niepotwierdzona — strażnik zmyślonych liczb musi to złapać, jeśli nieoznaczone.',
      },
    ],
    branches: {
      measured: 'smed-risk-entry',
      estimated: 'smed-risk-entry',
    },
    defaultNextId: 'smed-risk-entry',
  },

  // ---------------------------------------------------------------------
  // L4 — RISK & CAPABILITY: what is missing, who holds the gain
  // ---------------------------------------------------------------------
  {
    id: 'smed-risk-entry',
    level: 4,
    intentEn:
      'Separating or shortening without a quality safeguard shifts risk instead of removing it.',
    intentPl:
      'Rozdzielenie lub skrócenie bez zabezpieczenia jakości przenosi ryzyko, zamiast je usunąć.',
    textEn:
      'If you convert or shorten this step, what capability is missing (tooling, training, a buffer) to do it without raising defect or safety risk?',
    textPl:
      'Jeśli przeniesiesz lub skrócisz tę czynność, jakiej zdolności brakuje (oprzyrządowanie, szkolenie, bufor), by zrobić to bez podniesienia ryzyka braku lub urazu?',
    probeEn: 'What would the first defect after the change actually tell you was missing?',
    probePl: 'Co pierwsza usterka po zmianie faktycznie powiedziałaby ci, czego zabrakło?',
    answerOptions: [
      {
        key: 'capability-named',
        labelEn: 'Named — the specific missing capability is clear',
        labelPl: 'Nazwana — konkretna brakująca zdolność jest jasna',
        consultantSignalEn: 'Path to a safe conversion exists — now check who holds the gain.',
        consultantSignalPl:
          'Ścieżka do bezpiecznej konwersji istnieje — teraz sprawdź, kto utrzyma zysk.',
      },
      {
        key: 'no-capability-named',
        labelEn: 'Not yet named',
        labelPl: 'Jeszcze nie nazwana',
        consultantSignalEn:
          'Gap: a risky conversion — the engine should hold this step behind measurement first.',
        consultantSignalPl:
          'Luka: ryzykowna konwersja — silnik powinien zatrzymać tę czynność za pomiarem.',
      },
    ],
    branches: {
      'capability-named': 'smed-risk-owner',
      'no-capability-named': 'smed-risk-owner',
    },
    defaultNextId: 'smed-risk-owner',
  },
  {
    id: 'smed-risk-owner',
    level: 4,
    intentEn:
      'Holding a SMED gain is a managerial capability — without an owner it erodes within months.',
    intentPl:
      'Utrzymanie zysku SMED to zdolność zarządcza — bez właściciela eroduje w kilka miesięcy.',
    textEn:
      'Once implemented, who owns holding this gain (the standard, the training matrix), and how will drift be caught before the changeover time creeps back up?',
    textPl:
      'Po wdrożeniu, kto jest właścicielem utrzymania tego zysku (standardu, macierzy kompetencji) i jak wychwycicie odchylenie, zanim czas przezbrojenia znów zacznie rosnąć?',
    probeEn: 'If the owner left tomorrow, would the gain survive?',
    probePl: 'Gdyby właściciel odszedł jutro, czy zysk by przetrwał?',
    answerOptions: [
      {
        key: 'owner-and-loop-named',
        labelEn: 'Yes — an owner and a drift-check loop are named',
        labelPl: 'Tak — właściciel i pętla kontroli odchylenia są nazwane',
        consultantSignalEn: 'The gain is protected — the sequence can safely reach standardize.',
        consultantSignalPl:
          'Zysk jest chroniony — sekwencja może bezpiecznie dojść do standaryzacji.',
      },
      {
        key: 'no-owner-yet',
        labelEn: 'No owner or check loop yet',
        labelPl: 'Brak właściciela lub pętli kontroli',
        consultantSignalEn: 'Gap: standardizing now would freeze a gain nobody is accountable for.',
        consultantSignalPl:
          'Luka: standaryzacja teraz zamroziłaby zysk, za który nikt nie odpowiada.',
      },
    ],
    branches: {
      'owner-and-loop-named': null,
      'no-owner-yet': null,
    },
    defaultNextId: null,
  },
];

export const SMED_QUESTION_BANK: SmedQuestionNode[] = SMED_QUESTIONS;

export function getSmedQuestion(id: string): SmedQuestionNode | undefined {
  return SMED_QUESTION_BANK.find((q) => q.id === id);
}

export function getSmedQuestionsByLevel(level: SmedQuestionLevel): SmedQuestionNode[] {
  return SMED_QUESTION_BANK.filter((q) => q.level === level);
}

/** The first question of the ladder — always the surface classification question. */
export const SMED_QUESTION_ROOT_ID = 'smed-surface';

/**
 * Resolves the next question id from the current question + the answer key
 * the user (or AI) picked. Falls back to `defaultNextId` for unknown/omitted
 * answer keys, and returns `undefined` if `fromId` is not in the bank.
 */
export function getNextSmedQuestionId(
  fromId: string,
  answerKey: string
): string | null | undefined {
  const node = getSmedQuestion(fromId);
  if (!node) return undefined;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/**
 * True when a question node is a forced loop — i.e. at least one answer
 * branches back to the SAME question id. The ladder cannot silently skip
 * past this node; the discipline is enforced by the graph shape itself.
 */
export function isForcedLoopSmedQuestion(id: string): boolean {
  const node = getSmedQuestion(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildSmedQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań ma 4 poziomy: L1 klasyfikacja (wewnętrzna/zewnętrzna z powodem) -> L2 dowód (niesklasyfikowana lub założona czynność MUSI zostać sklasyfikowana, inaczej pytanie "smed-classify-force" wraca do siebie; klasyfikacja musi mieć ograniczenie, nie nawyk) -> L3 kwantyfikacja (minuty × częstotliwość, źródło liczby: pomiar czy szacunek) -> L4 ryzyko i zdolności (brakująca zdolność do bezpiecznej konwersji + właściciel utrzymania zysku).`;
  }
  return `The question ladder has 4 levels: L1 classification (internal/external with a reason) -> L2 evidence (an unclassified or assumed step MUST be classified, otherwise question "smed-classify-force" loops back on itself; the reason must be a constraint, not habit) -> L3 quantification (minutes × frequency, source of the number: measured or estimated) -> L4 risk & capability (the missing capability for a safe conversion + who owns holding the gain).`;
}
