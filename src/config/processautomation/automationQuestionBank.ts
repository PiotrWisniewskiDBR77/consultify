/**
 * Process Automation — laddered, branching question bank (OXFORD O3).
 *
 * Doctrine: docs/standards/CONCLUSION_LAYER_STANDARD.md (W2) + Harvard/wdrozenie-100/
 * _PROJEKT_C_OXFORD.md §O3 ("q-banki głębokie... insight staircase"). Pattern
 * mirror of src/config/smedplanner/smedQuestionBank.ts and
 * src/config/rpascanner/rpaQuestionBank.ts: every question node is pure data,
 * the answer determines the next question (branching), and the SAME bank
 * drives both the wizard UI and the AI mentor prompt.
 *
 * Process Automation ladders by the Lean discipline a process must survive
 * before it is automated:
 *   L1 surface       — is the process mapped end-to-end, or run from memory?
 *                        (forced loop: an unmapped process cannot advance —
 *                        see 'pa-map-force' below)
 *   L2 evidence       — is there ONE agreed way it runs, or does it vary?
 *                        (forced loop: a varying process cannot be automated —
 *                        see 'pa-standardize-force' below)
 *   L3 quantification — baseline runs/week × minutes/cycle × error rate, sourced
 *   L4 risk/capability — who owns sustain and what is the fallback if it breaks?
 */

export type AutomationQuestionLevel = 1 | 2 | 3 | 4;

export const AUTOMATION_QUESTION_LEVEL_LABEL: Record<AutomationQuestionLevel, { pl: string; en: string }> = {
  1: { pl: 'Mapowanie', en: 'Mapping' },
  2: { pl: 'Standaryzacja', en: 'Standardization' },
  3: { pl: 'Kwantyfikacja', en: 'Quantification' },
  4: { pl: 'Utrzymanie i ryzyko', en: 'Sustain & risk' },
};

export interface AutomationAnswerOption {
  key: string;
  labelEn: string;
  labelPl: string;
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface AutomationQuestionNode {
  id: string;
  level: AutomationQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  probeEn?: string;
  probePl?: string;
  answerOptions: AutomationAnswerOption[];
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

const AUTOMATION_QUESTIONS: AutomationQuestionNode[] = [
  // ---------------------------------------------------------------------
  // L1 — SURFACE: map the process end-to-end
  // ---------------------------------------------------------------------
  {
    id: 'pa-surface',
    level: 1,
    intentEn: 'You cannot automate or measure a process you have not mapped step by step.',
    intentPl: 'Nie da się zautomatyzować ani zmierzyć procesu, którego nie zmapowano krok po kroku.',
    textEn:
      'Is the process mapped end-to-end (every step named, in order, with who does what), or are you automating from memory of "roughly what happens"?',
    textPl:
      'Czy proces jest zmapowany od początku do końca (każdy krok nazwany, po kolei, z tym kto co robi), czy automatyzujesz z pamięci „mniej więcej co się dzieje"?',
    probeEn: 'If you asked three different people to draw the flow, would you get the same diagram?',
    probePl: 'Gdybyś poprosił trzy różne osoby o narysowanie przepływu, czy dostałbyś ten sam diagram?',
    answerOptions: [
      {
        key: 'mapped',
        labelEn: 'Mapped — every step is named and ordered',
        labelPl: 'Zmapowany — każdy krok jest nazwany i uporządkowany',
        consultantSignalEn: 'A real map exists — check next whether it is standardized.',
        consultantSignalPl: 'Realna mapa istnieje — sprawdź teraz, czy proces jest ustandaryzowany.',
      },
      {
        key: 'not-mapped',
        labelEn: 'Not mapped — running on institutional memory',
        labelPl: 'Niezmapowany — działa na pamięci instytucjonalnej',
        consultantSignalEn: 'Cannot be automated yet — force a step-by-step map first.',
        consultantSignalPl: 'Nie da się jeszcze zautomatyzować — wymuś mapę krok po kroku najpierw.',
      },
    ],
    branches: {
      mapped: 'pa-standardize-check',
      'not-mapped': 'pa-map-force',
    },
    defaultNextId: 'pa-map-force',
  },

  // ---------------------------------------------------------------------
  // L2 — STANDARDIZATION (two forced loops: map, then one-agreed-path)
  // ---------------------------------------------------------------------
  {
    id: 'pa-map-force',
    level: 2,
    intentEn: 'Automating an unmapped process usually automates the wrong step, or misses one entirely.',
    intentPl: 'Automatyzacja niezmapowanego procesu zwykle automatyzuje zły krok albo pomija jakiś całkiem.',
    textEn:
      'This process has not been mapped yet — go map it first (who does what, in what order, with what exceptions) before continuing.',
    textPl:
      'Ten proces nie jest jeszcze zmapowany — najpierw go zmapuj (kto co robi, w jakiej kolejności, z jakimi wyjątkami), zanim pójdziesz dalej.',
    probeEn: 'Who actually runs this today, and could they walk you through it step by step this week?',
    probePl: 'Kto faktycznie wykonuje to dziś i czy mógłby przeprowadzić cię przez to krok po kroku w tym tygodniu?',
    answerOptions: [
      {
        key: 'mapped-now',
        labelEn: 'Done — the process is now mapped',
        labelPl: 'Gotowe — proces jest teraz zmapowany',
        consultantSignalEn: 'Map satisfied — move to checking standardization.',
        consultantSignalPl: 'Mapa spełniona — przejdź do sprawdzenia standaryzacji.',
      },
      {
        key: 'still-not-mapped',
        labelEn: 'Still not mapped',
        labelPl: 'Wciąż niezmapowany',
        consultantSignalEn: 'Not mapped — loop back, the ladder cannot advance on an unmapped process.',
        consultantSignalPl: 'Brak mapy — wracamy, drabinka nie może iść dalej na niezmapowanym procesie.',
      },
    ],
    // Deliberately loops back to itself, mirroring SMED's forced-classification
    // loop and RPA's forced-volume loop.
    branches: {
      'mapped-now': 'pa-standardize-check',
      'still-not-mapped': 'pa-map-force',
    },
    defaultNextId: 'pa-map-force',
  },
  {
    id: 'pa-standardize-check',
    level: 2,
    intentEn: 'Automating a scattered process cements variation and waste at machine speed.',
    intentPl: 'Automatyzacja rozjechanego procesu betonuje wariancję i marnotrawstwo w tempie maszyny.',
    textEn: 'Is there ONE agreed way this process runs today, or does it vary by person, shift, or site?',
    textPl: 'Czy istnieje JEDEN uzgodniony sposób wykonania tego procesu dziś, czy różni się w zależności od osoby, zmiany albo lokalizacji?',
    probeEn: 'If it varies, which variant would you standardize on, and why that one?',
    probePl: 'Jeśli się różni, na który wariant byś ustandaryzował i dlaczego akurat na ten?',
    answerOptions: [
      {
        key: 'one-way',
        labelEn: 'One agreed way — no meaningful variation',
        labelPl: 'Jeden uzgodniony sposób — bez istotnej wariancji',
        consultantSignalEn: 'Standardized — quantify the baseline next.',
        consultantSignalPl: 'Ustandaryzowany — teraz skwantyfikuj bazę.',
      },
      {
        key: 'varies',
        labelEn: 'Varies by person, shift, or site',
        labelPl: 'Różni się w zależności od osoby, zmiany lub lokalizacji',
        consultantSignalEn: 'Cannot be automated yet — force one agreed path before continuing.',
        consultantSignalPl: 'Nie da się jeszcze zautomatyzować — wymuś jedną uzgodnioną ścieżkę, zanim pójdziesz dalej.',
      },
    ],
    branches: {
      'one-way': 'pa-quant-entry',
      varies: 'pa-standardize-force',
    },
    defaultNextId: 'pa-quant-entry',
  },
  {
    id: 'pa-standardize-force',
    level: 2,
    intentEn: 'Automating each variant separately multiplies the run cost and locks in the mess.',
    intentPl: 'Automatyzacja każdego wariantu z osobna zwielokrotnia koszt utrzymania i utrwala bałagan.',
    textEn:
      'Automating a process that still varies by person locks in the variance at machine speed — standardize to one agreed path before automating.',
    textPl:
      'Automatyzacja procesu, który wciąż się różni w zależności od osoby, utrwala wariancję w tempie maszyny — ustandaryzuj do jednej uzgodnionej ścieżki, zanim zautomatyzujesz.',
    probeEn: 'What would it take this week to get everyone to agree on one path?',
    probePl: 'Co byłoby potrzebne w tym tygodniu, żeby wszyscy zgodzili się na jedną ścieżkę?',
    answerOptions: [
      {
        key: 'standardized-now',
        labelEn: 'Done — one agreed path exists now',
        labelPl: 'Gotowe — jedna uzgodniona ścieżka istnieje teraz',
        consultantSignalEn: 'Standardization satisfied — move to quantifying the baseline.',
        consultantSignalPl: 'Standaryzacja spełniona — przejdź do kwantyfikacji bazy.',
      },
      {
        key: 'still-varies',
        labelEn: 'Still varies',
        labelPl: 'Wciąż się różni',
        consultantSignalEn: 'Not standardized — loop back, automating now would cement the variance.',
        consultantSignalPl: 'Brak standaryzacji — wracamy, automatyzacja teraz utrwaliłaby wariancję.',
      },
    ],
    branches: {
      'standardized-now': 'pa-quant-entry',
      'still-varies': 'pa-standardize-force',
    },
    defaultNextId: 'pa-standardize-force',
  },

  // ---------------------------------------------------------------------
  // L3 — QUANTIFICATION: baseline runs/week × minutes/cycle × error rate
  // ---------------------------------------------------------------------
  {
    id: 'pa-quant-entry',
    level: 3,
    intentEn: 'Runs/week × minutes/cycle turns "it takes a while" into an annual-hours payback figure.',
    intentPl: 'Uruchomienia/tydzień × minuty/cykl zamienia „długo trwa" w roczną liczbę godzin zwrotu.',
    textEn:
      'What is the baseline: runs per week, minutes per cycle, and the current error rate — do you have these numbers, or are you estimating the payback?',
    textPl:
      'Jaka jest baza: uruchomienia na tydzień, minuty na cykl i obecny wskaźnik błędu — masz te liczby, czy szacujesz zwrot?',
    probeEn: 'Which system or log would give you runs/week without asking anyone?',
    probePl: 'Który system albo log dałby ci uruchomienia/tydzień bez pytania kogokolwiek?',
    answerOptions: [
      {
        key: 'baseline-known',
        labelEn: 'Known — runs, minutes and error rate are all named',
        labelPl: 'Znana — uruchomienia, minuty i wskaźnik błędu są nazwane',
        consultantSignalEn: 'Baseline quantified — now check the target and its source.',
        consultantSignalPl: 'Baza skwantyfikowana — teraz sprawdź cel i jego źródło.',
      },
      {
        key: 'baseline-unknown',
        labelEn: 'Unknown — the payback is being estimated',
        labelPl: 'Nieznana — zwrot jest szacowany',
        consultantSignalEn: 'Keep this baseline as "unquantified" — the invented-number guard must catch any stated payback.',
        consultantSignalPl: 'Trzymaj tę bazę jako „niepoliczoną" — strażnik zmyślonych liczb musi złapać każdy podany zwrot.',
      },
    ],
    branches: {
      'baseline-known': 'pa-target-entry',
      'baseline-unknown': 'pa-target-entry',
    },
    defaultNextId: 'pa-target-entry',
  },
  {
    id: 'pa-target-entry',
    level: 3,
    intentEn: 'A target with no source is a hope, not a commitment the automation can be held to.',
    intentPl: 'Cel bez źródła to nadzieja, nie zobowiązanie, z którego można rozliczyć automatyzację.',
    textEn:
      'What target cycle time / error rate are you committing to, and where does that target come from (a benchmark, an engineering estimate, a vendor claim)?',
    textPl:
      'Jaki cel czasu cyklu / wskaźnika błędu deklarujecie i skąd bierze się ten cel (benchmark, szacunek inżynierski, deklaracja dostawcy)?',
    probeEn: 'Would this target survive being challenged by the team that has to hit it?',
    probePl: 'Czy ten cel przetrwałby wyzwanie ze strony zespołu, który ma go osiągnąć?',
    answerOptions: [
      {
        key: 'target-sourced',
        labelEn: 'Sourced — a benchmark, estimate, or engineering figure backs it',
        labelPl: 'Ma źródło — popiera go benchmark, szacunek albo liczba inżynierska',
        consultantSignalEn: 'Sourced — safe to treat as a fact in the sequencing engine.',
        consultantSignalPl: 'Ma źródło — bezpiecznie traktować jako fakt w silniku sekwencji.',
      },
      {
        key: 'target-unsourced',
        labelEn: "Unsourced — a vendor's claim or a round number",
        labelPl: 'Bez źródła — deklaracja dostawcy albo okrągła liczba',
        consultantSignalEn: 'Flag as declared/unconfirmed — the invented-number guard must catch this if unlabeled.',
        consultantSignalPl: 'Oznacz jako deklaracja/niepotwierdzone — strażnik zmyślonych liczb musi to złapać, jeśli nieoznaczone.',
      },
    ],
    branches: {
      'target-sourced': 'pa-sustain-entry',
      'target-unsourced': 'pa-sustain-entry',
    },
    defaultNextId: 'pa-sustain-entry',
  },

  // ---------------------------------------------------------------------
  // L4 — SUSTAIN & RISK: ownership and fallback
  // ---------------------------------------------------------------------
  {
    id: 'pa-sustain-entry',
    level: 4,
    intentEn: 'Automation without an owner becomes a black box until it breaks.',
    intentPl: 'Automatyzacja bez właściciela staje się czarną skrzynką, aż się wywali.',
    textEn:
      'Once live, who owns monitoring the automation and catching drift or failures — and what is the fallback process if it breaks mid-run?',
    textPl:
      'Po wdrożeniu, kto jest właścicielem monitorowania automatyzacji i wychwytywania odchyleń lub awarii — i jaki jest proces awaryjny, jeśli zepsuje się w trakcie działania?',
    probeEn: 'If it silently failed for a week, who would notice, and how?',
    probePl: 'Gdyby po cichu zepsuła się na tydzień, kto by to zauważył i w jaki sposób?',
    answerOptions: [
      {
        key: 'owner-and-fallback-named',
        labelEn: 'Yes — an owner and a fallback process are named',
        labelPl: 'Tak — właściciel i proces awaryjny są nazwani',
        consultantSignalEn: 'The gain is protected — safe to sequence into the automate phase.',
        consultantSignalPl: 'Zysk jest chroniony — bezpiecznie zsekwencjonować do fazy automatyzacji.',
      },
      {
        key: 'no-owner-yet',
        labelEn: 'No owner or fallback named yet',
        labelPl: 'Brak nazwanego właściciela lub procesu awaryjnego',
        consultantSignalEn: 'Gap: shipping now risks a silent failure with nobody accountable.',
        consultantSignalPl: 'Luka: wdrożenie teraz ryzykuje cichą awarię, za którą nikt nie odpowiada.',
      },
    ],
    branches: {
      'owner-and-fallback-named': null,
      'no-owner-yet': null,
    },
    defaultNextId: null,
  },
];

export const AUTOMATION_QUESTION_BANK: AutomationQuestionNode[] = AUTOMATION_QUESTIONS;

export function getAutomationQuestion(id: string): AutomationQuestionNode | undefined {
  return AUTOMATION_QUESTION_BANK.find((q) => q.id === id);
}

export function getAutomationQuestionsByLevel(level: AutomationQuestionLevel): AutomationQuestionNode[] {
  return AUTOMATION_QUESTION_BANK.filter((q) => q.level === level);
}

/** The first question of the ladder — always the end-to-end mapping question. */
export const AUTOMATION_QUESTION_ROOT_ID = 'pa-surface';

export function getNextAutomationQuestionId(fromId: string, answerKey: string): string | null | undefined {
  const node = getAutomationQuestion(fromId);
  if (!node) return undefined;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

export function isForcedLoopAutomationQuestion(id: string): boolean {
  const node = getAutomationQuestion(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildAutomationQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań ma 4 poziomy: L1 mapowanie (proces MUSI być zmapowany krok po kroku, inaczej pytanie "pa-map-force" wraca do siebie) -> L2 standaryzacja (proces MUSI mieć JEDNĄ uzgodnioną ścieżkę, inaczej pytanie "pa-standardize-force" wraca do siebie — dwie wymuszone pętle, bo automatyzacja niezmapowanego LUB rozjechanego procesu betonuje błąd) -> L3 kwantyfikacja (uruchomienia/tydzień × minuty/cykl × wskaźnik błędu, cel ze źródłem) -> L4 utrzymanie i ryzyko (właściciel + proces awaryjny po wdrożeniu).`;
  }
  return `The question ladder has 4 levels: L1 mapping (the process MUST be mapped step by step, otherwise question "pa-map-force" loops back on itself) -> L2 standardization (the process MUST have ONE agreed path, otherwise question "pa-standardize-force" loops back on itself — two forced loops, because automating an unmapped OR scattered process cements the error) -> L3 quantification (runs/week × minutes/cycle × error rate, a sourced target) -> L4 sustain & risk (an owner + a fallback process once live).`;
}
