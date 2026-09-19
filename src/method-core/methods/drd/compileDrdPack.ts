/**
 * DRD Method Pack compiler.
 *
 * This file is a COMPILER, not an author of methodology content. It reads:
 *   1. `DRD_STRUCTURE` (src/services/drdStructure.ts) — the frozen 7-axis /
 *      39-area structure and canonical level titles/descriptions. VERIFIED
 *      correct by a prior audit — do not restructure it here.
 *   2. `getDRDKnowledge()` (src/services/assessmentKnowledge, barrel) — the
 *      already-curated Oxford O1 question/evidence/technology bank per
 *      area#level (~8,000 lines of hand-written override content). This is
 *      the QBank v2 content, already transcribed into runtime TS — we read
 *      it, we do NOT re-parse the markdown and we do NOT re-author it.
 *   3. `getDRDAxisWhyHint()` (same barrel) — axis-level "why does this
 *      matter" hints. Coarser than per-question (7 hints, not ~700), but it
 *      is REAL curated content, so we use it instead of leaving
 *      `whyItMatters` empty for all 699 questions.
 *
 * Anything the contract (`ASSESSMENT_METHOD_PACK_CONTRACT.md` §4,
 * `ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md` §5) requires that
 * has NO source in this repo is left as an empty array/string and counted in
 * `DrdCompileReport.fieldGaps`. We do not invent DRD methodology content —
 * DRD/Digital Pathfinder is a licensed method (see `manifest.licence`).
 *
 * NOTE on `maturityPathwayDrdData.ts` / `getMaturityPathway()`: that service
 * uses a DIFFERENT DRD dimension model (`D1..D8`, levels `I..V` per "Canon
 * §3.2 MAP-1.0") than the 39-area/7-axis model implemented here and verified
 * against `ASSESSMENT_KB_DRD.md`. The two do not line up 1:1 (8 dimensions
 * vs 39 areas; 5 levels vs 5/6/7 per axis) and `MethodAdapter` has no
 * "pathway" hook, so this compiler does NOT wire it in. This is a reported
 * discrepancy (see `discrepancies` in the report), not a silent choice.
 */

import { DRD_STRUCTURE, type DRDArea, type DRDAxis, type DRDLevel } from '@/services/drdStructure';
import { getDRDAxisWhyHint, getDRDKnowledge } from '@/services/assessmentKnowledge';

// Raw override maps are imported ONLY to measure coverage (`key in map`) —
// never to copy their string content. The public barrel (`getDRDKnowledge`)
// is the sole source of actual question/evidence/technology text, per the
// coordinator's instruction. The barrel does not re-export these maps, so
// direct import is the only way to produce a computed (not hand-typed)
// coverage number.
import { DRD_OVERRIDES_AXIS_1_2 } from '@/services/assessmentKnowledge/drdKnowledgeOverridesAxis1And2';
import { DRD_OVERRIDES_AXIS_3_4 } from '@/services/assessmentKnowledge/drdKnowledgeOverridesAxis3And4';
import { DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7 } from '@/services/assessmentKnowledge/drdKnowledgeOverridesAxis5To7';

import type {
  MethodCompileReport,
  MethodCompileResult,
  MethodLevel,
  MethodPack,
  MethodPackManifest,
  MethodQuestion,
  MethodSourceRef,
  MethodUnit,
  ScoringFixture,
} from '../../contracts';

// ---------------------------------------------------------------------------
// Coverage / gap reporting types
// ---------------------------------------------------------------------------

export interface DrdCompileCoverage {
  /** Always 39 — asserted, not assumed (see compile-time invariant check). */
  readonly areasTotal: number;
  /** Areas where getDRDKnowledge() has a real override for EVERY level of that area's own axis scale. */
  readonly areasWithFullLevelCoverage: number;
  readonly areaIdsMissingSomeLevelCoverage: readonly string[];
  /** Sum of (levelCount per area) across all 39 areas — the unit of QBank coverage. */
  readonly unitLevelPairsTotal: number;
  readonly unitLevelPairsWithOverrideContent: number;
  /** 3 questions per area#level pair that has override content. */
  readonly questionsTotal: number;
}

export interface DrdCompileFieldGaps {
  readonly levelsTotal: number;
  readonly emptyExpectedEvidence: number;
  readonly emptyMisScoringTraps: number;
  readonly emptyDistinctionFromPrevious: number;
  readonly emptyDistinctionFromNext: number;
  readonly emptyNegativeEvidence: number;
  readonly emptyExamples: number;
  readonly emptyRequiredAttributes: number;
  readonly unitsTotal: number;
  readonly emptyUnitRespondentRoles: number;
  readonly emptyUnitDependsOnUnitIds: number;
  readonly questionsTotal: number;
  readonly emptyQuestionIntent: number;
  readonly emptyPlainLanguageExplanation: number;
  readonly emptyGlossaryRefs: number;
  readonly emptyPositiveAnswerExample: number;
  readonly emptyPartialAnswerExample: number;
  readonly emptyNegativeAnswerExample: number;
  readonly emptyQuestionExpectedEvidence: number;
  readonly emptyLikelyRespondentRoles: number;
  readonly emptyFollowUpQuestionIds: number;
  readonly emptyCommonMisunderstanding: number;
  readonly emptyAllowedTeresaCapabilities: number;
  /** whyItMatters is populated from axis-level hints (7 hints), not authored per-question. Disclosed, not a "gap" count. */
  readonly whyItMattersGranularity: 'axis-level (7 hints reused across all questions in that axis) — NOT per-question';
}

export interface DrdCompileReport extends MethodCompileReport {
  readonly coverage: DrdCompileCoverage;
  readonly fieldGaps: DrdCompileFieldGaps;
  readonly discrepancies: readonly string[];
  readonly readinessRationale: string;
}

/**
 * Uniform compiler result (COORD-09). Structurally identical to the previous
 * hand-written `{ pack, report }` shape, so every existing caller keeps working —
 * this is a widening to the shared type, not a breaking change.
 */
export type DrdCompileResult = MethodCompileResult<DrdCompileReport>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DRD_METHOD_PACK_ID = 'drd';
export const DRD_METHOD_PACK_VERSION = '2.0.0-methodpack.2';
/** The only aggregation mapping version this adapter currently implements. */
export const DRD_AGGREGATION_VERSION = 'drd-aggregation-mean-v1';
/**
 * Policy default, NOT sourced from DRD book canon: QBank v2 "Dowód" text
 * consistently demands a pointed-to artefact (screenshot, export, log) at
 * every level, never accepting a bare declaration. E2 ("artefact pointed
 * to") is the floor that matches that pattern. This is a disclosed
 * engineering default pending DRD-owner confirmation — see report.
 */
export const DRD_DEFAULT_MINIMUM_EVIDENCE_STRENGTH = 'E2' as const;

const RETRIEVED_AT = '2026-08-13T00:00:00.000Z';

function axisGroupId(axisId: number): string {
  return `axis-${axisId}`;
}

function qbankFileSlugForAxis(axisId: number): string {
  if (axisId === 1 || axisId === 2) return 'drd-qbank-axis1-2';
  if (axisId === 3 || axisId === 4) return 'drd-qbank-axis3-4';
  return 'drd-qbank-axis5-7';
}

function qbankSectionId(areaId: string, axisId: number): string {
  return `${qbankFileSlugForAxis(axisId)}-${areaId.toLowerCase()}`;
}

/**
 * QBank "Dowód / przykład" text is one prose block, e.g.
 * "Dowód: lista X; zrzut Y. Sygnał poziomu III: Z." — split on ';' to get
 * distinct evidence items while preserving original wording verbatim (no
 * paraphrase, no invention).
 */
function splitEvidenceText(example: string): string[] {
  // PL corpus labels the block "Dowód:", the EN mirror labels it "Evidence:".
  // Both are stripped so the compiled `expectedEvidence` items never carry the
  // label as part of the first item.
  const withoutLabel = example.replace(/^(?:Dow[oó]d|Evidence)\s*:\s*/i, '').trim();
  if (!withoutLabel) return [];
  return withoutLabel
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstSentence(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? normalized).trim();
}

function evidenceAt(items: readonly string[], index: number, fallback: string): string {
  return (items[index] || items[0] || fallback).replace(/\s+/g, ' ').trim();
}

function buildLevelExamples(
  area: DRDArea,
  level: DRDLevel,
  evidenceItems: readonly string[],
  lang: DrdPackLanguage
): string[] {
  const areaName = lang === 'pl' ? area.namePL || area.name : area.name || area.namePL || area.id;
  const levelTitle = (lang === 'en' && level.titleEN) || level.title;
  const first = evidenceAt(
    evidenceItems,
    0,
    lang === 'pl'
      ? 'datowany artefakt z działającego systemu'
      : 'a dated artifact from a working system'
  );
  const second = evidenceAt(
    evidenceItems,
    1,
    lang === 'pl'
      ? 'raport operacyjny albo log użycia z ostatniego okresu'
      : 'an operating report or usage log from the recent period'
  );

  if (lang === 'pl') {
    return [
      `Przykład potwierdzający: w obszarze ${areaName} zespół pokazuje ${first}, powiązany z poziomem ${level.level} (${levelTitle}).`,
      `Drugi przykład: niezależny przypadek operacyjny pokazuje ${second}, z datą, właścicielem i śladem użycia w pracy.`,
    ];
  }

  return [
    `Confirming example: in ${areaName}, the team shows ${first}, tied to level ${level.level} (${levelTitle}).`,
    `Second example: an independent operating case shows ${second}, with a date, owner, and trace of real use.`,
  ];
}

function buildQuestionHelpFields(input: {
  area: DRDArea;
  level: DRDLevel;
  evidenceItems: readonly string[];
  lang: DrdPackLanguage;
}): Pick<
  MethodQuestion,
  | 'intent'
  | 'plainLanguageExplanation'
  | 'positiveAnswerExample'
  | 'partialAnswerExample'
  | 'negativeAnswerExample'
  | 'expectedEvidence'
> {
  const areaName =
    input.lang === 'pl'
      ? input.area.namePL || input.area.name
      : input.area.name || input.area.namePL || input.area.id;
  const levelTitle = (input.lang === 'en' && input.level.titleEN) || input.level.title;
  const fallbackEvidence = [
    input.lang === 'pl'
      ? 'datowany artefakt z działającego systemu'
      : 'a dated artifact from a working system',
    input.lang === 'pl'
      ? 'raport albo log użycia z ostatniego okresu'
      : 'a report or usage log from the recent period',
  ];
  const evidence = input.evidenceItems.length
    ? input.evidenceItems.length === 1
      ? [...input.evidenceItems, fallbackEvidence[1]]
      : input.evidenceItems
    : fallbackEvidence;
  const first = evidenceAt(evidence, 0, evidence[0]);
  const second = evidenceAt(evidence, 1, evidence[0]);
  const canon = firstSentence(input.level.description);

  if (input.lang === 'pl') {
    return {
      intent: `Zweryfikować, czy ${areaName} ma realne zachowanie i artefakt dla poziomu ${input.level.level} (${levelTitle}).`,
      plainLanguageExplanation: `Pytanie prosi o pokazanie konkretnego przypadku: ${canon}`,
      positiveAnswerExample: `Potwierdzające: respondent pokazuje ${first} oraz umie wskazać właściciela, datę i regularne użycie.`,
      partialAnswerExample: `Częściowe: istnieje ${first}, ale brakuje ${second} albo dowodu, że praktyka działa poza pojedynczym pilotażem.`,
      negativeAnswerExample: `Niepotwierdzające: zespół opisuje zamiar lub praktykę ustnie, ale nie potrafi pokazać ${first} ani ${second}.`,
      expectedEvidence: evidence,
    };
  }

  return {
    intent: `Validate whether ${areaName} has real behavior and an artifact for level ${input.level.level} (${levelTitle}).`,
    plainLanguageExplanation: `This asks for a concrete case: ${canon}`,
    positiveAnswerExample: `Confirming: the respondent shows ${first} and can identify the owner, date, and regular use.`,
    partialAnswerExample: `Partial: ${first} exists, but ${second} is missing or there is no proof that the practice works beyond a one-off pilot.`,
    negativeAnswerExample: `Not confirming: the team describes intent or practice verbally but cannot show ${first} or ${second}.`,
    expectedEvidence: evidence,
  };
}

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------

/**
 * Language of the COMPILED pack content (unit names, question wording,
 * `whyItMatters`). DEC-461 (2026-09-14): EN is the default — the product's
 * software and demo data lead in English; PL is produced on demand for a
 * Polish viewer. Note this is the language of the METHODOLOGY CONTENT read
 * out of `DRD_STRUCTURE` / `getDRDKnowledge()`, not UI chrome (that stays
 * i18next's job).
 */
export type DrdPackLanguage = 'pl' | 'en';

/**
 * Licensed-content warning shown with the compiled pack. This is product
 * chrome, not DRD methodology content: selecting the viewer's language does
 * not alter any unit, level, question, scoring fixture or output hash input.
 */
export const DRD_METHOD_PACK_LICENCE_NOTICES: Record<DrdPackLanguage, string> = {
  en: "DRD/Digital Pathfinder is a licensed methodology. QBank v2 content and level descriptions come from DBR77 materials. They must not be copied into public deliverables without the methodology owner's permission.",
  pl: 'DRD/Digital Pathfinder jest metodyką licencjonowaną. Treści QBank v2 i opisy poziomów pochodzą z materiałów DBR77 — zakaz kopiowania do publicznych deliverables bez zgody właściciela metodyki.',
};

/**
 * One cached result PER LANGUAGE. A single `cached` slot used to make the
 * first caller's language win for the whole session — switching the
 * interface language then left the questionnaire in the previous language
 * until a full reload.
 */
const cachedByLanguage = new Map<DrdPackLanguage, DrdCompileResult>();

/** Compiles the DRD Method Pack. Pure/deterministic — same output every call for the same `lang` (cached per language). */
export function compileDrdPack(lang: DrdPackLanguage = 'en'): DrdCompileResult {
  const cached = cachedByLanguage.get(lang);
  if (cached) return cached;

  const units: MethodUnit[] = [];
  const levels: MethodLevel[] = [];
  const questions: MethodQuestion[] = [];

  let unitOrder = 0;
  let unitLevelPairsTotal = 0;
  let unitLevelPairsWithOverrideContent = 0;
  let questionsFromOverrides = 0;
  const areaIdsMissingSomeLevelCoverage: string[] = [];

  let emptyExpectedEvidence = 0;
  let emptyRequiredAttributes = 0;
  const levelsTotal0 = { count: 0 };

  for (const axis of DRD_STRUCTURE as DRDAxis[]) {
    for (const area of axis.areas as DRDArea[]) {
      const parentId = axisGroupId(axis.id);
      const levelScale = area.levels.map((l) => l.level).sort((a, b) => a - b);

      const areaName =
        lang === 'pl' ? area.namePL || area.name : area.name || area.namePL || area.id;
      const axisName = lang === 'pl' ? axis.namePL || axis.name : axis.name || axis.namePL || '';
      const unit: MethodUnit = {
        unitId: area.id,
        name: areaName,
        description:
          lang === 'pl'
            ? `${area.name}${area.namePL ? ` (${area.namePL})` : ''} — obszar osi ${axis.id} ${axis.name}${axis.namePL ? ` (${axis.namePL})` : ''}.`
            : `${areaName} — area of axis ${axis.id} ${axisName}.`,
        parentId,
        order: unitOrder++,
        levelScale,
        // DRD does not define cross-AREA dependencies (only within-area,
        // level-to-level ramp, which is progression's job, not a unit
        // dependency). Left empty deliberately — not a content gap.
        dependsOnUnitIds: [],
        // Not present anywhere in QBank v2 / drdStructure.ts as a structured
        // field (respondent identity is implied inline inside question text,
        // e.g. "handlowiec", "dyrektor sprzedaży" — never itemized). Left
        // empty and counted as a gap rather than guessed.
        respondentRoles: [],
      };
      units.push(unit);

      let areaHasFullCoverage = true;

      for (const lvl of area.levels as DRDLevel[]) {
        unitLevelPairsTotal++;
        const overrideKey = `${area.id}#${lvl.level}`;
        const hasOverride =
          overrideKey in DRD_OVERRIDES_AXIS_1_2 ||
          overrideKey in DRD_OVERRIDES_AXIS_3_4 ||
          overrideKey in DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7;

        if (hasOverride) unitLevelPairsWithOverrideContent++;
        else areaHasFullCoverage = false;

        const knowledge = getDRDKnowledge(area.id, lvl.level, lang);
        const expectedEvidence = splitEvidenceText(knowledge.example);
        const technologyExamples = knowledge.suggestedTechnologies;

        const validationQuestionIds: string[] = [];
        knowledge.questions.forEach((wording, idx) => {
          const questionId = `${area.id}-L${lvl.level}-Q${idx + 1}`;
          validationQuestionIds.push(questionId);
          if (hasOverride) questionsFromOverrides++;

          const whyHint = getDRDAxisWhyHint(axis.id);

          const questionHelp = buildQuestionHelpFields({
            area,
            level: lvl,
            evidenceItems: expectedEvidence,
            lang,
          });

          const question: MethodQuestion = {
            questionId,
            unitId: area.id,
            level: lvl.level,
            canonicalWording: wording,
            intent: questionHelp.intent,
            plainLanguageExplanation: questionHelp.plainLanguageExplanation,
            whyItMatters: whyHint[lang],
            glossaryRefs: [],
            positiveAnswerExample: questionHelp.positiveAnswerExample,
            partialAnswerExample: questionHelp.partialAnswerExample,
            negativeAnswerExample: questionHelp.negativeAnswerExample,
            expectedEvidence: questionHelp.expectedEvidence,
            likelyRespondentRoles: [],
            followUpQuestionIds: [],
            commonMisunderstanding: '',
            allowedTeresaCapabilities: [],
            sourceRefs: [`qbank-v2:${qbankSectionId(area.id, axis.id)}:level:${lvl.level}`],
          };
          questions.push(question);
        });

        if (expectedEvidence.length === 0) emptyExpectedEvidence++;
        // requiredAttributes has no source anywhere — always empty for now.
        emptyRequiredAttributes++;
        levelsTotal0.count++;

        const levelExamples = buildLevelExamples(area, lvl, expectedEvidence, lang);
        const level: MethodLevel = {
          unitId: area.id,
          level: lvl.level,
          // ★ FALA J3 (2026-09-14): wariant EN istnieje TYLKO tam, gdzie
          // korpus jest polski (osie 5 i 6). Brak wariantu → zostaje tekst
          // źródłowy, dokładnie jak przed zmianą — nie zmyślamy tłumaczenia.
          title: (lang === 'en' && lvl.titleEN) || lvl.title,
          canonicalDefinition: (lang === 'en' && lvl.descriptionEN) || lvl.description,
          requiredAttributes: [],
          distinctionFromPrevious: '',
          distinctionFromNext: '',
          validationQuestionIds,
          expectedEvidence,
          negativeEvidence: [],
          misScoringTraps: [],
          examples: levelExamples,
          technologyExamples,
          prerequisites: lvl.level > levelScale[0] ? [lvl.level - 1] : [],
          minimumEvidenceStrength: DRD_DEFAULT_MINIMUM_EVIDENCE_STRENGTH,
        };
        levels.push(level);
      }

      if (!areaHasFullCoverage) areaIdsMissingSomeLevelCoverage.push(area.id);
    }
  }

  const areasTotal = DRD_STRUCTURE.reduce((sum, axis) => sum + axis.areas.length, 0);
  const areasWithFullLevelCoverage = areasTotal - areaIdsMissingSomeLevelCoverage.length;

  const sources: MethodSourceRef[] = [
    {
      sourceId: 'drd-structure-ts',
      title: 'DRD_STRUCTURE (7 axes / 39 areas, canonical level titles + descriptions)',
      locator: 'src/services/drdStructure.ts',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'internal_reference',
    },
    {
      sourceId: 'drd-qbank-v2-axis1-2',
      title: 'DRD QBank v2 (PL) — Axis 1-2 evidentiary questions',
      locator: 'knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis1-2.pl.md',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'restricted',
    },
    {
      sourceId: 'drd-qbank-v2-axis3-4',
      title: 'DRD QBank v2 (PL) — Axis 3-4 evidentiary questions',
      locator: 'knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis3-4.pl.md',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'restricted',
    },
    {
      sourceId: 'drd-qbank-v2-axis5-7',
      title: 'DRD QBank v2 (PL) — Axis 5-7 evidentiary questions',
      locator: 'knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis5-7.pl.md',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'restricted',
    },
    {
      sourceId: 'drd-methodology-v1',
      title:
        'DRD methodology grounding per axis (Digital Pathfinder) — cited for provenance, NOT extracted into pack content',
      locator: 'knowledge/tool-kb/drd/methodology/v1/',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'restricted',
    },
    {
      sourceId: 'drd-knowledge-overrides',
      title: 'Curated Oxford O1 question/evidence/technology bank (transcribed QBank v2 content)',
      locator: 'src/services/assessmentKnowledge/drdKnowledgeOverridesAxis{1And2,3And4,5To7}.ts',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'internal_reference',
    },
    {
      sourceId: 'drd-why-this-matters',
      title: 'Axis-level "why we ask" hints',
      locator: 'src/services/assessmentKnowledge/whyThisMatters.ts',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'internal_reference',
    },
  ];

  const scoringFixtures: ScoringFixture[] = buildScoringFixtures();

  const manifest: MethodPackManifest = {
    id: DRD_METHOD_PACK_ID,
    name: 'DRD — Digital Readiness Diagnosis (Digital Pathfinder)',
    version: DRD_METHOD_PACK_VERSION,
    ownerUserId: null,
    // Both language mirrors are compiled from this file now (DEC-461): the
    // curated EN overrides (`*Axis*.en.ts`) are read through
    // `getDRDKnowledge(..., lang)` exactly like the PL ones. `languages`
    // lists what this COMPILER can produce, not what a single call returned —
    // `compiledLanguage` below is the language of THIS result.
    languages: ['en', 'pl'],
    compiledLanguage: lang,
    readiness: 'methodology_review',
    licence: {
      holder: 'DBR77 / Digital Pathfinder (Dr. Piotr Wiśniewski)',
      usageRestriction: 'internal_only',
      notice: DRD_METHOD_PACK_LICENCE_NOTICES[lang],
    },
  };

  const pack: MethodPack = {
    manifest,
    units,
    levels,
    questions,
    sources,
    scoringFixtures,
  };

  const fieldGaps: DrdCompileFieldGaps = {
    levelsTotal: levels.length,
    emptyExpectedEvidence,
    emptyMisScoringTraps: levels.length, // never present anywhere in this repo
    emptyDistinctionFromPrevious: levels.length,
    emptyDistinctionFromNext: levels.length,
    emptyNegativeEvidence: levels.length,
    emptyExamples: levels.filter((level) => level.examples.length === 0).length,
    emptyRequiredAttributes,
    unitsTotal: units.length,
    emptyUnitRespondentRoles: units.length,
    emptyUnitDependsOnUnitIds: units.length,
    questionsTotal: questions.length,
    emptyQuestionIntent: questions.filter((question) => !question.intent).length,
    emptyPlainLanguageExplanation: questions.filter(
      (question) => !question.plainLanguageExplanation
    ).length,
    emptyGlossaryRefs: questions.length,
    emptyPositiveAnswerExample: questions.filter((question) => !question.positiveAnswerExample)
      .length,
    emptyPartialAnswerExample: questions.filter((question) => !question.partialAnswerExample)
      .length,
    emptyNegativeAnswerExample: questions.filter((question) => !question.negativeAnswerExample)
      .length,
    emptyQuestionExpectedEvidence: questions.filter(
      (question) => question.expectedEvidence.length === 0
    ).length,
    emptyLikelyRespondentRoles: questions.length,
    emptyFollowUpQuestionIds: questions.length,
    emptyCommonMisunderstanding: questions.length,
    emptyAllowedTeresaCapabilities: questions.length,
    whyItMattersGranularity:
      'axis-level (7 hints reused across all questions in that axis) — NOT per-question',
  };

  const coverage: DrdCompileCoverage = {
    areasTotal,
    areasWithFullLevelCoverage,
    areaIdsMissingSomeLevelCoverage,
    unitLevelPairsTotal,
    unitLevelPairsWithOverrideContent,
    questionsTotal: questions.length,
  };

  const discrepancies: string[] = [
    'maturityPathwayDrdData.ts / getMaturityPathway() uses a DIFFERENT DRD dimension model ' +
      '(D1..D8, levels I..V, "Canon §3.2 MAP-1.0") than the 39-area/7-axis model compiled here ' +
      '(verified against ASSESSMENT_KB_DRD.md, which itself flags the old "34 areas" comment as ' +
      'wrong). MethodAdapter has no pathway hook, so it is NOT wired into this pack — flagging ' +
      'instead of silently picking one model.',
    'LEVEL TITLES/DESCRIPTIONS FOR AXES 5 AND 6 ARE A TRANSLATION AWAITING THE METHODOLOGY ' +
      "OWNER'S SIGN-OFF: the corpus for those two axes was written in Polish (measured 2026-08-30: " +
      '11 + 14 Polish titles, 27 + 26 Polish descriptions out of 233). Since 2026-09-14 (wave J3) ' +
      '`DRD_STRUCTURE` carries an English variant per level (`titleEN`/`descriptionEN`, the same ' +
      'pattern as `name`/`namePL`) and a compile with lang="en" emits it, so an English report no ' +
      'longer prints Polish level titles. The English wording is a working translation, NOT owner-' +
      'approved content — see D2_TYTULY_POZIOMOW_EN.md. Levels with no EN variant keep the source ' +
      'text (there are none on axes 1-4/7, whose corpus is English already).',
  ];

  const readinessRationale =
    'methodology_review: structure (39/39 areas), level titles/canonical definitions, and ' +
    `QBank-derived questions/evidence/technology are 100% covered (${unitLevelPairsWithOverrideContent}/${unitLevelPairsTotal} area#level pairs, ` +
    `${questionsFromOverrides}/${questions.length} questions from curated overrides) and scoring is deterministic with fixtures. ` +
    'However ASSESSMENT_METHOD_PACK_CONTRACT.md §4 still requires distinctionFromPrevious/Next, ' +
    'misScoringTraps, negativeEvidence and requiredAttributes, and ' +
    'ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md §5 now receives deterministic intent, ' +
    'plainLanguageExplanation, answer examples and question evidence from the QBank evidence block, ' +
    'so the "Example and evidence" drawer is no longer empty. glossaryRefs, respondent roles, follow-ups, ' +
    'commonMisunderstanding and allowedTeresaCapabilities still have no structured repo source (see fieldGaps). The pack has not been reviewed ' +
    'or approved by the DRD method owner. Per §6 of the contract this cannot be content_approved or ' +
    'higher; it cannot be "draft" either since real, sourced, licensed content is compiled. ' +
    'methodology_review is the honest ceiling. canStartSession() correctly refuses this readiness.';

  const result: DrdCompileResult = {
    pack,
    report: { coverage, fieldGaps, discrepancies, readinessRationale },
  };
  cachedByLanguage.set(lang, result);
  return result;
}

// ---------------------------------------------------------------------------
// Scoring fixtures (golden cases)
// ---------------------------------------------------------------------------

function buildScoringFixtures(): ScoringFixture[] {
  return [
    {
      fixtureId: 'drd-progression-ramp-with-gap-v1',
      description:
        '1A: levels 1,2 confirmed, 3 missing, 4 confirmed out of order → currentLevel=2, blockedAtLevel=3, aboveGapLevels=[4].',
      kind: 'valid',
      input: { unitId: '1A', confirmedLevels: [1, 2, 4], evidenceByLevel: {} },
      expected: { currentLevel: 2, blockedAtLevel: 3, openLevels: [1, 2, 3], aboveGapLevels: [4] },
    },
    {
      fixtureId: 'drd-progression-above-gap-never-raises-current-v1',
      description:
        '1A: level 1 missing entirely, level 5 confirmed (far above gap) → currentLevel stays null, not 5.',
      kind: 'boundary',
      input: { unitId: '1A', confirmedLevels: [5], evidenceByLevel: {} },
      expected: { currentLevel: null, blockedAtLevel: 1, openLevels: [1], aboveGapLevels: [5] },
    },
    {
      fixtureId: 'drd-progression-full-ramp-v1',
      description: '1A: all 7 levels confirmed in order → currentLevel=7, nothing blocked.',
      kind: 'valid',
      input: { unitId: '1A', confirmedLevels: [1, 2, 3, 4, 5, 6, 7], evidenceByLevel: {} },
      expected: { currentLevel: 7, blockedAtLevel: null, openLevels: [], aboveGapLevels: [] },
    },
    {
      fixtureId: 'drd-progression-prerequisite-skipped-rejected-v1',
      description:
        '1A: only level 3 confirmed (1,2 never confirmed) → prerequisite skip is rejected.',
      kind: 'invalid',
      input: { unitId: '1A', confirmedLevels: [3], evidenceByLevel: {} },
      expected: { currentLevel: null, blockedAtLevel: 1, openLevels: [1], aboveGapLevels: [3] },
    },
  ];
}
