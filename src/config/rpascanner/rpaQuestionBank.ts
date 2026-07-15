/**
 * RPA Scanner — laddered, branching question bank (OXFORD O3).
 *
 * Doctrine: docs/standards/CONCLUSION_LAYER_STANDARD.md (W2) + Harvard/wdrozenie-100/
 * _PROJEKT_C_OXFORD.md §O3 ("q-banki głębokie... insight staircase"). Pattern
 * mirror of src/config/ambitiondecomposer/ambitionQuestionBank.ts and
 * src/config/smedplanner/smedQuestionBank.ts: every question node is pure
 * data, the answer determines the next question (branching), and the SAME
 * bank drives both the wizard UI and the AI mentor prompt.
 *
 * RPA Scanner ladders by the discipline a candidate PROCESS must survive
 * before it is scored, ranked, or greenlit for a bot build:
 *   L1 surface       — is monthly volume known, or a guess?
 *                        (forced loop: an unknown-volume candidate cannot
 *                        advance — see 'rpa-volume-force' below)
 *   L2 evidence       — is the process rule-based, or exception-heavy?
 *   L3 quantification — handling time × volume × (1-exceptions) = annual minutes
 *   L4 risk/capability — which tech tier fits, and has feasibility been proven?
 */

export type RpaQuestionLevel = 1 | 2 | 3 | 4;

export const RPA_QUESTION_LEVEL_LABEL: Record<RpaQuestionLevel, { pl: string; en: string }> = {
  1: { pl: 'Wolumen', en: 'Volume' },
  2: { pl: 'Regułowość', en: 'Rule-basedness' },
  3: { pl: 'Kwantyfikacja', en: 'Quantification' },
  4: { pl: 'Dopasowanie technologii i wykonalność', en: 'Tech fit & feasibility' },
};

export interface RpaAnswerOption {
  key: string;
  labelEn: string;
  labelPl: string;
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface RpaQuestionNode {
  id: string;
  level: RpaQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  probeEn?: string;
  probePl?: string;
  answerOptions: RpaAnswerOption[];
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

const RPA_QUESTIONS: RpaQuestionNode[] = [
  // ---------------------------------------------------------------------
  // L1 — VOLUME: locate the candidate's real workload
  // ---------------------------------------------------------------------
  {
    id: 'rpa-surface',
    level: 1,
    intentEn: 'An automation case with no known volume cannot be ranked against anything.',
    intentPl:
      'Przypadek automatyzacji bez znanego wolumenu nie da się z niczym porównać w rankingu.',
    textEn:
      'Name the candidate process and state its monthly volume — do you already know it, or are you guessing?',
    textPl:
      'Nazwij proces-kandydata i podaj jego miesięczny wolumen — czy już go znasz, czy zgadujesz?',
    probeEn: 'Which system log or ticket queue would tell you the real monthly count?',
    probePl: 'Który log systemowy albo kolejka zgłoszeń pokazałaby realną liczbę miesięczną?',
    answerOptions: [
      {
        key: 'volume-known',
        labelEn: 'Known — from a log, report, or system count',
        labelPl: 'Znany — z logu, raportu albo liczby systemowej',
        consultantSignalEn: 'A real volume exists — check whether the process is rule-based next.',
        consultantSignalPl: 'Realny wolumen istnieje — sprawdź teraz, czy proces jest regułowy.',
      },
      {
        key: 'volume-unknown',
        labelEn: 'Unknown — a rough guess or "it feels like a lot"',
        labelPl: 'Nieznany — z grubsza albo „wydaje się, że dużo"',
        consultantSignalEn: 'Cannot be ranked yet — force a volume count before continuing.',
        consultantSignalPl:
          'Nie da się jeszcze rankingować — wymuś policzenie wolumenu, zanim pójdziesz dalej.',
      },
    ],
    branches: {
      'volume-known': 'rpa-standardize-check',
      'volume-unknown': 'rpa-volume-force',
    },
    defaultNextId: 'rpa-volume-force',
  },

  // ---------------------------------------------------------------------
  // L2 — RULE-BASEDNESS (forced volume + standardization/exceptions)
  // ---------------------------------------------------------------------
  {
    id: 'rpa-volume-force',
    level: 2,
    intentEn:
      'Building an automation case on an unmeasured volume is optimism, not a business case.',
    intentPl:
      'Budowanie przypadku automatyzacji na niezmierzonym wolumenie to optymizm, nie biznesowy przypadek.',
    textEn:
      'This candidate has no known volume yet — an automation case cannot be ranked on a guess. Go count it (or pull the log) before continuing.',
    textPl:
      'Ten kandydat nie ma jeszcze znanego wolumenu — przypadku automatyzacji nie da się rankingować na zgadywaniu. Policz go (albo pobierz log), zanim pójdziesz dalej.',
    probeEn: 'A one-week manual count is enough to unblock this — who can run it?',
    probePl: 'Tygodniowe ręczne liczenie wystarczy, by to odblokować — kto może je zrobić?',
    answerOptions: [
      {
        key: 'volume-now-known',
        labelEn: 'Done — the volume is now counted',
        labelPl: 'Gotowe — wolumen jest teraz policzony',
        consultantSignalEn: 'Volume satisfied — move to checking rule-basedness.',
        consultantSignalPl: 'Wolumen spełniony — przejdź do sprawdzenia regułowości.',
      },
      {
        key: 'still-unknown',
        labelEn: 'Still unknown',
        labelPl: 'Wciąż nieznany',
        consultantSignalEn:
          'Not counted — loop back, the ladder cannot advance on a guessed volume.',
        consultantSignalPl:
          'Niepoliczone — wracamy, drabinka nie może iść dalej na zgadywanym wolumenie.',
      },
    ],
    // Deliberately loops back to itself, mirroring SMED's forced-classification
    // loop: an unmeasured candidate blocks the ladder.
    branches: {
      'volume-now-known': 'rpa-standardize-check',
      'still-unknown': 'rpa-volume-force',
    },
    defaultNextId: 'rpa-volume-force',
  },
  {
    id: 'rpa-standardize-check',
    level: 2,
    intentEn:
      "A bot replays a rule, not an operator's judgment — exceptions are where automations break.",
    intentPl:
      'Bot odwzorowuje regułę, nie osąd operatora — wyjątki to miejsce, gdzie automatyzacje się psują.',
    textEn:
      'Is this process fully rule-based (one path, no judgment calls), or does it carry exceptions that need a human?',
    textPl:
      'Czy ten proces jest w pełni regułowy (jedna ścieżka, bez decyzji uznaniowych), czy niesie wyjątki wymagające człowieka?',
    probeEn: 'If there are exceptions, roughly what share of cases hit one?',
    probePl: 'Jeśli są wyjątki, jaki mniej więcej odsetek przypadków w nie trafia?',
    answerOptions: [
      {
        key: 'rule-based',
        labelEn: 'Fully rule-based — no meaningful exceptions',
        labelPl: 'W pełni regułowy — bez istotnych wyjątków',
        consultantSignalEn: 'Clean automation candidate — quantify the annual minutes next.',
        consultantSignalPl: 'Czysty kandydat do automatyzacji — teraz skwantyfikuj roczne minuty.',
      },
      {
        key: 'has-exceptions',
        labelEn: 'Has exceptions needing a human',
        labelPl: 'Ma wyjątki wymagające człowieka',
        consultantSignalEn:
          'Quantify the exception rate before picking a tech tier — it changes the fit.',
        consultantSignalPl:
          'Skwantyfikuj udział wyjątków, zanim wybierzesz poziom technologii — to zmienia dopasowanie.',
      },
    ],
    branches: {
      'rule-based': 'rpa-quant-entry',
      'has-exceptions': 'rpa-exception-rate',
    },
    defaultNextId: 'rpa-quant-entry',
  },
  {
    id: 'rpa-exception-rate',
    level: 2,
    intentEn:
      'A high exception rate on a plain rule-based bot is a false economy — it needs OCR/API/AI or standardization first.',
    intentPl:
      'Wysoki udział wyjątków przy zwykłym botcie regułowym to fałszywa oszczędność — potrzeba OCR/API/AI albo najpierw standaryzacji.',
    textEn:
      'What share of cases needs a human exception — and does that push you toward OCR/API/AI assistance rather than plain rule-based RPA?',
    textPl:
      'Jaki odsetek przypadków wymaga wyjątku obsługiwanego przez człowieka — i czy to popycha w stronę OCR/API/AI zamiast zwykłego RPA regułowego?',
    probeEn: 'At what exception rate would a plain bot spend more time escalating than it saves?',
    probePl:
      'Przy jakim udziale wyjątków zwykły bot spędzałby więcej czasu na eskalacji, niż oszczędza?',
    answerOptions: [
      {
        key: 'rate-quantified',
        labelEn: 'Quantified — the exception share is a real number',
        labelPl: 'Skwantyfikowany — udział wyjątków to realna liczba',
        consultantSignalEn:
          'Feed this rate into the tech-tier decision, do not default to plain RPA.',
        consultantSignalPl:
          'Wprowadź ten udział do decyzji o poziomie technologii, nie domyślaj się zwykłego RPA.',
      },
      {
        key: 'rate-unknown',
        labelEn: 'Not quantified yet',
        labelPl: 'Jeszcze nieskwantyfikowany',
        consultantSignalEn:
          'Gap: picking a tech tier without this number risks an optimistic, brittle build.',
        consultantSignalPl:
          'Luka: wybór poziomu technologii bez tej liczby ryzykuje optymistyczną, kruchą budowę.',
      },
    ],
    branches: {
      'rate-quantified': 'rpa-quant-entry',
      'rate-unknown': 'rpa-quant-entry',
    },
    defaultNextId: 'rpa-quant-entry',
  },

  // ---------------------------------------------------------------------
  // L3 — QUANTIFICATION: annual automatable minutes
  // ---------------------------------------------------------------------
  {
    id: 'rpa-quant-entry',
    level: 3,
    intentEn:
      'Volume × handling time × (1 - exceptions) turns "it takes a while" into an annual ROI figure.',
    intentPl:
      'Wolumen × czas obsługi × (1 - wyjątki) zamienia „długo trwa" w roczną liczbę zwrotu.',
    textEn:
      'What is the handling time per run, and what does the annual automatable-minutes total look like (volume × handling time × (1 - exception share))?',
    textPl:
      'Jaki jest czas obsługi jednego uruchomienia i jak wygląda roczna suma minut automatyzowalnych (wolumen × czas obsługi × (1 - udział wyjątków))?',
    probeEn: 'Would this figure survive a skeptical CFO asking "where does this number come from?"',
    probePl: 'Czy ta liczba przetrwałaby sceptycznego CFO pytającego „skąd ta liczba?"',
    answerOptions: [
      {
        key: 'quantified',
        labelEn: 'Yes — handling time and the annual total are both named',
        labelPl: 'Tak — czas obsługi i roczna suma są nazwane',
        consultantSignalEn: 'Quantified — now check which tech tier actually fits.',
        consultantSignalPl:
          'Skwantyfikowane — teraz sprawdź, jaki poziom technologii realnie pasuje.',
      },
      {
        key: 'not-quantified',
        labelEn: 'Not yet — only a rough sense of effort',
        labelPl: 'Jeszcze nie — mam tylko przybliżone wyczucie wysiłku',
        consultantSignalEn:
          'Keep this candidate as "estimated, unmeasured" until real figures land.',
        consultantSignalPl:
          'Trzymaj tego kandydata jako „szacowany, niemierzony", dopóki nie ma realnych liczb.',
      },
    ],
    branches: {
      quantified: 'rpa-tier-entry',
      'not-quantified': 'rpa-tier-entry',
    },
    defaultNextId: 'rpa-tier-entry',
  },

  // ---------------------------------------------------------------------
  // L4 — TECH FIT & FEASIBILITY
  // ---------------------------------------------------------------------
  {
    id: 'rpa-tier-entry',
    level: 4,
    intentEn:
      'Defaulting to "RPA" regardless of the exception rate is the top reason bots become brittle.',
    intentPl:
      'Domyślne wybieranie „RPA" niezależnie od udziału wyjątków to główny powód kruchości botów.',
    textEn:
      'Which technology tier fits (RPA / OCR / API / AI), and is that a deliberate fit to the exception rate and standardization level, or a default reach for "RPA" regardless?',
    textPl:
      'Jaki poziom technologii pasuje (RPA / OCR / API / AI) i czy to świadome dopasowanie do udziału wyjątków i poziomu standaryzacji, czy domyślne sięgnięcie po „RPA" niezależnie od tego?',
    probeEn:
      'If the process is not fully rule-based, what makes plain RPA the right choice anyway?',
    probePl:
      'Jeśli proces nie jest w pełni regułowy, co czyni zwykłe RPA właściwym wyborem mimo to?',
    answerOptions: [
      {
        key: 'tier-fits-exceptions',
        labelEn: 'Deliberate — the tier matches the exception rate and standardization',
        labelPl: 'Świadome — poziom pasuje do udziału wyjątków i standaryzacji',
        consultantSignalEn: 'Tier is grounded — now prove feasibility before approving the build.',
        consultantSignalPl:
          'Poziom jest ugruntowany — teraz udowodnij wykonalność, zanim zatwierdzisz budowę.',
      },
      {
        key: 'tier-is-default',
        labelEn: 'Default — "RPA" was picked without checking the fit',
        labelPl: 'Domyślne — „RPA" wybrane bez sprawdzenia dopasowania',
        consultantSignalEn:
          'Gap: an optimistic tier choice — the engine should flag this before a build.',
        consultantSignalPl:
          'Luka: optymistyczny wybór poziomu — silnik powinien to oznaczyć przed budową.',
      },
    ],
    branches: {
      'tier-fits-exceptions': 'rpa-feasibility',
      'tier-is-default': 'rpa-feasibility',
    },
    defaultNextId: 'rpa-feasibility',
  },
  {
    id: 'rpa-feasibility',
    level: 4,
    intentEn:
      'Feasibility assumed from a vendor pitch, not proven with a PoC, is the top reason bots never go live.',
    intentPl:
      'Wykonalność założona z prezentacji dostawcy, a nie udowodniona PoC, to główny powód, dla którego boty nigdy nie ruszają.',
    textEn:
      'Has a PoC proven this technically feasible, or is feasibility assumed from a vendor pitch or a similar-looking process elsewhere?',
    textPl:
      'Czy PoC udowodnił techniczną wykonalność, czy wykonalność jest założona z prezentacji dostawcy albo podobnie wyglądającego procesu gdzie indziej?',
    probeEn:
      'What would the PoC need to touch (a legacy screen, a flaky API) to actually prove this?',
    probePl:
      'Czego musiałby dotknąć PoC (stary ekran, niestabilne API), żeby to faktycznie udowodnić?',
    answerOptions: [
      {
        key: 'poc-proven',
        labelEn: 'Proven — a PoC exists against the real system',
        labelPl: 'Udowodnione — PoC istnieje na realnym systemie',
        consultantSignalEn: 'Feasibility is grounded — safe to greenlight the build.',
        consultantSignalPl: 'Wykonalność jest ugruntowana — bezpiecznie zatwierdzić budowę.',
      },
      {
        key: 'assumed',
        labelEn: 'Assumed — no PoC yet',
        labelPl: 'Założona — brak PoC',
        consultantSignalEn:
          'Gap: greenlighting the build now risks discovering infeasibility mid-build.',
        consultantSignalPl:
          'Luka: zatwierdzenie budowy teraz ryzykuje odkrycie niewykonalności w trakcie budowy.',
      },
    ],
    branches: {
      'poc-proven': null,
      assumed: null,
    },
    defaultNextId: null,
  },
];

export const RPA_QUESTION_BANK: RpaQuestionNode[] = RPA_QUESTIONS;

export function getRpaQuestion(id: string): RpaQuestionNode | undefined {
  return RPA_QUESTION_BANK.find((q) => q.id === id);
}

export function getRpaQuestionsByLevel(level: RpaQuestionLevel): RpaQuestionNode[] {
  return RPA_QUESTION_BANK.filter((q) => q.level === level);
}

/** The first question of the ladder — always the volume surface question. */
export const RPA_QUESTION_ROOT_ID = 'rpa-surface';

export function getNextRpaQuestionId(fromId: string, answerKey: string): string | null | undefined {
  const node = getRpaQuestion(fromId);
  if (!node) return undefined;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

export function isForcedLoopRpaQuestion(id: string): boolean {
  const node = getRpaQuestion(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildRpaQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań ma 4 poziomy: L1 wolumen (znany czy zgadywany; kandydat bez znanego wolumenu MUSI zostać policzony, inaczej pytanie "rpa-volume-force" wraca do siebie) -> L2 regułowość (w pełni regułowy czy z wyjątkami; udział wyjątków wpływa na wybór technologii) -> L3 kwantyfikacja (wolumen × czas obsługi × (1-wyjątki) = roczne minuty) -> L4 dopasowanie technologii i wykonalność (świadomy wybór poziomu RPA/OCR/API/AI + PoC przed zatwierdzeniem budowy).`;
  }
  return `The question ladder has 4 levels: L1 volume (known or guessed; a candidate with no known volume MUST be counted, otherwise question "rpa-volume-force" loops back on itself) -> L2 rule-basedness (fully rule-based or with exceptions; the exception rate feeds the tech-tier choice) -> L3 quantification (volume × handling time × (1-exceptions) = annual minutes) -> L4 tech fit & feasibility (a deliberate RPA/OCR/API/AI tier choice + a PoC before approving the build).`;
}
