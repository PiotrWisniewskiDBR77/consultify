/**
 * Narrative Engine — SCQA + MECE pyramid validator (OXFORD O3).
 *
 * This is the pure, testable brain that turns "we have some pillars and a core
 * message" into a checked Minto pyramid:
 *
 *   1. SCQA chain      — situation -> complication -> question -> answer
 *                         must be consistent (not restated, not disconnected).
 *   2. Governing thought — the core message must be a falsifiable claim
 *                         (not a topic/filler) actually supported by >= 2
 *                         active arguments (pillars).
 *   3. MECE pyramid    — the active pillars must be Mutually Exclusive (no two
 *                         arguing the same point) and Collectively Exhaustive
 *                         (no lone argument, no vague catch-all bucket).
 *   4. Insight staircase — each argument's fact -> interpretation -> so-what
 *                         (implication) chain, reusing the existing pillar
 *                         fields (proofPoints/evidence -> message -> implication).
 *   5. Evidence gate   — every argument with no proof is honestly labelled
 *                         "Deklaracja — niepotwierdzone" / "Declared — unconfirmed",
 *                         never silently asserted (CONCLUSION_LAYER R2).
 *
 * Every function is pure and deterministic — no LLM calls, no store access —
 * so the AI runtime and the unit tests read the exact same verdict.
 */

import type { NarrativeEngineData, NarrativePillar } from '@/store/useToolStore';

import {
  type ArgumentEvidenceGateResult,
  DECLARED_UNCONFIRMED_LABEL,
  evaluateArgumentEvidence,
} from './pyramidQuestionBank';
// Note: DECLARED_UNCONFIRMED_LABEL / evaluateArgumentEvidence / ArgumentEvidenceGateResult are
// NOT re-exported here — the barrel (./index.ts) already exports them from pyramidQuestionBank,
// and `export *` from both files would collide.

export interface PyramidIssue {
  code: string;
  messageEn: string;
  messagePl: string;
  /** Ids (pillar/context field) this issue references, when applicable. */
  refs?: string[];
}

const MIN_LEN = 12;

const isThin = (value?: string) => !value || value.trim().length < MIN_LEN;

const isActivePillar = (p: NarrativePillar) =>
  p.proposalStatus !== 'rejected' && p.proposalStatus !== 'rethinking';

// ---------------------------------------------------------------------------
// Shared text heuristics (significant-word Jaccard similarity)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  // EN
  'the',
  'and',
  'that',
  'this',
  'with',
  'from',
  'have',
  'will',
  'your',
  'which',
  'about',
  'into',
  'their',
  'because',
  'would',
  'should',
  'could',
  'there',
  'these',
  'those',
  'what',
  'when',
  'where',
  'while',
  'than',
  'then',
  'them',
  'they',
  'been',
  'being',
  'does',
  'doing',
  // PL
  'oraz',
  'jest',
  'jako',
  'przez',
  'przy',
  'czy',
  'tego',
  'temu',
  'tych',
  'tymi',
  'jego',
  'jej',
  'nasz',
  'nasza',
  'nasze',
  'który',
  'która',
  'które',
  'aby',
  'żeby',
  'ale',
  'gdy',
  'jeśli',
  'na',
  'do',
  'za',
  'nie',
  'jak',
  'lub',
  'czyli',
  'tylko',
  'bardziej',
]);

const significantWords = (text: string | undefined): Set<string> => {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );
};

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  a.forEach((w) => {
    if (b.has(w)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

/** Generic filler phrases CONCLUSION_LAYER R1 disqualifies — a thesis is not one of these alone. */
const FILLER_PATTERNS: RegExp[] = [
  /poprawi[ćc]\s+komunikacj/i,
  /zoptymalizowa[ćc]\s+proces/i,
  /nale[żz]y\s+rozwa[żz]y[ćc]/i,
  /warto\s+zwr[oó]ci[ćc]\s+uwag/i,
  /dynamiczny\s+rozw[oó]j/i,
  /w\s+dzisiejszych\s+czasach/i,
  /kluczowe\s+znaczenie\s+ma/i,
  /leverage\s+synerg/i,
  /drive\s+value/i,
  /best[\s-]in[\s-]class/i,
  /think\s+outside\s+the\s+box/i,
  /move\s+the\s+needle/i,
  /low[\s-]hanging\s+fruit/i,
  /circle\s+back/i,
  /optimi[sz]e\s+process/i,
  /improve\s+communication/i,
  /should\s+be\s+considered/i,
  /worth\s+(paying\s+attention|noting)/i,
  /key\s+importance/i,
  /in\s+today'?s\s+(world|day\s+and\s+age)/i,
];

const isFillerThesis = (text: string): boolean => FILLER_PATTERNS.some((re) => re.test(text));

// ---------------------------------------------------------------------------
// 1. SCQA validator
// ---------------------------------------------------------------------------

export interface ScqaInput {
  situation?: string;
  complication?: string;
  question?: string;
  /** The governing thought / core message plays the role of "Answer". */
  answer?: string;
}

/**
 * Validates the Situation -> Complication -> Question -> Answer chain:
 * every element must be present and non-trivial, the Complication must add
 * something the Situation did not already say, the Question must connect to
 * the Complication, and the Answer must actually resolve that Question.
 */
export function validateScqa(input: ScqaInput): PyramidIssue[] {
  const issues: PyramidIssue[] = [];

  if (isThin(input.situation)) {
    issues.push({
      code: 'missing-situation',
      messageEn:
        'No Situation (S) — the stable, agreed-on ground the story starts from is missing.',
      messagePl:
        'Brak Sytuacji (S) — brakuje stabilnego, uzgodnionego gruntu, od którego zaczyna się historia.',
    });
  }
  if (isThin(input.complication)) {
    issues.push({
      code: 'missing-complication',
      messageEn:
        'No Complication (C) — nothing breaks the stable picture, so there is no story yet.',
      messagePl:
        'Brak Komplikacji (C) — nic nie burzy stabilnego obrazu, więc nie ma jeszcze historii.',
    });
  }
  if (isThin(input.question)) {
    issues.push({
      code: 'missing-question',
      messageEn:
        'No Question (Q) — the Complication has not been sharpened into the one question it forces.',
      messagePl:
        'Brak Pytania (Q) — Komplikacja nie została zaostrzona do jednego wymuszanego pytania.',
    });
  }
  if (isThin(input.answer)) {
    issues.push({
      code: 'missing-answer',
      messageEn: 'No Answer (A) — the governing thought that resolves the question is missing.',
      messagePl: 'Brak Odpowiedzi (A) — brakuje tezy głównej rozstrzygającej pytanie.',
    });
  }

  if (!isThin(input.situation) && !isThin(input.complication)) {
    const sim = jaccard(significantWords(input.situation), significantWords(input.complication));
    if (sim > 0.6) {
      issues.push({
        code: 'complication-restates-situation',
        messageEn: 'Complication mostly restates the Situation instead of adding a new tension.',
        messagePl: 'Komplikacja w większości powtarza Sytuację, zamiast wnosić nowe napięcie.',
      });
    }
  }

  if (!isThin(input.complication) && !isThin(input.question)) {
    const sim = jaccard(significantWords(input.complication), significantWords(input.question));
    if (sim === 0) {
      issues.push({
        code: 'question-not-linked-to-complication',
        messageEn:
          'The Question shares no vocabulary with the Complication — it may not follow from it.',
        messagePl: 'Pytanie nie ma wspólnego słownictwa z Komplikacją — może z niej nie wynikać.',
      });
    }
  }

  if (!isThin(input.question) && !isThin(input.answer)) {
    const sim = jaccard(significantWords(input.question), significantWords(input.answer));
    if (sim === 0) {
      issues.push({
        code: 'answer-not-linked-to-question',
        messageEn:
          'The Answer (governing thought) shares no vocabulary with the Question — it may answer a different question.',
        messagePl:
          'Odpowiedź (teza główna) nie ma wspólnego słownictwa z Pytaniem — może odpowiadać na inne pytanie.',
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 2. Governing thought validator
// ---------------------------------------------------------------------------

/**
 * Validates the governing thought itself: must be a falsifiable claim (not a
 * filler/topic label), and must be actually supported by >= 2 active
 * arguments — a pyramid needs at least two branches to claim MECE.
 */
export function validateGoverningThought(
  coreMessage: string | undefined,
  pillars: NarrativePillar[]
): PyramidIssue[] {
  const issues: PyramidIssue[] = [];
  const active = pillars.filter(isActivePillar);

  if (isThin(coreMessage)) {
    issues.push({
      code: 'governing-thought-missing',
      messageEn: 'No governing thought — the core message is empty or too short to be a claim.',
      messagePl:
        'Brak tezy głównej — core message jest pusty lub za krótki, żeby być twierdzeniem.',
    });
  } else if (isFillerThesis(coreMessage!)) {
    issues.push({
      code: 'governing-thought-is-filler',
      messageEn:
        'Governing thought is a generic filler phrase — it would pass with any facts (R1/R3).',
      messagePl: 'Teza główna to ogólnikowy frazes — przeszłaby przy dowolnych faktach (R1/R3).',
    });
  }

  if (active.length === 0) {
    issues.push({
      code: 'governing-thought-needs-two-plus-arguments',
      messageEn: 'No active arguments (pillars) support the governing thought yet.',
      messagePl: 'Żaden aktywny argument (filar) jeszcze nie wspiera tezy głównej.',
    });
  } else if (active.length === 1) {
    issues.push({
      code: 'governing-thought-needs-two-plus-arguments',
      messageEn:
        'Only one active argument supports the governing thought — a pyramid needs >= 2 branches to be MECE.',
      messagePl:
        'Tylko jeden aktywny argument wspiera tezę główną — piramida potrzebuje >= 2 gałęzi, żeby być MECE.',
    });
  }

  if (!isThin(coreMessage) && active.length > 0) {
    const supported = active.some(
      (p) => jaccard(significantWords(coreMessage), significantWords(p.message)) > 0
    );
    if (!supported) {
      issues.push({
        code: 'governing-thought-not-supported-by-any-argument',
        messageEn:
          'The governing thought shares no vocabulary with any active argument — it floats free of the pyramid.',
        messagePl:
          'Teza główna nie ma wspólnego słownictwa z żadnym aktywnym argumentem — wisi w powietrzu, bez oparcia w piramidzie.',
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 3. MECE pyramid validator
// ---------------------------------------------------------------------------

export interface MeceOverlap {
  pillarIdA: string;
  pillarIdB: string;
  titleA: string;
  titleB: string;
  similarity: number;
}

export interface PyramidMeceReport {
  overlaps: MeceOverlap[];
  issues: PyramidIssue[];
}

const OVERLAP_THRESHOLD = 0.5;

const CATCHALL_TERMS =
  /\b(inne|pozosta[łl]\w*|r[oó]żne|miscellaneous|other|various|etc\.?|itd\.?)\b/i;

/**
 * Validates the pyramid of arguments (active pillars) for MECE:
 *  - Mutually Exclusive: no two arguments arguing essentially the same point
 *    (significant-word Jaccard similarity above threshold).
 *  - Collectively Exhaustive: at least two branches (a single argument cannot
 *    be MECE), and no argument is a vague "other/miscellaneous" catch-all.
 */
export function validatePyramidMece(pillars: NarrativePillar[]): PyramidMeceReport {
  const active = pillars.filter(isActivePillar);
  const issues: PyramidIssue[] = [];
  const overlaps: MeceOverlap[] = [];

  if (active.length === 0) {
    issues.push({
      code: 'pyramid-empty',
      messageEn: 'No active arguments — there is no pyramid to check for MECE yet.',
      messagePl: 'Brak aktywnych argumentów — nie ma jeszcze piramidy do sprawdzenia pod MECE.',
    });
  } else if (active.length === 1) {
    issues.push({
      code: 'pyramid-single-argument',
      messageEn:
        'Only one argument — a single branch cannot be Mutually Exclusive/Collectively Exhaustive.',
      messagePl:
        'Tylko jeden argument — pojedyncza gałąź nie może być wzajemnie wykluczająca się / łącznie wyczerpująca.',
      refs: [active[0].id],
    });
  }

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      const wordsA = new Set([...significantWords(a.title), ...significantWords(a.message)]);
      const wordsB = new Set([...significantWords(b.title), ...significantWords(b.message)]);
      const similarity = jaccard(wordsA, wordsB);
      if (similarity > OVERLAP_THRESHOLD) {
        overlaps.push({
          pillarIdA: a.id,
          pillarIdB: b.id,
          titleA: a.title,
          titleB: b.title,
          similarity: Math.round(similarity * 100) / 100,
        });
        issues.push({
          code: 'pillars-overlap',
          messageEn: `"${a.title}" and "${b.title}" argue essentially the same point (similarity ${Math.round(similarity * 100)}%) — not Mutually Exclusive.`,
          messagePl: `„${a.title}" i „${b.title}" argumentują w gruncie rzeczy to samo (podobieństwo ${Math.round(similarity * 100)}%) — nie są wzajemnie wykluczające się.`,
          refs: [a.id, b.id],
        });
      }
    }
  }

  active.forEach((p) => {
    if (CATCHALL_TERMS.test(`${p.title} ${p.message}`)) {
      issues.push({
        code: 'pyramid-catchall-bucket',
        messageEn: `"${p.title}" reads as a vague "other/miscellaneous" bucket, not a named MECE branch.`,
        messagePl: `„${p.title}" brzmi jak mglisty kosz "inne/pozostałe", nie jak nazwana gałąź MECE.`,
        refs: [p.id],
      });
    }
  });

  return { overlaps, issues };
}

// ---------------------------------------------------------------------------
// 4. Insight staircase per argument (fact -> interpretation -> so-what)
// ---------------------------------------------------------------------------

/**
 * Validates one argument's (pillar's) insight staircase, reusing the existing
 * pillar fields: proofPoints/evidence = K1 fact, message = K2 interpretation,
 * implication = K3 so-what. Mirrors validateInsightStaircase
 * (src/config/swot/swotInsightStaircase.ts) with narrative-specific field names.
 */
export function validateArgumentStaircase(pillar: NarrativePillar): PyramidIssue[] {
  const issues: PyramidIssue[] = [];
  const facts = [...(pillar.proofPoints || []), ...(pillar.evidence || [])].filter(
    (f) => f && f.trim()
  );

  if (facts.length === 0) {
    issues.push({
      code: 'argument-missing-fact',
      messageEn: `"${pillar.title}" has no underlying fact (K1) — no proof point or evidence entry.`,
      messagePl: `„${pillar.title}" nie ma faktu bazowego (K1) — brak proof pointa lub wpisu dowodowego.`,
      refs: [pillar.id],
    });
  }

  if (isThin(pillar.message)) {
    issues.push({
      code: 'argument-missing-interpretation',
      messageEn: `"${pillar.title}" has no claim/interpretation (K2) — the message field is empty or too short.`,
      messagePl: `„${pillar.title}" nie ma twierdzenia/interpretacji (K2) — pole message jest puste lub za krótkie.`,
      refs: [pillar.id],
    });
  }

  if (isThin(pillar.implication)) {
    issues.push({
      code: 'argument-missing-so-what',
      messageEn: `"${pillar.title}" has no so-what (K3 seed) — the implication field is empty or too short.`,
      messagePl: `„${pillar.title}" nie ma "no i co z tego" (zalążek K3) — pole implication jest puste lub za krótkie.`,
      refs: [pillar.id],
    });
  } else if (!isThin(pillar.message)) {
    const msg = pillar.message.trim().toLowerCase();
    const impl = pillar.implication!.trim().toLowerCase();
    if (
      msg === impl ||
      (impl.length > 20 && msg.includes(impl)) ||
      (msg.length > 20 && impl.includes(msg))
    ) {
      issues.push({
        code: 'argument-so-what-restates-claim',
        messageEn: `"${pillar.title}" — the so-what restates the claim instead of naming its consequence.`,
        messagePl: `„${pillar.title}" — "no i co z tego" powtarza twierdzenie zamiast nazwać jego konsekwencję.`,
        refs: [pillar.id],
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface ArgumentPyramidReport {
  pillarId: string;
  title: string;
  staircaseIssues: PyramidIssue[];
  evidenceGate: ArgumentEvidenceGateResult;
}

export interface NarrativePyramidReport {
  scqaIssues: PyramidIssue[];
  governingThoughtIssues: PyramidIssue[];
  mece: PyramidMeceReport;
  arguments: ArgumentPyramidReport[];
  /** true only when every structural check (SCQA/governing thought/MECE/staircase) is clean. */
  valid: boolean;
}

/**
 * One-shot structural validation of the whole narrative pyramid. Pure and
 * deterministic — safe to call on every render / before every AI prompt.
 */
export function validateNarrativePyramid(data: NarrativeEngineData): NarrativePyramidReport {
  const pillars = data.pillars || [];
  const scqaIssues = validateScqa({
    situation: data.context?.situation,
    complication: data.context?.complication,
    question: data.context?.question,
    answer: data.context?.coreMessage,
  });
  const governingThoughtIssues = validateGoverningThought(data.context?.coreMessage, pillars);
  const mece = validatePyramidMece(pillars);
  const argumentsReport: ArgumentPyramidReport[] = pillars.filter(isActivePillar).map((p) => ({
    pillarId: p.id,
    title: p.title,
    staircaseIssues: validateArgumentStaircase(p),
    evidenceGate: evaluateArgumentEvidence(p),
  }));

  const structuralIssueCount =
    scqaIssues.length +
    governingThoughtIssues.length +
    mece.issues.length +
    argumentsReport.reduce((sum, a) => sum + a.staircaseIssues.length, 0);

  return {
    scqaIssues,
    governingThoughtIssues,
    mece,
    arguments: argumentsReport,
    valid: structuralIssueCount === 0,
  };
}

/**
 * Renders the structural validation report as a prompt block the AI must fix
 * before finalizing its answer. Returns null when the pyramid is already
 * clean (nothing to flag) so callers can skip an empty section.
 */
export function buildPyramidValidationPromptBlock(
  report: NarrativePyramidReport,
  isPolish: boolean
): string | null {
  const lines: string[] = [];
  const msg = (issue: PyramidIssue) => (isPolish ? issue.messagePl : issue.messageEn);

  report.scqaIssues.forEach((i) => lines.push(`- [SCQA] ${msg(i)}`));
  report.governingThoughtIssues.forEach((i) => lines.push(`- [Governing thought] ${msg(i)}`));
  report.mece.issues.forEach((i) => lines.push(`- [MECE] ${msg(i)}`));
  report.arguments.forEach((a) => {
    a.staircaseIssues.forEach((i) => lines.push(`- [Staircase] ${msg(i)}`));
    if (a.evidenceGate.status === 'declared') {
      const label = isPolish ? a.evidenceGate.label!.pl : a.evidenceGate.label!.en;
      lines.push(
        isPolish
          ? `- [Dowód] „${a.title}" bez dowodu — etykieta „${label}" (nie blokuje, ale MUSI być nazwana).`
          : `- [Evidence] "${a.title}" has no proof — label "${label}" (does not block, but MUST be named).`
      );
    }
  });

  if (lines.length === 0) return null;

  const header = isPolish
    ? 'STRUKTURALNA WALIDACJA PIRAMIDY (silnik, do naprawienia PRZED domknięciem):'
    : 'STRUCTURAL PYRAMID VALIDATION (engine-derived, fix BEFORE finalizing):';

  return `${header}\n${lines.join('\n')}`;
}

/** Prompt block teaching the model the SCQA + MECE + so-what + evidence-gate contract. */
export function buildPyramidPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDA sesja Narrative Engine musi nieść dyscyplinę piramidy Minto:
- SCQA: "context.situation" (stabilny, uzgodniony fakt) -> "context.complication" (co go burzy,
  NIE powtórzenie sytuacji) -> "context.question" (JEDNO pytanie wymuszone przez komplikację) ->
  "context.coreMessage" jako Odpowiedź, która rozstrzyga DOKŁADNIE to pytanie.
- Teza główna ("context.coreMessage") musi być falsyfikowalna (R3) — gdyby fakty były przeciwne,
  brzmiałaby inaczej — i wspierana przez >= 2 aktywne filary (argumenty).
- Filary (argumenty) muszą być MECE: wzajemnie wykluczające się (żadne dwa nie argumentują tego
  samego) i łącznie wyczerpujące (żaden nie jest mglistym koszem "inne/pozostałe").
- Każdy filar niesie drabinę wniosku: "proofPoints"/"evidence" (K1 fakt) -> "message" (K2
  interpretacja) -> "implication" (K3 "no i co z tego") — implikacja NIE może powtarzać message.
- Filar bez proofPoints i evidence: jawnie oznacz jako "${DECLARED_UNCONFIRMED_LABEL.pl}" —
  bramka nigdy nie blokuje, ale wymaga uczciwej etykiety.`;
  }
  return `EVERY Narrative Engine session must carry the Minto pyramid discipline:
- SCQA: "context.situation" (stable, agreed fact) -> "context.complication" (what breaks it,
  NOT a restatement of the situation) -> "context.question" (the ONE question the complication
  forces) -> "context.coreMessage" as the Answer that resolves EXACTLY that question.
- The governing thought ("context.coreMessage") must be falsifiable (R3) — with opposite facts it
  would read differently — and supported by >= 2 active pillars (arguments).
- Pillars (arguments) must be MECE: Mutually Exclusive (no two arguing the same point) and
  Collectively Exhaustive (no vague "other/miscellaneous" catch-all).
- Every pillar carries an insight staircase: "proofPoints"/"evidence" (K1 fact) -> "message" (K2
  interpretation) -> "implication" (K3 so-what) — the implication must NOT restate the message.
- A pillar with no proofPoints and no evidence: explicitly label it
  "${DECLARED_UNCONFIRMED_LABEL.en}" — the gate never blocks, but demands an honest label.`;
}
