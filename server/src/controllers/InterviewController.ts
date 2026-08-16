/**
 * InterviewController - v2.0 ClickUp-like Redesign
 *
 * Handles:
 * - Interview sessions (5 categories: Strategy, Operations, Digital, People, Finance)
 * - Questions (task-list style with status, confidence, tags)
 * - Notes
 * - Evidence (files, links)
 * - Summary (ONLY facts - no recommendations)
 * - Organization context (Company Facts)
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { IngestionPipeline } from '../services/ai/ingestionPipeline.js';
import { llmService } from '../services/ai/llmService.js';
import {
  getPublishedInterviewTemplateSnapshot,
  publishInterviewTemplate,
  TemplatePublicationError,
} from '../services/interview/interviewTemplatePublicationService.js';
import {
  INSIGHT_GATED_STATUSES,
  INSIGHT_PATCH_SETTABLE_STATUSES,
} from '../services/InterviewInsightService.js';
import {
  buildAssignmentManagerScopeClause,
  buildSessionManagerScopeClause,
  type InterviewManagerScope,
  isOrgWideInterviewManagerRole,
  resolveInterviewManagerScope,
} from '../services/interviewManagerScope.js';
import notificationService from '../services/notificationService.js';
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
import PDFParserService from '../services/pdfParserService.js';
import { evaluateGatePolicy } from '../services/workflow/gatePolicy.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getTableColumns } from '../utils/dbSchema.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

import {
  canonicalStatusToken,
  statusEqualsSql,
} from '../services/interview/interviewStatusNormalization.js';
import { sanitizeQuestionText } from '../services/interview/interviewQuestionTextSanitizer.js';

import {
  isTruthyFlag,
  isTruthyFlagSql,
  LEGACY_FLAG_FALSE,
  LEGACY_FLAG_TRUE,
} from '../services/interview/interviewLegacyFlags.js';

// 5 Interview Categories (new spec)
const INTERVIEW_CATEGORIES = ['strategy', 'operations', 'digital', 'people', 'finance'] as const;
type InterviewCategory = (typeof INTERVIEW_CATEGORIES)[number];

const DEFAULT_INTERVIEW_QUESTION_TEMPLATES = [
  {
    id: 'tpl_strategy_1',
    category: 'strategy',
    questionText:
      'Walk me through your top 2-3 business objectives for the next 2-3 years — and for each, what specifically has to change operationally for you to get there?',
    sortOrder: 1,
    isRequired: 1,
  },
  {
    id: 'tpl_strategy_2',
    category: 'strategy',
    questionText:
      'Describe a recent decision where digital capability — or the lack of it — directly changed a business outcome. What does that tell you about where transformation needs to go next?',
    sortOrder: 2,
    isRequired: 1,
  },
  {
    id: 'tpl_operations_1',
    category: 'operations',
    questionText:
      'Walk me through your core end-to-end process — from request or order to delivery — step by step, including every handoff between teams. Where does it slow down?',
    sortOrder: 1,
    isRequired: 1,
  },
  {
    id: 'tpl_digital_1',
    category: 'digital',
    questionText:
      'Which systems run this business day to day, and where does someone have to re-key or copy-paste data between them?',
    sortOrder: 1,
    isRequired: 1,
  },
  {
    id: 'tpl_people_1',
    category: 'people',
    questionText:
      'Tell me about the last time your team had to learn a new tool or system. How long did it take to reach full productivity, and what made it hard?',
    sortOrder: 1,
    isRequired: 1,
  },
  {
    id: 'tpl_finance_1',
    category: 'finance',
    questionText:
      'What budget is actually committed for this initiative this year, and what would you need to see to unlock more?',
    sortOrder: 1,
    isRequired: 1,
  },
] as const;

// Question statuses (task-list style)
const QUESTION_STATUSES = ['not_started', 'in_progress', 'answered', 'needs_follow_up'] as const;
type QuestionStatus = (typeof QUESTION_STATUSES)[number];

// Helpers
const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

// Robust 0/1 flag coercion. Some boolean-intent columns are BIGINT on Postgres,
// which node-pg returns as a STRING ("1"/"0") — a bare `x === 1` is then always
// false (e.g. template/required/team-assignment flags silently flip off). Coerce
// numerically so it works for int4 (number), int8 (string) and boolean alike.
const flagOn = (v: unknown): boolean => v === true || Number(v) === 1;

const INTERVIEW_TEMPLATE_AREA_TAGS = new Set([
  'strategy',
  'operations',
  'digital',
  'finance',
  'people',
  'sales',
  'marketing',
  'procurement',
  'customer-service',
  'delivery',
  'it',
  'data',
  'risk',
  'compliance',
  'hr',
  'pmo',
]);

const normalizeTemplateAreaTags = (value: unknown): string[] => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  return raw
    .map((item) =>
      String(item || '')
        .trim()
        .toLowerCase()
    )
    .filter((item, index, array) => array.indexOf(item) === index)
    .filter((item) => INTERVIEW_TEMPLATE_AREA_TAGS.has(item))
    .slice(0, 6);
};

const matchesTemplateSourceFilter = (
  scope: 'system' | 'organization' | 'private',
  filter: string
): boolean => {
  if (!filter || filter === 'all') return true;
  if (filter === 'application') return scope === 'system';
  if (filter === 'organization') return scope === 'organization';
  if (filter === 'user') return scope === 'private';
  return true;
};

type InterviewMissingItem = {
  key: string;
  label: string;
  questionId?: string;
  sectionId?: string;
};

const parseMissingItems = (value: string | null | undefined): InterviewMissingItem[] =>
  parseJson<InterviewMissingItem[]>(value, []);

const INTERVIEW_AI_FIX_TYPES = [
  'clarify',
  'add_evidence',
  'expand_answer',
  'make_specific',
  'complete_required_fields',
  'correct_meaning',
] as const;

type InterviewAiFixType = (typeof INTERVIEW_AI_FIX_TYPES)[number];
type InterviewAiAnswerVerdict = 'sufficient' | 'needs_improvement' | 'insufficient' | 'unanswered';
type InterviewAiOverallVerdict =
  | 'ready_for_approval'
  | 'needs_improvement'
  | 'insufficient'
  | 'empty';
type InterviewReviewAlignment =
  | 'aligned'
  | 'manager_stricter_than_ai'
  | 'manager_overrode_ai_warning'
  | 'no_ai_signal';

// ── #48a — Objective scoring rubric (Oxford style) ──
// The rubric is DATA, not a black box: every criterion has an explicit key,
// label, and a 0-4 anchored description. The LLM only judges each criterion
// independently (low temperature, no free-form "overall impression"); every
// rollup — per-question score, verdict, and the session overallScore/verdict —
// is computed by plain arithmetic in this file, not guessed by the model.
// This is what makes the score reproducible/defensible instead of "losowy".
const INTERVIEW_RUBRIC_CRITERIA = [
  {
    key: 'concreteness',
    labelEn: 'Concreteness',
    labelPl: 'Konkretność',
    descriptionEn:
      'Specific facts, names, numbers, or examples instead of vague generalities ("some", "a lot", "we try to").',
    descriptionPl:
      'Konkretne fakty, nazwy, liczby lub przykłady zamiast ogólników ("trochę", "sporo", "staramy się").',
  },
  {
    key: 'evidence',
    labelEn: 'Evidence',
    labelPl: 'Dowody',
    descriptionEn:
      'Cites something checkable — a data point, named system/process, document, or observed event — to support the claim.',
    descriptionPl:
      'Podaje coś sprawdzalnego — dane, nazwany system/proces, dokument lub zaobserwowane zdarzenie — na poparcie twierdzenia.',
  },
  {
    key: 'depth',
    labelEn: 'Depth',
    labelPl: 'Głębia',
    descriptionEn:
      'Goes beyond restating the question — explains mechanism, root cause, trade-off, or context rather than a surface answer.',
    descriptionPl:
      'Wykracza poza powtórzenie pytania — wyjaśnia mechanizm, przyczynę źródłową, kompromis lub kontekst, a nie tylko odpowiedź powierzchowną.',
  },
  {
    key: 'measurability',
    labelEn: 'Measurability',
    labelPl: 'Mierzalność',
    descriptionEn:
      'Contains a quantifiable, verifiable, or falsifiable statement (a number, date, percentage, threshold, or named comparison).',
    descriptionPl:
      'Zawiera mierzalne, weryfikowalne lub falsyfikowalne stwierdzenie (liczbę, datę, procent, próg lub nazwane porównanie).',
  },
  {
    key: 'coherence',
    labelEn: 'Coherence',
    labelPl: 'Spójność',
    descriptionEn:
      'Directly and consistently answers what was actually asked, without contradicting itself or drifting off-topic.',
    descriptionPl:
      'Bezpośrednio i spójnie odpowiada na zadane pytanie, bez sprzeczności i bez odchodzenia od tematu.',
  },
] as const;

type InterviewRubricCriterionKey = (typeof INTERVIEW_RUBRIC_CRITERIA)[number]['key'];
const INTERVIEW_RUBRIC_MAX_PER_CRITERION = 4; // anchored 0 (absent) .. 4 (excellent)
const INTERVIEW_RUBRIC_MAX_TOTAL =
  INTERVIEW_RUBRIC_CRITERIA.length * INTERVIEW_RUBRIC_MAX_PER_CRITERION; // 20
const INTERVIEW_RUBRIC_VERSION = 'oxford-v1';

type InterviewAiRubricCriterionResult = {
  criterion: InterviewRubricCriterionKey;
  label: string;
  score: number; // 0..INTERVIEW_RUBRIC_MAX_PER_CRITERION
  maxScore: number;
  justification: string;
};

// Deterministic 0-20 rubric total -> legacy 1-5 scale, so every existing
// consumer (hard-floor gate, notification %, InterviewHub column) keeps working
// unchanged. Rounded to 1 decimal for readability.
const rubricTotalToFiveScale = (total: number): number => {
  const clamped = Math.max(0, Math.min(INTERVIEW_RUBRIC_MAX_TOTAL, total));
  return Math.round((1 + (clamped / INTERVIEW_RUBRIC_MAX_TOTAL) * 4) * 10) / 10;
};

// Deterministic per-answer verdict from the rubric ratio — replaces the old
// LLM-guessed verdict so categorization is rule-based, not "vibes".
const verdictFromRubricRatio = (ratio: number): InterviewAiAnswerVerdict => {
  if (ratio >= 0.8) return 'sufficient';
  if (ratio >= 0.5) return 'needs_improvement';
  return 'insufficient';
};

type InterviewAiQuestionEvaluation = {
  questionId: string;
  score: number;
  verdict: InterviewAiAnswerVerdict;
  feedback: string;
  fixType: InterviewAiFixType;
  rubric: InterviewAiRubricCriterionResult[];
  rubricTotal: number;
  rubricMax: number;
};

type InterviewAiWeakAnswerItem = InterviewMissingItem & {
  score: number;
  verdict: InterviewAiAnswerVerdict;
  feedback: string;
  fixType: InterviewAiFixType;
  isRequired: boolean;
  rubric: InterviewAiRubricCriterionResult[];
  /**
   * #48A — Soft, non-blocking depth nudge for the RESPONDENT (not just the
   * manager). Present only when the answer was scored ('needs_improvement')
   * or explicitly flagged 'expand_answer'; names the single weakest rubric
   * criterion so the hint is concrete ("this answer could be deeper: Depth")
   * rather than generic. Never set for 'sufficient'/'insufficient'/'unanswered'
   * — those already have their own hard-floor or positive messaging.
   */
  depthHint?: string;
};

type InterviewAiReviewSnapshot = {
  overallScore: number;
  overallVerdict: InterviewAiOverallVerdict;
  questionEvaluations: InterviewAiQuestionEvaluation[];
  recommendations: string[];
  weakAnswerMap: InterviewAiWeakAnswerItem[];
  rubricVersion: string;
  rubricCriteria: Array<{ key: string; label: string; description: string; maxScore: number }>;
};

type InterviewReviewDecisionMemoryEntry = {
  id: string;
  action: 'approve' | 'send_back';
  actorId: string;
  actorRole?: string;
  createdAt: string;
  aiOverallVerdict: InterviewAiOverallVerdict;
  aiOverallScore: number | null;
  aiWeakAnswerCount: number;
  alignment: InterviewReviewAlignment;
  reason?: string;
  missingItems?: InterviewMissingItem[];
};

const parseAiReviewSnapshot = (
  value: string | null | undefined
): InterviewAiReviewSnapshot | null => parseJson<InterviewAiReviewSnapshot | null>(value, null);

const parseReviewDecisionMemory = (
  value: string | null | undefined
): InterviewReviewDecisionMemoryEntry[] =>
  parseJson<InterviewReviewDecisionMemoryEntry[]>(value, []);

const normalizeInterviewAiFixType = (
  value: unknown,
  meta?: { verdict?: InterviewAiAnswerVerdict; isRequired?: boolean; feedback?: string }
): InterviewAiFixType => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if ((INTERVIEW_AI_FIX_TYPES as readonly string[]).includes(normalized)) {
    return normalized as InterviewAiFixType;
  }

  const feedback = String(meta?.feedback || '').toLowerCase();
  if (meta?.verdict === 'unanswered') return 'complete_required_fields';
  if (meta?.isRequired && (meta?.verdict === 'insufficient' || !feedback)) {
    return 'complete_required_fields';
  }
  if (feedback.includes('evidence')) return 'add_evidence';
  if (
    feedback.includes('specific') ||
    feedback.includes('detail') ||
    feedback.includes('example') ||
    feedback.includes('concrete')
  ) {
    return 'make_specific';
  }
  if (feedback.includes('expand') || feedback.includes('depth') || feedback.includes('broader')) {
    return 'expand_answer';
  }
  if (
    feedback.includes('incorrect') ||
    feedback.includes('misunder') ||
    feedback.includes('meaning') ||
    feedback.includes('contradict')
  ) {
    return 'correct_meaning';
  }
  return 'clarify';
};

// #48A — Deterministic depth nudge, built from the same rubric the LLM already
// scored (no extra AI call). Picks the single weakest criterion so the hint
// names something concrete instead of a generic "improve this answer".
const buildDepthHint = (
  verdict: InterviewAiAnswerVerdict,
  fixType: InterviewAiFixType,
  rubric: InterviewAiRubricCriterionResult[],
  lang: 'pl' | 'en'
): string | undefined => {
  if (verdict !== 'needs_improvement' && fixType !== 'expand_answer') return undefined;
  if (!rubric || rubric.length === 0) return undefined;

  const weakest = rubric.reduce((min, r) => (r.score < min.score ? r : min), rubric[0]);
  const criterionMeta = INTERVIEW_RUBRIC_CRITERIA.find((c) => c.key === weakest.criterion);
  const criterionLabel = criterionMeta
    ? lang === 'pl'
      ? criterionMeta.labelPl
      : criterionMeta.labelEn
    : weakest.label;

  return lang === 'pl'
    ? `Ta odpowiedź może być głębsza: ${criterionLabel}`
    : `This answer could be deeper: ${criterionLabel}`;
};

const buildInterviewAiWeakAnswerMap = (
  questions: Array<{
    id: string;
    question_text?: string;
    is_required?: boolean;
  }>,
  questionEvaluations: InterviewAiQuestionEvaluation[],
  lang: 'pl' | 'en' = 'en'
): InterviewAiWeakAnswerItem[] => {
  const questionMap = new Map<string, { question_text?: string; is_required?: boolean }>();
  for (const question of questions) {
    questionMap.set(String(question.id), question);
  }

  return questionEvaluations
    .filter((item) => item.verdict !== 'sufficient')
    .map((item) => {
      const question = questionMap.get(item.questionId);
      const label = String(question?.question_text || 'Question')
        .trim()
        .slice(0, 160);
      return {
        key: `ai_${item.questionId}`,
        label,
        questionId: item.questionId,
        score: item.score,
        verdict: item.verdict,
        feedback: item.feedback,
        fixType: item.fixType,
        isRequired: Boolean(question?.is_required),
        rubric: item.rubric,
        depthHint: buildDepthHint(item.verdict, item.fixType, item.rubric, lang),
      };
    })
    .sort((a, b) => {
      if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1;
      if (a.score !== b.score) return a.score - b.score;
      return a.label.localeCompare(b.label);
    });
};

// Normalizes one LLM-scored rubric (an array of {criterion, score, justification})
// into the fixed 5-criterion shape, in the canonical INTERVIEW_RUBRIC_CRITERIA
// order, clamping stray scores into [0, MAX]. Missing/unknown criteria default
// to 0 with an empty justification rather than being silently dropped — a
// truncated LLM response degrades the score instead of corrupting the shape.
const normalizeRubricResult = (
  rawRubric: Array<{ criterion?: unknown; score?: unknown; justification?: unknown }> | undefined
): InterviewAiRubricCriterionResult[] => {
  const byKey = new Map<string, { score?: unknown; justification?: unknown }>();
  for (const entry of rawRubric || []) {
    const key = String(entry?.criterion || '').trim();
    if (key) byKey.set(key, entry);
  }
  return INTERVIEW_RUBRIC_CRITERIA.map((criterion) => {
    const entry = byKey.get(criterion.key);
    const rawScore = Number(entry?.score);
    const score = Number.isFinite(rawScore)
      ? Math.max(0, Math.min(INTERVIEW_RUBRIC_MAX_PER_CRITERION, Math.round(rawScore)))
      : 0;
    return {
      criterion: criterion.key,
      label: criterion.labelEn,
      score,
      maxScore: INTERVIEW_RUBRIC_MAX_PER_CRITERION,
      justification: String(entry?.justification || '').trim(),
    };
  });
};

const zeroRubric = (): InterviewAiRubricCriterionResult[] =>
  INTERVIEW_RUBRIC_CRITERIA.map((criterion) => ({
    criterion: criterion.key,
    label: criterion.labelEn,
    score: 0,
    maxScore: INTERVIEW_RUBRIC_MAX_PER_CRITERION,
    justification: '',
  }));

// #48a — Builds the full review snapshot from PER-CRITERION rubric judgments.
// Every numeric rollup here (per-question score/verdict, session overallScore/
// overallVerdict) is deterministic arithmetic over the rubric — the LLM never
// supplies a final score or verdict directly, only the 0-4 judgment per
// criterion. Same rubric + same answers -> same score, every time.
const buildInterviewAiReviewSnapshot = (
  raw: {
    questionEvaluations: Array<{
      questionId: string;
      isAnswered: boolean;
      rubric?: Array<{ criterion?: unknown; score?: unknown; justification?: unknown }>;
      feedback?: string;
      fixType?: InterviewAiFixType;
    }>;
    recommendations: string[];
  },
  questions: Array<{
    id: string;
    question_text?: string;
    is_required?: boolean;
  }>,
  lang: 'pl' | 'en' = 'en'
): InterviewAiReviewSnapshot => {
  const questionMeta = new Map<string, { is_required?: boolean }>();
  for (const question of questions) {
    questionMeta.set(String(question.id), { is_required: question.is_required });
  }

  const questionEvaluations: InterviewAiQuestionEvaluation[] = (raw.questionEvaluations || []).map(
    (item) => {
      const isRequired = Boolean(questionMeta.get(String(item.questionId))?.is_required);
      if (!item.isAnswered) {
        return {
          questionId: String(item.questionId),
          score: 1,
          verdict: 'unanswered' as InterviewAiAnswerVerdict,
          feedback: lang === 'pl' ? 'Brak odpowiedzi.' : 'No answer provided.',
          fixType: normalizeInterviewAiFixType(undefined, {
            verdict: 'unanswered',
            isRequired,
            feedback: '',
          }),
          rubric: zeroRubric(),
          rubricTotal: 0,
          rubricMax: INTERVIEW_RUBRIC_MAX_TOTAL,
        };
      }
      const rubric = normalizeRubricResult(item.rubric);
      const rubricTotal = rubric.reduce((sum, r) => sum + r.score, 0);
      const verdict = verdictFromRubricRatio(rubricTotal / INTERVIEW_RUBRIC_MAX_TOTAL);
      return {
        questionId: String(item.questionId),
        score: rubricTotalToFiveScale(rubricTotal),
        verdict,
        feedback: String(item.feedback || '').trim(),
        fixType: normalizeInterviewAiFixType(item.fixType, {
          verdict,
          isRequired,
          feedback: item.feedback,
        }),
        rubric,
        rubricTotal,
        rubricMax: INTERVIEW_RUBRIC_MAX_TOTAL,
      };
    }
  );

  // Session-level rollup — weighted average (required answers count 1.5x so a
  // weak mandatory answer moves the score more than a weak optional one),
  // computed here rather than asked of the LLM.
  let weightedSum = 0;
  let weightTotal = 0;
  let requiredBlocked = false;
  for (const evalItem of questionEvaluations) {
    const isRequired = Boolean(questionMeta.get(evalItem.questionId)?.is_required);
    const weight = isRequired ? 1.5 : 1;
    weightedSum += evalItem.score * weight;
    weightTotal += weight;
    if (isRequired && (evalItem.verdict === 'insufficient' || evalItem.verdict === 'unanswered')) {
      requiredBlocked = true;
    }
  }
  const overallScore = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) / 10 : 0;
  const overallVerdict: InterviewAiOverallVerdict =
    overallScore >= 3.5 && !requiredBlocked
      ? 'ready_for_approval'
      : overallScore >= 2.5
        ? 'needs_improvement'
        : 'insufficient';

  return {
    overallScore,
    overallVerdict,
    questionEvaluations,
    recommendations: Array.isArray(raw.recommendations)
      ? raw.recommendations.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    weakAnswerMap: buildInterviewAiWeakAnswerMap(questions, questionEvaluations, lang),
    rubricVersion: INTERVIEW_RUBRIC_VERSION,
    rubricCriteria: INTERVIEW_RUBRIC_CRITERIA.map((c) => ({
      key: c.key,
      label: lang === 'pl' ? c.labelPl : c.labelEn,
      description: lang === 'pl' ? c.descriptionPl : c.descriptionEn,
      maxScore: INTERVIEW_RUBRIC_MAX_PER_CRITERION,
    })),
  };
};

const resolveInterviewReviewAlignment = (
  action: 'approve' | 'send_back',
  aiReview: InterviewAiReviewSnapshot | null
): InterviewReviewAlignment => {
  const verdict = aiReview?.overallVerdict;
  if (!verdict || verdict === 'empty') return 'no_ai_signal';
  if (action === 'approve') {
    return verdict === 'ready_for_approval' ? 'aligned' : 'manager_overrode_ai_warning';
  }
  return verdict === 'ready_for_approval' ? 'manager_stricter_than_ai' : 'aligned';
};

const appendInterviewReviewDecisionMemory = (params: {
  existing: InterviewReviewDecisionMemoryEntry[];
  action: 'approve' | 'send_back';
  actorId: string;
  actorRole?: string;
  aiReview: InterviewAiReviewSnapshot | null;
  reason?: string;
  missingItems?: InterviewMissingItem[];
  createdAt: string;
}): InterviewReviewDecisionMemoryEntry[] => {
  const entry: InterviewReviewDecisionMemoryEntry = {
    id: `irdm_${uuidv4()}`,
    action: params.action,
    actorId: params.actorId,
    actorRole: params.actorRole,
    createdAt: params.createdAt,
    aiOverallVerdict: params.aiReview?.overallVerdict || 'empty',
    aiOverallScore:
      typeof params.aiReview?.overallScore === 'number' ? params.aiReview.overallScore : null,
    aiWeakAnswerCount: params.aiReview?.weakAnswerMap?.length || 0,
    alignment: resolveInterviewReviewAlignment(params.action, params.aiReview),
    reason: params.reason || undefined,
    missingItems:
      params.missingItems && params.missingItems.length > 0 ? params.missingItems : undefined,
  };

  return [...(params.existing || []), entry].slice(-25);
};

const requireUser = (req: AuthenticatedRequest) => {
  const user = req.user;
  if (!user) throw new Error('Unauthorized');
  return user;
};

const resolveTemplateScopeFromRow = (row: any): 'system' | 'organization' | 'private' => {
  const explicit = String(row?.template_scope || '')
    .trim()
    .toLowerCase();
  if (explicit === 'system' || explicit === 'organization' || explicit === 'private') {
    return explicit;
  }
  return row?.organization_id ? 'organization' : 'system';
};

const resolveRequestedTemplateScope = (params: {
  requestedScope?: unknown;
  requestedVisibility?: unknown;
  userRole?: string;
}): 'system' | 'organization' | 'private' => {
  const requestedScope = String(params.requestedScope || '')
    .trim()
    .toLowerCase();
  if (requestedScope === 'private') return 'private';
  if (requestedScope === 'system') {
    return ['SUPERADMIN'].includes(String(params.userRole || '').toUpperCase())
      ? 'system'
      : 'organization';
  }

  const requestedVisibility = String(params.requestedVisibility || '')
    .trim()
    .toLowerCase();
  if (requestedVisibility === 'global') {
    return ['SUPERADMIN'].includes(String(params.userRole || '').toUpperCase())
      ? 'system'
      : 'organization';
  }
  if (requestedVisibility === 'admin_only') return 'private';
  return 'organization';
};

const resolveTemplateStoragePolicy = (params: {
  scope: 'system' | 'organization' | 'private';
  organizationId: string;
  requestedVisibility?: unknown;
}) => {
  const explicitVisibility = String(params.requestedVisibility || '')
    .trim()
    .toLowerCase();
  if (params.scope === 'system') {
    return {
      organizationId: null,
      visibility: explicitVisibility || 'global',
    };
  }
  if (params.scope === 'private') {
    return {
      organizationId: params.organizationId,
      visibility: 'admin_only',
    };
  }
  return {
    organizationId: params.organizationId,
    visibility: explicitVisibility && explicitVisibility !== 'global' ? explicitVisibility : 'org',
  };
};

const canAccessTemplate = (
  row: any,
  user: { organizationId: string; id: string; role?: string }
) => {
  const scope = resolveTemplateScopeFromRow(row);
  if (scope === 'system') {
    return row?.visibility !== 'admin_only' || ['ADMIN', 'SUPERADMIN'].includes(user.role || '');
  }
  if (scope === 'private') {
    return row?.organization_id === user.organizationId && row?.created_by === user.id;
  }
  return row?.organization_id === user.organizationId;
};

const canManageTemplate = (
  row: any,
  user: { organizationId: string; id: string; role?: string }
) => {
  const scope = resolveTemplateScopeFromRow(row);
  if (scope === 'system') {
    return ['SUPERADMIN'].includes(user.role || '');
  }
  if (scope === 'private') {
    return row?.organization_id === user.organizationId && row?.created_by === user.id;
  }
  return row?.organization_id === user.organizationId;
};

async function ensureInterviewEvidenceColumns(): Promise<void> {
  const cols = await getTableColumns('interview_evidence');
  if (!cols.has('category')) {
    await queryHelpers.queryRun(`ALTER TABLE interview_evidence ADD COLUMN category TEXT`);
  }
  if (!cols.has('evidence_role')) {
    await queryHelpers.queryRun(
      `ALTER TABLE interview_evidence ADD COLUMN evidence_role TEXT DEFAULT 'supporting'`
    );
  }
  if (!cols.has('transcript_text')) {
    await queryHelpers.queryRun(`ALTER TABLE interview_evidence ADD COLUMN transcript_text TEXT`);
  }
  if (!cols.has('ingest_to_knowledge')) {
    await queryHelpers.queryRun(
      `ALTER TABLE interview_evidence ADD COLUMN ingest_to_knowledge INTEGER DEFAULT 1`
    );
  }
  if (!cols.has('knowledge_document_id')) {
    await queryHelpers.queryRun(
      `ALTER TABLE interview_evidence ADD COLUMN knowledge_document_id TEXT`
    );
  }
}

async function ensureInterviewQuestionV6Columns(): Promise<void> {
  const cols = await getTableColumns('interview_questions');
  const missingColumns: Array<{ name: string; sql: string }> = [
    {
      name: 'answer_options',
      sql: `ALTER TABLE interview_questions ADD COLUMN answer_options TEXT DEFAULT '[]'`,
    },
    {
      name: 'answer_type',
      sql: `ALTER TABLE interview_questions ADD COLUMN answer_type TEXT DEFAULT 'open'`,
    },
    {
      name: 'is_required',
      sql: `ALTER TABLE interview_questions ADD COLUMN is_required INTEGER DEFAULT 0`,
    },
    {
      name: 'expected_answer_shape',
      sql: `ALTER TABLE interview_questions ADD COLUMN expected_answer_shape TEXT`,
    },
    {
      name: 'description',
      sql: `ALTER TABLE interview_questions ADD COLUMN description TEXT`,
    },
    {
      name: 'evidence_prompt',
      sql: `ALTER TABLE interview_questions ADD COLUMN evidence_prompt TEXT`,
    },
    {
      name: 'allow_voice',
      sql: `ALTER TABLE interview_questions ADD COLUMN allow_voice INTEGER DEFAULT 0`,
    },
    {
      name: 'allow_file_upload',
      sql: `ALTER TABLE interview_questions ADD COLUMN allow_file_upload INTEGER DEFAULT 0`,
    },
    {
      name: 'allow_url',
      sql: `ALTER TABLE interview_questions ADD COLUMN allow_url INTEGER DEFAULT 0`,
    },
    {
      name: 'allow_context_note',
      sql: `ALTER TABLE interview_questions ADD COLUMN allow_context_note INTEGER DEFAULT 1`,
    },
    {
      name: 'answer_mode',
      sql: `ALTER TABLE interview_questions ADD COLUMN answer_mode TEXT DEFAULT 'text'`,
    },
    {
      name: 'answer_payload',
      sql: `ALTER TABLE interview_questions ADD COLUMN answer_payload TEXT DEFAULT '{}'`,
    },
    { name: 'context_note', sql: `ALTER TABLE interview_questions ADD COLUMN context_note TEXT` },
    {
      name: 'voice_transcript',
      sql: `ALTER TABLE interview_questions ADD COLUMN voice_transcript TEXT`,
    },
    {
      name: 'voice_transcript_status',
      sql: `ALTER TABLE interview_questions ADD COLUMN voice_transcript_status TEXT DEFAULT 'none'`,
    },
    {
      name: 'voice_audio_evidence_id',
      sql: `ALTER TABLE interview_questions ADD COLUMN voice_audio_evidence_id TEXT`,
    },
    {
      name: 'source_template_question_id',
      sql: `ALTER TABLE interview_questions ADD COLUMN source_template_question_id TEXT`,
    },
    {
      name: 'answer_knowledge_doc_id',
      sql: `ALTER TABLE interview_questions ADD COLUMN answer_knowledge_doc_id TEXT`,
    },
    {
      name: 'context_note_knowledge_doc_id',
      sql: `ALTER TABLE interview_questions ADD COLUMN context_note_knowledge_doc_id TEXT`,
    },
    {
      name: 'guidance',
      sql: `ALTER TABLE interview_questions ADD COLUMN guidance TEXT`,
    },
    {
      name: 'example_answer',
      sql: `ALTER TABLE interview_questions ADD COLUMN example_answer TEXT`,
    },
  ];

  for (const column of missingColumns) {
    if (!cols.has(column.name)) {
      try {
        await queryHelpers.queryRun(column.sql);
        // getTableColumns() caches and returns this Set. Keep the cache coherent
        // after a successful lazy migration so later requests do not issue the
        // same ALTER and fill logs with harmless duplicate-column errors.
        cols.add(column.name);
      } catch (err: any) {
        // Idempotent guard: getTableColumns() caches the column set per-process, so a
        // column added earlier in this process (or by another instance) is absent from the
        // cached set and we re-issue the ALTER. Postgres/SQLite then throw
        // "already exists"/"duplicate column" — safe to ignore; rethrow anything else.
        const m = String(err?.message || err).toLowerCase();
        if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
        cols.add(column.name);
      }
    }
  }
}

async function ensureInterviewSessionV6Columns(): Promise<void> {
  const cols = await getTableColumns('interview_sessions');
  const missingColumns: Array<{ name: string; sql: string }> = [
    {
      name: 'runtime_mode_default',
      sql: `ALTER TABLE interview_sessions ADD COLUMN runtime_mode_default TEXT DEFAULT 'single_question'`,
    },
    {
      name: 'template_id',
      sql: `ALTER TABLE interview_sessions ADD COLUMN template_id TEXT`,
    },
    {
      name: 'template_version',
      sql: `ALTER TABLE interview_sessions ADD COLUMN template_version INTEGER DEFAULT 1`,
    },
    {
      name: 'assignment_id',
      sql: `ALTER TABLE interview_sessions ADD COLUMN assignment_id TEXT`,
    },
    {
      name: 'total_questions',
      sql: `ALTER TABLE interview_sessions ADD COLUMN total_questions INTEGER DEFAULT 0`,
    },
    {
      name: 'answered_questions',
      sql: `ALTER TABLE interview_sessions ADD COLUMN answered_questions INTEGER DEFAULT 0`,
    },
    {
      name: 'last_activity_at',
      sql: `ALTER TABLE interview_sessions ADD COLUMN last_activity_at TIMESTAMP`,
    },
    {
      name: 'started_at',
      sql: `ALTER TABLE interview_sessions ADD COLUMN started_at TIMESTAMP`,
    },
  ];

  for (const column of missingColumns) {
    if (!cols.has(column.name)) {
      try {
        await queryHelpers.queryRun(column.sql);
      } catch (err: any) {
        // Idempotent guard: getTableColumns() caches the column set per-process, so a
        // column added earlier in this process (or by another instance) is absent from the
        // cached set and we re-issue the ALTER. Postgres/SQLite then throw
        // "already exists"/"duplicate column" — safe to ignore; rethrow anything else.
        const m = String(err?.message || err).toLowerCase();
        if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
      }
    }
  }
}

/**
 * Lazy-ensure lifecycle columns on interview_sessions (archive + trash).
 * DB_MANAGED_SCHEMA is off in dev, so we ADD COLUMN only when missing.
 */
async function ensureInterviewSessionLifecycleColumns(): Promise<void> {
  const cols = await getTableColumns('interview_sessions');
  const missingColumns: Array<{ name: string; sql: string }> = [
    {
      name: 'archived_at',
      sql: `ALTER TABLE interview_sessions ADD COLUMN archived_at TIMESTAMP`,
    },
    {
      name: 'archived_by',
      sql: `ALTER TABLE interview_sessions ADD COLUMN archived_by TEXT`,
    },
    {
      name: 'trashed_at',
      sql: `ALTER TABLE interview_sessions ADD COLUMN trashed_at TIMESTAMP`,
    },
    {
      name: 'trashed_by',
      sql: `ALTER TABLE interview_sessions ADD COLUMN trashed_by TEXT`,
    },
  ];

  for (const column of missingColumns) {
    if (!cols.has(column.name)) {
      try {
        await queryHelpers.queryRun(column.sql);
      } catch (err: any) {
        // Idempotent guard: getTableColumns() caches the column set per-process, so a
        // column added earlier in this process (or by another instance) is absent from the
        // cached set and we re-issue the ALTER. Postgres/SQLite then throw
        // "already exists"/"duplicate column" — safe to ignore; rethrow anything else.
        const m = String(err?.message || err).toLowerCase();
        if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
      }
    }
  }
}

/**
 * Lazy-ensure lifecycle columns on interview_insights (dev schema; DB_MANAGED_SCHEMA=off).
 * Mirrors the session/assignment lifecycle pattern so Insights can be archived/restored
 * without a migration. Idempotent + safe under per-process column cache.
 */
async function ensureInterviewInsightLifecycleColumns(): Promise<void> {
  const cols = await getTableColumns('interview_insights');
  const missingColumns: Array<{ name: string; sql: string }> = [
    {
      name: 'archived_at',
      sql: `ALTER TABLE interview_insights ADD COLUMN archived_at TIMESTAMP`,
    },
    {
      name: 'archived_by',
      sql: `ALTER TABLE interview_insights ADD COLUMN archived_by TEXT`,
    },
  ];

  for (const column of missingColumns) {
    if (!cols.has(column.name)) {
      try {
        await queryHelpers.queryRun(column.sql);
      } catch (err: any) {
        const m = String(err?.message || err).toLowerCase();
        if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
      }
    }
  }
}

// Module-level flag: true once we've confirmed section_completions exists (avoids repeated DDL).
let _insightSectionCompletionsEnsured = false;

/**
 * Lazy ALTER — adds section_completions JSON column to interview_insights.
 * Called from updateInsight when the payload includes sectionCompletions.
 * Stores: { "themes": true, "issues-risks": true, ... } (AI Mark Complete signal).
 *
 * Uses pg_attribute (catalog table, no table-lock) to check existence first.
 * This avoids the ALTER TABLE ACCESS EXCLUSIVE lock that can hang when a prior
 * DDL on the same table is still queued on the DB server.
 */
async function ensureInsightSectionCompletionsColumn(): Promise<void> {
  if (_insightSectionCompletionsEnsured) return;
  try {
    // pg_attribute lookup — much faster than information_schema and does NOT
    // compete with table-level locks that block ALTER TABLE.
    const rows = await queryHelpers.queryAll<{ attname: string }>(
      `SELECT attname FROM pg_attribute
       WHERE attrelid = 'interview_insights'::regclass
         AND attname = 'section_completions'
         AND attnum > 0
         AND NOT attisdropped`,
      []
    );
    if (rows && rows.length > 0) {
      // Column already exists — no DDL needed.
      _insightSectionCompletionsEnsured = true;
      return;
    }
    // Column missing — add it (no IF NOT EXISTS: cleaner error if race condition).
    await queryHelpers.queryRun(
      `ALTER TABLE interview_insights ADD COLUMN section_completions TEXT`
    );
    _insightSectionCompletionsEnsured = true;
  } catch (err: any) {
    const m = String(err?.message || err).toLowerCase();
    if (m.includes('already exists') || m.includes('duplicate column')) {
      _insightSectionCompletionsEnsured = true;
      return;
    }
    throw err;
  }
}

// Module-level flag: true once we've confirmed section_overrides exists.
let _insightSectionOverridesEnsured = false;

/**
 * Lazy ALTER — dokłada kolumnę `section_overrides` (JSON w TEXT) do
 * `interview_insights`. Wzór 1:1 jak `ensureInsightSectionCompletionsColumn`:
 * sprawdzenie w `pg_attribute` (bez locka na tabelę), ALTER wyłącznie gdy
 * kolumny brak. Formalny zapis schematu żyje w migracji
 * `server/migrations/931_interview_insight_section_overrides.sql`.
 */
async function ensureInsightSectionOverridesColumn(): Promise<void> {
  if (_insightSectionOverridesEnsured) return;
  try {
    const rows = await queryHelpers.queryAll<{ attname: string }>(
      `SELECT attname FROM pg_attribute
       WHERE attrelid = 'interview_insights'::regclass
         AND attname = 'section_overrides'
         AND attnum > 0
         AND NOT attisdropped`,
      []
    );
    if (rows && rows.length > 0) {
      _insightSectionOverridesEnsured = true;
      return;
    }
    await queryHelpers.queryRun(`ALTER TABLE interview_insights ADD COLUMN section_overrides TEXT`);
    _insightSectionOverridesEnsured = true;
  } catch (err: any) {
    const m = String(err?.message || err).toLowerCase();
    if (m.includes('already exists') || m.includes('duplicate column')) {
      _insightSectionOverridesEnsured = true;
      return;
    }
    throw err;
  }
}

async function ensureInterviewQuestionTemplatesTable(): Promise<void> {
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS interview_question_templates (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      question_text TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_required INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  for (const template of DEFAULT_INTERVIEW_QUESTION_TEMPLATES) {
    await queryHelpers.queryRun(
      `INSERT INTO interview_question_templates
       (id, category, question_text, sort_order, is_required)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [
        template.id,
        template.category,
        template.questionText,
        template.sortOrder,
        template.isRequired,
      ]
    );
  }
}

async function ensureInterviewAssignmentAiReviewColumns(): Promise<void> {
  const cols = await getTableColumns('interview_assignments');
  if (!cols.has('ai_review_snapshot_json')) {
    await queryHelpers.queryRun(
      `ALTER TABLE interview_assignments ADD COLUMN ai_review_snapshot_json TEXT`
    );
  }
  if (!cols.has('ai_reviewed_at')) {
    await queryHelpers.queryRun(
      `ALTER TABLE interview_assignments ADD COLUMN ai_reviewed_at TIMESTAMP`
    );
  }
  if (!cols.has('review_decision_memory_json')) {
    await queryHelpers.queryRun(
      `ALTER TABLE interview_assignments ADD COLUMN review_decision_memory_json TEXT`
    );
  }
}

/**
 * Lazy-ensure lifecycle columns on interview_assignments (archive/restore).
 * DB_MANAGED_SCHEMA is off in dev, so we ADD COLUMN only when missing.
 * Escalation columns (escalated_at, escalation_count, escalate_to) are ensured by
 * InterviewAssignmentService.ensureSchemaCompatibility; we add only the archive pair here.
 */
async function ensureInterviewAssignmentLifecycleColumns(): Promise<void> {
  const cols = await getTableColumns('interview_assignments');
  const missingColumns: Array<{ name: string; sql: string }> = [
    {
      name: 'archived_at',
      sql: `ALTER TABLE interview_assignments ADD COLUMN archived_at TIMESTAMP`,
    },
    {
      name: 'archived_by',
      sql: `ALTER TABLE interview_assignments ADD COLUMN archived_by TEXT`,
    },
    // #50a — set TRUE only by the session-archive cascade in
    // applySessionLifecycleAction; read back on session-restore so we only
    // un-archive assignments the cascade itself archived (mirrors migration
    // 920_interview_assignment_archived_via_session.sql).
    {
      name: 'archived_via_session',
      sql: `ALTER TABLE interview_assignments ADD COLUMN archived_via_session BOOLEAN DEFAULT FALSE`,
    },
    // Defensive: ensure escalation columns exist even if the service path has not
    // run yet (additive, mirrors InterviewAssignmentService DDL names).
    {
      name: 'escalated_at',
      sql: `ALTER TABLE interview_assignments ADD COLUMN escalated_at TIMESTAMP`,
    },
    {
      name: 'escalation_count',
      sql: `ALTER TABLE interview_assignments ADD COLUMN escalation_count INTEGER DEFAULT 0`,
    },
    {
      name: 'escalate_to',
      sql: `ALTER TABLE interview_assignments ADD COLUMN escalate_to TEXT`,
    },
  ];

  for (const column of missingColumns) {
    if (!cols.has(column.name)) {
      try {
        await queryHelpers.queryRun(column.sql);
      } catch (err: any) {
        // Idempotent guard: getTableColumns() caches the column set per-process, so a
        // column added earlier in this process (or by another instance) is absent from the
        // cached set and we re-issue the ALTER. Postgres/SQLite then throw
        // "already exists"/"duplicate column" — safe to ignore; rethrow anything else.
        const m = String(err?.message || err).toLowerCase();
        if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
      }
    }
  }
}

/**
 * D18-A — Lazy-ensure `is_anonymous` on both interview_assignments and
 * interview_sessions (DB_MANAGED_SCHEMA off in dev). Canonical formal
 * migration: server/migrations/922_interview_anonymity_wall.sql (NOT
 * auto-applied — this runtime path is what makes dev/local work without it).
 * Default FALSE — zero behavior change for existing/non-anonymous surveys.
 */
async function ensureInterviewAnonymityColumns(): Promise<void> {
  const assignmentCols = await getTableColumns('interview_assignments');
  if (!assignmentCols.has('is_anonymous')) {
    try {
      await queryHelpers.queryRun(
        `ALTER TABLE interview_assignments ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE`
      );
    } catch (err: any) {
      const m = String(err?.message || err).toLowerCase();
      if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
    }
  }

  const sessionCols = await getTableColumns('interview_sessions');
  if (!sessionCols.has('is_anonymous')) {
    try {
      await queryHelpers.queryRun(
        `ALTER TABLE interview_sessions ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE`
      );
    } catch (err: any) {
      const m = String(err?.message || err).toLowerCase();
      if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
    }
  }
}

/**
 * D18-A hard wall — true when `row` (an interview_assignments or
 * interview_sessions row) is anonymous AND the requesting user is NOT the
 * respondent themselves. The respondent always sees their own full answers
 * (they need them to write/edit); anyone else gets the redacted view.
 */
const isAnonymityWallActive = (row: any, viewerUserId: string, ownerField: string): boolean =>
  flagOn(row?.is_anonymous) && String(row?.[ownerField] ?? '') !== String(viewerUserId ?? '');

/**
 * D18-A hard wall — strips every field on an AI review snapshot that could
 * quote or paraphrase a specific respondent's raw answer (feedback text,
 * per-criterion justification). Keeps everything that is a pure number/score
 * (overallScore, overallVerdict, rubric scores, rubricVersion/Criteria) plus
 * session-level recommendations, so the manager still sees the AI-score wall
 * — just never the underlying answer content or per-answer commentary.
 */
function redactAiReviewSnapshotForAnonymity(
  aiReview: InterviewAiReviewSnapshot | null | undefined
): InterviewAiReviewSnapshot | null {
  if (!aiReview) return aiReview ?? null;
  return {
    ...aiReview,
    questionEvaluations: (aiReview.questionEvaluations || []).map((qe: any) => ({
      questionId: qe.questionId,
      score: qe.score,
      verdict: qe.verdict,
      fixType: qe.fixType,
      rubricTotal: qe.rubricTotal,
      rubricMax: qe.rubricMax,
      rubric: Array.isArray(qe.rubric)
        ? qe.rubric.map((r: any) => ({
            criterion: r.criterion,
            label: r.label,
            score: r.score,
            maxScore: r.maxScore,
            // justification intentionally dropped — may quote the raw answer
            justification: '',
          }))
        : qe.rubric,
      // feedback intentionally dropped — same reason
      feedback: '',
    })),
    weakAnswerMap: (aiReview.weakAnswerMap || []).map((w: any) => ({
      key: w.key,
      label: w.label, // question text, not answer content — safe to keep
      questionId: w.questionId,
      score: w.score,
      verdict: w.verdict,
      fixType: w.fixType,
      isRequired: w.isRequired,
      rubric: Array.isArray(w.rubric)
        ? w.rubric.map((r: any) => ({
            criterion: r.criterion,
            label: r.label,
            score: r.score,
            maxScore: r.maxScore,
            justification: '',
          }))
        : w.rubric,
      // #48A — names a rubric criterion only (e.g. "Depth"), never quotes the
      // raw answer — safe to keep under the anonymity wall like rubric labels.
      depthHint: w.depthHint,
      // feedback intentionally dropped
      feedback: '',
    })),
  };
}

/**
 * #48B — lazy-create `interview_answer_history` (migration 923, NOT
 * auto-applied — mirrors 920's pattern). Runtime self-healing companion so
 * dev/DB_MANAGED_SCHEMA-off environments don't need the migration to be run
 * manually; TROLLEY/prod should still get 923 applied via
 * consultify-promocja-demo. CREATE TABLE IF NOT EXISTS is idempotent and
 * additive — safe to call on every sendBackAssignment / history read.
 */
async function ensureInterviewAnswerHistoryTable(): Promise<void> {
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS interview_answer_history (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      assignment_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer_text TEXT,
      reason TEXT NOT NULL DEFAULT 'send_back',
      saved_at TIMESTAMP NOT NULL,
      saved_by TEXT
    )`
  );
}

async function snapshotInterviewAnswers(params: {
  organizationId: string;
  assignmentId: string;
  sessionId: string;
  reason: 'submission' | 'send_back';
  savedAt: string;
  savedBy: string;
}): Promise<number> {
  await ensureInterviewAnswerHistoryTable();
  const answeredQuestions = await queryHelpers.queryAll(
    `SELECT id, answer_text FROM interview_questions
      WHERE session_id = ?
        AND organization_id = ?
        AND answer_text IS NOT NULL
        AND answer_text != ''`,
    [params.sessionId, params.organizationId]
  );

  for (const q of answeredQuestions || []) {
    await queryHelpers.queryRun(
      `INSERT INTO interview_answer_history
       (id, organization_id, assignment_id, session_id, question_id, answer_text, reason, saved_at, saved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        params.assignmentId,
        params.sessionId,
        (q as any).id,
        (q as any).answer_text,
        params.reason,
        params.savedAt,
        params.savedBy,
      ]
    );
  }
  return (answeredQuestions || []).length;
}

async function ensureInterviewAiSuggestionAuditTable(): Promise<void> {
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS interview_ai_suggestion_audit (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      generated_by TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'interview_question_ai_suggest',
      model_id TEXT NOT NULL,
      provider TEXT,
      prompt_version TEXT NOT NULL,
      suggested_answer_text TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      confidence_score INTEGER NOT NULL,
      decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'accepted', 'rejected')),
      final_answer_text TEXT,
      generated_at TIMESTAMP NOT NULL,
      decided_at TIMESTAMP,
      decided_by TEXT
    )`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_interview_ai_suggestion_question
       ON interview_ai_suggestion_audit(organization_id, question_id, generated_at DESC)`
  );
}

async function ensureInterviewTemplateV6Columns(): Promise<void> {
  const cols = await getTableColumns('interview_library_templates');
  const missingColumns: Array<{ name: string; sql: string }> = [
    {
      name: 'status',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN status TEXT DEFAULT 'draft'`,
    },
    {
      name: 'visibility',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN visibility TEXT DEFAULT 'org'`,
    },
    {
      name: 'template_scope',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN template_scope TEXT DEFAULT 'organization'`,
    },
    {
      name: 'audience',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN audience TEXT`,
    },
    {
      name: 'estimated_time_minutes',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN estimated_time_minutes INTEGER DEFAULT 10`,
    },
    {
      name: 'runtime_mode_default',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN runtime_mode_default TEXT DEFAULT 'one_question_per_screen'`,
    },
    {
      name: 'answer_design_guide',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN answer_design_guide TEXT`,
    },
    {
      name: 'area_tags',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN area_tags TEXT DEFAULT '[]'`,
    },
    {
      name: 'source_template_id',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN source_template_id TEXT`,
    },
    {
      name: 'language',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN language VARCHAR(5) DEFAULT 'en'`,
    },
    {
      name: 'is_default',
      sql: `ALTER TABLE interview_library_templates ADD COLUMN is_default INTEGER DEFAULT 0`,
    },
  ];

  for (const column of missingColumns) {
    if (!cols.has(column.name)) {
      try {
        await queryHelpers.queryRun(column.sql);
      } catch (err: any) {
        // Idempotent guard: getTableColumns() caches the column set per-process, so a
        // column added earlier in this process (or by another instance) is absent from the
        // cached set and we re-issue the ALTER. Postgres/SQLite then throw
        // "already exists"/"duplicate column" — safe to ignore; rethrow anything else.
        const m = String(err?.message || err).toLowerCase();
        if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
      }
    }
  }
}

async function ensureInterviewTemplateQuestionV6Columns(): Promise<void> {
  const cols = await getTableColumns('interview_library_template_questions');
  const missingColumns: Array<{ name: string; sql: string }> = [
    {
      name: 'description',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN description TEXT`,
    },
    {
      name: 'evidence_prompt',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN evidence_prompt TEXT`,
    },
    {
      name: 'answer_type',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN answer_type TEXT DEFAULT 'open'`,
    },
    {
      name: 'is_required',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN is_required INTEGER DEFAULT 0`,
    },
    {
      name: 'help_hint',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN help_hint TEXT`,
    },
    {
      name: 'answer_options',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN answer_options TEXT DEFAULT '[]'`,
    },
    {
      name: 'expected_answer_shape',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN expected_answer_shape TEXT`,
    },
    {
      name: 'allow_voice',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN allow_voice INTEGER DEFAULT 0`,
    },
    {
      name: 'allow_file_upload',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN allow_file_upload INTEGER DEFAULT 0`,
    },
    {
      name: 'allow_url',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN allow_url INTEGER DEFAULT 0`,
    },
    {
      name: 'allow_context_note',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN allow_context_note INTEGER DEFAULT 1`,
    },
    {
      name: 'section_title',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN section_title TEXT`,
    },
    {
      name: 'guidance',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN guidance TEXT`,
    },
    {
      name: 'example_answer',
      sql: `ALTER TABLE interview_library_template_questions ADD COLUMN example_answer TEXT`,
    },
  ];

  for (const column of missingColumns) {
    if (!cols.has(column.name)) {
      try {
        await queryHelpers.queryRun(column.sql);
      } catch (err: any) {
        // Idempotent guard: getTableColumns() caches the column set per-process, so a
        // column added earlier in this process (or by another instance) is absent from the
        // cached set and we re-issue the ALTER. Postgres/SQLite then throw
        // "already exists"/"duplicate column" — safe to ignore; rethrow anything else.
        const m = String(err?.message || err).toLowerCase();
        if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
      }
    }
  }
}

async function ingestInterviewTextArtifact(params: {
  organizationId: string;
  sourceType: string;
  title: string;
  content?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const content = String(params.content || '').trim();
  if (!content) return null;

  try {
    const pipeline = new IngestionPipeline();
    const result = await pipeline.ingestText(content, {
      title: params.title,
      organizationId: params.organizationId,
      sourceType: params.sourceType,
      metadata: params.metadata || {},
    });
    return result.documentId || null;
  } catch (error) {
    logger.warn(
      `[InterviewController] Knowledge ingestion skipped for ${params.sourceType}: ${String(
        (error as Error)?.message || error
      )}`
    );
    return null;
  }
}

async function resolveLinkedArtifact(
  organizationId: string,
  artifactType: string,
  artifactId: string
): Promise<{ title: string; status?: string; type: string } | null> {
  const tableMap: Record<string, { table: string; titleCol: string; statusCol?: string }> = {
    task: { table: 'tasks', titleCol: 'title', statusCol: 'status' },
    initiative: { table: 'initiatives', titleCol: 'name', statusCol: 'status' },
    decision: { table: 'decisions', titleCol: 'title', statusCol: 'status' },
    project: { table: 'projects', titleCol: 'name', statusCol: 'status' },
    assessment: { table: 'assessments', titleCol: 'name', statusCol: 'status' },
    report: { table: 'report_builder_reports', titleCol: 'title', statusCol: 'status' },
    presentation: { table: 'presentations', titleCol: 'title', statusCol: 'status' },
  };
  const config = tableMap[artifactType];
  if (!config) return null;
  try {
    const statusSelect = config.statusCol ? `, ${config.statusCol} as status` : '';
    const row = await queryHelpers.queryOne<any>(
      `SELECT id, ${config.titleCol} as title${statusSelect}
       FROM ${config.table}
       WHERE id = ? AND organization_id = ?
       LIMIT 1`,
      [artifactId, organizationId]
    );
    if (!row) return null;
    return {
      title: String(row.title || artifactId),
      status: row.status ? String(row.status) : undefined,
      type: artifactType,
    };
  } catch {
    return null;
  }
}

// Response builders
const buildSessionResponse = (row: any) => {
  if (!row) return null;
  const rawStatus = String(row.status || '').toLowerCase();
  const runtimeModeDefaultRaw = String(row.runtime_mode_default || '').toLowerCase();
  const runtimeModeDefault =
    runtimeModeDefaultRaw === 'task_list' ? 'task_list' : 'single_question';
  // DB legacy constraint uses: active | completed | paused
  // API contract uses: in_progress | completed | paused (+ derived states at assignment level)
  const normalizedStatus = rawStatus === 'active' ? 'in_progress' : rawStatus;
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id || undefined,
    name: row.name || 'Discovery Interview',
    ownerId: row.owner_id,
    status: normalizedStatus,
    templateId: row.template_id || undefined,
    templateVersion: row.template_version || undefined,
    assignmentId: row.assignment_id || undefined,
    progress: parseJson(row.progress_json, {}),
    totalQuestions: row.total_questions || 0,
    answeredQuestions: row.answered_questions || 0,
    summaryFacts: parseJson(row.summary_facts, []),
    summaryGaps: parseJson(row.summary_gaps, []),
    summaryConstraints: parseJson(row.summary_constraints, []),
    summaryPainPoints: parseJson(row.summary_pain_points, []),
    runtimeModeDefault,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastActivityAt: row.last_activity_at,
  };
};

const buildQuestionResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    category: row.category,
    questionText: row.question_text,
    answerText: row.answer_text || '',
    isRequired: row.is_required === 1,
    answerType: row.answer_type || 'open',
    answerOptions: parseJson(row.answer_options, []),
    expectedAnswerShape: row.expected_answer_shape || '',
    description: row.description || '',
    evidencePrompt: row.evidence_prompt || '',
    answerMode: row.answer_mode || (row.answer_text ? 'text' : 'empty'),
    answerPayload: parseJson(row.answer_payload, {}),
    contextNote: row.context_note || '',
    notes: row.context_note || '',
    voiceTranscript: row.voice_transcript || '',
    voiceTranscriptStatus: row.voice_transcript_status || 'none',
    voiceAudioEvidenceId: row.voice_audio_evidence_id || undefined,
    allowVoice: row.allow_voice === 1,
    allowFileUpload: row.allow_file_upload === 1,
    allowUrl: row.allow_url === 1,
    allowContextNote: row.allow_context_note !== 0,
    guidance: row.guidance || '',
    exampleAnswer: row.example_answer || '',
    answerKnowledgeDocId: row.answer_knowledge_doc_id || undefined,
    contextNoteKnowledgeDocId: row.context_note_knowledge_doc_id || undefined,
    status: row.status,
    confidenceScore: row.confidence_score || 0,
    answeredBy: row.answered_by,
    answeredAt: row.answered_at,
    tags: parseJson(row.tags, []),
    sortOrder: row.sort_order || 0,
    isTemplate: flagOn(row.is_template), // bigint on PG → coerce
    // INT-BVP-001 (6): exposed so a client can round-trip it back as
    // `expectedUpdatedAt` on the next PATCH for optimistic-concurrency (CAS).
    updatedAt: row.updated_at || undefined,
  };
};

const buildNoteResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    category: row.category,
    title: row.title,
    content: row.content,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const buildEvidenceResponse = (row: any) => {
  if (!row) return null;
  const ingestToKnowledge =
    typeof row.ingest_to_knowledge === 'boolean'
      ? row.ingest_to_knowledge
      : Number(row.ingest_to_knowledge || 0) !== 0;
  return {
    id: row.id,
    sessionId: row.session_id,
    questionId: row.question_id,
    category: row.category,
    evidenceType: row.evidence_type,
    evidenceRole: row.evidence_role || 'supporting',
    title: row.title,
    name: row.file_name || row.title,
    description: row.description,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    url: row.url,
    transcriptText: row.transcript_text || '',
    ingestToKnowledge,
    knowledgeDocumentId: row.knowledge_document_id || undefined,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    uploadedAt: row.created_at,
  };
};

/**
 * D18-A hard wall — strips the free-text answer content from a question
 * response, keeping only structural/progress fields (status, whether it was
 * answered, confidence self-rating, required/allow-* flags). Used when the
 * session is anonymous and the viewer is not the respondent.
 */
const redactQuestionResponseForAnonymity = (
  q: NonNullable<ReturnType<typeof buildQuestionResponse>>
) => ({
  ...q,
  answerText: '',
  answerPayload: {},
  contextNote: '',
  notes: '',
  voiceTranscript: '',
  voiceAudioEvidenceId: undefined,
});

/**
 * D18-A hard wall — strips free-text note content (manager-facing note reads
 * only see that a note exists, never its body) when the session is
 * anonymous and the viewer is not the respondent.
 */
const redactNoteResponseForAnonymity = (n: NonNullable<ReturnType<typeof buildNoteResponse>>) => ({
  ...n,
  content: '',
});

/**
 * D18-A hard wall — strips evidence transcript content for anonymous
 * sessions viewed by anyone other than the respondent.
 */
const redactEvidenceResponseForAnonymity = (
  e: NonNullable<ReturnType<typeof buildEvidenceResponse>>
) => ({
  ...e,
  transcriptText: '',
  filePath: '',
  url: '',
});

/**
 * Ensures evidence records exist for a question's text-based answer artifacts.
 * For each non-empty field (answer_text, voice_transcript, context_note),
 * creates an interview_evidence row if one doesn't already exist for that role.
 */
async function normalizeAnswerEvidence(
  questionId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  const question = (await queryHelpers.queryOne(
    `SELECT id, session_id, category, answer_text, voice_transcript, context_note
     FROM interview_questions WHERE id = ? AND organization_id = ?`,
    [questionId, organizationId]
  )) as {
    id: string;
    session_id: string;
    category: string;
    answer_text: string | null;
    voice_transcript: string | null;
    context_note: string | null;
  } | null;

  if (!question) return;

  await ensureInterviewEvidenceColumns();

  const roleMap: {
    field: 'answer_text' | 'voice_transcript' | 'context_note';
    evidenceRole: string;
    evidenceType: string;
    titlePrefix: string;
  }[] = [
    {
      field: 'answer_text',
      evidenceRole: 'answer_text',
      evidenceType: 'text',
      titlePrefix: 'Answer',
    },
    {
      field: 'voice_transcript',
      evidenceRole: 'voice_transcript',
      evidenceType: 'transcript',
      titlePrefix: 'Voice transcript',
    },
    {
      field: 'context_note',
      evidenceRole: 'context_note',
      evidenceType: 'note',
      titlePrefix: 'Context note',
    },
  ];

  for (const mapping of roleMap) {
    const content = String(question[mapping.field] || '').trim();
    if (!content) continue;

    const existing = await queryHelpers.queryOne(
      `SELECT id FROM interview_evidence
       WHERE question_id = ? AND evidence_role = ? AND organization_id = ?`,
      [questionId, mapping.evidenceRole, organizationId]
    );
    if (existing) continue;

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_evidence
       (id, session_id, organization_id, question_id, category, evidence_type, evidence_role,
        title, transcript_text, ingest_to_knowledge, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        question.session_id,
        organizationId,
        questionId,
        question.category || null,
        mapping.evidenceType,
        mapping.evidenceRole,
        `${mapping.titlePrefix} – Q ${questionId.slice(0, 8)}`,
        mapping.evidenceType === 'text' ? null : content,
        1,
        userId,
        now,
      ]
    );

    const knowledgeDocumentId = await ingestInterviewTextArtifact({
      organizationId,
      sourceType: 'interview_evidence',
      title: `${mapping.titlePrefix} – Q ${questionId.slice(0, 8)}`,
      content,
      metadata: {
        evidenceId: id,
        sessionId: question.session_id,
        questionId,
        category: question.category || null,
        evidenceType: mapping.evidenceType,
        evidenceRole: mapping.evidenceRole,
      },
    });

    if (knowledgeDocumentId) {
      await queryHelpers.queryRun(
        `UPDATE interview_evidence SET knowledge_document_id = ? WHERE id = ?`,
        [knowledgeDocumentId, id]
      );

      // D02: Update question's knowledge doc reference based on evidence role
      const questionKnowledgeCol =
        mapping.evidenceRole === 'context_note'
          ? 'context_note_knowledge_doc_id'
          : 'answer_knowledge_doc_id';
      await queryHelpers.queryRun(
        `UPDATE interview_questions SET ${questionKnowledgeCol} = COALESCE(${questionKnowledgeCol}, ?) WHERE id = ?`,
        [knowledgeDocumentId, questionId]
      );
    }

    // D03: Link graph edge — evidence → question
    try {
      const lgCols = await getTableColumns('link_graph_edges');
      if (lgCols && lgCols.size > 0) {
        await queryHelpers.queryRun(
          `INSERT OR IGNORE INTO link_graph_edges
           (id, organization_id, source_type, source_id, target_type, target_id, relation, container_type, container_id, created_by, created_at)
           VALUES (?, ?, 'interview_evidence', ?, 'interview_question', ?, 'ref', 'interview_session', ?, ?, ?)`,
          [uuidv4(), organizationId, id, questionId, question.session_id, userId, now]
        );
      }
    } catch (e) {
      logger.warn(
        `[InterviewController] Link graph edge (evidence→question) skipped: ${String((e as Error)?.message || e)}`
      );
    }
  }
}

// Template response builders (Interview templates library)
const buildTemplateResponse = (row: any) => {
  if (!row) return null;
  const scope = resolveTemplateScopeFromRow(row);
  const resolvedVisibility =
    row.visibility || (scope === 'system' ? 'global' : scope === 'private' ? 'admin_only' : 'org');
  return {
    id: row.id,
    organizationId: row.organization_id || undefined,
    name: row.name,
    description: row.description || '',
    questionCount: Number(row.question_count ?? 0),
    category: typeof row.category === 'string' ? row.category.toLowerCase() : row.category,
    // M03R-002: kolumna jest TEXT ('0' | 'false' | 'true'), więc porównanie do
    // liczby zwracało `false` dla KAŻDEGO szablonu, także realnie domyślnego.
    isDefault: isTruthyFlag(row.is_default),
    scope,
    visibility: resolvedVisibility,
    audience: row.audience || '',
    estimatedTimeMinutes: row.estimated_time_minutes ?? 10,
    runtimeModeDefault: row.runtime_mode_default || 'one_question_per_screen',
    answerDesignGuide: row.answer_design_guide || '',
    areaTags: normalizeTemplateAreaTags(parseJson(row.area_tags, [] as string[])),
    status: row.status || 'approved',
    version: Number(row.version ?? 0),
    sessionsUsed: Number(row.sessions_used ?? 0),
    createdBy: row.created_by || undefined,
    updatedAt: row.updated_at || row.created_at,
    sourceTemplateId: row.source_template_id || undefined,
    language: row.language || 'en',
    createdAt: row.created_at,
  };
};

const buildTemplateQuestionResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    templateId: row.template_id,
    category: row.category,
    questionText: row.question_text,
    sortOrder: row.sort_order || 0,
    answerType: row.answer_type || 'open',
    isRequired: flagOn(row.is_required), // interview_question_templates.is_required is bigint on PG
    sectionTitle: row.section_title || null,
    helpHint: row.help_hint || null,
    answerOptions: parseJson(row.answer_options, [] as unknown[]),
    expectedAnswerShape: row.expected_answer_shape || '',
    description: row.description || '',
    evidencePrompt: row.evidence_prompt || '',
    allowVoice: row.allow_voice === 1,
    allowFileUpload: row.allow_file_upload === 1,
    allowUrl: row.allow_url === 1,
    allowContextNote: row.allow_context_note !== 0,
    guidance: row.guidance || '',
    exampleAnswer: row.example_answer || '',
  };
};

async function resolveValidProjectId(params: {
  organizationId: string;
  projectId?: string | null;
}): Promise<string | null> {
  const { organizationId } = params;
  const raw = String(params.projectId || '').trim();
  if (raw) {
    try {
      const p = await queryHelpers.withPgTransaction(async (tx) => {
        const result = await tx.query(
          `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
          [raw, organizationId]
        );
        return result.rows[0] as { id?: string } | undefined;
      });
      if (p?.id) return String(p.id);
    } catch {
      // ignore; fallback below
    }
  }
  // Fallback to first project in org (prevents SQLITE_CONSTRAINT on NOT NULL/FK)
  let first: any;
  try {
    first = await queryHelpers.withPgTransaction(async (tx) => {
      const result = await tx.query(
        `SELECT id FROM projects WHERE organization_id = ? ORDER BY created_at ASC LIMIT 1`,
        [organizationId]
      );
      return result.rows[0];
    });
  } catch {
    try {
      first = await queryHelpers.queryOne(
        `SELECT id FROM projects WHERE organization_id = ? ORDER BY id ASC LIMIT 1`,
        [organizationId]
      );
    } catch {
      return null;
    }
  }
  return first?.id ? String(first.id) : null;
}

async function createSessionFromTemplate(params: {
  user: any;
  templateId: string;
  projectId?: string;
  name?: string;
  assignmentId?: string;
}): Promise<any> {
  const { user, templateId, projectId, name: rawName, assignmentId } = params;
  // F15 (data-integrity, continuation of Z139): decode HTML entities the
  // global input-sanitization middleware escaped on this field before
  // storing interview_sessions.name.
  const name = typeof rawName === 'string' ? decodeHtmlEntities(rawName) : rawName;

  const template = await queryHelpers.withPgTransaction(async (tx) => {
    const result = await tx.query(`SELECT * FROM interview_library_templates WHERE id = ?`, [
      templateId,
    ]);
    return result.rows[0] as any;
  });

  if (!template) throw new Error('Template not found');
  if (!canAccessTemplate(template, user)) {
    throw new Error('Permission denied');
  }

  // Minimal visibility guard
  if (template.visibility === 'admin_only' && !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
    throw new Error('Permission denied');
  }

  // Only approved templates can be used to create sessions
  if (String(template.status || '').toLowerCase() !== 'approved') {
    throw new Error('Template is not approved yet');
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  await ensureInterviewSessionV6Columns();
  await ensureInterviewQuestionV6Columns();
  await ensureInterviewAnonymityColumns();
  const resolvedProjectId = await resolveValidProjectId({
    organizationId: user.organizationId,
    projectId,
  });
  if (!resolvedProjectId) {
    throw new Error('Project not found');
  }

  // D18-A — mirror the assignment's anonymity flag onto the session at
  // creation time so session-scoped reads (getQuestions/getNotes/getEvidence/
  // getSummary) can check it directly without an extra JOIN back to
  // interview_assignments on every request.
  let sessionIsAnonymous = false;
  if (assignmentId) {
    const assignmentRow = await queryHelpers.queryOne(
      `SELECT is_anonymous FROM interview_assignments WHERE id = ?`,
      [assignmentId]
    );
    sessionIsAnonymous = flagOn((assignmentRow as any)?.is_anonymous);
  }

  const publishedSnapshot = await getPublishedInterviewTemplateSnapshot(
    user.organizationId,
    template.id,
    Number(template.version || 1)
  );
  const templateQuestions = publishedSnapshot
    ? publishedSnapshot.questions
    : await queryHelpers.queryAll(
        `SELECT * FROM interview_library_template_questions WHERE template_id = ? ORDER BY category, sort_order`,
        [template.id]
      );

  const session = await queryHelpers.withPgTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO interview_sessions
       (id, organization_id, project_id, name, owner_id, status, progress_json,
        runtime_mode_default, template_id, template_version, assignment_id, is_anonymous,
        started_at, last_activity_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        user.organizationId,
        resolvedProjectId,
        name || `Interview ${new Date().toLocaleDateString()}`,
        user.id,
        'active',
        JSON.stringify({ strategy: 0, operations: 0, digital: 0, people: 0, finance: 0 }),
        String(template.runtime_mode_default || '').toLowerCase() === 'task_list'
          ? 'task_list'
          : 'single_question',
        template.id,
        template.version || 1,
        assignmentId || null,
        sessionIsAnonymous,
        now,
        now,
        now,
        now,
      ]
    );

    for (const tq of templateQuestions as any[]) {
      await tx.query(
        `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, description, evidence_prompt,
          status, sort_order, is_template, is_required, answer_type, answer_options,
          expected_answer_shape, allow_voice, allow_file_upload, allow_url, allow_context_note,
          source_template_question_id, guidance, example_answer, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          id,
          user.organizationId,
          tq.category,
          // M03R-007: artefakt `$NN` nie ma prawa wejść do treści pytania sesji.
          sanitizeQuestionText(tq.question_text),
          tq.description || null,
          tq.evidence_prompt || null,
          'not_started',
          tq.sort_order,
          true,
          toDbFlag(tq.is_required, 0),
          tq.answer_type || 'open',
          tq.answer_options || '[]',
          tq.expected_answer_shape || null,
          toDbFlag(tq.allow_voice, 0),
          toDbFlag(tq.allow_file_upload, 0),
          toDbFlag(tq.allow_url, 0),
          toDbFlag(tq.allow_context_note, 1),
          tq.id,
          tq.guidance || null,
          tq.example_answer || null,
          now,
          now,
        ]
      );
    }
    await tx.query(`UPDATE interview_sessions SET total_questions = ? WHERE id = ?`, [
      templateQuestions.length,
      id,
    ]);
    return (await tx.query(`SELECT * FROM interview_sessions WHERE id = ?`, [id])).rows[0];
  });
  return buildSessionResponse(session);
}

// ==========================================
// ASSIGNMENTS HELPERS
// ==========================================

// A submitted interview is a review artefact, not an editable draft. The
// reviewer must explicitly send it back before answers, notes or evidence can
// change.
const LOCKED_SESSION_STATUSES = ['submitted', 'completed'] as const;

const calcCompletenessRatio = (answered: number, total: number): number => {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(1, answered / total));
};

const isLockedSessionStatus = (status?: string): boolean => {
  const s = String(status || '').toLowerCase();
  return (LOCKED_SESSION_STATUSES as unknown as string[]).includes(s);
};

const normalizeAssignmentStatusForClient = (status?: string): string => {
  // V-A S5 — pass `sent_back` through. It was previously remapped to
  // `in_progress`, which hid send-back round-trips entirely: the rose
  // "Sent back" chip never rendered and the sent_back count/filter was
  // permanently 0, so a manager couldn't see which submissions they'd
  // bounced back. The frontend AssignmentStatus union already includes
  // 'sent_back' and has a chip for it.
  return String(status || '').toLowerCase();
};

const toDbFlag = (value: unknown, fallback = 0): number => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value > 0 ? 1 : 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback ? 1 : 0;
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return 1;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return 0;
  }
  return fallback ? 1 : 0;
};

async function assertSessionEditable(sessionId: string, organizationId: string): Promise<any> {
  let session: any;
  try {
    session = await queryHelpers.queryOne(
      `SELECT
         s.id,
         s.status,
         s.owner_id as owner_id
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [sessionId, organizationId, organizationId]
    );
  } catch {
    session = await queryHelpers.queryOne(
      `SELECT
         s.id,
         s.status,
         s.user_id as owner_id
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [sessionId, organizationId, organizationId]
    );
  }
  if (!session) throw new Error('Session not found');
  if (isLockedSessionStatus((session as any).status)) throw new Error('Session is locked');
  return session;
}

async function canUserAccessSession(params: {
  sessionId: string;
  organizationId: string;
  userId: string;
  userRole?: string | null;
}): Promise<boolean> {
  const { sessionId, organizationId, userId, userRole } = params;

  let base: any = null;
  try {
    base = await queryHelpers.queryOne(
      `SELECT
         s.id,
         s.assignment_id,
         s.owner_id as owner_id,
         s.is_anonymous
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [sessionId, organizationId, organizationId]
    );
  } catch {
    base = await queryHelpers.queryOne(
      `SELECT
         s.id,
         s.assignment_id,
         s.user_id as owner_id,
         s.is_anonymous
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [sessionId, organizationId, organizationId]
    );
  }

  if (!base) return false;
  if (String((base as any).owner_id) === String(userId)) return true;

  // The row above is already tenant-scoped. Organization owners/admins may
  // read an identified interview in their organization, but anonymous
  // sessions remain respondent-only. `is_anonymous` is read in the same
  // tenant-scoped query, so a DB/schema failure cannot fall open.
  const elevatedRoles = new Set(['OWNER', 'ADMIN', 'ADMINISTRATOR', 'SUPERADMIN']);
  if (
    userRole &&
    elevatedRoles.has(String(userRole).toUpperCase()) &&
    !flagOn((base as any).is_anonymous)
  ) {
    return true;
  }

  const assignmentId = (base as any).assignment_id ? String((base as any).assignment_id) : '';
  if (!assignmentId) return false;

  // Primary assignee can always access
  try {
    const a = await queryHelpers.queryOne(
      `SELECT assignee_user_id FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [assignmentId, organizationId]
    );
    if (String((a as any)?.assignee_user_id || '') === String(userId)) return true;
  } catch {
    // ignore
  }

  // Team member access (table may not exist in all envs)
  try {
    const member = await queryHelpers.queryOne(
      `SELECT id FROM interview_assignment_members WHERE assignment_id = ? AND user_id = ?`,
      [assignmentId, userId]
    );
    return Boolean(member?.id);
  } catch {
    return false;
  }
}

async function assertSessionAccessibleOrThrow(params: {
  sessionId: string;
  organizationId: string;
  userId: string;
  userRole?: string | null;
}): Promise<void> {
  const { sessionId, organizationId, userId, userRole } = params;
  const ok = await canUserAccessSession({ sessionId, organizationId, userId, userRole });
  if (ok) return;

  // Differentiate "not found" from "forbidden" for read endpoints.
  let exists: any = null;
  try {
    exists = await queryHelpers.queryOne(
      `SELECT s.id
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [sessionId, organizationId, organizationId]
    );
  } catch {
    exists = null;
  }

  if (!exists?.id) throw new Error('Session not found');
  throw new Error('Forbidden');
}

async function assertSessionOwnedByUser(
  sessionId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  const ok = await canUserAccessSession({ sessionId, organizationId, userId });
  if (!ok) throw new Error('Forbidden');
}

async function getAssignmentForSession(
  sessionId: string,
  organizationId: string
): Promise<any | null> {
  const row = await queryHelpers.queryOne(
    `SELECT * FROM interview_assignments WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId]
  );
  return row || null;
}

async function ensureInterviewInsightActivityTable(): Promise<void> {
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS interview_insight_activity (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      insight_id TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      user_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_interview_insight_activity_org ON interview_insight_activity(organization_id)`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_interview_insight_activity_insight ON interview_insight_activity(insight_id)`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_interview_insight_activity_created ON interview_insight_activity(created_at DESC)`
  );
}

async function logInterviewInsightActivity(params: {
  organizationId: string;
  insightId: string;
  type: string;
  description: string;
  userId?: string;
}): Promise<void> {
  const { organizationId, insightId, type, description, userId } = params;
  try {
    await ensureInterviewInsightActivityTable();
    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_activity (id, organization_id, insight_id, type, description, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        organizationId,
        insightId,
        type,
        description,
        userId || null,
        new Date().toISOString(),
      ]
    );
  } catch (e) {
    logger.warn('[InterviewController] Failed to log interview insight activity', e);
  }
}

/**
 * Org-scoped interview session reads — shared by legacy GET /interview/sessions|sessions/:id and the V8 read bridge.
 */
export async function loadInterviewSessionsForOrganization(
  organizationId: string,
  status?: unknown
): Promise<NonNullable<ReturnType<typeof buildSessionResponse>>[]> {
  let query = `
      SELECT s.*
      FROM interview_sessions s
      LEFT JOIN projects p ON p.id = s.project_id
      WHERE (
        p.organization_id = ?
        OR (s.project_id IS NULL AND s.organization_id = ?)
      )
    `;
  const params: unknown[] = [organizationId, organizationId];

  if (status) {
    const normalized =
      String(status).toLowerCase() === 'in_progress' ? 'active' : String(status).toLowerCase();
    // M03R-004: compatibility read — `COMPLETED` obok `completed` w danych.
    query += ` AND ${statusEqualsSql('s.status')}`;
    params.push(normalized);
  }

  query += ` ORDER BY s.started_at DESC`;

  const rows = await queryHelpers.queryAll(query, params);
  return rows.map((row: any) => buildSessionResponse(row)).filter(Boolean) as NonNullable<
    ReturnType<typeof buildSessionResponse>
  >[];
}

export async function loadInterviewSessionForOrganization(
  organizationId: string,
  sessionId: string
): Promise<NonNullable<ReturnType<typeof buildSessionResponse>> | null> {
  const row = await queryHelpers.queryOne(
    `SELECT s.*
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
    [sessionId, organizationId, organizationId]
  );
  if (!row) return null;
  return buildSessionResponse(row);
}

export async function loadAcceptedInterviewSessionsForManager(
  organizationId: string,
  userId: string
): Promise<
  Array<{
    id: string;
    name: string;
    templateId?: string;
    templateName?: string;
    templateCategory?: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    respondentId?: string;
    respondentName?: string;
    answeredQuestions: number;
    totalQuestions: number;
  }>
> {
  const rows = await queryHelpers.queryAll(
    `SELECT
       s.id, s.name as name, s.template_id, s.status, s.started_at, s.completed_at, s.owner_id, s.is_anonymous,
       s.answered_questions, s.total_questions,
       t.name as template_name, t.category as template_category,
       COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') as respondent_name
     FROM interview_sessions s
     INNER JOIN interview_assignments a
       ON a.session_id = s.id
       AND a.organization_id = ?
       AND a.created_by = ?
       AND a.status IN ('approved', 'completed')
     LEFT JOIN projects p ON p.id = s.project_id
     LEFT JOIN interview_library_templates t ON t.id = s.template_id
     LEFT JOIN users u ON u.id = s.owner_id
     WHERE (
       p.organization_id = ?
       OR (s.project_id IS NULL AND s.organization_id = ?)
     )
     AND lower(s.status) = 'completed'
     ORDER BY s.completed_at DESC`,
    [organizationId, userId, organizationId, organizationId]
  );

  // D18-A hard wall — this loader is joined on `a.created_by = userId`, so the
  // caller is always the manager who created the assignment, never the
  // respondent. Anonymize identity for any anonymous session.
  return (rows || []).map((row: any) => {
    const isAnon = flagOn(row.is_anonymous);
    return {
      id: row.id,
      name: row.name,
      templateId: row.template_id || undefined,
      templateName: row.template_name || undefined,
      templateCategory: row.template_category || undefined,
      status: row.status,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
      respondentId: isAnon ? undefined : row.owner_id || undefined,
      respondentName: isAnon
        ? 'Anonymous respondent'
        : String(row.respondent_name || '').trim() || undefined,
      answeredQuestions: row.answered_questions || 0,
      totalQuestions: row.total_questions || 0,
    };
  });
}

export type InterviewSessionLifecycle = 'active' | 'archived' | 'trash' | 'all';

/**
 * Build a SQL fragment (with leading AND) that filters interview_sessions rows by
 * their archive/trash lifecycle. `sessionAlias` is the table alias used in the query.
 * - active   → not archived AND not trashed (default list)
 * - archived → archived AND not trashed
 * - trash    → trashed (regardless of archived)
 * - all      → no filter
 */
function buildSessionLifecycleClause(
  lifecycle: InterviewSessionLifecycle | undefined,
  sessionAlias: string
): string {
  const a = sessionAlias;
  switch (lifecycle) {
    case 'archived':
      return ` AND ${a}.archived_at IS NOT NULL AND ${a}.trashed_at IS NULL`;
    case 'trash':
      return ` AND ${a}.trashed_at IS NOT NULL`;
    case 'all':
      return '';
    case 'active':
    default:
      return ` AND ${a}.archived_at IS NULL AND ${a}.trashed_at IS NULL`;
  }
}

function normalizeSessionLifecycleParam(raw: unknown): InterviewSessionLifecycle {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'archived' || value === 'trash' || value === 'all' || value === 'active') {
    return value;
  }
  return 'active';
}

/**
 * Assignment lifecycle (archive only — assignments have no trash bin).
 * - active   → not archived (default list)
 * - archived → archived only
 * - all      → no filter
 */
export type InterviewAssignmentLifecycle = 'active' | 'archived' | 'all';

function buildAssignmentLifecycleClause(
  lifecycle: InterviewAssignmentLifecycle | undefined,
  assignmentAlias: string
): string {
  const a = assignmentAlias;
  switch (lifecycle) {
    case 'archived':
      return ` AND ${a}.archived_at IS NOT NULL`;
    case 'all':
      return '';
    case 'active':
    default:
      return ` AND ${a}.archived_at IS NULL`;
  }
}

function normalizeAssignmentLifecycleParam(raw: unknown): InterviewAssignmentLifecycle {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'archived' || value === 'all' || value === 'active') {
    return value;
  }
  return 'active';
}

export async function loadManagedInterviewSessionsForManager(
  organizationId: string,
  userId: string,
  options?: {
    elevated?: boolean;
    scope?: InterviewManagerScope;
    lifecycle?: InterviewSessionLifecycle;
  }
): Promise<
  Array<{
    id: string;
    organizationId: string;
    projectId?: string;
    name: string;
    ownerId: string;
    status: string;
    sessionRuntimeStatus?: string;
    assignmentId?: string;
    assignmentStatus?: string;
    assignmentPriority?: string;
    assignmentCreatedBy?: string;
    totalQuestions: number;
    answeredQuestions: number;
    startedAt: string;
    completedAt?: string;
    lastActivityAt?: string;
    templateId?: string;
    templateName?: string;
    templateCategory?: string;
    respondentId?: string;
    respondentName?: string;
    assigneeId?: string;
    assigneeName?: string;
    assigneeEmail?: string;
    dueAt?: string;
    submittedAt?: string;
    sentBackAt?: string;
    sentBackReason?: string;
  }>
> {
  // Ensure lifecycle columns exist before filtering on them (lazy ALTER, dev schema).
  await ensureInterviewSessionLifecycleColumns();

  const lifecycle = options?.lifecycle || 'active';
  const lifecycleClause = buildSessionLifecycleClause(lifecycle, 's');

  const scope =
    options?.scope ||
    (options?.elevated ? { kind: 'organization' } : { kind: 'creator', creatorId: userId });
  const scopeClause = buildSessionManagerScopeClause(scope, {
    assignmentAlias: 'a',
    sessionProjectColumn: 's.project_id',
  });
  const params: unknown[] = [organizationId, ...scopeClause.params, organizationId, organizationId];

  const rows = await queryHelpers.queryAll(
    `SELECT
       s.id,
       COALESCE(s.organization_id, a.organization_id) as organization_id,
       s.project_id,
       s.name,
       s.owner_id,
       s.is_anonymous,
       s.status as session_runtime_status,
       s.template_id,
       s.started_at,
       s.completed_at,
       s.last_activity_at,
       s.answered_questions,
       s.total_questions,
       a.id as assignment_id,
       a.status as assignment_status,
       a.priority as assignment_priority,
       a.created_by as assignment_created_by,
       a.due_at,
       a.submitted_at,
       a.sent_back_at,
       a.sent_back_reason,
       t.name as template_name,
       t.category as template_category,
       COALESCE(owner_u.first_name, '') || ' ' || COALESCE(owner_u.last_name, '') as respondent_name,
       a.assignee_user_id as assignee_id,
       COALESCE(assignee_u.first_name, '') || ' ' || COALESCE(assignee_u.last_name, '') as assignee_name,
       assignee_u.email as assignee_email
     FROM interview_assignments a
     INNER JOIN interview_sessions s ON s.id = a.session_id
     LEFT JOIN projects p ON p.id = s.project_id
     LEFT JOIN interview_library_templates t ON t.id = s.template_id
     LEFT JOIN users owner_u ON owner_u.id = s.owner_id
     LEFT JOIN users assignee_u ON assignee_u.id = a.assignee_user_id
     WHERE a.organization_id = ?
       ${scopeClause.clause}
       AND a.status IN ('in_progress', 'submitted', 'sent_back', 'approved', 'completed')
       AND (
         p.organization_id = ?
         OR (s.project_id IS NULL AND s.organization_id = ?)
       )
       ${lifecycleClause}
     ORDER BY
       CASE a.status
         WHEN 'submitted' THEN 0
         WHEN 'in_progress' THEN 1
         WHEN 'sent_back' THEN 1
         WHEN 'approved' THEN 2
         WHEN 'completed' THEN 3
         ELSE 5
       END,
       COALESCE(a.submitted_at, a.sent_back_at, s.last_activity_at, s.started_at) DESC`,
    params
  );

  // D18-A hard wall — this is the manager's "managed sessions" list. The
  // caller can coincide with the respondent only in edge cases (e.g. a
  // manager reviewing their own ad-hoc-turned-assigned session), so still
  // check ownership rather than assuming "always someone else".
  const managed = (rows || []).map((row: any) => {
    const wallActive = isAnonymityWallActive(row, userId, 'owner_id');
    return {
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id || undefined,
      name: row.name || 'Discovery Interview',
      ownerId: row.owner_id,
      status: normalizeAssignmentStatusForClient(row.assignment_status || 'in_progress'),
      sessionRuntimeStatus: row.session_runtime_status || undefined,
      assignmentId: row.assignment_id || undefined,
      assignmentStatus: normalizeAssignmentStatusForClient(row.assignment_status || undefined),
      assignmentPriority: row.assignment_priority || undefined,
      assignmentCreatedBy: row.assignment_created_by || undefined,
      totalQuestions: row.total_questions || 0,
      answeredQuestions: row.answered_questions || 0,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      lastActivityAt: row.last_activity_at || undefined,
      templateId: row.template_id || undefined,
      templateName: row.template_name || undefined,
      templateCategory: row.template_category || undefined,
      respondentId: wallActive ? undefined : row.owner_id || undefined,
      respondentName: wallActive
        ? 'Anonymous respondent'
        : String(row.respondent_name || '').trim() || undefined,
      // For a single (non-team) assignment, assignee === respondent — leaving
      // the assignee name visible here would silently undo the anonymization
      // above, so it gets the same treatment.
      assigneeId: wallActive ? undefined : row.assignee_id || undefined,
      assigneeName: wallActive
        ? 'Anonymous respondent'
        : String(row.assignee_name || '').trim() || undefined,
      assigneeEmail: wallActive ? undefined : row.assignee_email || undefined,
      dueAt: row.due_at || undefined,
      submittedAt: row.submitted_at || undefined,
      sentBackAt: row.sent_back_at || undefined,
      sentBackReason: row.sent_back_reason || undefined,
    };
  });

  // V-A — include the caller's own ad-hoc sessions (created via the Sessions-tab
  // "New session" CTA with no template/assignment). The managed query above
  // INNER JOINs interview_assignments, so an assignment-less session would
  // vanish on reload — the user creates a session and it disappears. This
  // second query appends sessions owned by the caller that have NO assignment
  // row. The managed query is left untouched (zero regression to its scope
  // semantics); the two result sets can't overlap (ad-hoc = no assignment).
  let ownedAdHoc: typeof managed = [];
  try {
    const ownedRows = await queryHelpers.queryAll(
      `SELECT
         s.id,
         s.organization_id,
         s.project_id,
         s.name,
         s.owner_id,
         s.status as session_runtime_status,
         s.template_id,
         s.started_at,
         s.completed_at,
         s.last_activity_at,
         s.answered_questions,
         s.total_questions,
         t.name as template_name,
         t.category as template_category,
         TRIM(COALESCE(owner_u.first_name, '') || ' ' || COALESCE(owner_u.last_name, '')) as respondent_name
       FROM interview_sessions s
       LEFT JOIN interview_library_templates t ON t.id = s.template_id
       LEFT JOIN users owner_u ON owner_u.id = s.owner_id
       WHERE s.organization_id = ?
         AND s.owner_id = ?
         AND NOT EXISTS (SELECT 1 FROM interview_assignments a WHERE a.session_id = s.id)
         ${lifecycleClause}
       ORDER BY COALESCE(s.last_activity_at, s.started_at) DESC`,
      [organizationId, userId]
    );
    ownedAdHoc = (ownedRows || []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id || undefined,
      name: row.name || 'Discovery Interview',
      ownerId: row.owner_id,
      status: String(row.session_runtime_status || 'in_progress'),
      sessionRuntimeStatus: row.session_runtime_status || undefined,
      assignmentId: undefined,
      assignmentStatus: undefined as string | undefined,
      assignmentPriority: undefined,
      assignmentCreatedBy: undefined,
      totalQuestions: row.total_questions || 0,
      answeredQuestions: row.answered_questions || 0,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      lastActivityAt: row.last_activity_at || undefined,
      templateId: row.template_id || undefined,
      templateName: row.template_name || undefined,
      templateCategory: row.template_category || undefined,
      respondentId: row.owner_id || undefined,
      respondentName: String(row.respondent_name || '').trim() || undefined,
      assigneeId: undefined,
      assigneeName: undefined,
      assigneeEmail: undefined,
      dueAt: undefined,
      submittedAt: undefined,
      sentBackAt: undefined,
      sentBackReason: undefined,
    })) as typeof managed;
  } catch {
    /* ad-hoc augmentation is best-effort; managed list is the floor */
  }

  // Dedupe defensively (no overlap expected) and surface ad-hoc sessions first
  // so a just-created one is visible at the top.
  const seen = new Set(managed.map((m) => m.id));
  const merged = [...ownedAdHoc.filter((s) => !seen.has(s.id)), ...managed];
  return merged;
}

// INT-BVP-001 (2): the AI review endpoint had no server-side bound at all —
// only the client raced it against a 12s timer and gave up, while the
// request (and the provider call behind it) kept running unbounded. Default
// picked to sit above the client's 12s soft-timeout (so the common case
// still returns a real result before the client gives up) while still
// guaranteeing the HTTP request itself cannot hang indefinitely. Env-
// overridable for ops tuning without a redeploy; hardcoded default keeps the
// bound defined even when the env var is unset/misconfigured.
const INTERVIEW_AI_REVIEW_TIMEOUT_MS = (() => {
  const raw = Number(process.env.INTERVIEW_AI_REVIEW_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 20000;
})();

async function evaluateInterviewSessionAnswers(params: {
  session: { id?: string; name?: string };
  questions: any[];
  language?: unknown;
  timeoutMs?: number;
}): Promise<InterviewAiReviewSnapshot> {
  const { session, questions } = params;
  const langCode: 'pl' | 'en' = params.language === 'pl' ? 'pl' : 'en';
  if (!questions || questions.length === 0) {
    return {
      overallScore: 0,
      overallVerdict: 'empty',
      questionEvaluations: [],
      recommendations: [],
      weakAnswerMap: [],
      rubricVersion: INTERVIEW_RUBRIC_VERSION,
      rubricCriteria: INTERVIEW_RUBRIC_CRITERIA.map((c) => ({
        key: c.key,
        label: langCode === 'pl' ? c.labelPl : c.labelEn,
        description: langCode === 'pl' ? c.descriptionPl : c.descriptionEn,
        maxScore: INTERVIEW_RUBRIC_MAX_PER_CRITERION,
      })),
    };
  }

  const lang = langCode === 'pl' ? 'Polish' : 'English';

  // #48a — Deterministic split: questions with no answer never go to the LLM
  // at all (there is nothing to judge), they are scored 0/unanswered in code.
  // Only answered questions are sent for rubric evaluation.
  const answeredQuestions = (questions as any[]).filter(
    (q) => canonicalStatusToken(q.status) === 'answered' && String(q.answer_text || '').trim().length > 0
  );

  const criterionKeys = INTERVIEW_RUBRIC_CRITERIA.map((c) => c.key) as [string, ...string[]];
  const RubricCriterionSchema = z.object({
    criterion: z.enum(criterionKeys),
    score: z.number().int().min(0).max(INTERVIEW_RUBRIC_MAX_PER_CRITERION),
    justification: z.string(),
  });
  const EvalSchema = z.object({
    questionEvaluations: z.array(
      z.object({
        questionId: z.string(),
        rubric: z.array(RubricCriterionSchema).length(INTERVIEW_RUBRIC_CRITERIA.length),
        feedback: z.string(),
        fixType: z
          .enum([
            'clarify',
            'add_evidence',
            'expand_answer',
            'make_specific',
            'complete_required_fields',
            'correct_meaning',
          ])
          // Strict structured-output providers require every object property
          // to be present in `required`. `optional()` produces a schema the
          // provider rejects before inference; `null` is the explicit
          // no-remediation value and is normalized by the read side below.
          .nullable(),
      })
    ),
    recommendations: z.array(z.string()),
  });

  let llmEvaluations: Array<{
    questionId: string;
    rubric?: Array<{ criterion?: unknown; score?: unknown; justification?: unknown }>;
    feedback?: string;
    fixType?: InterviewAiFixType;
  }> = [];
  let recommendations: string[] = [];

  if (answeredQuestions.length > 0) {
    const rubricText = INTERVIEW_RUBRIC_CRITERIA.map(
      (c, i) => `${i + 1}. ${c.labelEn} (key: "${c.key}") — ${c.descriptionEn}`
    ).join('\n');

    const questionsForPrompt = answeredQuestions
      .map((q, i) => {
        return `[Q${i + 1}] id=${q.id} | required=${q.is_required ? 'yes' : 'no'} | type=${q.answer_type || 'open'}
Question: ${q.question_text}
${q.expected_answer_shape ? `Expected format: ${q.expected_answer_shape}` : ''}
${q.description ? `Helper: ${q.description}` : ''}
Answer: ${String(q.answer_text).trim()}
${q.context_note ? `Context note: ${q.context_note}` : ''}`;
      })
      .join('\n\n');

    // Oxford-style rubric: explicit, named, independently-scored criteria — no
    // single "overall impression" number from the model. Low temperature and
    // per-criterion anchors keep repeated runs on the same answer stable.
    const systemPrompt = `You are an objective rubric-based reviewer for interview/survey answers.

For EACH answer, score it against ALL ${INTERVIEW_RUBRIC_CRITERIA.length} criteria below, independently. Do NOT
produce a single "overall impression" score — score every criterion on its own, each 0-${INTERVIEW_RUBRIC_MAX_PER_CRITERION}:
- 0: absent — the answer shows nothing for this criterion
- 1: poor — barely present
- 2: partial — present but thin
- 3: good — clearly present
- 4: excellent — strongly and clearly present

Rubric criteria (use these exact keys):
${rubricText}

For each criterion, write a one-sentence justification tied to the actual answer text (quote or paraphrase it) —
never a generic statement. If the answer does not demonstrate a criterion, say why, briefly.

For each weak answer choose the most useful fixType:
- clarify
- add_evidence
- expand_answer
- make_specific
- complete_required_fields
- correct_meaning

Also provide 2-5 actionable, session-level recommendations for improving the weakest answers overall.
Write all feedback, justifications, and recommendations in ${lang}.
Return valid JSON matching the schema. Do not include any field for an overall score or overall verdict — those are computed separately.`;

    const userPrompt = `Session: ${session?.name || 'Interview session'}
Total questions: ${questions.length}
Answered (being scored below): ${answeredQuestions.length}

${questionsForPrompt}`;

    const result = await llmService.call({
      type: 'structured',
      modelConfig: { id: 'standard' },
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      schema: EvalSchema,
      maxTokens: 2500,
      temperature: 0.1,
      cache: false,
      // INT-BVP-001 (2): llmService's own AbortSignal.timeout enforcement —
      // real cancellation, not just a promise race — defaults to 60s when
      // unset. Pass our bound through so the provider call itself gets
      // aborted instead of only being ignored by the HTTP layer above.
      timeoutMs: params.timeoutMs,
    });

    const evaluation = (result as any).object || { questionEvaluations: [], recommendations: [] };
    llmEvaluations = Array.isArray(evaluation.questionEvaluations)
      ? evaluation.questionEvaluations
      : [];
    recommendations = Array.isArray(evaluation.recommendations) ? evaluation.recommendations : [];
  }

  const llmByQuestionId = new Map(llmEvaluations.map((item) => [String(item.questionId), item]));
  const answeredIds = new Set(answeredQuestions.map((q) => String(q.id)));

  const questionEvaluations = (questions as any[]).map((q) => {
    const qid = String(q.id);
    const isAnswered = answeredIds.has(qid);
    const llmItem = llmByQuestionId.get(qid);
    return {
      questionId: qid,
      isAnswered,
      rubric: llmItem?.rubric,
      feedback: llmItem?.feedback,
      fixType: llmItem?.fixType,
    };
  });

  return buildInterviewAiReviewSnapshot(
    { questionEvaluations, recommendations },
    questions,
    langCode
  );
}

/**
 * Fetch an interview session scoped to the caller's organization (project-scoped
 * OR org-scoped). Returns null when not found / cross-org (IDOR-safe). Includes
 * lifecycle columns so callers can branch on archive/trash state.
 */
async function loadOrgScopedSessionForLifecycle(
  sessionId: string,
  organizationId: string
): Promise<{
  id: string;
  archived_at: string | null;
  archived_by: string | null;
  trashed_at: string | null;
  trashed_by: string | null;
} | null> {
  await ensureInterviewSessionLifecycleColumns();
  const row = await queryHelpers.queryOne<any>(
    `SELECT s.id, s.archived_at, s.archived_by, s.trashed_at, s.trashed_by
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
    [sessionId, organizationId, organizationId]
  );
  return (row as any) || null;
}

/**
 * Apply a single lifecycle action to an org-scoped session. Returns a result code
 * so both the single-id handlers and the bulk handler can share the logic.
 */
async function applySessionLifecycleAction(params: {
  sessionId: string;
  organizationId: string;
  userId: string;
  action: 'archive' | 'restore' | 'trash' | 'untrash';
}): Promise<'ok' | 'not_found'> {
  const { sessionId, organizationId, userId, action } = params;
  const session = await loadOrgScopedSessionForLifecycle(sessionId, organizationId);
  if (!session) return 'not_found';

  const now = new Date().toISOString();
  switch (action) {
    case 'archive':
      await queryHelpers.queryRun(
        `UPDATE interview_sessions SET archived_at = ?, archived_by = ? WHERE id = ?`,
        [now, userId, sessionId]
      );
      // #50a — cascade: archiving a session archives its assignments too, so
      // an assignment tied to an archived session doesn't stay visible as
      // active. Guarded by `archived_at IS NULL` so an assignment the admin
      // ALREADY archived independently (via archiveAssignment) keeps its own
      // archived_at/archived_by and archived_via_session stays FALSE for it —
      // the cascade never overwrites an independent archive record.
      await ensureInterviewAssignmentLifecycleColumns();
      await queryHelpers.queryRun(
        `UPDATE interview_assignments
            SET archived_at = ?, archived_by = ?, archived_via_session = TRUE, updated_at = ?
          WHERE session_id = ? AND archived_at IS NULL`,
        [now, userId, now, sessionId]
      );
      break;
    case 'restore':
      await queryHelpers.queryRun(
        `UPDATE interview_sessions SET archived_at = NULL, archived_by = NULL WHERE id = ?`,
        [sessionId]
      );
      // #50a — cascade back: restoring a session only un-archives the
      // assignments THIS cascade archived (archived_via_session = TRUE).
      // Assignments an admin archived independently via archiveAssignment
      // (archived_via_session = FALSE) are left archived — restoring a
      // session must never silently un-archive someone's deliberate,
      // independent assignment-level archive.
      await ensureInterviewAssignmentLifecycleColumns();
      await queryHelpers.queryRun(
        `UPDATE interview_assignments
            SET archived_at = NULL, archived_by = NULL, archived_via_session = FALSE, updated_at = ?
          WHERE session_id = ? AND archived_via_session = TRUE`,
        [now, sessionId]
      );
      break;
    case 'trash':
      await queryHelpers.queryRun(
        `UPDATE interview_sessions SET trashed_at = ?, trashed_by = ? WHERE id = ?`,
        [now, userId, sessionId]
      );
      break;
    case 'untrash':
      await queryHelpers.queryRun(
        `UPDATE interview_sessions SET trashed_at = NULL, trashed_by = NULL WHERE id = ?`,
        [sessionId]
      );
      break;
  }
  return 'ok';
}

/**
 * Insight export section filter (#25).
 *
 * The frontend may pass `sectionIds` to export only a subset of an insight's
 * content. An insight's structured payload is grouped into top-level "sections"
 * (executiveSummary, themes, issues, opportunities, signals, evidenceMap,
 * missingData) and each grouped item is keyed by its title. A sectionId can
 * therefore be either:
 *   - a top-level group key (e.g. "themes", "issues", "executiveSummary"), or
 *   - an item identifier of the form "<group>:<title>" or a bare item title.
 *
 * Returns a filtered copy of the insight plus a human-readable filtered content
 * snapshot. Unknown ids are ignored. If the filter yields nothing, the caller
 * should fall back to the full insight (handled at the call site).
 */
type FilterableInsight = {
  title?: string;
  content?: string;
  description?: string;
  executiveSummary?: string;
  themes?: Array<{ title?: string; description?: string }>;
  issues?: Array<{ title?: string; description?: string }>;
  opportunities?: Array<{ title?: string; description?: string }>;
  signals?: Array<{ title?: string; description?: string }>;
  evidenceMap?: Array<{ question_text?: string }>;
  missingData?: string[];
  [key: string]: unknown;
};

const INSIGHT_SECTION_GROUPS = [
  'executiveSummary',
  'themes',
  'issues',
  'opportunities',
  'signals',
  'evidenceMap',
  'missingData',
] as const;

function filterInsightBySectionIds(
  insight: FilterableInsight,
  sectionIds: string[]
): { filtered: FilterableInsight; matched: boolean; markdown: string } {
  const wanted = new Set(
    (sectionIds || [])
      .map((s) =>
        String(s || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );

  const groupWanted = (group: string): boolean => wanted.has(group.toLowerCase());

  const itemWanted = (group: string, title: string): boolean => {
    const t = String(title || '')
      .trim()
      .toLowerCase();
    if (!t) return false;
    return wanted.has(t) || wanted.has(`${group.toLowerCase()}:${t}`);
  };

  const filtered: FilterableInsight = { title: insight.title };
  let matched = false;
  const mdParts: string[] = [];

  // executiveSummary is a scalar — matched only by its group key.
  if (insight.executiveSummary && groupWanted('executiveSummary')) {
    filtered.executiveSummary = insight.executiveSummary;
    mdParts.push(`## Executive Summary\n\n${insight.executiveSummary}`);
    matched = true;
  }

  const listGroups: Array<keyof FilterableInsight> = [
    'themes',
    'issues',
    'opportunities',
    'signals',
  ];
  for (const group of listGroups) {
    const items = Array.isArray(insight[group])
      ? (insight[group] as Array<{ title?: string; description?: string }>)
      : [];
    if (items.length === 0) continue;
    const keepWholeGroup = groupWanted(String(group));
    const kept = items.filter(
      (item) => keepWholeGroup || itemWanted(String(group), String(item?.title || ''))
    );
    if (kept.length > 0) {
      (filtered as any)[group] = kept;
      matched = true;
      const heading = String(group).charAt(0).toUpperCase() + String(group).slice(1);
      const body = kept
        .map((item) => {
          const title = String(item?.title || '').trim();
          const desc = String(item?.description || '').trim();
          return `- **${title}**${desc ? `: ${desc}` : ''}`;
        })
        .join('\n');
      mdParts.push(`## ${heading}\n\n${body}`);
    }
  }

  if (Array.isArray(insight.evidenceMap) && groupWanted('evidenceMap')) {
    filtered.evidenceMap = insight.evidenceMap;
    matched = true;
  }
  if (Array.isArray(insight.missingData) && groupWanted('missingData')) {
    filtered.missingData = insight.missingData;
    matched = true;
    if (insight.missingData.length > 0) {
      mdParts.push(`## Missing Data\n\n${insight.missingData.map((m) => `- ${m}`).join('\n')}`);
    }
  }

  return { filtered, matched, markdown: mdParts.join('\n\n') };
}

export const InterviewController = {
  // ==========================================
  // SESSIONS
  // ==========================================

  getSessions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const sessions = await loadInterviewSessionsForOrganization(
      user.organizationId,
      req.query.status
    );
    res.json(sessions);
  }),

  /**
   * Accepted sessions (Manager pipeline)
   * - Sessions that originate from assignments created by current user
   * - Only after assignment approval (treated as valid "source" for Insights)
   *
   * This supports the Interview workflow:
   * Assigned (in progress / submitted / sent back) → approve → Sessions (accepted sources) → Insights
   */
  getAcceptedSessions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const sessions = await loadAcceptedInterviewSessionsForManager(user.organizationId, user.id);
    res.json(sessions);
  }),

  getManagedSessions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const scope = await resolveInterviewManagerScope({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });
    const lifecycle = normalizeSessionLifecycleParam(req.query.lifecycle);
    const sessions = await loadManagedInterviewSessionsForManager(user.organizationId, user.id, {
      scope,
      lifecycle,
    });
    res.json(sessions);
  }),

  getSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    // INT-BVP-001 (5): bring getSession up to the same access standard as its
    // siblings (getQuestions/getNotes/getEvidence/getLinkedItems/getSummary) —
    // org-only scoping let any authenticated org member read another user's
    // session (including anonymous-session summary content the D18-A wall
    // exists to hide) just by knowing the session id. Reuse the existing
    // access-matrix helper rather than writing a parallel check.
    try {
      await assertSessionAccessibleOrThrow({
        sessionId: id,
        organizationId: user.organizationId,
        userId: user.id,
        userRole: user.role,
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const session = await loadInterviewSessionForOrganization(user.organizationId, id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // D18-A hard wall — same redaction contract as getSummary: an elevated
    // org role or team member may pass the access-matrix check above (it's a
    // valid session-level participant) but must still not see per-respondent
    // summary content for an anonymous session unless they ARE the respondent.
    await ensureInterviewAnonymityColumns();
    const anonymityRow = await queryHelpers.queryOne(
      `SELECT owner_id, is_anonymous FROM interview_sessions WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (isAnonymityWallActive(anonymityRow, user.id, 'owner_id')) {
      res.json({
        ...session,
        summaryFacts: [],
        summaryGaps: [],
        summaryConstraints: [],
        summaryPainPoints: [],
        anonymized: true,
      });
      return;
    }

    res.json(session);
  }),

  createSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { name: rawSessionName, projectId, templateId } = req.body;
    // F15 (data-integrity, continuation of Z139): decode HTML entities the
    // global input-sanitization middleware escaped on this field before it
    // feeds interview_sessions.name (below AND via createSessionFromTemplate,
    // which decodes again defensively — decode is idempotent).
    const name =
      typeof rawSessionName === 'string' ? decodeHtmlEntities(rawSessionName) : rawSessionName;

    // If templateId provided, create from template library (snapshot)
    if (templateId) {
      const resolvedProjectId = await resolveValidProjectId({
        organizationId: user.organizationId,
        projectId,
      });
      if (!resolvedProjectId) {
        res.status(400).json({ error: 'Project required' });
        return;
      }
      const session = await createSessionFromTemplate({
        user,
        templateId,
        projectId: resolvedProjectId,
        name,
      });
      res.status(201).json(session);
      return;
    }

    const resolvedProjectId = await resolveValidProjectId({
      organizationId: user.organizationId,
      projectId,
    });
    if (!resolvedProjectId) {
      res.status(400).json({ error: 'Project required' });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    await ensureInterviewSessionV6Columns();
    await ensureInterviewQuestionV6Columns();
    await ensureInterviewQuestionTemplatesTable();

    // Create session
    // Note: Schema uses owner_id (not user_id) and doesn't have topic column
    await queryHelpers.queryRun(
      `INSERT INTO interview_sessions
       (id, organization_id, project_id, name, owner_id, status, progress_json,
        runtime_mode_default,
        started_at, last_activity_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        user.organizationId,
        resolvedProjectId,
        name || 'Discovery Interview',
        user.id, // owner_id
        'active',
        JSON.stringify({ strategy: 0, operations: 0, digital: 0, people: 0, finance: 0 }),
        'single_question',
        now,
        now,
        now,
        now,
      ]
    );

    // Load question templates and create questions for session
    const templates = await queryHelpers.queryAll(
      `SELECT * FROM interview_question_templates ORDER BY category, sort_order`
    );

    let questionCount = 0;
    for (const template of templates as any[]) {
      const questionId = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, status, sort_order, is_template, is_required, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          questionId,
          id,
          user.organizationId,
          template.category,
          sanitizeQuestionText(template.question_text),
          'not_started',
          template.sort_order,
          1,
          template.is_required || 0,
          now,
          now,
        ]
      );
      questionCount++;
    }

    // Update total questions
    await queryHelpers.queryRun(`UPDATE interview_sessions SET total_questions = ? WHERE id = ?`, [
      questionCount,
      id,
    ]);

    const session = await queryHelpers.queryOne(`SELECT * FROM interview_sessions WHERE id = ?`, [
      id,
    ]);
    logger.info(`[InterviewController] Created session ${id} with ${questionCount} questions`);
    res.status(201).json(buildSessionResponse(session));
  }),

  updateSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { name, status, summaryFacts, summaryGaps, summaryConstraints, summaryPainPoints } =
      req.body;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (name) {
      updates.push('name = ?');
      // F15 (data-integrity, continuation of Z139): decode HTML entities the
      // global sanitizer escaped on this field before storing.
      params.push(decodeHtmlEntities(String(name)));
    }
    let normalizedStatus = '';
    if (status) {
      // DB constraint allows: active | completed | paused
      // API may send: in_progress (alias for active)
      normalizedStatus =
        String(status).toLowerCase() === 'in_progress' ? 'active' : String(status).toLowerCase();
      const allowed = new Set(['active', 'completed', 'paused']);
      if (!allowed.has(normalizedStatus)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
    }
    if (summaryFacts) {
      updates.push('summary_facts = ?');
      params.push(JSON.stringify(summaryFacts));
    }
    if (summaryGaps) {
      updates.push('summary_gaps = ?');
      params.push(JSON.stringify(summaryGaps));
    }
    if (summaryConstraints) {
      updates.push('summary_constraints = ?');
      params.push(JSON.stringify(summaryConstraints));
    }
    if (summaryPainPoints) {
      updates.push('summary_pain_points = ?');
      params.push(JSON.stringify(summaryPainPoints));
    }

    if (normalizedStatus) {
      updates.push('status = ?');
      params.push(normalizedStatus);
      if (normalizedStatus === 'completed') {
        updates.push('completed_at = ?');
        params.push(new Date().toISOString());
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    updates.push('last_activity_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    // Verify session belongs to user's organization (project-scoped OR org-scoped)
    const sessionCheck = await queryHelpers.queryOne(
      `SELECT s.id, s.assignment_id, s.status
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [id, user.organizationId, user.organizationId]
    );
    if (!sessionCheck) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (normalizedStatus && (sessionCheck as any)?.assignment_id) {
      res.status(409).json({
        error:
          'Assignment-backed sessions must use assignment workflow actions instead of direct status changes',
      });
      return;
    }

    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await queryHelpers.queryOne(`SELECT * FROM interview_sessions WHERE id = ?`, [
      id,
    ]);
    res.json(buildSessionResponse(updated));
  }),

  // ==========================================
  // SESSION LIFECYCLE (Archive / Trash)
  // ==========================================

  archiveSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const result = await applySessionLifecycleAction({
      sessionId: id,
      organizationId: user.organizationId,
      userId: user.id,
      action: 'archive',
    });
    if (result === 'not_found') {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ success: true, id, archived: true });
  }),

  restoreSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const result = await applySessionLifecycleAction({
      sessionId: id,
      organizationId: user.organizationId,
      userId: user.id,
      action: 'restore',
    });
    if (result === 'not_found') {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ success: true, id, archived: false });
  }),

  trashSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const result = await applySessionLifecycleAction({
      sessionId: id,
      organizationId: user.organizationId,
      userId: user.id,
      action: 'trash',
    });
    if (result === 'not_found') {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ success: true, id, trashed: true });
  }),

  untrashSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const result = await applySessionLifecycleAction({
      sessionId: id,
      organizationId: user.organizationId,
      userId: user.id,
      action: 'untrash',
    });
    if (result === 'not_found') {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ success: true, id, trashed: false });
  }),

  /**
   * Permanently delete a session. Only allowed once the session has been trashed
   * (trashed_at IS NOT NULL). Cascade-deletes the session's direct child rows
   * (questions, notes, evidence, assignments) then the session row itself.
   */
  deleteSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const session = await loadOrgScopedSessionForLifecycle(id, user.organizationId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (!session.trashed_at) {
      res
        .status(409)
        .json({ error: 'Session must be trashed before it can be permanently deleted' });
      return;
    }

    // Cascade-delete known session-scoped child rows, then the session row.
    // Best-effort per table so a missing/legacy table never blocks the delete.
    for (const sql of [
      `DELETE FROM interview_questions WHERE session_id = ?`,
      `DELETE FROM interview_notes WHERE session_id = ?`,
      `DELETE FROM interview_evidence WHERE session_id = ?`,
      `DELETE FROM interview_assignments WHERE session_id = ?`,
    ]) {
      try {
        await queryHelpers.queryRun(sql, [id]);
      } catch {
        /* best-effort cascade — ignore tables that don't exist or lack session_id */
      }
    }

    await queryHelpers.queryRun(`DELETE FROM interview_sessions WHERE id = ?`, [id]);

    res.json({ success: true, deletedId: id });
  }),

  /**
   * Bulk lifecycle action over a set of session ids (org-scoped). Applies the
   * given action to each id in a loop; ids outside the caller's org are skipped.
   */
  bulkSessionLifecycle: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { ids, action } = req.body || {};

    const allowedActions = new Set(['archive', 'restore', 'trash', 'untrash']);
    if (!allowedActions.has(action)) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids must be a non-empty array' });
      return;
    }

    const updatedIds: string[] = [];
    const notFoundIds: string[] = [];
    for (const rawId of ids) {
      const sessionId = String(rawId);
      const result = await applySessionLifecycleAction({
        sessionId,
        organizationId: user.organizationId,
        userId: user.id,
        action,
      });
      if (result === 'ok') {
        updatedIds.push(sessionId);
      } else {
        notFoundIds.push(sessionId);
      }
    }

    res.json({ success: true, action, updatedIds, notFoundIds });
  }),

  // ==========================================
  // ASSIGNMENTS (Workflow)
  // ==========================================

  getMyAssignments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { status, includeCompleted } = req.query as any;

    const params: unknown[] = [user.organizationId, user.id, user.id];
    let where = `WHERE a.organization_id = ? AND (a.assignee_user_id = ? OR m.user_id = ?)`;

    if (status) {
      where += ` AND a.status = ?`;
      params.push(status);
    } else if (!includeCompleted) {
      where += ` AND a.status NOT IN ('approved', 'completed')`;
    }

    let rows: any[] = [];
    try {
      rows = await queryHelpers.queryAll(
        `SELECT
           a.*,
           t.name as template_name,
           t.description as template_description,
           t.category as template_category,
           s.status as session_status,
           s.answered_questions as answered_questions,
           s.total_questions as total_questions,
           TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as assignee_name,
           u.email as assignee_email
         FROM interview_assignments a
         LEFT JOIN interview_assignment_members m ON m.assignment_id = a.id
         LEFT JOIN interview_library_templates t ON t.id = a.template_id
         LEFT JOIN interview_sessions s ON s.id = a.session_id
         LEFT JOIN users u ON u.id = a.assignee_user_id
         ${where}
         ORDER BY
           CASE a.status WHEN 'assigned' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'sent_back' THEN 1 WHEN 'submitted' THEN 2 ELSE 3 END,
           COALESCE(a.due_at, '9999-12-31') ASC,
           a.created_at DESC`,
        params
      );
    } catch {
      // Back-compat: environments without `interview_assignment_members`.
      const fallbackParams: unknown[] = [user.organizationId, user.id];
      let fallbackWhere = `WHERE a.organization_id = ? AND a.assignee_user_id = ?`;
      if (status) {
        fallbackWhere += ` AND a.status = ?`;
        fallbackParams.push(status);
      } else if (!includeCompleted) {
        fallbackWhere += ` AND a.status NOT IN ('approved', 'completed')`;
      }
      rows = await queryHelpers.queryAll(
        `SELECT
           a.*,
           t.name as template_name,
           t.description as template_description,
           t.category as template_category,
           s.status as session_status,
           s.answered_questions as answered_questions,
           s.total_questions as total_questions,
           TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as assignee_name,
           u.email as assignee_email
         FROM interview_assignments a
         LEFT JOIN interview_library_templates t ON t.id = a.template_id
         LEFT JOIN interview_sessions s ON s.id = a.session_id
         LEFT JOIN users u ON u.id = a.assignee_user_id
         ${fallbackWhere}
         ORDER BY
           CASE a.status WHEN 'assigned' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'sent_back' THEN 1 WHEN 'submitted' THEN 2 ELSE 3 END,
           COALESCE(a.due_at, '9999-12-31') ASC,
           a.created_at DESC`,
        fallbackParams
      );
    }

    const mapped = (rows || []).map((r: any) => {
      const answered = Number(r.answered_questions || 0);
      const total = Number(r.total_questions || 0);
      const completenessRatio = calcCompletenessRatio(answered, total);
      return {
        id: r.id,
        organizationId: r.organization_id,
        status: normalizeAssignmentStatusForClient(r.status),
        projectId: r.project_id || null,
        sessionId: r.session_id || null,
        dueAt: r.due_at || null,
        startedAt: r.started_at || null,
        submittedAt: r.submitted_at || null,
        sentBackAt: r.sent_back_at || null,
        sentBackReason: r.sent_back_reason || null,
        missingItems: parseMissingItems(r.missing_items_json),
        aiReview: parseAiReviewSnapshot(r.ai_review_snapshot_json),
        aiReviewedAt: r.ai_reviewed_at || null,
        reviewDecisionMemory: parseReviewDecisionMemory(r.review_decision_memory_json),
        processRef: r.process_ref || null,
        template: {
          id: r.template_id,
          version: r.template_version,
          name: r.template_name || '',
          description: r.template_description || '',
          category:
            typeof r.template_category === 'string'
              ? r.template_category.toLowerCase()
              : r.template_category,
        },
        session: r.session_id
          ? {
              id: r.session_id,
              status: r.session_status,
              answeredQuestions: answered,
              totalQuestions: total,
              completenessPercent: Math.round(completenessRatio * 100),
            }
          : null,
        // V-A S2 — emit the assignee so the Inbox stops rendering "Unknown".
        // The legacy REST path previously projected no assignee field at all.
        assignee: r.assignee_user_id
          ? {
              id: r.assignee_user_id,
              name: (r.assignee_name && String(r.assignee_name).trim()) || r.assignee_email || '',
              email: r.assignee_email || '',
            }
          : undefined,
      };
    });

    res.json(mapped);
  }),

  createAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admin = requireUser(req);
    const {
      assigneeUserId, // Single user (legacy support)
      assigneeUserIds, // Array of users (new - supports teams)
      templateId,
      dueAt,
      processRef,
      projectId,
      priority,
      escalateTo,
      notes,
      teamLeadId,
      isAnonymous,
    } = req.body || {};

    // Support both singular and plural assignee fields
    const requestedUserIds: string[] = assigneeUserIds
      ? Array.isArray(assigneeUserIds)
        ? assigneeUserIds
        : [assigneeUserIds]
      : assigneeUserId
        ? [assigneeUserId]
        : [];
    const userIds = Array.from(
      new Set(requestedUserIds.map((id) => String(id || '').trim()).filter(Boolean))
    );

    if (userIds.length === 0 || !templateId) {
      res.status(400).json({ error: 'assigneeUserId(s) and templateId are required' });
      return;
    }

    // ==========================================
    // SCOPE VALIDATION - Check if user can assign to these users
    // ==========================================
    const creatorRoleRaw = (admin.role || '').toString().trim().toUpperCase();
    // Auth middleware maps roles to app-level labels (e.g. admin -> administrator).
    // Normalize to permission roles used across the backend.
    const creatorRole =
      creatorRoleRaw === 'ADMINISTRATOR'
        ? 'ADMIN'
        : creatorRoleRaw === 'OWNER'
          ? 'SUPERADMIN'
          : creatorRoleRaw === 'PROJECT_MANAGER'
            ? 'PROJECT_MANAGER'
            : creatorRoleRaw;

    const orgRolesWithFullAccess = ['SUPERADMIN', 'ADMIN', 'PROJECT_MANAGER'];
    const projectRolesWithAssign = ['PMO_LEAD', 'WORKSTREAM_OWNER', 'INITIATIVE_OWNER', 'SPONSOR'];

    // If creator has org-level permission, they can assign to anyone in org
    if (!orgRolesWithFullAccess.includes(creatorRole)) {
      // Check project-level permissions
      if (!projectId) {
        // Without projectId, check if user has any project role that allows assignment
        const userProjectRoles = await queryHelpers.queryAll(
          `SELECT project_id, role FROM project_members WHERE user_id = ?`,
          [admin.id]
        );

        const hasAnyManagementRole = (userProjectRoles || []).some((pm: any) =>
          projectRolesWithAssign.includes((pm.role || '').toUpperCase())
        );

        if (!hasAnyManagementRole) {
          res.status(403).json({
            error:
              'You do not have permission to assign interviews. You need PROJECT_MANAGER role or a management role in a project.',
          });
          return;
        }
      } else {
        // With projectId, check if creator has management role in that project
        const creatorProjectRole = await queryHelpers.queryOne(
          `SELECT role FROM project_members WHERE user_id = ? AND project_id = ?`,
          [admin.id, projectId]
        );

        if (
          !creatorProjectRole ||
          !projectRolesWithAssign.includes(((creatorProjectRole as any).role || '').toUpperCase())
        ) {
          res.status(403).json({
            error: 'You do not have a management role in this project to assign interviews.',
          });
          return;
        }

        // Validate that all assignees are members of the project
        const projectMembers = await queryHelpers.queryAll(
          `SELECT user_id FROM project_members WHERE project_id = ?`,
          [projectId]
        );
        const projectMemberIds = (projectMembers || []).map((m: any) => m.user_id);

        const invalidAssignees = userIds.filter((id) => !projectMemberIds.includes(id));
        if (invalidAssignees.length > 0) {
          res.status(403).json({
            error:
              'Some assignees are not members of this project. You can only assign to project members.',
          });
          return;
        }
      }
    }
    // ==========================================

    // V-A — cross-org assignee IDOR guard. The org-role branch above grants
    // "assign to anyone in org" but never verified the assignees are actually
    // IN the caller's org — an admin could assign to a user from a DIFFERENT
    // org by passing their id. Validate every assignee belongs to this org
    // (applies to all branches; the project branch already checks membership,
    // this is the org-level backstop).
    {
      const orgMembers = await queryHelpers.queryAll(
        `SELECT user_id FROM organization_members WHERE organization_id = ?`,
        [admin.organizationId]
      );
      const orgMemberIds = new Set((orgMembers || []).map((m: any) => String(m.user_id)));
      const foreignAssignees = userIds.filter((id) => !orgMemberIds.has(String(id)));
      if (foreignAssignees.length > 0) {
        res.status(403).json({
          error: 'One or more assignees are not members of your organization.',
          code: 'ASSIGNEE_NOT_IN_ORG',
        });
        return;
      }
    }

    // Validate template
    const template = await queryHelpers.queryOne(
      `SELECT id, name, version, status FROM interview_library_templates WHERE id = ?`,
      [templateId]
    );
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    if (String((template as any).status || '').toLowerCase() !== 'approved') {
      res.status(400).json({ error: 'Template is not approved yet' });
      return;
    }

    // Use InterviewAssignmentService for proper handling of teams, notifications, escalation
    const { default: interviewAssignmentService } =
      await import('../services/InterviewAssignmentService.js');

    const createPayloadBase = {
      organizationId: admin.organizationId,
      projectId: projectId || undefined,
      templateId,
      templateVersion: (template as any).version || 1,
      dueAt: dueAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      priority: priority || 'medium',
      escalateTo: escalateTo || admin.id,
      notes: notes || undefined,
      processRef: processRef || undefined,
      createdBy: admin.id,
      // D18-A — anonymous survey toggle ("Odpowiedzi anonimowe" in the assignment
      // modal). Defaults false: zero behavior change for existing assignments.
      isAnonymous: isAnonymous === true,
    };

    // Multi-assign is modeled as separate assignments per assignee so each person
    // gets an independent session and manager review flow.
    if (userIds.length > 1) {
      const createdAssignments = [] as any[];
      for (const userId of userIds) {
        const created = await interviewAssignmentService.create({
          ...createPayloadBase,
          assigneeUserIds: [userId],
        });
        const assignmentWithDetails = await interviewAssignmentService.getByIdWithDetails(
          created.id
        );
        if (assignmentWithDetails) {
          createdAssignments.push(assignmentWithDetails);
        }
      }
      const primaryAssignment = createdAssignments[0] || null;
      res.status(201).json({
        ...(primaryAssignment || {}),
        createdAssignments,
        createdCount: createdAssignments.length,
        splitAssignments: true,
      });
      return;
    }

    const assignment = await interviewAssignmentService.create({
      ...createPayloadBase,
      assigneeUserIds: userIds,
      teamLeadId: teamLeadId || undefined,
    });

    const assignmentWithDetails = await interviewAssignmentService.getByIdWithDetails(
      assignment.id
    );
    res.status(201).json(assignmentWithDetails);
  }),

  listAssignments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admin = requireUser(req);
    const { status, assigneeUserId, createdBy, projectId, overdue } = req.query as any;

    const params: unknown[] = [admin.organizationId];
    let where = `WHERE a.organization_id = ?`;
    if (status) {
      where += ` AND a.status = ?`;
      params.push(status);
    }
    if (assigneeUserId) {
      where += ` AND a.assignee_user_id = ?`;
      params.push(assigneeUserId);
    }
    if (createdBy) {
      where += ` AND a.created_by = ?`;
      params.push(createdBy);
    }
    if (projectId) {
      where += ` AND a.project_id = ?`;
      params.push(projectId);
    }
    if (String(overdue) === '1' || String(overdue).toLowerCase() === 'true') {
      where += ` AND a.due_at IS NOT NULL AND a.due_at < datetime('now') AND a.status != 'completed'`;
    }

    const rows = await queryHelpers.queryAll(
      `SELECT
         a.*,
         t.name as template_name,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions as answered_questions,
         s.total_questions as total_questions
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       ${where}
       ORDER BY a.updated_at DESC`,
      params
    );

    const mapped = (rows || []).map((r: any) => {
      const answered = Number(r.answered_questions || 0);
      const total = Number(r.total_questions || 0);
      // D18-A hard wall — `...r` below would otherwise leak the raw
      // ai_review_snapshot_json string (feedback/justification quoting the
      // answer) alongside the parsed+redacted `aiReview`. Drop it from the
      // spread; only the caller who is the assignee themselves keeps it.
      const { ai_review_snapshot_json: _rawAiReviewSnapshotJson, ...rWithoutRawAiReview } = r;
      const wallActive = isAnonymityWallActive(r, admin.id, 'assignee_user_id');
      return {
        ...rWithoutRawAiReview,
        aiReview: wallActive
          ? redactAiReviewSnapshotForAnonymity(parseAiReviewSnapshot(r.ai_review_snapshot_json))
          : parseAiReviewSnapshot(r.ai_review_snapshot_json),
        aiReviewedAt: r.ai_reviewed_at || null,
        reviewDecisionMemory: parseReviewDecisionMemory(r.review_decision_memory_json),
        template: {
          id: r.template_id,
          name: r.template_name || '',
          category:
            typeof r.template_category === 'string'
              ? r.template_category.toLowerCase()
              : r.template_category,
          version: r.template_version,
        },
        session: r.session_id
          ? {
              id: r.session_id,
              status: r.session_status,
              answeredQuestions: answered,
              totalQuestions: total,
              completenessPercent: Math.round(calcCompletenessRatio(answered, total) * 100),
            }
          : null,
      };
    });

    res.json(mapped);
  }),

  startAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { projectId, name } = req.body || {};

    // Allow team members to start the assignment too (team assignment support).
    let assignment: any = null;
    try {
      assignment = await queryHelpers.queryOne(
        `SELECT a.*
         FROM interview_assignments a
         LEFT JOIN interview_assignment_members m ON m.assignment_id = a.id
         WHERE a.id = ?
           AND a.organization_id = ?
           AND (a.assignee_user_id = ? OR m.user_id = ?)`,
        [id, user.organizationId, user.id, user.id]
      );
    } catch {
      // Back-compat: environments without `interview_assignment_members`.
      assignment = await queryHelpers.queryOne(
        `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ? AND assignee_user_id = ?`,
        [id, user.organizationId, user.id]
      );
    }
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    const assignmentStatus = String((assignment as any).status || '').toLowerCase();
    if (assignmentStatus === 'approved' || assignmentStatus === 'completed') {
      res.status(409).json({ error: 'Assignment already completed' });
      return;
    }

    if ((assignment as any).session_id) {
      const session = await queryHelpers.queryOne(`SELECT * FROM interview_sessions WHERE id = ?`, [
        (assignment as any).session_id,
      ]);
      res.json({ assignmentId: id, session: buildSessionResponse(session) });
      return;
    }

    const resolvedProjectId = await resolveValidProjectId({
      organizationId: user.organizationId,
      projectId: (assignment as any).project_id || projectId,
    });
    if (!resolvedProjectId) {
      res.status(400).json({ error: 'Project required' });
      return;
    }

    const session = await createSessionFromTemplate({
      user,
      templateId: (assignment as any).template_id,
      projectId: resolvedProjectId,
      name: name || `Interview ${new Date().toLocaleDateString()}`,
      assignmentId: id,
    });

    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE interview_assignments
       SET session_id = ?, status = 'in_progress', started_at = ?, updated_at = ?, project_id = COALESCE(project_id, ?)
       WHERE id = ?`,
      [(session as any).id, now, now, resolvedProjectId, id]
    );

    // Mirror into task status/description
    if ((assignment as any).task_id) {
      await queryHelpers.queryRun(
        `UPDATE tasks SET status = ?, description = ?, updated_at = ? WHERE id = ?`,
        [
          'in_progress',
          JSON.stringify({
            type: 'interview_assignment',
            assignmentId: id,
            templateId: (assignment as any).template_id,
            templateVersion: (assignment as any).template_version,
            sessionId: (session as any).id,
          }),
          now,
          (assignment as any).task_id,
        ]
      );
    }

    res.json({ assignmentId: id, session });
  }),

  submitAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    await ensureInterviewAssignmentAiReviewColumns();
    await ensureInterviewQuestionV6Columns();

    // Team submission is allowed only for the primary assignee OR team lead (member role=lead).
    let assignment: any = null;
    try {
      assignment = await queryHelpers.queryOne(
        `SELECT a.*
         FROM interview_assignments a
         LEFT JOIN interview_assignment_members m
           ON m.assignment_id = a.id AND m.user_id = ? AND m.role = 'lead'
         LEFT JOIN interview_sessions s
           ON s.id = a.session_id
         WHERE a.id = ?
           AND a.organization_id = ?
           AND (
             a.assignee_user_id = ?
             OR m.id IS NOT NULL
             OR a.created_by = ?
             OR s.owner_id = ?
           )`,
        [user.id, id, user.organizationId, user.id, user.id, user.id]
      );
    } catch {
      // Back-compat: environments without `interview_assignment_members`.
      assignment = await queryHelpers.queryOne(
        `SELECT a.*
         FROM interview_assignments a
         LEFT JOIN interview_sessions s ON s.id = a.session_id
         WHERE a.id = ?
           AND a.organization_id = ?
           AND (
             a.assignee_user_id = ?
             OR a.created_by = ?
             OR s.owner_id = ?
           )`,
        [id, user.organizationId, user.id, user.id, user.id]
      );
    }
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    const submitGate = evaluateGatePolicy({
      action: 'SUBMIT_INTERVIEW',
      contextType: 'interview_assignment',
      user,
      context: { assignment },
    });
    if (!submitGate.allow) {
      const gateError = submitGate as {
        allow: false;
        error: string;
        code?: 'FORBIDDEN' | 'INVALID_STATE' | 'MISSING_DATA';
      };
      res.status(gateError.code === 'INVALID_STATE' ? 409 : 400).json({ error: gateError.error });
      return;
    }

    const sessionRow = await queryHelpers.queryOne(
      `SELECT s.*
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [(assignment as any).session_id, user.organizationId, user.organizationId]
    );
    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Recalculate progress from actual question data to avoid stale counters
    const sessionId = (assignment as any).session_id;
    await InterviewController.updateSessionProgress(sessionId);
    const freshSession = await queryHelpers.queryOne(
      `SELECT answered_questions, total_questions FROM interview_sessions WHERE id = ?`,
      [sessionId]
    );
    const answered = Number((freshSession as any)?.answered_questions || 0);
    const total = Number((freshSession as any)?.total_questions || 0);
    const completenessRatio = calcCompletenessRatio(answered, total);
    const completenessPercent = Math.round(completenessRatio * 100);
    const now = new Date().toISOString();

    // ── L-07 / SPEC_13 §5.1 — hard submit floor (objective insufficiency) ──
    // Compute the AI review BEFORE flipping status so we can block an objectively
    // insufficient submission. The hard floor is deterministic + objective only:
    //   (a) required questions with no answer, OR
    //   (b) AI overall verdict 'empty' / 'insufficient' (e.g. nothing answered).
    // This is a HARD gate with NO "submit anyway" escape (SPEC §5.1/§5.2) — the
    // draft stays editable (status unchanged) so the respondent can fix and retry.
    // Soft quality (needs_improvement / short answers) is NOT blocked here; it is
    // escalated to the sender via score + recommendations (HITL).
    const submitQuestions = await queryHelpers.queryAll(
      `SELECT id, question_text, answer_type, is_required, expected_answer_shape, description,
              status, answer_text, context_note, confidence_score
       FROM interview_questions
       WHERE session_id = ? AND organization_id = ?
       ORDER BY sort_order`,
      [sessionId, user.organizationId]
    );

    const requiredMissing = (submitQuestions as any[]).filter((q) => {
      const isRequired = Boolean(q.is_required);
      const hasAnswer =
        String(q.status || '') === 'answered' && String(q.answer_text || '').trim().length > 0;
      return isRequired && !hasAnswer;
    });

    let aiReview: InterviewAiReviewSnapshot | null = null;
    try {
      aiReview = await evaluateInterviewSessionAnswers({
        session: { id: sessionId, name: (sessionRow as any)?.name || 'Interview session' },
        questions: submitQuestions as any[],
        language: req.body?.language,
      });
    } catch (error) {
      // AI eval is best-effort: if it fails we still enforce the deterministic
      // required-missing floor, but we never block on a missing AI signal.
      logger.warn('[InterviewController] Failed to generate AI review on submit', error);
    }

    // The AI hard-floor only applies when there are questions to answer. A
    // session with zero questions is a template/config artifact, not a respondent
    // failure — don't trap the respondent on it (the deterministic required-missing
    // check still governs the real "answered nothing" case).
    const aiVerdict = aiReview?.overallVerdict;
    const aiHardFloorBreached =
      (submitQuestions as any[]).length > 0 &&
      (aiVerdict === 'empty' || aiVerdict === 'insufficient');
    const objectiveFloorBreached = requiredMissing.length > 0 || aiHardFloorBreached;

    if (objectiveFloorBreached) {
      const blockedItems: InterviewMissingItem[] = [
        ...requiredMissing.map((q: any) => ({
          key: `required_${q.id}`,
          label: String(q.question_text || 'Required question')
            .trim()
            .slice(0, 160),
          questionId: String(q.id),
        })),
        ...((aiReview?.weakAnswerMap || [])
          .filter((w) => w.verdict === 'insufficient' || w.verdict === 'unanswered')
          .map((w) => ({
            key: w.key,
            label: w.label,
            questionId: w.questionId,
          })) as InterviewMissingItem[]),
      ];
      // Deduplicate by questionId (a required-missing item may also surface in the AI map).
      const seenQ = new Set<string>();
      const dedupedBlockedItems = blockedItems.filter((item) => {
        const qid = item.questionId || item.key;
        if (seenQ.has(qid)) return false;
        seenQ.add(qid);
        return true;
      });

      res.status(422).json({
        error:
          requiredMissing.length > 0
            ? 'Cannot submit: required questions are unanswered'
            : 'Cannot submit: answers are insufficient',
        code: 'OBJECTIVE_INSUFFICIENCY',
        reason: requiredMissing.length > 0 ? 'required_missing' : 'ai_insufficient',
        blockedItems: dedupedBlockedItems,
        requiredMissingCount: requiredMissing.length,
        aiReview,
        completenessPercent,
      });
      return;
    }

    const newAssignmentStatus = 'submitted';

    // INT-05 — persist the exact answer version before changing lifecycle
    // state. Submission is fail-closed: success without a durable snapshot
    // would leave the manager reviewing mutable, unverifiable data.
    try {
      await snapshotInterviewAnswers({
        organizationId: user.organizationId,
        assignmentId: id,
        sessionId,
        reason: 'submission',
        savedAt: now,
        savedBy: user.id,
      });
    } catch (error) {
      logger.error('[InterviewController] Failed to snapshot interview submission', error);
      res.status(500).json({
        error: 'Submission could not be safely persisted. Please retry.',
        code: 'SUBMISSION_SNAPSHOT_FAILED',
      });
      return;
    }

    try {
      await queryHelpers.queryRun(
        `UPDATE interview_assignments
         SET status = ?, submitted_at = ?, sent_back_at = NULL, sent_back_reason = NULL, missing_items_json = NULL, ai_review_snapshot_json = NULL, ai_reviewed_at = NULL, updated_at = ?
         WHERE id = ?`,
        [newAssignmentStatus, now, now, id]
      );
    } catch {
      await queryHelpers.queryRun(
        `UPDATE interview_assignments
         SET status = ?, submitted_at = ?, sent_back_at = NULL, sent_back_reason = NULL, ai_review_snapshot_json = NULL, ai_reviewed_at = NULL, updated_at = ?
         WHERE id = ?`,
        [newAssignmentStatus, now, now, id]
      );
    }

    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET status = 'submitted', updated_at = ?, last_activity_at = ? WHERE id = ?`,
      [now, now, sessionId]
    );

    if ((assignment as any).task_id) {
      await queryHelpers.queryRun(
        `UPDATE tasks SET status = ?, progress = ?, updated_at = ? WHERE id = ?`,
        ['in_progress', completenessPercent, now, (assignment as any).task_id]
      );
    }

    // Persist the AI review snapshot computed above (score, verdict, weak answers,
    // recommendations) so the sender's review panel shows the score (Z-04). Reuses
    // the single evaluation from the hard-floor gate — no second LLM call.
    if (aiReview) {
      try {
        await queryHelpers.queryRun(
          `UPDATE interview_assignments
           SET ai_review_snapshot_json = ?, ai_reviewed_at = ?, updated_at = ?
           WHERE id = ?`,
          [JSON.stringify(aiReview), now, now, id]
        );
      } catch (error) {
        logger.warn('[InterviewController] Failed to persist AI review on submit', error);
      }
    }

    const updatedAssignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );
    const updatedSession = await queryHelpers.queryOne(
      `SELECT * FROM interview_sessions WHERE id = ?`,
      [(assignment as any).session_id]
    );

    // Notify the assignment creator (manager/reviewer) that review is needed.
    // Z-06 / SPEC_13 §5 — carry the AI score + top recommendation so the sender
    // sees the assessment in the notification, not just a generic "submitted".
    try {
      const createdBy = (assignment as any).created_by;
      if (createdBy) {
        // #48a — overallScore is the rubric's 1-5 scale; map to 0-100 (1 -> 0%,
        // 5 -> 100%) the same way as the InterviewHub aiScore column.
        const scorePct =
          typeof aiReview?.overallScore === 'number'
            ? Math.round(Math.max(0, Math.min(1, (aiReview.overallScore - 1) / 4)) * 100)
            : null;
        const topRecommendation = (aiReview?.recommendations || []).find((r) => r && r.trim());
        const scorePart = scorePct !== null ? `AI quality score: ${scorePct}/100. ` : '';
        const recPart = topRecommendation ? `Top note: ${topRecommendation.trim()}` : '';
        const body =
          `An interview assignment has been submitted and is awaiting your review. ${scorePart}${recPart}`.trim();
        await notificationService.send({
          userId: createdBy,
          organizationId: user.organizationId,
          type: 'interview_submitted',
          title:
            scorePct !== null
              ? `Interview submitted (AI score ${scorePct}/100)`
              : 'Interview submitted for review',
          body,
          entityType: 'interview_assignment',
          entityId: id,
          actionUrl: `/interview?assignmentId=${id}&scope=managed`,
          priority: 'high',
          actorId: user.id,
        });
      }
    } catch (e) {
      logger.warn('[InterviewController] Failed to send interview_submitted notification', e);
    }

    res.json({
      assignment: {
        ...(updatedAssignment as any),
        aiReview:
          aiReview || parseAiReviewSnapshot((updatedAssignment as any)?.ai_review_snapshot_json),
        aiReviewedAt: (updatedAssignment as any)?.ai_reviewed_at || null,
        reviewDecisionMemory: parseReviewDecisionMemory(
          (updatedAssignment as any)?.review_decision_memory_json
        ),
      },
      session: buildSessionResponse(updatedSession),
      completenessPercent,
      entersContext: false,
      aiReview:
        aiReview || parseAiReviewSnapshot((updatedAssignment as any)?.ai_review_snapshot_json),
    });
  }),

  sendBackAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admin = requireUser(req);
    const { id } = req.params;
    const { reason, missingItems } = req.body || {};
    await ensureInterviewAssignmentAiReviewColumns();

    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!normalizedReason) {
      res.status(400).json({ error: 'Send-back reason is required' });
      return;
    }

    const normalizedMissingItems: InterviewMissingItem[] = Array.isArray(missingItems)
      ? (missingItems
          .map((item: any, idx: number) => {
            if (typeof item === 'string') {
              const label = item.trim();
              if (!label) return null;
              return { key: `missing_${idx + 1}`, label };
            }
            if (!item || typeof item !== 'object') return null;
            const label = typeof item.label === 'string' ? item.label.trim() : '';
            if (!label) return null;
            const key =
              typeof item.key === 'string' && item.key.trim()
                ? item.key.trim()
                : `missing_${idx + 1}`;
            return {
              key,
              label,
              questionId:
                typeof item.questionId === 'string' && item.questionId.trim()
                  ? item.questionId.trim()
                  : undefined,
              sectionId:
                typeof item.sectionId === 'string' && item.sectionId.trim()
                  ? item.sectionId.trim()
                  : undefined,
            };
          })
          .filter(Boolean) as InterviewMissingItem[])
      : [];

    if (normalizedMissingItems.length === 0) {
      normalizedMissingItems.push({
        key: 'quality_gaps',
        label: 'Uzupełnij brakujące odpowiedzi i doprecyzuj kluczowe odpowiedzi.',
      });
    }

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, admin.organizationId]
    );
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    const sendBackGate = evaluateGatePolicy({
      action: 'SEND_BACK_INTERVIEW',
      contextType: 'interview_assignment',
      user: admin,
      context: { assignment },
    });
    if (!sendBackGate.allow) {
      const gateError = sendBackGate as {
        allow: false;
        error: string;
        code?: 'FORBIDDEN' | 'INVALID_STATE' | 'MISSING_DATA';
      };
      res.status(gateError.code === 'INVALID_STATE' ? 409 : 400).json({ error: gateError.error });
      return;
    }

    const sessionRow = await queryHelpers.queryOne(
      `SELECT s.*
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [(assignment as any).session_id, admin.organizationId, admin.organizationId]
    );
    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Canon: send-back is a quality decision, not a completeness math gate.
    // It requires a reason and sends the session back to editable state.

    const now = new Date().toISOString();

    // #48B — snapshot the current answers BEFORE send-back so a subsequent
    // re-submit never silently loses what was there before (migration 923,
    // interview_answer_history). Fail-open: a snapshot hiccup must never
    // block the send-back itself — history is an audit nicety on top.
    try {
      await snapshotInterviewAnswers({
        organizationId: admin.organizationId,
        assignmentId: id,
        sessionId: (assignment as any).session_id,
        reason: 'send_back',
        savedAt: now,
        savedBy: admin.id,
      });
    } catch (err) {
      logger.warn(
        '[InterviewController] sendBackAssignment: answer-history snapshot skipped (fail-open)',
        err
      );
    }

    const missingItemsJson = JSON.stringify(normalizedMissingItems);
    const aiReview = parseAiReviewSnapshot((assignment as any)?.ai_review_snapshot_json);
    const reviewDecisionMemory = appendInterviewReviewDecisionMemory({
      existing: parseReviewDecisionMemory((assignment as any)?.review_decision_memory_json),
      action: 'send_back',
      actorId: admin.id,
      actorRole: admin.role,
      aiReview,
      reason: normalizedReason,
      missingItems: normalizedMissingItems,
      createdAt: now,
    });
    const reviewDecisionMemoryJson = JSON.stringify(reviewDecisionMemory);
    try {
      await queryHelpers.queryRun(
        `UPDATE interview_assignments
         SET status = 'in_progress', sent_back_at = ?, sent_back_reason = ?, missing_items_json = ?, review_decision_memory_json = ?, updated_at = ?
         WHERE id = ?`,
        [now, normalizedReason, missingItemsJson, reviewDecisionMemoryJson, now, id]
      );
    } catch (error) {
      // Back-compat for environments without missing_items_json column.
      await queryHelpers.queryRun(
        `UPDATE interview_assignments
         SET status = 'in_progress', sent_back_at = ?, sent_back_reason = ?, review_decision_memory_json = ?, updated_at = ?
         WHERE id = ?`,
        [now, normalizedReason, reviewDecisionMemoryJson, now, id]
      );
      logger.warn(
        '[InterviewController] sendBackAssignment: missing_items_json column unavailable, using reason-only fallback'
      );
      logger.debug('[InterviewController] sendBackAssignment fallback details', error);
    }

    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET status = 'active', updated_at = ?, last_activity_at = ? WHERE id = ?`,
      [now, now, (assignment as any).session_id]
    );

    if ((assignment as any).task_id) {
      await queryHelpers.queryRun(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`, [
        'in_progress',
        now,
        (assignment as any).task_id,
      ]);
    }

    const updated = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );
    const updatedSession = await queryHelpers.queryOne(
      `SELECT * FROM interview_sessions WHERE id = ?`,
      [(assignment as any).session_id]
    );

    // Notify assignee(s) that interview was sent back (team-aware).
    try {
      const recipients = new Set<string>();
      if ((assignment as any).assignee_user_id)
        recipients.add(String((assignment as any).assignee_user_id));
      try {
        const memberRows = await queryHelpers.queryAll(
          `SELECT user_id FROM interview_assignment_members WHERE assignment_id = ?`,
          [id]
        );
        (memberRows || []).forEach((r: any) => {
          if (r?.user_id) recipients.add(String(r.user_id));
        });
      } catch {
        // ignore - members table may not exist
      }
      for (const userId of recipients) {
        await notificationService.send({
          userId,
          organizationId: admin.organizationId,
          type: 'interview_sent_back',
          title: 'Interview sent back for revision',
          body: `${normalizedReason} (${normalizedMissingItems.length} missing item(s))`,
          entityType: 'interview_assignment',
          entityId: id,
          actionUrl: `/interview?assignmentId=${id}`,
          priority: 'high',
          actorId: admin.id,
        });
      }
    } catch (e) {
      logger.warn('[InterviewController] Failed to send interview_sent_back notification', e);
    }

    // D18-A hard wall — sendBackAssignment is always called by the reviewer
    // (never the respondent), so an anonymous assignment always gets the
    // score-only redaction here. Also strip the raw ai_review_snapshot_json
    // string from both spreads below — it would otherwise bypass the
    // redacted `aiReview` field.
    const sendBackWallActive = isAnonymityWallActive(updated, admin.id, 'assignee_user_id');
    const { ai_review_snapshot_json: _sendBackRawAiReviewJson, ...updatedWithoutRawAiReview } =
      (updated as any) || {};
    const sendBackAiReview = sendBackWallActive
      ? redactAiReviewSnapshotForAnonymity(
          parseAiReviewSnapshot((updated as any)?.ai_review_snapshot_json)
        )
      : parseAiReviewSnapshot((updated as any)?.ai_review_snapshot_json);

    res.json({
      ...updatedWithoutRawAiReview,
      status: normalizeAssignmentStatusForClient((updated as any)?.status),
      missingItems: parseMissingItems((updated as any)?.missing_items_json),
      aiReview: sendBackAiReview,
      aiReviewedAt: (updated as any)?.ai_reviewed_at || null,
      reviewDecisionMemory: parseReviewDecisionMemory(
        (updated as any)?.review_decision_memory_json
      ),
      assignment: {
        ...updatedWithoutRawAiReview,
        status: normalizeAssignmentStatusForClient((updated as any)?.status),
        missingItems: parseMissingItems((updated as any)?.missing_items_json),
        aiReview: sendBackAiReview,
        aiReviewedAt: (updated as any)?.ai_reviewed_at || null,
        reviewDecisionMemory: parseReviewDecisionMemory(
          (updated as any)?.review_decision_memory_json
        ),
      },
      session: buildSessionResponse(updatedSession),
    });
  }),

  /**
   * #48B — GET /interview/assignments/:id/answer-history
   * Read-only history of answer snapshots taken on send-back
   * (interview_answer_history, migration 923). Manager-facing: lets the
   * reviewer see "previous version" per question after a send-back →
   * re-submit cycle, without a new screen (tooltip/expand in the existing
   * review view). Grouped by question_id, newest first within each question.
   */
  getAnswerHistory: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admin = requireUser(req);
    const { id } = req.params;

    const assignment = await queryHelpers.queryOne(
      `SELECT id, session_id FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, admin.organizationId]
    );
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    await ensureInterviewAnswerHistoryTable();

    const rows = await queryHelpers.queryAll(
      `SELECT h.id, h.question_id, h.answer_text, h.reason, h.saved_at, h.saved_by,
              q.question_text
         FROM interview_answer_history h
         LEFT JOIN interview_questions q ON q.id = h.question_id
        WHERE h.assignment_id = ?
          AND h.organization_id = ?
        ORDER BY h.question_id, h.saved_at DESC`,
      [id, admin.organizationId]
    );

    const byQuestion: Record<
      string,
      Array<{
        id: string;
        answerText: string | null;
        reason: string;
        savedAt: string;
        savedBy: string | null;
        questionText: string | null;
      }>
    > = {};
    for (const row of (rows || []) as any[]) {
      const qid = String(row.question_id);
      if (!byQuestion[qid]) byQuestion[qid] = [];
      byQuestion[qid].push({
        id: row.id,
        answerText: row.answer_text ?? null,
        reason: row.reason || 'send_back',
        savedAt: row.saved_at,
        savedBy: row.saved_by ?? null,
        questionText: row.question_text ?? null,
      });
    }

    res.json({ assignmentId: id, byQuestion });
  }),

  approveAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const reviewer = requireUser(req);
    const { id } = req.params;
    await ensureInterviewAssignmentAiReviewColumns();

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, reviewer.organizationId]
    );
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    const approveGate = evaluateGatePolicy({
      action: 'APPROVE_INTERVIEW',
      contextType: 'interview_assignment',
      user: reviewer,
      context: { assignment },
    });
    if (!approveGate.allow) {
      const gateError = approveGate as {
        allow: false;
        error: string;
        code?: 'FORBIDDEN' | 'INVALID_STATE' | 'MISSING_DATA';
      };
      res.status(gateError.code === 'INVALID_STATE' ? 409 : 400).json({ error: gateError.error });
      return;
    }

    const sessionRow = await queryHelpers.queryOne(
      `SELECT s.*
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [(assignment as any).session_id, reviewer.organizationId, reviewer.organizationId]
    );
    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const answered = Number((sessionRow as any).answered_questions || 0);
    const total = Number((sessionRow as any).total_questions || 0);
    const completenessRatio = calcCompletenessRatio(answered, total);
    const completenessPercent = Math.round(completenessRatio * 100);

    // Canon default: require minimum completeness to allow approval
    if (completenessRatio < 0.5) {
      res.status(409).json({ error: 'Cannot approve: completeness is < 50%' });
      return;
    }

    const now = new Date().toISOString();
    const aiReview = parseAiReviewSnapshot((assignment as any)?.ai_review_snapshot_json);
    const reviewDecisionMemory = appendInterviewReviewDecisionMemory({
      existing: parseReviewDecisionMemory((assignment as any)?.review_decision_memory_json),
      action: 'approve',
      actorId: reviewer.id,
      actorRole: reviewer.role,
      aiReview,
      createdAt: now,
    });
    await queryHelpers.queryRun(
      `UPDATE interview_assignments
       SET status = 'approved', review_decision_memory_json = ?, updated_at = ?
       WHERE id = ?`,
      [JSON.stringify(reviewDecisionMemory), now, id]
    );
    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, (assignment as any).session_id]
    );

    if ((assignment as any).task_id) {
      await queryHelpers.queryRun(
        `UPDATE tasks SET status = ?, progress = ?, updated_at = ? WHERE id = ?`,
        ['done', 100, now, (assignment as any).task_id]
      );
    }

    // Notify assignee(s) that interview is approved (team-aware).
    try {
      const recipients = new Set<string>();
      if ((assignment as any).assignee_user_id)
        recipients.add(String((assignment as any).assignee_user_id));
      try {
        const memberRows = await queryHelpers.queryAll(
          `SELECT user_id FROM interview_assignment_members WHERE assignment_id = ?`,
          [id]
        );
        (memberRows || []).forEach((r: any) => {
          if (r?.user_id) recipients.add(String(r.user_id));
        });
      } catch {
        // ignore - members table may not exist
      }
      for (const userId of recipients) {
        await notificationService.send({
          userId,
          organizationId: reviewer.organizationId,
          type: 'interview_approved',
          title: 'Interview approved',
          body: 'Your interview submission has been approved.',
          entityType: 'interview_assignment',
          entityId: id,
          actionUrl: `/interview?assignmentId=${id}`,
          priority: 'normal',
          actorId: reviewer.id,
        });
      }
    } catch (e) {
      logger.warn('[InterviewController] Failed to send interview_approved notification', e);
    }

    const updatedAssignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );
    const updatedSession = await queryHelpers.queryOne(
      `SELECT * FROM interview_sessions WHERE id = ?`,
      [(assignment as any).session_id]
    );

    // D18-A hard wall — approveAssignment is always called by the reviewer
    // (never the respondent); redact + strip the raw snapshot JSON the same
    // way as sendBackAssignment above.
    const approveWallActive = isAnonymityWallActive(
      updatedAssignment,
      reviewer.id,
      'assignee_user_id'
    );
    const {
      ai_review_snapshot_json: _approveRawAiReviewJson,
      ...updatedAssignmentWithoutRawAiReview
    } = (updatedAssignment as any) || {};

    res.json({
      assignment: {
        ...updatedAssignmentWithoutRawAiReview,
        aiReview: approveWallActive
          ? redactAiReviewSnapshotForAnonymity(
              parseAiReviewSnapshot((updatedAssignment as any)?.ai_review_snapshot_json)
            )
          : parseAiReviewSnapshot((updatedAssignment as any)?.ai_review_snapshot_json),
        aiReviewedAt: (updatedAssignment as any)?.ai_reviewed_at || null,
        reviewDecisionMemory: parseReviewDecisionMemory(
          (updatedAssignment as any)?.review_decision_memory_json
        ),
      },
      session: buildSessionResponse(updatedSession),
      completenessPercent,
      entersContext: true,
    });
  }),

  // ==========================================
  // EXTENDED ASSIGNMENTS (Team, Reminders, Counts)
  // ==========================================

  getManagedAssignments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { status, projectId } = req.query as any;
    // Lazy-ensure lifecycle columns before filtering on archived_at (dev schema).
    await ensureInterviewAssignmentLifecycleColumns();
    const lifecycle = normalizeAssignmentLifecycleParam(req.query.lifecycle);
    const scope = await resolveInterviewManagerScope({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });
    const scopeClause = buildAssignmentManagerScopeClause(scope, { assignmentAlias: 'a' });
    const params: unknown[] = [user.organizationId, ...scopeClause.params];
    let where = `WHERE a.organization_id = ?${scopeClause.clause}`;
    // Default excludes archived; ?lifecycle=archived|all to include.
    where += buildAssignmentLifecycleClause(lifecycle, 'a');

    if (status) {
      where += ` AND a.status = ?`;
      params.push(status);
    }
    if (projectId) {
      where += ` AND a.project_id = ?`;
      params.push(projectId);
    }

    const rows = await queryHelpers.queryAll(
      `SELECT
         a.*,
         t.name as template_name,
         t.description as template_description,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions,
         s.total_questions,
         (u.first_name || ' ' || u.last_name) as assignee_name,
         u.email as assignee_email
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       ${where}
       ORDER BY a.created_at DESC`,
      params
    );

    const mapped = (rows || []).map((r: any) => {
      const answered = Number(r.answered_questions || 0);
      const total = Number(r.total_questions || 0);
      return {
        id: r.id,
        organizationId: r.organization_id,
        projectId: r.project_id || null,
        status: normalizeAssignmentStatusForClient(r.status),
        sessionId: r.session_id || null,
        priority: r.priority || 'medium',
        dueAt: r.due_at || null,
        startedAt: r.started_at || null,
        submittedAt: r.submitted_at || null,
        sentBackAt: r.sent_back_at || null,
        sentBackReason: r.sent_back_reason || null,
        missingItems: parseMissingItems(r.missing_items_json),
        // D18-A hard wall — getManagedAssignments is a manager-only list (the
        // viewer is never the respondent here), so any anonymous assignment
        // always gets the score-only redaction.
        aiReview: isAnonymityWallActive(r, user.id, 'assignee_user_id')
          ? redactAiReviewSnapshotForAnonymity(parseAiReviewSnapshot(r.ai_review_snapshot_json))
          : parseAiReviewSnapshot(r.ai_review_snapshot_json),
        aiReviewedAt: r.ai_reviewed_at || null,
        reviewDecisionMemory: parseReviewDecisionMemory(r.review_decision_memory_json),
        isTeamAssignment: flagOn(r.is_team_assignment), // bigint on PG → coerce
        reminderCount: r.reminder_count || 0,
        escalationCount: r.escalation_count || 0,
        escalatedAt: r.escalated_at || null,
        archivedAt: r.archived_at || null,
        createdAt: r.created_at,
        template: {
          id: r.template_id,
          version: r.template_version,
          name: r.template_name || '',
          description: r.template_description || '',
          category:
            typeof r.template_category === 'string'
              ? r.template_category.toLowerCase()
              : r.template_category,
        },
        session: r.session_id
          ? {
              id: r.session_id,
              status: r.session_status,
              answeredQuestions: answered,
              totalQuestions: total,
              completenessPercent: Math.round(calcCompletenessRatio(answered, total) * 100),
            }
          : null,
        assignee: r.assignee_name
          ? {
              id: r.assignee_user_id,
              name: r.assignee_name,
              email: r.assignee_email,
            }
          : null,
      };
    });

    res.json(mapped);
  }),

  /**
   * Manual "escalate now" (#9b). Advances the escalation counter and notifies the
   * designated escalation target (escalate_to, falling back to created_by) in-app,
   * recording the event in interview_notifications. Mirrors the core of
   * InterviewAssignmentService.checkAndEscalate but for a single org-scoped assignment,
   * without the overdue/24h gating (the manager is explicitly forcing it).
   */
  escalateAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admin = requireUser(req);
    const { id } = req.params;
    await ensureInterviewAssignmentLifecycleColumns();

    const assignment = await queryHelpers.queryOne<any>(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, admin.organizationId]
    );
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const now = new Date().toISOString();
    const targetUserId = String(assignment.escalate_to || assignment.created_by || '').trim();

    if (targetUserId) {
      // Resolve target + template/assignee names for a useful notification body.
      const target = await queryHelpers.queryOne<any>(
        `SELECT id, email, first_name, last_name FROM users WHERE id = ?`,
        [targetUserId]
      );
      const template = await queryHelpers.queryOne<any>(
        `SELECT name FROM interview_library_templates WHERE id = ?`,
        [assignment.template_id]
      );
      const assignee = assignment.assignee_user_id
        ? await queryHelpers.queryOne<any>(
            `SELECT first_name, last_name, email FROM users WHERE id = ?`,
            [assignment.assignee_user_id]
          )
        : null;
      const templateName = String(template?.name || 'Interview');
      const assigneeName =
        `${String(assignee?.first_name || '').trim()} ${String(assignee?.last_name || '').trim()}`.trim() ||
        assignee?.email ||
        'the assignee';

      if (target?.id) {
        try {
          await notificationService.send({
            userId: target.id,
            organizationId: admin.organizationId,
            type: 'interview_escalation',
            title: 'Interview Assignment Escalated',
            body: `The interview "${templateName}" assigned to ${assigneeName} has been escalated for your attention.`,
            entityType: 'interview_assignment',
            entityId: id,
            actionUrl: `/interview?assignmentId=${id}`,
            priority: 'high',
            actorId: admin.id,
          });
        } catch (e) {
          logger.warn('[InterviewController] Failed to send interview_escalation notification', e);
        }

        // Best-effort audit row (table is created by InterviewAssignmentService).
        try {
          await queryHelpers.queryRun(
            `INSERT INTO interview_notifications (id, assignment_id, user_id, type, channel, title, body, sent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `in_${uuidv4()}`,
              id,
              target.id,
              'escalation',
              'in_app',
              'Interview Assignment Escalated',
              `Manually escalated by ${admin.id}`,
              now,
            ]
          );
        } catch {
          // interview_notifications may not exist yet in some dev schemas — ignore.
        }
      }
    } else {
      logger.warn(
        `[InterviewController] escalateAssignment: no escalation target resolved for ${id}`
      );
    }

    await queryHelpers.queryRun(
      `UPDATE interview_assignments
       SET escalated_at = ?, escalation_count = COALESCE(escalation_count, 0) + 1, updated_at = ?
       WHERE id = ?`,
      [now, now, id]
    );

    const updated = await queryHelpers.queryOne<any>(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );
    // D18-A hard wall — strip the raw ai_review_snapshot_json string before
    // spreading; this endpoint never surfaces a parsed `aiReview` field, but
    // the raw string would otherwise leak per-answer feedback/justification.
    const { ai_review_snapshot_json: _escalateRawAiReviewJson, ...updatedWithoutRawAiReview } =
      (updated as any) || {};
    res.json({
      success: true,
      ...updatedWithoutRawAiReview,
      status: normalizeAssignmentStatusForClient((updated as any)?.status),
      escalatedAt: (updated as any)?.escalated_at || null,
      escalationCount: (updated as any)?.escalation_count || 0,
      archivedAt: (updated as any)?.archived_at || null,
      escalationTargetId: targetUserId || null,
    });
  }),

  /** Archive an assignment (#8) — org-scoped, sets archived_at/by. */
  archiveAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admin = requireUser(req);
    const { id } = req.params;
    await ensureInterviewAssignmentLifecycleColumns();

    const assignment = await queryHelpers.queryOne<any>(
      `SELECT id FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, admin.organizationId]
    );
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE interview_assignments SET archived_at = ?, archived_by = ?, updated_at = ? WHERE id = ?`,
      [now, admin.id, now, id]
    );

    const updated = await queryHelpers.queryOne<any>(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );
    res.json({
      success: true,
      ...(updated || {}),
      status: normalizeAssignmentStatusForClient((updated as any)?.status),
      archivedAt: (updated as any)?.archived_at || null,
    });
  }),

  /** Restore (un-archive) an assignment (#8) — org-scoped, clears archived_at/by. */
  restoreAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admin = requireUser(req);
    const { id } = req.params;
    await ensureInterviewAssignmentLifecycleColumns();

    const assignment = await queryHelpers.queryOne<any>(
      `SELECT id FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, admin.organizationId]
    );
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE interview_assignments SET archived_at = NULL, archived_by = NULL, updated_at = ? WHERE id = ?`,
      [now, id]
    );

    const updated = await queryHelpers.queryOne<any>(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );
    res.json({
      success: true,
      ...(updated || {}),
      status: normalizeAssignmentStatusForClient((updated as any)?.status),
      archivedAt: (updated as any)?.archived_at || null,
    });
  }),

  getOverdueAssignments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const now = new Date().toISOString();
    const scope = await resolveInterviewManagerScope({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });
    const scopeClause = buildAssignmentManagerScopeClause(scope, { assignmentAlias: 'a' });

    const rows = await queryHelpers.queryAll(
      `SELECT
         a.*,
         t.name as template_name,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions,
         s.total_questions,
         (u.first_name || ' ' || u.last_name) as assignee_name,
         u.email as assignee_email
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       WHERE a.organization_id = ?
         ${scopeClause.clause}
         AND a.due_at IS NOT NULL
         AND a.due_at < ?
         AND a.status NOT IN ('approved', 'completed', 'submitted')
       ORDER BY a.due_at ASC`,
      [user.organizationId, ...scopeClause.params, now]
    );

    const mapped = (rows || []).map((r: any) => {
      const answered = Number(r.answered_questions || 0);
      const total = Number(r.total_questions || 0);
      const dueAt = new Date(r.due_at);
      const overdueDays = Math.floor((Date.now() - dueAt.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: r.id,
        organizationId: r.organization_id,
        projectId: r.project_id || null,
        status: normalizeAssignmentStatusForClient(r.status),
        sessionId: r.session_id || null,
        priority: r.priority || 'medium',
        dueAt: r.due_at,
        overdueDays,
        template: {
          id: r.template_id,
          name: r.template_name || '',
          category: r.template_category,
        },
        session: r.session_id
          ? {
              id: r.session_id,
              status: r.session_status,
              completenessPercent: Math.round(calcCompletenessRatio(answered, total) * 100),
            }
          : null,
        assignee: {
          id: r.assignee_user_id,
          name: r.assignee_name,
          email: r.assignee_email,
        },
      };
    });

    res.json(mapped);
  }),

  getAssignmentCounts: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const now = new Date().toISOString();
    const scope = await resolveInterviewManagerScope({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });
    const countScopeClause = buildAssignmentManagerScopeClause(scope, {
      assignmentAlias: 'interview_assignments',
    });

    // My assignments count (including team memberships)
    let myResult: any = null;
    try {
      myResult = await queryHelpers.queryOne(
        `SELECT COUNT(DISTINCT a.id) as count
         FROM interview_assignments a
         LEFT JOIN interview_assignment_members m ON m.assignment_id = a.id
         WHERE a.organization_id = ?
           AND (a.assignee_user_id = ? OR m.user_id = ?)
           AND a.status NOT IN ('approved', 'completed')`,
        [user.organizationId, user.id, user.id]
      );
    } catch {
      // Back-compat: environments without `interview_assignment_members`.
      myResult = await queryHelpers.queryOne(
        `SELECT COUNT(*) as count
         FROM interview_assignments
         WHERE organization_id = ? AND assignee_user_id = ? AND status NOT IN ('approved', 'completed')`,
        [user.organizationId, user.id]
      );
    }

    // Managed assignments count
    const managedResult = await queryHelpers.queryOne(
      `SELECT COUNT(*) as count
       FROM interview_assignments
       WHERE organization_id = ?
         ${countScopeClause.clause}`,
      [user.organizationId, ...countScopeClause.params]
    );

    // Overdue count (managed only)
    const overdueResult = await queryHelpers.queryOne(
      `SELECT COUNT(*) as count
       FROM interview_assignments
       WHERE organization_id = ?
         ${countScopeClause.clause}
         AND due_at IS NOT NULL
         AND due_at < ?
         AND status NOT IN ('approved', 'completed', 'submitted')`,
      [user.organizationId, ...countScopeClause.params, now]
    );

    res.json({
      my: (myResult as any)?.count || 0,
      managed: (managedResult as any)?.count || 0,
      overdue: (overdueResult as any)?.count || 0,
    });
  }),

  getAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT
         a.*,
         t.name as template_name,
         t.description as template_description,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions,
         s.total_questions,
         (u.first_name || ' ' || u.last_name) as assignee_name,
         u.email as assignee_email,
         (creator.first_name || ' ' || creator.last_name) as creator_name
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       LEFT JOIN users creator ON creator.id = a.created_by
       WHERE a.id = ? AND a.organization_id = ?`,
      [id, user.organizationId]
    );

    if (!row) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const r = row as any;
    const answered = Number(r.answered_questions || 0);
    const total = Number(r.total_questions || 0);

    // Load team members if team assignment
    let members: any[] = [];
    if (flagOn(r.is_team_assignment)) {
      members = await queryHelpers.queryAll(
        `SELECT m.*, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as user_name, u.email as user_email
         FROM interview_assignment_members m
         LEFT JOIN users u ON u.id = m.user_id
         WHERE m.assignment_id = ?`,
        [id]
      );
    }

    res.json({
      id: r.id,
      organizationId: r.organization_id,
      projectId: r.project_id || null,
      status: normalizeAssignmentStatusForClient(r.status),
      priority: r.priority || 'medium',
      dueAt: r.due_at || null,
      startedAt: r.started_at || null,
      submittedAt: r.submitted_at || null,
      sentBackAt: r.sent_back_at || null,
      sentBackReason: r.sent_back_reason || null,
      missingItems: parseMissingItems(r.missing_items_json),
      // D18-A hard wall — the assignee always sees their own full AI review;
      // anyone else (manager/creator) gets score/rubric numbers only for an
      // anonymous assignment, never per-answer feedback/justification text.
      aiReview: isAnonymityWallActive(r, user.id, 'assignee_user_id')
        ? redactAiReviewSnapshotForAnonymity(parseAiReviewSnapshot(r.ai_review_snapshot_json))
        : parseAiReviewSnapshot(r.ai_review_snapshot_json),
      aiReviewedAt: r.ai_reviewed_at || null,
      reviewDecisionMemory: parseReviewDecisionMemory(r.review_decision_memory_json),
      notes: r.notes || null,
      isTeamAssignment: flagOn(r.is_team_assignment),
      reminderSentAt: r.reminder_sent_at || null,
      reminderCount: r.reminder_count || 0,
      escalatedAt: r.escalated_at || null,
      escalationCount: r.escalation_count || 0,
      createdBy: r.created_by,
      creatorName: r.creator_name,
      createdAt: r.created_at,
      template: {
        id: r.template_id,
        version: r.template_version,
        name: r.template_name || '',
        description: r.template_description || '',
        category:
          typeof r.template_category === 'string'
            ? r.template_category.toLowerCase()
            : r.template_category,
      },
      session: r.session_id
        ? {
            id: r.session_id,
            status: r.session_status,
            answeredQuestions: answered,
            totalQuestions: total,
            completenessPercent: Math.round(calcCompletenessRatio(answered, total) * 100),
          }
        : null,
      assignee: {
        id: r.assignee_user_id,
        name: r.assignee_name,
        email: r.assignee_email,
      },
      members: (members || []).map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        userName: m.user_name,
        userEmail: m.user_email,
        role: m.role,
        progressPercent: m.progress_percent || 0,
        joinedAt: m.joined_at,
        completedAt: m.completed_at,
      })),
    });
  }),

  updateAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { dueAt, priority, notes, assigneeUserId } = req.body || {};

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    const now = new Date().toISOString();

    if (dueAt !== undefined) {
      updates.push('due_at = ?');
      params.push(dueAt);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (assigneeUserId !== undefined && (existing as any).status === 'assigned') {
      // Can only reassign if not started.
      // V-A (reassign) — cross-org assignee IDOR guard. Mirror createAssignment's
      // org-membership check: the new assignee MUST belong to the caller's org,
      // otherwise a manager could reassign an interview to a foreign-org user id.
      const newAssigneeId = String(assigneeUserId || '').trim();
      if (!newAssigneeId) {
        res.status(400).json({ error: 'assigneeUserId must be a non-empty user id' });
        return;
      }
      const assigneeMember = await queryHelpers.queryOne(
        `SELECT user_id FROM organization_members WHERE organization_id = ? AND user_id = ?`,
        [user.organizationId, newAssigneeId]
      );
      if (!assigneeMember) {
        res.status(404).json({
          error: 'Assignee is not a member of your organization.',
          code: 'ASSIGNEE_NOT_IN_ORG',
        });
        return;
      }
      updates.push('assignee_user_id = ?');
      params.push(newAssigneeId);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await queryHelpers.queryRun(
      `UPDATE interview_assignments SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Update mirror task if deadline changed
    if (dueAt !== undefined && (existing as any).task_id) {
      await queryHelpers.queryRun(`UPDATE tasks SET due_date = ?, updated_at = ? WHERE id = ?`, [
        dueAt,
        now,
        (existing as any).task_id,
      ]);
    }

    const updated = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );
    res.json(updated);
  }),

  deleteAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    if ((existing as any).status !== 'assigned') {
      res.status(409).json({ error: 'Cannot delete assignment that has been started' });
      return;
    }

    // Delete mirror task
    if ((existing as any).task_id) {
      await queryHelpers.queryRun(`DELETE FROM tasks WHERE id = ?`, [(existing as any).task_id]);
    }

    // Delete team members
    await queryHelpers.queryRun(
      `DELETE FROM interview_assignment_members WHERE assignment_id = ?`,
      [id]
    );

    // Delete assignment
    await queryHelpers.queryRun(`DELETE FROM interview_assignments WHERE id = ?`, [id]);

    res.json({ success: true, deletedId: id });
  }),

  sendAssignmentReminder: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const assignment = await queryHelpers.queryOne(
      `SELECT a.*, t.name as template_name
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       WHERE a.id = ? AND a.organization_id = ?`,
      [id, user.organizationId]
    );

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    // Import service dynamically to avoid circular deps
    const { default: interviewAssignmentService } =
      await import('../services/InterviewAssignmentService.js');
    await interviewAssignmentService.sendReminder(id, user.id);

    res.json({ success: true, message: 'Reminder sent' });
  }),

  // ==========================================
  // TEAM MEMBER MANAGEMENT
  // ==========================================

  getAssignmentMembers: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const members = await queryHelpers.queryAll(
      `SELECT m.*, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as user_name, u.email as user_email
       FROM interview_assignment_members m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.assignment_id = ?`,
      [id]
    );

    res.json(
      (members || []).map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        userName: m.user_name,
        userEmail: m.user_email,
        role: m.role,
        progressPercent: m.progress_percent || 0,
        joinedAt: m.joined_at,
        completedAt: m.completed_at,
      }))
    );
  }),

  addAssignmentMember: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { userId, role = 'member' } = req.body || {};

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    // Check if user already a member
    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignment_members WHERE assignment_id = ? AND user_id = ?`,
      [id, userId]
    );

    if (existing) {
      res.status(409).json({ error: 'User is already a member of this assignment' });
      return;
    }

    const memberId = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_assignment_members
       (id, assignment_id, user_id, role, progress_percent, joined_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, id, userId, role, 0, now, now, now]
    );

    // Mark assignment as team if not already
    await queryHelpers.queryRun(
      `UPDATE interview_assignments SET is_team_assignment = 1, updated_at = ? WHERE id = ?`,
      [now, id]
    );

    const member = await queryHelpers.queryOne(
      `SELECT m.*, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as user_name, u.email as user_email
       FROM interview_assignment_members m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
      [memberId]
    );

    res.status(201).json({
      id: (member as any).id,
      userId: (member as any).user_id,
      userName: (member as any).user_name,
      userEmail: (member as any).user_email,
      role: (member as any).role,
      progressPercent: 0,
      joinedAt: now,
    });
  }),

  removeAssignmentMember: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id, userId } = req.params;

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    // Cannot remove primary assignee
    if ((assignment as any).assignee_user_id === userId) {
      res
        .status(409)
        .json({ error: 'Cannot remove primary assignee. Reassign the assignment first.' });
      return;
    }

    await queryHelpers.queryRun(
      `DELETE FROM interview_assignment_members WHERE assignment_id = ? AND user_id = ?`,
      [id, userId]
    );

    // Check remaining members
    const remaining = await queryHelpers.queryOne(
      `SELECT COUNT(*) as count FROM interview_assignment_members WHERE assignment_id = ?`,
      [id]
    );

    // If only one member left, mark as non-team
    if ((remaining as any)?.count <= 1) {
      await queryHelpers.queryRun(
        `UPDATE interview_assignments SET is_team_assignment = 0, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), id]
      );
    }

    res.json({ success: true, removedUserId: userId });
  }),

  // ==========================================
  // TEMPLATES (Library)
  // ==========================================

  getTemplates: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    await ensureInterviewTemplateV6Columns();
    const sourceFilter = String(req.query?.source || 'all')
      .trim()
      .toLowerCase();
    const requestedAreaTags = normalizeTemplateAreaTags(
      typeof req.query?.areaTags === 'string'
        ? req.query.areaTags
        : Array.isArray(req.query?.areaTags)
          ? req.query.areaTags.join(',')
          : ''
    );

    // Resolve org language for system template filtering (default: 'en')
    let orgLanguage = 'en';
    try {
      const langRow = await queryHelpers.queryOne(
        `SELECT setting_value FROM organization_settings WHERE organization_id = ? AND setting_key = 'language'`,
        [user.organizationId]
      );
      if (langRow && (langRow as any).setting_value) {
        orgLanguage = String((langRow as any).setting_value)
          .trim()
          .toLowerCase()
          .substring(0, 2);
      }
    } catch {
      /* fallback to 'en' */
    }

    const rows = await queryHelpers.queryAll(
      `SELECT
         t.*,
         (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count,
         (SELECT COUNT(1) FROM interview_sessions s 
          JOIN projects p ON p.id = s.project_id 
          WHERE s.template_id = t.id AND p.organization_id = ?) as sessions_used
       FROM interview_library_templates t
       WHERE (
         (
           COALESCE(NULLIF(t.template_scope, ''), CASE WHEN t.organization_id IS NULL THEN 'system' ELSE 'organization' END) = 'system'
           AND (t.language IS NULL OR t.language = ? OR NOT EXISTS (
             SELECT 1 FROM interview_library_templates t2
             WHERE t2.template_scope = 'system' AND t2.category = t.category AND t2.language = ?
           ))
         )
         OR (
           COALESCE(NULLIF(t.template_scope, ''), CASE WHEN t.organization_id IS NULL THEN 'system' ELSE 'organization' END) = 'organization'
           AND t.organization_id = ?
         )
         OR (
           COALESCE(NULLIF(t.template_scope, ''), CASE WHEN t.organization_id IS NULL THEN 'system' ELSE 'organization' END) = 'private'
           AND t.organization_id = ?
           AND t.created_by = ?
         )
       )
         AND (t.visibility != 'admin_only' OR ? IN ('ADMIN', 'SUPERADMIN') OR t.created_by = ?)
       ORDER BY
         CASE t.status WHEN 'approved' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
         t.is_default DESC,
         t.category ASC,
         t.name ASC`,
      [
        user.organizationId,
        orgLanguage,
        orgLanguage,
        user.organizationId,
        user.organizationId,
        user.id,
        user.role,
        user.id,
      ]
    );

    const templates = (rows || [])
      .map(buildTemplateResponse)
      .filter((template): template is NonNullable<ReturnType<typeof buildTemplateResponse>> =>
        Boolean(template)
      );

    const filtered = templates.filter((template) => {
      if (!matchesTemplateSourceFilter(template.scope, sourceFilter)) {
        return false;
      }
      if (requestedAreaTags.length > 0) {
        const tags = Array.isArray(template.areaTags) ? template.areaTags : [];
        if (!requestedAreaTags.every((tag) => tags.includes(tag))) {
          return false;
        }
      }
      return true;
    });

    res.json(filtered);
  }),

  getTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    await ensureInterviewTemplateV6Columns();

    const row = await queryHelpers.queryOne(
      `SELECT
         t.*,
         (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count
       FROM interview_library_templates t
       WHERE t.id = ?`,
      [id]
    );

    if (!row || !canAccessTemplate(row, user)) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json(buildTemplateResponse(row));
  }),

  getTemplateQuestions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    await ensureInterviewTemplateV6Columns();
    await ensureInterviewTemplateQuestionV6Columns();

    const tpl = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ?`,
      [id]
    );
    if (!tpl || !canAccessTemplate(tpl, user)) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const rows = await queryHelpers.queryAll(
      `SELECT * FROM interview_library_template_questions WHERE template_id = ? ORDER BY category, sort_order`,
      [id]
    );

    res.json((rows || []).map(buildTemplateQuestionResponse));
  }),

  useTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { projectId, name } = req.body || {};

    try {
      const tpl = await queryHelpers.withPgTransaction(async (tx) => {
        const result = await tx.query(`SELECT * FROM interview_library_templates WHERE id = ?`, [
          id,
        ]);
        return result.rows[0] as any;
      });
      if (!tpl || !canAccessTemplate(tpl, user)) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      if (String((tpl as any).status || '').toLowerCase() !== 'approved') {
        res.status(400).json({ error: 'Template is not approved yet' });
        return;
      }

      const session = await createSessionFromTemplate({ user, templateId: id, projectId, name });
      res.status(201).json(session);
    } catch (err: any) {
      const msg = String(err?.message || 'Failed to use template');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: msg });
        return;
      }
      if (msg.toLowerCase().includes('permission')) {
        res.status(403).json({ error: msg });
        return;
      }
      logger.error('[InterviewController] useTemplate error:', err);
      res
        .status(500)
        .json({ error: 'Failed to use template', code: 'INTERVIEW_USE_TEMPLATE_FAILED' });
    }
  }),

  // ==========================================
  // TEMPLATES MANAGEMENT (create, edit, delete, clone)
  // ==========================================

  createTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    await ensureInterviewTemplateV6Columns();
    await ensureInterviewTemplateQuestionV6Columns();
    const {
      name,
      description,
      category,
      status,
      visibility,
      isDefault,
      scope,
      audience,
      estimatedTimeMinutes,
      runtimeModeDefault,
      answerDesignGuide,
      areaTags,
    } = req.body || {};

    if (!name?.trim()) {
      res.status(400).json({ error: 'Template name is required' });
      return;
    }

    const templateId = uuidv4();
    const now = new Date().toISOString();
    const templateScope = resolveRequestedTemplateScope({
      requestedScope: scope,
      requestedVisibility: visibility,
      userRole: user.role,
    });
    const storagePolicy = resolveTemplateStoragePolicy({
      scope: templateScope,
      organizationId: user.organizationId,
      requestedVisibility: visibility,
    });

    const normalizedAreaTags = normalizeTemplateAreaTags(areaTags);

    const created = await queryHelpers.withPgTransaction(async (tx) => {
      const result = await tx.query(
        `INSERT INTO interview_library_templates
         (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, answer_design_guide, area_tags, is_default, version, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
        [
          templateId,
          storagePolicy.organizationId,
          name.trim(),
          description || '',
          category || 'CUSTOM',
          status || 'draft',
          storagePolicy.visibility,
          templateScope,
          audience || '',
          Number.isFinite(Number(estimatedTimeMinutes)) ? Number(estimatedTimeMinutes) : 10,
          runtimeModeDefault || 'one_question_per_screen',
          answerDesignGuide || '',
          JSON.stringify(normalizedAreaTags),
          // M03R-002 (P2): jedno kodowanie tekstowe w całej ścieżce.
          isDefault ? LEGACY_FLAG_TRUE : LEGACY_FLAG_FALSE,
          0,
          user.id,
          now,
          now,
        ]
      );
      return result.rows[0] as Record<string, unknown> | undefined;
    });

    if (!created) {
      throw new Error('Template insert did not persist');
    }

    res.status(201).json(buildTemplateResponse(created));
  }),

  cloneTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { name, scope } = req.body || {};
    await ensureInterviewTemplateV6Columns();
    await ensureInterviewTemplateQuestionV6Columns();

    // Get source template
    const source = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ?`,
      [id]
    );
    if (!source || !canAccessTemplate(source, user)) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Get source questions
    const sourceQuestions = await queryHelpers.queryAll(
      `SELECT * FROM interview_library_template_questions WHERE template_id = ? ORDER BY sort_order`,
      [id]
    );

    // Create new template
    const newTemplateId = uuidv4();
    const now = new Date().toISOString();
    const clonedScope = resolveRequestedTemplateScope({
      requestedScope: scope,
      requestedVisibility: 'admin_only',
      userRole: user.role,
    });
    const storagePolicy = resolveTemplateStoragePolicy({
      scope: clonedScope,
      organizationId: user.organizationId,
      requestedVisibility: clonedScope === 'private' ? 'admin_only' : 'org',
    });

    await queryHelpers.queryRun(
      `INSERT INTO interview_library_templates
       (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, answer_design_guide, area_tags, source_template_id, is_default, version, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newTemplateId,
        storagePolicy.organizationId,
        name || `${(source as any).name} (copy)`,
        (source as any).description || '',
        (source as any).category || 'CUSTOM',
        'draft', // cloned templates start as draft
        storagePolicy.visibility,
        clonedScope,
        (source as any).audience || '',
        (source as any).estimated_time_minutes ?? 10,
        (source as any).runtime_mode_default || 'one_question_per_screen',
        (source as any).answer_design_guide || '',
        (source as any).area_tags || '[]',
        (source as any).id,
        0, // not default
        1,
        user.id,
        now,
        now,
      ]
    );

    // Clone questions
    for (const q of (sourceQuestions || []) as any[]) {
      const newQuestionId = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO interview_library_template_questions
         (id, template_id, category, question_text, sort_order, answer_type, is_required, help_hint, answer_options, expected_answer_shape, allow_voice, allow_file_upload, allow_url, allow_context_note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newQuestionId,
          newTemplateId,
          q.category,
          q.question_text,
          q.sort_order || 0,
          q.answer_type || 'open',
          q.is_required || 0,
          q.help_hint || '',
          q.answer_options || '[]',
          q.expected_answer_shape || null,
          q.allow_voice || 0,
          q.allow_file_upload || 0,
          q.allow_url || 0,
          q.allow_context_note ?? 1,
          now,
        ]
      );
    }

    const created = await queryHelpers.queryOne(
      `SELECT t.*, (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count
       FROM interview_library_templates t WHERE t.id = ?`,
      [newTemplateId]
    );

    res.status(201).json(buildTemplateResponse(created));
  }),

  deleteTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ?`,
      [id]
    );
    if (!existing || !canManageTemplate(existing, user)) {
      res.status(404).json({ error: 'Template not found or cannot be deleted' });
      return;
    }

    // Don't allow deleting system templates
    if (resolveTemplateScopeFromRow(existing) === 'system') {
      res.status(403).json({ error: 'Cannot delete global templates' });
      return;
    }

    // Don't allow deleting default templates
    // M03R-002 (P2): `is_default` to TEXT — goła prawdziwość łapie także
    // `'false'` i `'0'` (niepuste stringi), więc KAŻDY szablon wyglądał na
    // domyślny i nie dawał się skasować.
    if (isTruthyFlag((existing as any).is_default)) {
      res.status(403).json({ error: 'Cannot delete default templates' });
      return;
    }

    // Delete questions first (cascade should handle this, but be explicit)
    await queryHelpers.queryRun(
      `DELETE FROM interview_library_template_questions WHERE template_id = ?`,
      [id]
    );

    // Delete template
    await queryHelpers.queryRun(`DELETE FROM interview_library_templates WHERE id = ?`, [id]);

    res.json({ success: true, deletedId: id });
  }),

  archiveTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ?`,
      [id]
    );
    if (!existing || !canManageTemplate(existing, user)) {
      res.status(404).json({ error: 'Template not found or cannot be archived' });
      return;
    }

    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE interview_library_templates SET status = 'archived', updated_at = ? WHERE id = ?`,
      [now, id]
    );

    const updated = await queryHelpers.queryOne(
      `SELECT t.*, (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count
       FROM interview_library_templates t WHERE t.id = ?`,
      [id]
    );

    res.json(buildTemplateResponse(updated));
  }),

  restoreTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ?`,
      [id]
    );
    if (!existing || !canManageTemplate(existing, user)) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE interview_library_templates SET status = 'draft', updated_at = ? WHERE id = ?`,
      [now, id]
    );

    const updated = await queryHelpers.queryOne(
      `SELECT t.*, (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count
       FROM interview_library_templates t WHERE t.id = ?`,
      [id]
    );

    res.json(buildTemplateResponse(updated));
  }),

  // #15 — Set / unset a template as the organization default. Single default per
  // org: setting one clears the flag on every other template in the same org.
  setTemplateDefault: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    await ensureInterviewTemplateV6Columns();

    const isDefault = Boolean((req.body || {}).isDefault);

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ?`,
      [id]
    );
    if (!existing || !canManageTemplate(existing, user)) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Org-scoping: only org-owned templates can carry an org default flag. System
    // templates have no organization_id, so they can't be the org default.
    if ((existing as any).organization_id !== user.organizationId) {
      res
        .status(403)
        .json({ error: 'Cannot change default for a template outside your organization' });
      return;
    }

    const now = new Date().toISOString();
    if (isDefault) {
      // Single default per org: clear every OTHER org template first, then set this one.
      await queryHelpers.queryRun(
        // M03R-002: kolumna TEXT — patrz interviewLegacyFlags.ts
        `UPDATE interview_library_templates SET is_default = 'false', updated_at = ? WHERE organization_id = ? AND id != ? AND ${isTruthyFlagSql('is_default')}`,
        [now, user.organizationId, id]
      );
      await queryHelpers.queryRun(
        `UPDATE interview_library_templates SET is_default = 'true', updated_at = ? WHERE id = ? AND organization_id = ?`,
        [now, id, user.organizationId]
      );
    } else {
      await queryHelpers.queryRun(
        `UPDATE interview_library_templates SET is_default = 'false', updated_at = ? WHERE id = ? AND organization_id = ?`,
        [now, id, user.organizationId]
      );
    }

    const updated = await queryHelpers.queryOne(
      `SELECT t.*, (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count
       FROM interview_library_templates t WHERE t.id = ?`,
      [id]
    );

    res.json(buildTemplateResponse(updated));
  }),

  updateTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    await ensureInterviewTemplateV6Columns();
    const {
      name,
      description,
      category,
      status,
      visibility,
      isDefault,
      scope,
      audience,
      estimatedTimeMinutes,
      runtimeModeDefault,
      answerDesignGuide,
      areaTags,
    } = req.body || {};

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ?`,
      [id]
    );
    if (!existing || !canManageTemplate(existing, user)) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (visibility !== undefined) {
      updates.push('visibility = ?');
      params.push(visibility);
    }
    if (scope !== undefined) {
      const nextScope = resolveRequestedTemplateScope({
        requestedScope: scope,
        requestedVisibility: visibility ?? (existing as any).visibility,
        userRole: user.role,
      });
      const storagePolicy = resolveTemplateStoragePolicy({
        scope: nextScope,
        organizationId: user.organizationId,
        requestedVisibility: visibility ?? (existing as any).visibility,
      });
      updates.push('template_scope = ?');
      params.push(nextScope);
      updates.push('organization_id = ?');
      params.push(storagePolicy.organizationId);
      if (visibility === undefined) {
        updates.push('visibility = ?');
        params.push(storagePolicy.visibility);
      }
    }
    if (isDefault !== undefined) {
      updates.push('is_default = ?');
      params.push(isDefault ? LEGACY_FLAG_TRUE : LEGACY_FLAG_FALSE);
    }
    if (audience !== undefined) {
      updates.push('audience = ?');
      params.push(audience);
    }
    if (estimatedTimeMinutes !== undefined) {
      updates.push('estimated_time_minutes = ?');
      params.push(
        Number.isFinite(Number(estimatedTimeMinutes)) ? Number(estimatedTimeMinutes) : 10
      );
    }
    if (runtimeModeDefault !== undefined) {
      updates.push('runtime_mode_default = ?');
      params.push(runtimeModeDefault || 'one_question_per_screen');
    }
    if (answerDesignGuide !== undefined) {
      updates.push('answer_design_guide = ?');
      params.push(answerDesignGuide);
    }
    if (areaTags !== undefined) {
      updates.push('area_tags = ?');
      params.push(JSON.stringify(normalizeTemplateAreaTags(areaTags)));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    // Publication version changes only in the atomic publish endpoint. Draft
    // edits must not impersonate an immutable published version.
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await queryHelpers.queryRun(
      `UPDATE interview_library_templates SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await queryHelpers.queryOne(
      `SELECT
         t.*,
         (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count,
         (SELECT COUNT(1) FROM interview_sessions s 
          JOIN projects p ON p.id = s.project_id
          WHERE s.template_id = t.id AND p.organization_id = ?) as sessions_used
       FROM interview_library_templates t
       WHERE t.id = ?`,
      [user.organizationId, id]
    );

    res.json(buildTemplateResponse(updated));
  }),

  publishTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    try {
      await ensureInterviewTemplateV6Columns();
      await ensureInterviewTemplateQuestionV6Columns();
      const result = await publishInterviewTemplate({
        organizationId: user.organizationId,
        actorId: user.id,
        templateId: req.params.id,
        metadata: (req.body || {}).template || {},
        questions: Array.isArray((req.body || {}).questions) ? (req.body || {}).questions : [],
        expectedVersion: Number((req.body || {}).expectedVersion),
      });
      res.json(result);
    } catch (error) {
      if (error instanceof TemplatePublicationError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      throw error;
    }
  }),

  addTemplateQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params; // template id
    await ensureInterviewTemplateV6Columns();
    await ensureInterviewTemplateQuestionV6Columns();
    const {
      category,
      questionText,
      sortOrder,
      answerType,
      isRequired,
      sectionTitle,
      helpHint,
      answerOptions,
      expectedAnswerShape,
      description,
      evidencePrompt,
      allowVoice,
      allowFileUpload,
      allowUrl,
      allowContextNote,
      guidance,
      exampleAnswer,
    } = req.body || {};

    const template = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ?`,
      [id]
    );
    if (!template || !canManageTemplate(template, user)) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    if (!category || !questionText) {
      res.status(400).json({ error: 'category and questionText are required' });
      return;
    }

    const qid = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO interview_library_template_questions
       (id, template_id, category, question_text, sort_order, answer_type, is_required, section_title, help_hint, answer_options, expected_answer_shape, description, evidence_prompt, allow_voice, allow_file_upload, allow_url, allow_context_note, guidance, example_answer, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        qid,
        id,
        category,
        questionText,
        typeof sortOrder === 'number' ? sortOrder : 0,
        answerType || 'open',
        isRequired ? 1 : 0,
        typeof sectionTitle === 'string' && sectionTitle.trim() ? sectionTitle.trim() : null,
        helpHint || null,
        JSON.stringify(Array.isArray(answerOptions) ? answerOptions : []),
        expectedAnswerShape || null,
        description || null,
        evidencePrompt || null,
        allowVoice ? 1 : 0,
        allowFileUpload ? 1 : 0,
        allowUrl ? 1 : 0,
        allowContextNote === false ? 0 : 1,
        typeof guidance === 'string' && guidance.trim() ? guidance.trim() : null,
        typeof exampleAnswer === 'string' && exampleAnswer.trim() ? exampleAnswer.trim() : null,
        new Date().toISOString(),
      ]
    );

    await queryHelpers.queryRun(
      `UPDATE interview_library_templates SET updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );

    const created = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_template_questions WHERE id = ?`,
      [qid]
    );
    res.status(201).json(buildTemplateQuestionResponse(created));
  }),

  updateTemplateQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id, questionId } = req.params;
    await ensureInterviewTemplateV6Columns();
    await ensureInterviewTemplateQuestionV6Columns();
    const {
      category,
      questionText,
      sortOrder,
      answerType,
      isRequired,
      sectionTitle,
      helpHint,
      answerOptions,
      expectedAnswerShape,
      description,
      evidencePrompt,
      allowVoice,
      allowFileUpload,
      allowUrl,
      allowContextNote,
      guidance,
      exampleAnswer,
    } = req.body || {};

    const template = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ?`,
      [id]
    );
    if (!template || !canManageTemplate(template, user)) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_template_questions WHERE id = ? AND template_id = ?`,
      [questionId, id]
    );
    if (!existing) {
      res.status(404).json({ error: 'Template question not found' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (questionText !== undefined) {
      updates.push('question_text = ?');
      params.push(questionText);
    }
    if (sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(sortOrder);
    }
    if (answerType !== undefined) {
      updates.push('answer_type = ?');
      params.push(answerType);
    }
    if (isRequired !== undefined) {
      updates.push('is_required = ?');
      params.push(isRequired ? 1 : 0);
    }
    if (sectionTitle !== undefined) {
      updates.push('section_title = ?');
      params.push(
        typeof sectionTitle === 'string' && sectionTitle.trim() ? sectionTitle.trim() : null
      );
    }
    if (helpHint !== undefined) {
      updates.push('help_hint = ?');
      params.push(helpHint);
    }
    if (answerOptions !== undefined) {
      updates.push('answer_options = ?');
      params.push(JSON.stringify(Array.isArray(answerOptions) ? answerOptions : []));
    }
    if (expectedAnswerShape !== undefined) {
      updates.push('expected_answer_shape = ?');
      params.push(expectedAnswerShape);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (evidencePrompt !== undefined) {
      updates.push('evidence_prompt = ?');
      params.push(evidencePrompt || null);
    }
    if (allowVoice !== undefined) {
      updates.push('allow_voice = ?');
      params.push(allowVoice ? 1 : 0);
    }
    if (allowFileUpload !== undefined) {
      updates.push('allow_file_upload = ?');
      params.push(allowFileUpload ? 1 : 0);
    }
    if (allowUrl !== undefined) {
      updates.push('allow_url = ?');
      params.push(allowUrl ? 1 : 0);
    }
    if (allowContextNote !== undefined) {
      updates.push('allow_context_note = ?');
      params.push(allowContextNote ? 1 : 0);
    }
    if (guidance !== undefined) {
      updates.push('guidance = ?');
      params.push(typeof guidance === 'string' && guidance.trim() ? guidance.trim() : null);
    }
    if (exampleAnswer !== undefined) {
      updates.push('example_answer = ?');
      params.push(
        typeof exampleAnswer === 'string' && exampleAnswer.trim() ? exampleAnswer.trim() : null
      );
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    await queryHelpers.queryRun(
      `UPDATE interview_library_template_questions SET ${updates.join(', ')} WHERE id = ?`,
      [...params, questionId]
    );

    await queryHelpers.queryRun(
      `UPDATE interview_library_templates SET updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );

    const updated = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_template_questions WHERE id = ?`,
      [questionId]
    );
    res.json(buildTemplateQuestionResponse(updated));
  }),

  deleteTemplateQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id, questionId } = req.params;

    // SEC — cross-org/privilege IDOR guard. Mirror add/updateTemplateQuestion:
    // load the parent template and enforce canManageTemplate BEFORE mutating, so
    // a caller cannot delete questions from a foreign-org or system template by
    // passing its id (INTERVIEW_TEMPLATE_MANAGE is org-local, not template-scoped).
    const template = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ?`,
      [id]
    );
    if (!template || !canManageTemplate(template, user)) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const existing = await queryHelpers.queryOne(
      `SELECT id FROM interview_library_template_questions WHERE id = ? AND template_id = ?`,
      [questionId, id]
    );
    if (!existing) {
      res.status(404).json({ error: 'Template question not found' });
      return;
    }

    await queryHelpers.queryRun(`DELETE FROM interview_library_template_questions WHERE id = ?`, [
      questionId,
    ]);

    await queryHelpers.queryRun(
      `UPDATE interview_library_templates SET updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );

    res.json({ success: true });
  }),

  importTemplateSource: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    requireUser(req);
    const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const originalName = String(file.originalname || 'source');
    const mimeType = String(file.mimetype || '').toLowerCase();
    const isPdf = mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
    const isTxt =
      mimeType.startsWith('text/') ||
      originalName.toLowerCase().endsWith('.txt') ||
      originalName.toLowerCase().endsWith('.md');

    if (!isPdf && !isTxt) {
      res.status(400).json({ error: 'Only TXT and PDF files are supported' });
      return;
    }

    let extractedText = '';
    if (isPdf) {
      extractedText = await PDFParserService.extractTextFromBuffer(file.buffer);
    } else {
      extractedText = file.buffer.toString('utf-8');
    }

    const normalized = String(extractedText || '')
      .replace(/\r\n/g, '\n')
      .split('\0')
      .join('')
      .trim();

    if (!normalized) {
      res.status(422).json({ error: 'Could not extract readable text from file' });
      return;
    }

    const limitedText = normalized.slice(0, 50000);
    res.json({
      fileName: originalName,
      mimeType: file.mimetype,
      text: limitedText,
      charCount: limitedText.length,
      truncated: normalized.length > limitedText.length,
    });
  }),

  // ==========================================
  // AI ASSIST (human-in-the-loop)
  // ==========================================

  aiSuggestQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { questionId } = req.params;

    const question = await queryHelpers.queryOne(
      `SELECT q.*, s.owner_id as session_owner_id
       FROM interview_questions q
       JOIN interview_sessions s ON s.id = q.session_id
       WHERE q.id = ? AND q.organization_id = ? AND s.organization_id = ?`,
      [questionId, user.organizationId, user.organizationId]
    );
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    if (String((question as any).session_owner_id) !== String(user.id)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const context = await organizationContextService.buildResolvedContext(user.organizationId);

    const answered = await queryHelpers.queryAll(
      `SELECT category, question_text, answer_text
       FROM interview_questions
       WHERE session_id = ? AND status = 'answered'
       ORDER BY updated_at DESC
       LIMIT 10`,
      [question.session_id]
    );

    const SuggestionSchema = z.object({
      answerText: z.string().min(1),
      tags: z.array(z.enum(['risk', 'opportunity', 'constraint', 'priority'])).default([]),
      confidenceScore: z.number().min(1).max(5).default(3),
    });

    const systemPrompt = `
You are a senior management consultant helping fill a structured interview.
Goal: Draft a concise, factual answer to the question based on provided context and prior answers.
Rules:
- Facts only. No recommendations or action plans.
- If information is missing, write a short best-effort draft and add one explicit missing-data sentence.
- Keep it practical and business-relevant.
- Return ONLY a JSON object matching the schema: { answerText, tags, confidenceScore }.
`;

    const userPrompt = `
Question category: ${question.category}
Question: ${question.question_text}

Organization context (raw DB row, may include nulls):
${JSON.stringify(context || {}, null, 2)}

Recent answered Q&A (may be empty):
${JSON.stringify(answered || [], null, 2)}
`;

    const modelConfig = await llmService.resolveModelConfig({ id: 'standard' });
    const result = await llmService.call({
      type: 'structured',
      modelConfig,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      schema: SuggestionSchema,
      maxTokens: 600,
      temperature: 0.3,
      cache: false,
    });

    const suggestion = (result as any).object as z.infer<typeof SuggestionSchema> | undefined;
    if (!suggestion?.answerText?.trim()) {
      res.status(502).json({ error: 'AI suggestion was empty' });
      return;
    }

    await ensureInterviewAiSuggestionAuditTable();
    const suggestionId = uuidv4();
    const generatedAt = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO interview_ai_suggestion_audit
       (id, organization_id, session_id, question_id, generated_by, source, model_id,
        provider, prompt_version, suggested_answer_text, tags_json, confidence_score,
        decision, generated_at)
       VALUES (?, ?, ?, ?, ?, 'interview_question_ai_suggest', ?, ?, 'int04-v1', ?, ?, ?, 'pending', ?)`,
      [
        suggestionId,
        user.organizationId,
        (question as any).session_id,
        questionId,
        user.id,
        String(modelConfig.id || 'standard'),
        modelConfig.provider ? String(modelConfig.provider) : null,
        suggestion.answerText.trim(),
        JSON.stringify(suggestion.tags || []),
        suggestion.confidenceScore || 3,
        generatedAt,
      ]
    );

    res.json({
      ...suggestion,
      answerText: suggestion.answerText.trim(),
      suggestionId,
      generatedAt,
    });
  }),

  getAiSuggestionAudit: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { questionId } = req.params;
    const question = await queryHelpers.queryOne(
      `SELECT q.id, s.owner_id
         FROM interview_questions q
         JOIN interview_sessions s ON s.id = q.session_id
        WHERE q.id = ? AND q.organization_id = ? AND s.organization_id = ?`,
      [questionId, user.organizationId, user.organizationId]
    );
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    const canRead =
      String((question as any).owner_id) === user.id ||
      isOrgWideInterviewManagerRole(String(user.role));
    if (!canRead) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await ensureInterviewAiSuggestionAuditTable();
    const rows = await queryHelpers.queryAll(
      `SELECT id, source, model_id, provider, prompt_version, suggested_answer_text,
              tags_json, confidence_score, decision, final_answer_text, generated_at,
              generated_by, decided_at, decided_by
         FROM interview_ai_suggestion_audit
        WHERE question_id = ? AND organization_id = ?
        ORDER BY generated_at DESC`,
      [questionId, user.organizationId]
    );
    res.json(
      (rows as any[]).map((row) => ({
        id: row.id,
        source: row.source,
        modelId: row.model_id,
        provider: row.provider,
        promptVersion: row.prompt_version,
        suggestedAnswerText: row.suggested_answer_text,
        tags: parseJson(row.tags_json, []),
        confidenceScore: row.confidence_score,
        decision: row.decision,
        finalAnswerText: row.final_answer_text,
        generatedAt: row.generated_at,
        generatedBy: row.generated_by,
        decidedAt: row.decided_at,
        decidedBy: row.decided_by,
      }))
    );
  }),

  rejectAiSuggestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { questionId, suggestionId } = req.params;
    await ensureInterviewAiSuggestionAuditTable();
    const now = new Date().toISOString();
    const result = await queryHelpers.queryRun(
      `UPDATE interview_ai_suggestion_audit a
          SET decision = 'rejected', decided_at = ?, decided_by = ?
        FROM interview_questions q
        JOIN interview_sessions s ON s.id = q.session_id
       WHERE a.id = ? AND a.question_id = ? AND a.organization_id = ?
         AND a.decision = 'pending' AND q.id = a.question_id
         AND q.organization_id = a.organization_id AND s.organization_id = a.organization_id
         AND s.owner_id = ?`,
      [now, user.id, suggestionId, questionId, user.organizationId, user.id]
    );
    if (result.changes !== 1) {
      res.status(404).json({ error: 'Pending suggestion not found' });
      return;
    }
    res.json({ id: suggestionId, decision: 'rejected', decidedAt: now, decidedBy: user.id });
  }),

  aiImproveAnswer: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { questionId } = req.params;
    const { answerText, language, mode } = req.body || {};

    if (!answerText || typeof answerText !== 'string' || answerText.trim().length < 3) {
      res.status(400).json({ error: 'answerText is required (min 3 chars)' });
      return;
    }

    const question = await queryHelpers.queryOne(
      `SELECT q.*, s.owner_id as session_owner_id
       FROM interview_questions q
       JOIN interview_sessions s ON s.id = q.session_id
       WHERE q.id = ? AND q.organization_id = ? AND s.organization_id = ?`,
      [questionId, user.organizationId, user.organizationId]
    );
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    if (String((question as any).session_owner_id) !== String(user.id)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const lang = language === 'pl' ? 'Polish' : 'English';
    const ImproveSchema = z.object({
      improvedText: z.string().min(1),
      changesSummary: z.string(),
    });

    const modeInstructions: Record<string, string> = {
      improve: `1. Fix grammar, spelling, and punctuation errors.
2. Improve clarity and readability — make the answer more structured if it's rambling.
3. Expand overly brief answers with reasonable elaboration based on context.
4. Keep the original meaning and intent intact — do NOT add new facts the user didn't mention.
5. If the answer comes from voice transcription, clean up speech artifacts (filler words, repetitions, incomplete sentences).`,
      fix_grammar: `1. ONLY fix grammar, spelling, and punctuation errors.
2. Do NOT change the meaning, structure, or style of the answer.
3. Do NOT expand or shorten the text.
4. Clean up obvious typos and voice transcription artifacts.`,
      shorten: `1. Make the answer significantly shorter while preserving the key points.
2. Remove redundant phrases, filler words, and unnecessary elaboration.
3. Target roughly 50-60% of the original length.
4. Keep the most important information intact.`,
      expand: `1. Expand the answer with more detail, examples, and elaboration.
2. Add structure (e.g. numbered points) if the answer is a list of items.
3. Keep the original meaning — elaborate on what the user said, don't invent new facts.
4. Target roughly 150-200% of the original length.`,
      formal: `1. Rewrite the answer in a professional, formal business tone.
2. Remove colloquialisms, slang, and overly casual language.
3. Keep the same meaning and level of detail.
4. Use proper business vocabulary appropriate for a corporate report or presentation.`,
    };

    const activeMode = modeInstructions[mode] ? mode : 'improve';
    const systemPrompt = `You are a professional writing assistant improving interview answers.
Your job:
${modeInstructions[activeMode]}
6. Write in ${lang}.
7. Return JSON: { "improvedText": "...", "changesSummary": "..." }.
   changesSummary = 1-2 sentence description of what you changed (in ${lang}).`;

    const userPrompt = `Question: ${(question as any).question_text}
${(question as any).description ? `Helper text: ${(question as any).description}` : ''}
${(question as any).expected_answer_shape ? `Expected format: ${(question as any).expected_answer_shape}` : ''}

User's answer to ${activeMode === 'improve' ? 'improve' : activeMode === 'fix_grammar' ? 'fix grammar in' : activeMode === 'shorten' ? 'shorten' : activeMode === 'expand' ? 'expand' : 'make formal'}:
"""
${answerText.trim()}
"""`;

    const result = await llmService.call({
      type: 'structured',
      modelConfig: { id: 'standard' },
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      schema: ImproveSchema,
      maxTokens: 800,
      temperature: 0.3,
      cache: false,
    });

    res.json((result as any).object || { improvedText: answerText, changesSummary: '' });
  }),

  aiExplainQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { questionId } = req.params;
    const { language } = req.body || {};

    const question = await queryHelpers.queryOne(
      `SELECT q.*, s.owner_id as session_owner_id
       FROM interview_questions q
       JOIN interview_sessions s ON s.id = q.session_id
       WHERE q.id = ? AND q.organization_id = ? AND s.organization_id = ?`,
      [questionId, user.organizationId, user.organizationId]
    );
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    if (String((question as any).session_owner_id) !== String(user.id)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const lang = language === 'pl' ? 'Polish' : 'English';
    const ExplainSchema = z.object({
      explanation: z.string().min(1),
      exampleAnswers: z.array(z.string()).min(1).max(3),
      whyItMatters: z.string(),
    });

    const systemPrompt = `You are a helpful survey guide explaining interview questions to respondents.
Your job:
1. Explain what the question is really asking in simple, plain language.
2. Provide 1-3 short example answers showing different possible response styles (brief, detailed, specific).
3. Explain why this question matters — what insight does the interviewer hope to get.
4. Be encouraging, not condescending. Assume the respondent is smart but may not understand the domain jargon.
5. Write everything in ${lang}.
6. Return JSON: { "explanation": "...", "exampleAnswers": ["...", "..."], "whyItMatters": "..." }.`;

    const userPrompt = `Question: ${(question as any).question_text}
${(question as any).category ? `Category: ${(question as any).category}` : ''}
${(question as any).description ? `Helper text: ${(question as any).description}` : ''}
${(question as any).expected_answer_shape ? `Expected format: ${(question as any).expected_answer_shape}` : ''}
Answer type: ${(question as any).answer_type || 'open'}`;

    const result = await llmService.call({
      type: 'structured',
      modelConfig: { id: 'standard' },
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      schema: ExplainSchema,
      maxTokens: 600,
      temperature: 0.4,
      cache: false,
    });

    res.json(
      (result as any).object || {
        explanation: '',
        exampleAnswers: [],
        whyItMatters: '',
      }
    );
  }),

  evaluateSessionAnswers: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { language } = req.body || {};

    // P1-7 — null-safe org predicate so project-less (ad-hoc) sessions can be
    // evaluated/parsed. The previous inner JOIN on projects excluded them
    // entirely. Mirror getSummary/createInsight org match.
    let session: any = null;
    try {
      session = await queryHelpers.queryOne(
        `SELECT s.*, s.owner_id as owner_id FROM interview_sessions s
         LEFT JOIN projects p ON p.id = s.project_id
         WHERE s.id = ?
           AND (p.organization_id = ? OR (s.project_id IS NULL AND s.organization_id = ?))`,
        [sessionId, user.organizationId, user.organizationId]
      );
    } catch {
      // Backward compatibility for environments still using legacy user_id.
      session = await queryHelpers.queryOne(
        `SELECT s.*, s.user_id as owner_id FROM interview_sessions s
         LEFT JOIN projects p ON p.id = s.project_id
         WHERE s.id = ?
           AND (p.organization_id = ? OR (s.project_id IS NULL AND s.organization_id = ?))`,
        [sessionId, user.organizationId, user.organizationId]
      );
    }
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const questions = await queryHelpers.queryAll(
      `SELECT id, question_text, answer_type, is_required, expected_answer_shape, description,
              status, answer_text, context_note, confidence_score
       FROM interview_questions
       WHERE session_id = ? AND organization_id = ?
       ORDER BY sort_order`,
      [sessionId, user.organizationId]
    );

    if (!questions || questions.length === 0) {
      res.json({
        overallScore: 0,
        overallVerdict: 'empty',
        questionEvaluations: [],
        recommendations: [],
        weakAnswerMap: [],
        rubricVersion: INTERVIEW_RUBRIC_VERSION,
        rubricCriteria: INTERVIEW_RUBRIC_CRITERIA.map((c) => ({
          key: c.key,
          label: language === 'pl' ? c.labelPl : c.labelEn,
          description: language === 'pl' ? c.descriptionPl : c.descriptionEn,
          maxScore: INTERVIEW_RUBRIC_MAX_PER_CRITERION,
        })),
      });
      return;
    }

    const persistSnapshot = async (evaluation: InterviewAiReviewSnapshot) => {
      try {
        await ensureInterviewAssignmentAiReviewColumns();
        const assignment = await queryHelpers.queryOne(
          `SELECT id FROM interview_assignments WHERE session_id = ? AND organization_id = ? LIMIT 1`,
          [sessionId, user.organizationId]
        );
        if ((assignment as any)?.id) {
          await queryHelpers.queryRun(
            `UPDATE interview_assignments
             SET ai_review_snapshot_json = ?, ai_reviewed_at = ?, updated_at = ?
             WHERE id = ?`,
            [
              JSON.stringify(evaluation),
              new Date().toISOString(),
              new Date().toISOString(),
              (assignment as any).id,
            ]
          );
        }
      } catch (persistError) {
        logger.warn('[evaluateSessionAnswers] Failed to persist AI review snapshot', persistError);
      }
    };

    // INT-BVP-001 (2): the server previously awaited evaluateInterviewSessionAnswers
    // with NO bound — a hung provider hung the HTTP request indefinitely. We now
    // race it against INTERVIEW_AI_REVIEW_TIMEOUT_MS on top of llmService's own
    // (now-passed-through) abort timeout, so the response is guaranteed within the
    // bound even if the provider/mocked call ignores its own timeout. `responded`
    // guards against a double res.* call if the underlying promise settles after
    // we've already sent the timeout fallback (Express would throw on a second
    // response); the loser promise, if it does complete later, only persists the
    // snapshot for a future read — it never touches interview_questions/answers,
    // so the user's already-persisted answer is never at risk either way.
    let responded = false;
    const timeoutMs = INTERVIEW_AI_REVIEW_TIMEOUT_MS;
    const TIMED_OUT = Symbol('interview-ai-review-timed-out');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
    });

    const evaluationPromise = evaluateInterviewSessionAnswers({
      session: session as any,
      questions: questions as any[],
      language,
      timeoutMs,
    });

    // Never let the loser promise produce an unhandled rejection once we've
    // stopped awaiting it below.
    evaluationPromise.catch(() => undefined);

    try {
      const winner = await Promise.race([evaluationPromise, timeoutPromise]);

      if (winner === TIMED_OUT) {
        responded = true;
        logger.warn('[evaluateSessionAnswers] AI review exceeded bound, returning fallback', {
          sessionId,
          timeoutMs,
        });
        // Explicit, non-fabricated fallback: overallVerdict:'timeout' and an
        // empty questionEvaluations/recommendations set — never a guessed score.
        res.json({
          overallScore: 0,
          overallVerdict: 'timeout',
          questionEvaluations: [],
          recommendations: [],
          weakAnswerMap: [],
          rubricVersion: INTERVIEW_RUBRIC_VERSION,
          rubricCriteria: INTERVIEW_RUBRIC_CRITERIA.map((c) => ({
            key: c.key,
            label: language === 'pl' ? c.labelPl : c.labelEn,
            description: language === 'pl' ? c.descriptionPl : c.descriptionEn,
            maxScore: INTERVIEW_RUBRIC_MAX_PER_CRITERION,
          })),
          timedOut: true,
        });

        // Best-effort: if the provider eventually answers, still persist the
        // snapshot for a later read (e.g. getSummary/getAssignment). No response
        // is sent for it — `responded` is already true.
        evaluationPromise.then((late) => persistSnapshot(late)).catch(() => undefined);
        return;
      }

      const evaluation = winner as InterviewAiReviewSnapshot;
      await persistSnapshot(evaluation);
      responded = true;

      // D18-A hard wall — the FULL evaluation (with per-answer feedback/
      // justification, which may quote the raw answer) is always persisted
      // above so the respondent keeps full self-review; only the RESPONSE to
      // a non-respondent viewer of an anonymous session is redacted here.
      const wallActive = isAnonymityWallActive(session, user.id, 'owner_id');
      res.json(wallActive ? redactAiReviewSnapshotForAnonymity(evaluation) : evaluation);
    } catch (err) {
      if (!responded) {
        logger.error('[evaluateSessionAnswers] AI call failed:', err);
        res.status(500).json({ error: 'AI evaluation failed' });
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }),

  aiParseSessionAnswers: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { text, questionIds } = req.body || {};

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    // P1-7 — null-safe org predicate so project-less (ad-hoc) sessions can be
    // evaluated/parsed. The previous inner JOIN on projects excluded them
    // entirely. Mirror getSummary/createInsight org match.
    let session: any = null;
    try {
      session = await queryHelpers.queryOne(
        `SELECT s.*, s.owner_id as owner_id FROM interview_sessions s
         LEFT JOIN projects p ON p.id = s.project_id
         WHERE s.id = ?
           AND (p.organization_id = ? OR (s.project_id IS NULL AND s.organization_id = ?))`,
        [sessionId, user.organizationId, user.organizationId]
      );
    } catch {
      // Backward compatibility for environments still using legacy user_id.
      session = await queryHelpers.queryOne(
        `SELECT s.*, s.user_id as owner_id FROM interview_sessions s
         LEFT JOIN projects p ON p.id = s.project_id
         WHERE s.id = ?
           AND (p.organization_id = ? OR (s.project_id IS NULL AND s.organization_id = ?))`,
        [sessionId, user.organizationId, user.organizationId]
      );
    }
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (String((session as any).owner_id) !== String(user.id)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const restrict = Array.isArray(questionIds) && questionIds.length > 0;
    const inClause = restrict ? `AND id IN (${questionIds.map(() => '?').join(', ')})` : '';

    const questions = await queryHelpers.queryAll(
      `SELECT id, category, question_text FROM interview_questions
       WHERE session_id = ? AND organization_id = ?
       ${inClause}
       ORDER BY category, sort_order`,
      restrict ? [sessionId, user.organizationId, ...questionIds] : [sessionId, user.organizationId]
    );

    const MappingSchema = z.object({
      answers: z.array(
        z.object({
          questionId: z.string().min(1),
          answerText: z.string().min(1),
        })
      ),
    });

    const systemPrompt = `
You are a senior consultant. Your task is to map a chat transcript into structured interview answers.
Rules:
- Facts only. No recommendations or plans.
- Only answer questions that are clearly supported by the transcript.
- Keep answers concise, in the same language as the transcript.
- Return ONLY JSON: { answers: [{questionId, answerText}] }.
`;

    const userPrompt = `
Transcript:
${text}

Questions to map:
${JSON.stringify(questions || [], null, 2)}
`;

    const result = await llmService.call({
      type: 'structured',
      modelConfig: { id: 'standard' },
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      schema: MappingSchema,
      maxTokens: 1200,
      temperature: 0.2,
      cache: false,
    });

    res.json((result as any).object || { answers: [] });
  }),

  // ==========================================
  // QUESTIONS (Task-list style)
  // ==========================================

  getQuestions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { category } = req.query;
    await ensureInterviewQuestionV6Columns();
    await ensureInterviewAnonymityColumns();

    try {
      await assertSessionAccessibleOrThrow({
        sessionId,
        organizationId: user.organizationId,
        userId: user.id,
        userRole: user.role,
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // D18-A hard wall — anonymous sessions never expose per-answer content to
    // anyone but the respondent, regardless of who else has session access.
    const sessionOwnerRow = await queryHelpers.queryOne(
      `SELECT owner_id, is_anonymous FROM interview_sessions WHERE id = ?`,
      [sessionId]
    );
    const wallActive = isAnonymityWallActive(sessionOwnerRow, user.id, 'owner_id');

    let query = `SELECT * FROM interview_questions WHERE session_id = ? AND organization_id = ?`;
    const params: unknown[] = [sessionId, user.organizationId];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY category, sort_order`;

    const rows = await queryHelpers.queryAll(query, params);
    const mapped = rows.map(buildQuestionResponse).filter(Boolean) as NonNullable<
      ReturnType<typeof buildQuestionResponse>
    >[];
    res.json(wallActive ? mapped.map(redactQuestionResponseForAnonymity) : mapped);
  }),

  updateQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { questionId } = req.params;
    await ensureInterviewQuestionV6Columns();
    const {
      answerText,
      status: rawStatus,
      confidenceScore,
      tags,
      notes,
      contextNote,
      answerMode,
      answerPayload,
      voiceTranscript,
      voiceTranscriptStatus,
      voiceAudioEvidenceId,
      aiSuggestionId,
      expectedUpdatedAt,
    } = req.body;

    // INT-BVP-001 (6): optional per-answer CAS guard. `updated_at` already
    // exists on interview_questions (no schema change needed) but the API
    // never exposed it, so no client could send back an "expected" version —
    // updateQuestion was plain last-write-wins under the coarse session-lock
    // check above. Additive/opt-in: a client that sends `expectedUpdatedAt`
    // (round-tripped from a prior GET/PATCH response's `updatedAt`) gets a
    // real optimistic-concurrency guard and a 409 on a lost race; a client
    // that omits it keeps the pre-existing (documented, known-gap)
    // last-write-wins behaviour unchanged.
    const hasCasGuard = typeof expectedUpdatedAt === 'string' && expectedUpdatedAt.trim().length > 0;

    // M03R-004 — normalizacja NA ZAPISIE. Klient może przysłać `ANSWERED`;
    // do kolumny wchodzi wyłącznie postać kanoniczna, żeby nie dokładać
    // kolejnych wierszy do rozjazdu, który już jest w danych.
    const status = rawStatus === undefined ? undefined : canonicalStatusToken(rawStatus);

    // Lock edits when session is submitted/completed
    const qSession = await queryHelpers.queryOne(
      `SELECT q.session_id as session_id, s.status as session_status, s.owner_id as owner_id
       FROM interview_questions q
       JOIN interview_sessions s ON s.id = q.session_id
       WHERE q.id = ? AND q.organization_id = ? AND s.organization_id = ?`,
      [questionId, user.organizationId, user.organizationId]
    );
    if (!qSession) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    const ownerId = String((qSession as any).owner_id || '').trim();
    if (!ownerId || ownerId !== user.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (isLockedSessionStatus((qSession as any).session_status)) {
      res.status(409).json({ error: 'Session is locked' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    const normalizedContextNote = contextNote !== undefined ? contextNote : notes;
    const shouldPromoteVoiceTranscriptToAnswer =
      answerText === undefined &&
      typeof voiceTranscript === 'string' &&
      voiceTranscript.trim().length > 0 &&
      (voiceTranscriptStatus === 'approved' || answerMode === 'voice_answer');

    if (answerText !== undefined) {
      updates.push('answer_text = ?');
      params.push(answerText);
    } else if (shouldPromoteVoiceTranscriptToAnswer) {
      updates.push('answer_text = ?');
      params.push(voiceTranscript.trim());
    }
    if (status && (QUESTION_STATUSES as readonly string[]).includes(status)) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'answered') {
        updates.push('answered_by = ?', 'answered_at = ?');
        params.push(user.id, new Date().toISOString());
      }
    }
    if (confidenceScore !== undefined) {
      updates.push('confidence_score = ?');
      params.push(Math.max(0, Math.min(5, confidenceScore)));
    }
    if (tags) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }
    if (normalizedContextNote !== undefined) {
      updates.push('context_note = ?');
      params.push(normalizedContextNote || null);
    }
    if (answerMode !== undefined) {
      updates.push('answer_mode = ?');
      params.push(answerMode || 'text');
    }
    if (answerPayload !== undefined) {
      updates.push('answer_payload = ?');
      params.push(JSON.stringify(answerPayload || {}));
    }
    if (voiceTranscript !== undefined) {
      updates.push('voice_transcript = ?');
      params.push(voiceTranscript || null);
    }
    if (voiceTranscriptStatus !== undefined) {
      updates.push('voice_transcript_status = ?');
      params.push(voiceTranscriptStatus || 'none');
    }
    if (voiceAudioEvidenceId !== undefined) {
      updates.push('voice_audio_evidence_id = ?');
      params.push(voiceAudioEvidenceId || null);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(questionId, user.organizationId);
    // CAS predicate appended after id/organization_id so it lines up with the
    // trailing `WHERE id = ? AND organization_id = ?[ AND updated_at = ?]` text
    // in both branches below.
    const casClause = hasCasGuard ? ' AND updated_at = ?' : '';
    const casParams = hasCasGuard ? [expectedUpdatedAt] : [];

    let updateResult;
    if (aiSuggestionId !== undefined) {
      if (
        typeof aiSuggestionId !== 'string' ||
        !aiSuggestionId.trim() ||
        typeof answerText !== 'string' ||
        !answerText.trim()
      ) {
        res.status(400).json({ error: 'aiSuggestionId requires a non-empty answerText' });
        return;
      }
      await ensureInterviewAiSuggestionAuditTable();
      const decidedAt = new Date().toISOString();
      updateResult = await queryHelpers.queryRun(
        `WITH accepted AS (
           UPDATE interview_ai_suggestion_audit
              SET decision = 'accepted', final_answer_text = ?, decided_at = ?, decided_by = ?
            WHERE id = ? AND question_id = ? AND organization_id = ? AND decision = 'pending'
            RETURNING id
         )
         UPDATE interview_questions
            SET ${updates.join(', ')}
          WHERE id = ? AND organization_id = ?${casClause}
            AND EXISTS (SELECT 1 FROM accepted)`,
        [
          answerText.trim(),
          decidedAt,
          user.id,
          aiSuggestionId.trim(),
          questionId,
          user.organizationId,
          ...params,
          ...casParams,
        ]
      );
      if (updateResult.changes !== 1) {
        // Same 409 shape either way: an already-decided suggestion and a lost
        // CAS race are both "someone else moved this answer since you loaded
        // it" — the client's remediation (reload) is identical for both.
        res.status(409).json({ error: 'AI suggestion is missing or already decided' });
        return;
      }
    } else {
      updateResult = await queryHelpers.queryRun(
        `UPDATE interview_questions SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?${casClause}`,
        [...params, ...casParams]
      );
      if (hasCasGuard && updateResult.changes !== 1) {
        // Same 409 shape the file already uses elsewhere (Session is locked /
        // AI suggestion is missing or already decided) for a conflict outcome.
        res.status(409).json({
          error: 'Answer was modified by another update since it was loaded. Reload and try again.',
        });
        return;
      }
    }

    // Update session progress
    const question = (await queryHelpers.queryOne(
      `SELECT session_id FROM interview_questions WHERE id = ?`,
      [questionId]
    )) as { session_id: string } | null;

    if (question) {
      await InterviewController.updateSessionProgress(question.session_id);
    }

    const updated = await queryHelpers.queryOne(`SELECT * FROM interview_questions WHERE id = ?`, [
      questionId,
    ]);

    const updatedQuestion = updated as any;
    if (updatedQuestion?.session_id) {
      await organizationContextService.recordInterviewAnswer({
        organizationId: user.organizationId,
        userId: user.id,
        payload: {
          questionId,
          sessionId: updatedQuestion.session_id,
          category: updatedQuestion.category,
          questionText: updatedQuestion.question_text,
          answerText: updatedQuestion.answer_text,
          contextNote: updatedQuestion.context_note,
          tags: parseJson(updatedQuestion.tags, []),
          confidenceScore: updatedQuestion.confidence_score,
          answerMode: updatedQuestion.answer_mode,
        },
      });

      const answerKnowledgeDocId = await ingestInterviewTextArtifact({
        organizationId: user.organizationId,
        sourceType: 'interview_answer',
        title: `Interview answer ${questionId}`,
        content: updatedQuestion.answer_text,
        metadata: {
          questionId,
          sessionId: updatedQuestion.session_id,
          category: updatedQuestion.category,
          answerMode: updatedQuestion.answer_mode || 'text',
        },
      });
      const contextNoteKnowledgeDocId = await ingestInterviewTextArtifact({
        organizationId: user.organizationId,
        sourceType: 'interview_context_note',
        title: `Interview context note ${questionId}`,
        content: updatedQuestion.context_note,
        metadata: {
          questionId,
          sessionId: updatedQuestion.session_id,
          category: updatedQuestion.category,
        },
      });

      if (answerKnowledgeDocId || contextNoteKnowledgeDocId) {
        await queryHelpers.queryRun(
          `UPDATE interview_questions
           SET answer_knowledge_doc_id = COALESCE(?, answer_knowledge_doc_id),
               context_note_knowledge_doc_id = COALESCE(?, context_note_knowledge_doc_id)
           WHERE id = ?`,
          [answerKnowledgeDocId, contextNoteKnowledgeDocId, questionId]
        );
      }

      if (
        typeof voiceTranscript === 'string' &&
        voiceTranscript.trim() &&
        (voiceTranscriptStatus === 'approved' ||
          updatedQuestion.voice_transcript_status === 'approved')
      ) {
        try {
          const transcriptService = await import('../services/interviewTranscriptService.js');
          await transcriptService.addMessage(
            user.organizationId,
            updatedQuestion.session_id,
            'user',
            voiceTranscript.trim(),
            {
              questionId,
              source: 'interview_voice_answer',
              category: updatedQuestion.category,
              voiceAudioEvidenceId:
                voiceAudioEvidenceId || updatedQuestion.voice_audio_evidence_id || null,
            }
          );
        } catch (error) {
          logger.warn(
            `[InterviewController] Failed to append approved voice transcript: ${String(
              (error as Error)?.message || error
            )}`
          );
        }
      }
    }

    if (status === 'answered') {
      try {
        await normalizeAnswerEvidence(questionId, user.organizationId, user.id);
      } catch (err) {
        logger.warn(
          `[InterviewController] normalizeAnswerEvidence failed for Q ${questionId}: ${String((err as Error)?.message || err)}`
        );
      }
    }

    const refreshed = await queryHelpers.queryOne(
      `SELECT * FROM interview_questions WHERE id = ?`,
      [questionId]
    );
    res.json(buildQuestionResponse(refreshed));
  }),

  addQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { category, questionText } = req.body;
    await ensureInterviewQuestionV6Columns();

    try {
      await assertSessionEditable(sessionId, user.organizationId);
      await assertSessionOwnedByUser(sessionId, user.organizationId, user.id);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      if (msg.toLowerCase().includes('forbidden')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (msg.toLowerCase().includes('locked')) {
        res.status(409).json({ error: 'Session is locked' });
        return;
      }
      throw e;
    }

    if (!category || !INTERVIEW_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }
    if (!questionText) {
      res.status(400).json({ error: 'questionText is required' });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Get max sort order
    const maxOrder = (await queryHelpers.queryOne(
      `SELECT MAX(sort_order) as max_order FROM interview_questions WHERE session_id = ? AND category = ?`,
      [sessionId, category]
    )) as { max_order: number } | null;

    await queryHelpers.queryRun(
      `INSERT INTO interview_questions
       (id, session_id, organization_id, category, question_text, status, sort_order, is_template, is_required, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sessionId,
        user.organizationId,
        category,
        sanitizeQuestionText(questionText),
        'not_started',
        (maxOrder?.max_order || 0) + 1,
        0,
        0,
        now,
        now,
      ]
    );

    // Update total questions
    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET total_questions = total_questions + 1 WHERE id = ?`,
      [sessionId]
    );

    const created = await queryHelpers.queryOne(`SELECT * FROM interview_questions WHERE id = ?`, [
      id,
    ]);
    res.status(201).json(buildQuestionResponse(created));
  }),

  // Helper to update session progress
  updateSessionProgress: async (sessionId: string) => {
    const questions = (await queryHelpers.queryAll(
      `SELECT category, status FROM interview_questions WHERE session_id = ?`,
      [sessionId]
    )) as { category: string; status: string }[];

    const progress: Record<string, number> = {};
    const categoryCount: Record<string, number> = {};
    let answeredTotal = 0;

    for (const q of questions) {
      const cat = q.category || 'general';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      progress[cat] = progress[cat] || 0;
      if (canonicalStatusToken(q.status) === 'answered') {
        progress[cat]++;
        answeredTotal++;
      }
    }

    for (const cat of Object.keys(progress)) {
      if (categoryCount[cat] > 0) {
        progress[cat] = Math.round((progress[cat] / categoryCount[cat]) * 100);
      }
    }

    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET progress_json = ?, answered_questions = ?, last_activity_at = ? WHERE id = ?`,
      [JSON.stringify(progress), answeredTotal, new Date().toISOString(), sessionId]
    );
  },

  // ==========================================
  // NOTES
  // ==========================================

  getNotes: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;

    try {
      await assertSessionAccessibleOrThrow({
        sessionId,
        organizationId: user.organizationId,
        userId: user.id,
        userRole: user.role,
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await ensureInterviewAnonymityColumns();
    const sessionOwnerRow = await queryHelpers.queryOne(
      `SELECT owner_id, is_anonymous FROM interview_sessions WHERE id = ?`,
      [sessionId]
    );
    const wallActive = isAnonymityWallActive(sessionOwnerRow, user.id, 'owner_id');

    const rows = await queryHelpers.queryAll(
      `SELECT * FROM interview_notes WHERE session_id = ? AND organization_id = ? ORDER BY created_at DESC`,
      [sessionId, user.organizationId]
    );
    const mapped = rows.map(buildNoteResponse).filter(Boolean) as NonNullable<
      ReturnType<typeof buildNoteResponse>
    >[];
    res.json(wallActive ? mapped.map(redactNoteResponseForAnonymity) : mapped);
  }),

  createNote: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { category, title, content } = req.body;

    try {
      await assertSessionEditable(sessionId, user.organizationId);
      await assertSessionOwnedByUser(sessionId, user.organizationId, user.id);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      if (msg.toLowerCase().includes('forbidden')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (msg.toLowerCase().includes('locked')) {
        res.status(409).json({ error: 'Session is locked' });
        return;
      }
      throw e;
    }

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_notes (id, session_id, organization_id, category, title, content, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sessionId,
        user.organizationId,
        category || null,
        title || null,
        content,
        user.id,
        now,
        now,
      ]
    );

    const created = await queryHelpers.queryOne(`SELECT * FROM interview_notes WHERE id = ?`, [id]);
    res.status(201).json(buildNoteResponse(created));
  }),

  updateNote: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { noteId } = req.params;
    const { title, content } = req.body;

    // Lock edits when note's session is submitted/completed
    const noteSession = await queryHelpers.queryOne(
      `SELECT n.session_id as session_id, s.status as session_status
       FROM interview_notes n
       JOIN interview_sessions s ON s.id = n.session_id
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE n.id = ? AND n.organization_id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [noteId, user.organizationId, user.organizationId, user.organizationId]
    );
    if (!noteSession) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    try {
      await assertSessionOwnedByUser(
        String((noteSession as any).session_id),
        user.organizationId,
        user.id
      );
    } catch {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (isLockedSessionStatus((noteSession as any).session_status)) {
      res.status(409).json({ error: 'Session is locked' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(noteId, user.organizationId);

    await queryHelpers.queryRun(
      `UPDATE interview_notes SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );

    const updated = await queryHelpers.queryOne(`SELECT * FROM interview_notes WHERE id = ?`, [
      noteId,
    ]);
    res.json(buildNoteResponse(updated));
  }),

  deleteNote: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { noteId } = req.params;

    // Lock deletes when note's session is submitted/completed
    const noteSession = await queryHelpers.queryOne(
      `SELECT n.session_id as session_id, s.status as session_status
       FROM interview_notes n
       JOIN interview_sessions s ON s.id = n.session_id
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE n.id = ? AND n.organization_id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [noteId, user.organizationId, user.organizationId, user.organizationId]
    );
    if (!noteSession) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    try {
      await assertSessionOwnedByUser(
        String((noteSession as any).session_id),
        user.organizationId,
        user.id
      );
    } catch {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (isLockedSessionStatus((noteSession as any).session_status)) {
      res.status(409).json({ error: 'Session is locked' });
      return;
    }

    await queryHelpers.queryRun(
      `DELETE FROM interview_notes WHERE id = ? AND organization_id = ?`,
      [noteId, user.organizationId]
    );

    res.json({ success: true });
  }),

  // ==========================================
  // EVIDENCE
  // ==========================================

  getEvidence: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    await ensureInterviewEvidenceColumns();

    try {
      await assertSessionAccessibleOrThrow({
        sessionId,
        organizationId: user.organizationId,
        userId: user.id,
        userRole: user.role,
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await ensureInterviewAnonymityColumns();
    const sessionOwnerRow = await queryHelpers.queryOne(
      `SELECT owner_id, is_anonymous FROM interview_sessions WHERE id = ?`,
      [sessionId]
    );
    const wallActive = isAnonymityWallActive(sessionOwnerRow, user.id, 'owner_id');

    const rows = await queryHelpers.queryAll(
      `SELECT * FROM interview_evidence WHERE session_id = ? AND organization_id = ? ORDER BY created_at DESC`,
      [sessionId, user.organizationId]
    );
    const mapped = rows.map(buildEvidenceResponse).filter(Boolean) as NonNullable<
      ReturnType<typeof buildEvidenceResponse>
    >[];
    res.json(wallActive ? mapped.map(redactEvidenceResponseForAnonymity) : mapped);
  }),

  createEvidence: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const {
      questionId,
      evidenceType,
      title,
      name, // frontend compatibility
      description,
      fileName,
      fileSize,
      fileType,
      mimeType, // frontend compatibility
      url,
      category,
      transcriptText,
      evidenceRole,
      ingestToKnowledge,
    } = req.body;
    await ensureInterviewEvidenceColumns();

    try {
      await assertSessionEditable(sessionId, user.organizationId);
      await assertSessionOwnedByUser(sessionId, user.organizationId, user.id);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      if (msg.toLowerCase().includes('forbidden')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (msg.toLowerCase().includes('locked')) {
        res.status(409).json({ error: 'Session is locked' });
        return;
      }
      throw e;
    }

    const resolvedTitle =
      typeof title === 'string' && title.trim()
        ? title.trim()
        : typeof name === 'string'
          ? name.trim()
          : String(name || '').trim();
    if (!evidenceType || !resolvedTitle) {
      res.status(400).json({ error: 'evidenceType and title are required' });
      return;
    }

    const resolvedFileName =
      typeof fileName === 'string' && fileName.trim()
        ? fileName.trim()
        : typeof name === 'string'
          ? name.trim()
          : null;
    const resolvedFileType =
      typeof fileType === 'string' && fileType.trim()
        ? fileType.trim()
        : typeof mimeType === 'string'
          ? mimeType.trim()
          : null;

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_evidence
       (id, session_id, organization_id, question_id, category, evidence_type, evidence_role, title, description, file_name, file_size, file_type, url, transcript_text, ingest_to_knowledge, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sessionId,
        user.organizationId,
        questionId || null,
        category || null,
        evidenceType,
        evidenceRole || 'supporting',
        resolvedTitle,
        description || null,
        resolvedFileName,
        fileSize || null,
        resolvedFileType,
        url || null,
        transcriptText || null,
        // INT-BVP-001/INT-DELIVERY-OPS-001 (1): write a literal 0/1 here, matching the
        // auto-evidence write site above (line ~1836). A raw JS boolean is NOT
        // universally safe for this column: `ensureInterviewEvidenceColumns` (line
        // ~766) creates it as INTEGER on environments where the table didn't
        // already exist, and node-pg throws 22P02 "invalid input syntax for type
        // integer" when a boolean parameter is bound to an integer column. The
        // literal 0/1 form is accepted by Postgres for BOTH integer columns and
        // legacy boolean columns (boolean text-input parser accepts '1'/'0'), so
        // it is safe regardless of which physical type a given environment has.
        ingestToKnowledge !== false ? 1 : 0,
        user.id,
        now,
      ]
    );

    const knowledgeDocumentId =
      ingestToKnowledge === false
        ? null
        : await ingestInterviewTextArtifact({
            organizationId: user.organizationId,
            sourceType: 'interview_evidence',
            title: resolvedTitle,
            content:
              transcriptText ||
              description ||
              (typeof url === 'string' && url.trim() ? `${resolvedTitle}\n${url.trim()}` : ''),
            metadata: {
              evidenceId: id,
              sessionId,
              questionId: questionId || null,
              category: category || null,
              evidenceType,
              evidenceRole: evidenceRole || 'supporting',
              fileName: resolvedFileName,
              fileType: resolvedFileType,
              url: url || null,
            },
          });

    if (knowledgeDocumentId) {
      await queryHelpers.queryRun(
        `UPDATE interview_evidence SET knowledge_document_id = ? WHERE id = ?`,
        [knowledgeDocumentId, id]
      );
    }

    await organizationContextService.recordInterviewEvidence({
      organizationId: user.organizationId,
      userId: user.id,
      payload: {
        evidenceId: id,
        sessionId,
        questionId: questionId || null,
        title: resolvedTitle,
        description: description || null,
        evidenceType,
        evidenceRole: evidenceRole || 'supporting',
        fileName: resolvedFileName,
        fileType: resolvedFileType,
        url: url || null,
        transcriptText: transcriptText || null,
        category: category || null,
        knowledgeDocumentId,
      },
    });

    const created = await queryHelpers.queryOne(`SELECT * FROM interview_evidence WHERE id = ?`, [
      id,
    ]);
    res.status(201).json(buildEvidenceResponse(created));
  }),

  deleteEvidence: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { evidenceId } = req.params;

    // Lock deletes when evidence session is submitted/completed
    const evSession = await queryHelpers.queryOne(
      `SELECT e.session_id as session_id, s.status as session_status
       FROM interview_evidence e
       JOIN interview_sessions s ON s.id = e.session_id
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE e.id = ? AND e.organization_id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [evidenceId, user.organizationId, user.organizationId, user.organizationId]
    );
    if (!evSession) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }
    try {
      await assertSessionOwnedByUser(
        String((evSession as any).session_id),
        user.organizationId,
        user.id
      );
    } catch {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (isLockedSessionStatus((evSession as any).session_status)) {
      res.status(409).json({ error: 'Session is locked' });
      return;
    }

    await queryHelpers.queryRun(
      `DELETE FROM interview_evidence WHERE id = ? AND organization_id = ?`,
      [evidenceId, user.organizationId]
    );

    res.json({ success: true });
  }),

  // ==========================================
  // KNOWLEDGE SEARCH
  // ==========================================

  searchInterviewKnowledge: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { query, templateId, projectId, category, sessionId, limit: rawLimit } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      res.status(400).json({ error: 'Query is required (min 2 chars)' });
      return;
    }

    const searchLimit = Math.min(Math.max(Number(rawLimit) || 20, 1), 100);
    const searchTerm = `%${String(query).trim()}%`;

    const conditions: string[] = ['s.organization_id = ?'];
    const params: unknown[] = [user.organizationId];

    if (templateId) {
      conditions.push('s.template_id = ?');
      params.push(templateId);
    }
    if (projectId) {
      conditions.push('s.project_id = ?');
      params.push(projectId);
    }
    if (sessionId) {
      conditions.push('s.id = ?');
      params.push(sessionId);
    }
    if (category) {
      conditions.push('q.category = ?');
      params.push(category);
    }

    const whereClause = conditions.join(' AND ');

    const rows = await queryHelpers.queryAll(
      `SELECT
         q.id as "questionId",
         q.session_id as "sessionId",
         q.category,
         q.question_text as "questionText",
         q.answer_text as "answerText",
         q.voice_transcript as "voiceTranscript",
         q.context_note as "contextNote",
         q.answer_knowledge_doc_id as "answerKnowledgeDocId",
         q.context_note_knowledge_doc_id as "contextNoteKnowledgeDocId",
         q.status,
         q.confidence_score as "confidenceScore",
         s.name as "sessionName",
         s.template_id as "templateId",
         s.project_id as "projectId",
         t.name as "templateName"
       FROM interview_questions q
       JOIN interview_sessions s ON s.id = q.session_id
       LEFT JOIN interview_library_templates t ON t.id = s.template_id
       WHERE ${whereClause}
         AND q.status = 'answered'
         AND (
           q.answer_text LIKE ? OR
           q.voice_transcript LIKE ? OR
           q.context_note LIKE ? OR
           q.question_text LIKE ?
         )
       ORDER BY s.last_activity_at DESC, q.sort_order ASC
       LIMIT ?`,
      [...params, searchTerm, searchTerm, searchTerm, searchTerm, searchLimit]
    );

    const evidenceRows = await queryHelpers.queryAll(
      `SELECT
         e.id as "evidenceId",
         e.session_id as "sessionId",
         e.question_id as "questionId",
         e.title,
         e.description,
         e.evidence_type as "evidenceType",
         e.knowledge_document_id as "knowledgeDocumentId",
         s.name as "sessionName",
         s.template_id as "templateId"
       FROM interview_evidence e
       JOIN interview_sessions s ON s.id = e.session_id
       WHERE s.organization_id = ?
         ${templateId ? 'AND s.template_id = ?' : ''}
         ${projectId ? 'AND s.project_id = ?' : ''}
         ${sessionId ? 'AND s.id = ?' : ''}
         AND (e.title LIKE ? OR e.description LIKE ?)
       ORDER BY e.created_at DESC
       LIMIT ?`,
      [
        user.organizationId,
        ...(templateId ? [templateId] : []),
        ...(projectId ? [projectId] : []),
        ...(sessionId ? [sessionId] : []),
        searchTerm,
        searchTerm,
        searchLimit,
      ]
    );

    res.json({
      answers: rows || [],
      evidence: evidenceRows || [],
      query: String(query).trim(),
      totalAnswers: (rows || []).length,
      totalEvidence: (evidenceRows || []).length,
    });
  }),

  getLinkedItems: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;

    try {
      await assertSessionAccessibleOrThrow({
        sessionId,
        organizationId: user.organizationId,
        userId: user.id,
        userRole: user.role,
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT id, target_type, target_id
         FROM link_graph_edges
         WHERE organization_id = ? AND source_type = 'interview_session' AND source_id = ?
         ORDER BY created_at DESC`,
        [user.organizationId, sessionId]
      )) || [];

    const items = (
      await Promise.all(
        rows.map(async (row: any) => {
          const resolved = await resolveLinkedArtifact(
            user.organizationId,
            String(row.target_type || ''),
            String(row.target_id || '')
          );
          if (!resolved) return null;
          return {
            edgeId: String(row.id),
            id: String(row.target_id),
            type: resolved.type,
            title: resolved.title,
            status: resolved.status,
          };
        })
      )
    ).filter(Boolean);

    res.json(items);
  }),

  addLinkedItem: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const itemType = String(req.body?.type || '')
      .trim()
      .toLowerCase();
    const itemId = String(req.body?.id || '').trim();

    if (!itemType || !itemId) {
      res.status(400).json({ error: 'type and id are required' });
      return;
    }

    try {
      await assertSessionEditable(sessionId, user.organizationId);
      await assertSessionOwnedByUser(sessionId, user.organizationId, user.id);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      if (msg.toLowerCase().includes('locked')) {
        res.status(409).json({ error: 'Session is locked' });
        return;
      }
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const resolved = await resolveLinkedArtifact(user.organizationId, itemType, itemId);
    if (!resolved) {
      res.status(404).json({ error: 'Linked artifact not found' });
      return;
    }

    const edgeId = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO link_graph_edges
       (id, organization_id, source_type, source_id, target_type, target_id, relation, container_type, container_id, created_by, created_at)
       VALUES (?, ?, 'interview_session', ?, ?, ?, 'ref', 'interview_supporting_material', ?, ?, ?)`,
      [
        edgeId,
        user.organizationId,
        sessionId,
        itemType,
        itemId,
        sessionId,
        user.id,
        new Date().toISOString(),
      ]
    );

    res.status(201).json({
      edgeId,
      id: itemId,
      type: itemType,
      title: resolved.title,
      status: resolved.status,
    });
  }),

  deleteLinkedItem: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId, edgeId } = req.params;

    try {
      await assertSessionEditable(sessionId, user.organizationId);
      await assertSessionOwnedByUser(sessionId, user.organizationId, user.id);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      if (msg.toLowerCase().includes('locked')) {
        res.status(409).json({ error: 'Session is locked' });
        return;
      }
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await queryHelpers.queryRun(
      `DELETE FROM link_graph_edges
       WHERE id = ? AND organization_id = ? AND source_type = 'interview_session' AND source_id = ?`,
      [edgeId, user.organizationId, sessionId]
    );

    res.json({ success: true });
  }),

  // ==========================================
  // ORGANIZATION CONTEXT (Company Facts)
  // ==========================================

  getOrganizationContext: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const resolved = await organizationContextService.buildResolvedContext(user.organizationId);
    const legacyRow = await queryHelpers.queryOne(
      `SELECT completeness_percent, last_interview_id FROM organization_context WHERE organization_id = ?`,
      [user.organizationId]
    );

    res.json({
      organizationId: user.organizationId,
      companyName: resolved.profile.companyName,
      industry: resolved.profile.industry,
      companySize: resolved.profile.companySize,
      location: resolved.profile.location,
      employeeCount: resolved.profile.employeeCount,
      annualRevenue: resolved.profile.annualRevenue,
      keyMetrics: resolved.operations.keyMetrics,
      stakeholders: resolved.stakeholders,
      openGaps: resolved.operations.gaps,
      completenessPercent:
        (legacyRow as any)?.completeness_percent ||
        Math.min(
          100,
          [
            resolved.profile.companyName,
            resolved.profile.industry,
            resolved.profile.companySize,
            resolved.profile.location,
            resolved.profile.employeeCount,
          ].filter(Boolean).length *
            15 +
            (resolved.operations.keyMetrics.length ? 20 : 0) +
            (resolved.stakeholders.length ? 20 : 0)
        ),
      lastInterviewId: (legacyRow as any)?.last_interview_id || null,
    });
  }),

  updateOrganizationContext: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const {
      companyName,
      industry,
      companySize,
      location,
      employeeCount,
      annualRevenue,
      keyMetrics,
      stakeholders,
      openGaps,
      lastInterviewId,
    } = req.body;

    const existing = await queryHelpers.queryOne(
      `SELECT id FROM organization_context WHERE organization_id = ?`,
      [user.organizationId]
    );

    const now = new Date().toISOString();

    // Calculate completeness
    let completeness = 0;
    if (companyName) completeness += 15;
    if (industry) completeness += 15;
    if (companySize) completeness += 10;
    if (location) completeness += 10;
    if (employeeCount) completeness += 10;
    if (keyMetrics && keyMetrics.length > 0) completeness += 20;
    if (stakeholders && stakeholders.length > 0) completeness += 20;

    if (existing) {
      await queryHelpers.queryRun(
        `UPDATE organization_context SET
         company_name = COALESCE(?, company_name),
         industry = COALESCE(?, industry),
         company_size = COALESCE(?, company_size),
         location = COALESCE(?, location),
         employee_count = COALESCE(?, employee_count),
         annual_revenue = COALESCE(?, annual_revenue),
         key_metrics = COALESCE(?, key_metrics),
         stakeholders = COALESCE(?, stakeholders),
         open_gaps = COALESCE(?, open_gaps),
         completeness_percent = ?,
         last_interview_id = COALESCE(?, last_interview_id),
         updated_at = ?
         WHERE organization_id = ?`,
        [
          companyName || null,
          industry || null,
          companySize || null,
          location || null,
          employeeCount || null,
          annualRevenue || null,
          keyMetrics ? JSON.stringify(keyMetrics) : null,
          stakeholders ? JSON.stringify(stakeholders) : null,
          openGaps ? JSON.stringify(openGaps) : null,
          completeness,
          lastInterviewId || null,
          now,
          user.organizationId,
        ]
      );
    } else {
      const id = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO organization_context
         (id, organization_id, company_name, industry, company_size, location, employee_count, annual_revenue,
          key_metrics, stakeholders, open_gaps, completeness_percent, last_interview_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          user.organizationId,
          companyName || null,
          industry || null,
          companySize || null,
          location || null,
          employeeCount || null,
          annualRevenue || null,
          JSON.stringify(keyMetrics || []),
          JSON.stringify(stakeholders || []),
          JSON.stringify(openGaps || []),
          completeness,
          lastInterviewId || null,
          now,
          now,
        ]
      );
    }

    const contextPayload = {
      companyName: companyName || null,
      industry: industry || null,
      companySize: companySize || null,
      location: location || null,
      employeeCount: employeeCount || null,
      annualRevenue: annualRevenue || null,
      keyMetrics: keyMetrics || [],
      stakeholders: stakeholders || [],
      openGaps: openGaps || [],
      lastInterviewId: lastInterviewId || null,
    };
    await organizationContextService.recordInterviewContext({
      organizationId: user.organizationId,
      userId: user.id,
      payload: contextPayload,
    });

    const resolved = await organizationContextService.buildResolvedContext(user.organizationId);
    const compatibility = await queryHelpers.queryOne(
      `SELECT id, completeness_percent, last_interview_id FROM organization_context WHERE organization_id = ?`,
      [user.organizationId]
    );

    res.json({
      id: (compatibility as any)?.id || null,
      organizationId: user.organizationId,
      companyName: resolved.profile.companyName,
      industry: resolved.profile.industry,
      companySize: resolved.profile.companySize,
      location: resolved.profile.location,
      employeeCount: resolved.profile.employeeCount,
      annualRevenue: resolved.profile.annualRevenue,
      keyMetrics: resolved.operations.keyMetrics || [],
      stakeholders: resolved.stakeholders || [],
      openGaps: resolved.operations.gaps || [],
      lastInterviewId: (compatibility as any)?.last_interview_id || null,
      completenessPercent: (compatibility as any)?.completeness_percent || completeness,
    });
  }),

  // ==========================================
  // EXPORT CONTEXT
  // ==========================================

  exportContext: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { targetType, targetId } = req.body;

    if (!targetType || !targetId) {
      res.status(400).json({ error: 'targetType and targetId are required' });
      return;
    }

    // Export gating:
    // - Assignments: only after reviewer approval (approved) or legacy completed.
    // - Ad-hoc: only when session is completed.
    const sessionRow = await queryHelpers.queryOne(
      `SELECT id, status, assignment_id, answered_questions, total_questions FROM interview_sessions
       WHERE id = ? AND organization_id = ?`,
      [sessionId, user.organizationId]
    );
    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const sessionStatus = String((sessionRow as any).status || '').toLowerCase();
    if ((sessionRow as any).assignment_id) {
      const assignment = await queryHelpers.queryOne(
        `SELECT status FROM interview_assignments WHERE id = ? AND organization_id = ?`,
        [(sessionRow as any).assignment_id, user.organizationId]
      );
      const asgStatus = String((assignment as any)?.status || '').toLowerCase();
      const allowed = asgStatus === 'approved' || asgStatus === 'completed';
      if (!allowed) {
        res.status(409).json({ error: 'Interview not approved - cannot export yet' });
        return;
      }
    } else {
      if (sessionStatus !== 'completed') {
        res.status(409).json({ error: 'Interview not completed - cannot export yet' });
        return;
      }
    }

    const context = await organizationContextService.buildResolvedContext(user.organizationId);

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_context_exports
       (id, interview_session_id, organization_id, target_type, target_id, context_snapshot, exported_by, exported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sessionId,
        user.organizationId,
        targetType,
        targetId,
        JSON.stringify(context),
        user.id,
        now,
      ]
    );

    logger.info(`[InterviewController] Exported context to ${targetType}:${targetId}`);
    res.json({ success: true, exportId: id });
  }),

  // ==========================================
  // GENERATE SUMMARY (ONLY FACTS - no recommendations)
  // ==========================================

  generateSummary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;

    // Summary gating (aligned with export gating):
    // - Assignments: only after reviewer approval (approved) or legacy completed.
    // - Ad-hoc: only when session is completed.
    const sessionRow = await queryHelpers.queryOne(
      `SELECT id, status, assignment_id, answered_questions, total_questions FROM interview_sessions
       WHERE id = ? AND organization_id = ?`,
      [sessionId, user.organizationId]
    );
    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const sessionStatus = String((sessionRow as any).status || '').toLowerCase();
    if ((sessionRow as any).assignment_id) {
      const assignment = await queryHelpers.queryOne(
        `SELECT status FROM interview_assignments WHERE id = ? AND organization_id = ?`,
        [(sessionRow as any).assignment_id, user.organizationId]
      );
      const asgStatus = String((assignment as any)?.status || '').toLowerCase();
      const allowed = asgStatus === 'approved' || asgStatus === 'completed';
      if (!allowed) {
        res.status(409).json({ error: 'Interview not approved - cannot generate summary yet' });
        return;
      }
    } else {
      if (sessionStatus !== 'completed') {
        res.status(409).json({ error: 'Interview not completed - cannot generate summary yet' });
        return;
      }
    }

    // Get all answered questions
    const questions = (await queryHelpers.queryAll(
      `SELECT * FROM interview_questions WHERE session_id = ? AND status = 'answered' ORDER BY category, sort_order`,
      [sessionId]
    )) as any[];

    // Summary is stored as simple string arrays for frontend compatibility.
    const facts: string[] = [];
    const gaps: string[] = [];
    const constraints: string[] = [];
    const painPoints: string[] = [];

    for (const q of questions) {
      if (q.answer_text) {
        facts.push(`${q.question_text}: ${q.answer_text}`);

        // Check tags for constraints/pain points
        const tags = parseJson(q.tags, []) as string[];
        if (tags.includes('constraint')) {
          constraints.push(String(q.answer_text));
        }
        if (tags.includes('pain_point') || tags.includes('risk')) {
          painPoints.push(String(q.answer_text));
        }
      }
    }

    // Find gaps (unanswered required questions or low confidence)
    const allQuestions = (await queryHelpers.queryAll(
      `SELECT * FROM interview_questions WHERE session_id = ?`,
      [sessionId]
    )) as any[];

    for (const q of allQuestions) {
      if (q.status !== 'answered' || (q.confidence_score && q.confidence_score < 3)) {
        gaps.push(String(q.question_text));
      }
    }

    // Update session with summary (ONLY FACTS)
    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET
       summary_facts = ?, summary_gaps = ?, summary_constraints = ?, summary_pain_points = ?, updated_at = ?
       WHERE id = ?`,
      [
        JSON.stringify(facts),
        JSON.stringify(gaps),
        JSON.stringify(constraints),
        JSON.stringify(painPoints),
        new Date().toISOString(),
        sessionId,
      ]
    );

    res.json({
      facts,
      gaps,
      constraints,
      painPoints,
      message: 'Summary generated (facts only, no recommendations)',
    });
  }),

  getSummary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;

    try {
      // INT-BVP-001 (5, parity finding): this call was the only one of the five
      // assertSessionAccessibleOrThrow call sites in this file that omitted
      // `userRole` — getQuestions/getNotes/getEvidence/getLinkedItems (and the
      // new getSession check above) all pass it. Without it, canUserAccessSession's
      // elevated-role branch never fires, so an org OWNER/ADMIN could NOT read a
      // non-anonymous session's summary unless they also happened to be the
      // assignee/team member — inconsistent with every sibling endpoint and with
      // the access matrix's documented intent. Discovered while writing the
      // getSession/getSummary parity test; fixed here since it's the same
      // one-line pattern already used identically four other times in this file.
      await assertSessionAccessibleOrThrow({
        sessionId,
        organizationId: user.organizationId,
        userId: user.id,
        userRole: user.role,
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await ensureInterviewAnonymityColumns();
    const row = await queryHelpers.queryOne(
      `SELECT summary_facts, summary_gaps, summary_constraints, summary_pain_points, owner_id, is_anonymous
       FROM interview_sessions
       WHERE id = ? AND organization_id = ?`,
      [sessionId, user.organizationId]
    );
    if (!row) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // D18-A hard wall — summary facts/gaps/constraints/pain points are literal
    // "question: answer" strings (see generateSummary above) for THIS single
    // respondent's session. For anonymous sessions, that's per-answer content
    // attributable to one person — never expose it to anyone but the
    // respondent. The manager still gets the AI score via getAssignment.
    if (isAnonymityWallActive(row, user.id, 'owner_id')) {
      res.json({ facts: [], gaps: [], constraints: [], painPoints: [], anonymized: true });
      return;
    }

    res.json({
      facts: parseJson((row as any).summary_facts, []),
      gaps: parseJson((row as any).summary_gaps, []),
      constraints: parseJson((row as any).summary_constraints, []),
      painPoints: parseJson((row as any).summary_pain_points, []),
    });
  }),

  // ==========================================
  // COMPLETED SESSIONS (for Insights tab)
  // ==========================================

  getCompletedSessions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const userProfileExtendedColumns = await getTableColumns('user_profile_extended');
    const hasUserProfileExtended = userProfileExtendedColumns.size > 0;
    await ensureInterviewAnonymityColumns();

    // Filter by organization and return approved/completed source material only.
    // Assigned interviews must be manager-approved; legacy/ad-hoc sessions remain eligible when completed.
    const rows = await queryHelpers.queryAll(
      `SELECT
        s.id, s.name as name, s.template_id, s.status, s.completed_at, s.owner_id, s.is_anonymous,
        s.answered_questions, s.total_questions,
        a.status as assignment_status,
        t.name as template_name, t.category as template_category,
        u.job_title, ${hasUserProfileExtended ? 'upe.department' : 'NULL'} as department,
        COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') as respondent_name
       FROM interview_sessions s
       LEFT JOIN interview_assignments a ON a.id = s.assignment_id AND a.organization_id = ?
       LEFT JOIN projects p ON p.id = s.project_id
       LEFT JOIN interview_library_templates t ON t.id = s.template_id
       LEFT JOIN users u ON u.id = s.owner_id
       ${hasUserProfileExtended ? 'LEFT JOIN user_profile_extended upe ON upe.user_id = u.id' : ''}
       WHERE (
         p.organization_id = ?
         OR (s.project_id IS NULL AND s.organization_id = ?)
       ) AND lower(s.status) = 'completed'
       AND (s.assignment_id IS NULL OR a.status IN ('approved', 'completed'))
       ORDER BY s.completed_at DESC`,
      [user.organizationId, user.organizationId, user.organizationId]
    );

    const sessions = (rows || []).map((row: any) => {
      // D18-A hard wall — this is the Insights-tab session picker (manager
      // chooses which sessions to feed into an Insight). It never exposes
      // answer content, but respondent name/role/department alone already
      // identify WHO answered — the exact "autora" leak the wall forbids for
      // anonymous sessions. The respondent themselves still sees their own
      // identity (they know who they are); anyone else gets anonymized labels.
      const wallActive = isAnonymityWallActive(row, user.id, 'owner_id');
      return {
        id: row.id,
        name: row.name,
        templateId: row.template_id,
        templateName: row.template_name,
        templateCategory: row.template_category,
        status: row.status,
        approvalStatus: row.assignment_status || 'completed',
        sourceScopeStatus: 'approved_only',
        completedAt: row.completed_at,
        respondentId: wallActive ? undefined : row.owner_id,
        respondentName: wallActive ? 'Anonymous respondent' : row.respondent_name,
        respondentRole: wallActive ? undefined : row.job_title,
        department: wallActive ? undefined : row.department,
        isAnonymous: flagOn(row.is_anonymous),
        answeredQuestions: row.answered_questions,
        totalQuestions: row.total_questions,
      };
    });

    res.json(sessions);
  }),

  // ==========================================
  // INSIGHTS (AI-generated summaries)
  // ==========================================

  listInsights: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { limit = 50, offset = 0, scope } = req.query;

    // Lifecycle scope: active (default) | archived | all. Ensure the column exists first.
    const normalizedScope: 'active' | 'archived' | 'all' =
      scope === 'archived' ? 'archived' : scope === 'all' ? 'all' : 'active';
    await ensureInterviewInsightLifecycleColumns();

    const interviewInsightService = await import('../services/InterviewInsightService.js');
    const insights = await interviewInsightService.list(user.organizationId, {
      limit: Number(limit),
      offset: Number(offset),
      scope: normalizedScope,
    });

    res.json(insights);
  }),

  getInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const orgRow = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!orgRow) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    const userOrgId = String(req.user?.organizationId || (req as any).organizationId || '');
    if (String((orgRow as any).organization_id) !== userOrgId) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    const interviewInsightService = await import('../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    res.json(insight);
  }),

  createInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const {
      title,
      sessionIds,
      sessionId,
      promptType,
      filters,
      analysisScope,
      analysisMode,
      contextMode,
      topicFocus,
      consultantNote,
      leadingQuestion,
      customPrompt,
      selectedContextDocumentIds,
    } = req.body || {};

    const normalizedSessionIds: string[] = Array.isArray(sessionIds)
      ? sessionIds.map(String).filter(Boolean)
      : sessionId
        ? [String(sessionId)].filter(Boolean)
        : [];

    if (normalizedSessionIds.length === 0) {
      res.status(400).json({ error: 'sessionId or sessionIds is required' });
      return;
    }

    const placeholders = normalizedSessionIds.map(() => '?').join(',');
    const approvedRows = await queryHelpers.queryAll<{ id: string }>(
      `SELECT s.id
       FROM interview_sessions s
       LEFT JOIN interview_assignments a ON a.id = s.assignment_id AND a.organization_id = ?
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id IN (${placeholders})
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )
         AND lower(s.status) = 'completed'
         AND (s.assignment_id IS NULL OR a.status IN ('approved', 'completed'))`,
      [user.organizationId, ...normalizedSessionIds, user.organizationId, user.organizationId]
    );
    const approvedIds = new Set((approvedRows || []).map((row) => String(row.id)));
    const rejectedIds = normalizedSessionIds.filter((id) => !approvedIds.has(id));
    if (rejectedIds.length > 0) {
      res.status(409).json({
        error: 'Interview Insight can only be generated from approved/completed interview sessions',
        rejectedSessionIds: rejectedIds,
      });
      return;
    }

    let normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedPromptType = (
      typeof promptType === 'string' && promptType.trim() ? promptType.trim() : 'summary'
    ) as any;

    // If title is omitted (e.g. quick-generate from a session row), build a reasonable default.
    if (!normalizedTitle) {
      try {
        const sessionRow = await queryHelpers.queryOne(
          `SELECT name FROM interview_sessions WHERE id = ?`,
          [normalizedSessionIds[0]]
        );
        const sessionName = String((sessionRow as any)?.name || '').trim();
        normalizedTitle = sessionName
          ? `${sessionName} — ${normalizedPromptType}`
          : `Interview Insight — ${normalizedPromptType}`;
      } catch {
        normalizedTitle = `Interview Insight — ${normalizedPromptType}`;
      }
    }

    const interviewInsightService = await import('../services/InterviewInsightService.js');
    const insight = await interviewInsightService.create({
      organizationId: user.organizationId,
      title: normalizedTitle,
      sessionIds: normalizedSessionIds,
      promptType: normalizedPromptType,
      filters,
      analysisScope,
      analysisMode,
      contextMode,
      topicFocus,
      consultantNote,
      leadingQuestion,
      customPrompt,
      selectedContextDocumentIds: Array.isArray(selectedContextDocumentIds)
        ? selectedContextDocumentIds.map(String).filter(Boolean)
        : [],
      createdBy: user.id,
    });

    void logInterviewInsightActivity({
      organizationId: user.organizationId,
      insightId: insight.id,
      type: 'created',
      description: `Insight created (${normalizedPromptType})`,
      userId: user.id,
    });

    // D03: Link graph edges — insight → source sessions + insight → evidence
    void (async () => {
      try {
        const lgCols = await getTableColumns('link_graph_edges');
        if (!lgCols || lgCols.size === 0) return;
        const now = new Date().toISOString();

        for (const sid of normalizedSessionIds) {
          await queryHelpers.queryRun(
            `INSERT OR IGNORE INTO link_graph_edges
             (id, organization_id, source_type, source_id, target_type, target_id, relation, created_by, created_at)
             VALUES (?, ?, 'interview_insight', ?, 'interview_session', ?, 'created_from', ?, ?)`,
            [uuidv4(), user.organizationId, insight.id, sid, user.id, now]
          );

          const evidenceRows = await queryHelpers.queryAll<{ id: string }>(
            `SELECT id FROM interview_evidence WHERE session_id = ? AND organization_id = ?`,
            [sid, user.organizationId]
          );
          for (const ev of evidenceRows || []) {
            await queryHelpers.queryRun(
              `INSERT OR IGNORE INTO link_graph_edges
               (id, organization_id, source_type, source_id, target_type, target_id, relation, container_type, container_id, created_by, created_at)
               VALUES (?, ?, 'interview_insight', ?, 'interview_evidence', ?, 'ref', 'interview_session', ?, ?, ?)`,
              [uuidv4(), user.organizationId, insight.id, ev.id, sid, user.id, now]
            );
          }
        }
      } catch (e) {
        logger.warn(
          `[InterviewController] Link graph edges for insight ${insight.id} skipped: ${String((e as Error)?.message || e)}`
        );
      }
    })();

    res.status(201).json(insight);
  }),

  regenerateInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    if (String((row as any).organization_id) !== String(user.organizationId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const interviewInsightService = await import('../services/InterviewInsightService.js');
    const insight = await interviewInsightService.regenerate(id);

    if (!insight) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }

    void logInterviewInsightActivity({
      organizationId: user.organizationId,
      insightId: id,
      type: 'regenerated',
      description: 'Regeneration requested',
      userId: user.id,
    });

    res.json(insight);
  }),

  deleteInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const orgRow = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!orgRow) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    const userOrgId = String(req.user?.organizationId || (req as any).organizationId || '');
    if (String((orgRow as any).organization_id) !== userOrgId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const interviewInsightService = await import('../services/InterviewInsightService.js');
    let deleted = false;
    try {
      deleted = await interviewInsightService.deleteInsight(id);
    } catch (error) {
      // M03R-008: odmowa rozerwania lineage jest odpowiedzią 409 z liczbą
      // trzymających obiektów, nie anonimowym 500.
      if (error instanceof interviewInsightService.InsightReferencedError) {
        res.status(error.status).json({
          error: error.message,
          code: error.code,
          referencingCount: error.referencingCount,
        });
        return;
      }
      throw error;
    }

    if (!deleted) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    res.json({ success: true });
  }),

  // Update insight (status, etc.)
  updateInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const {
      title,
      status,
      exportedToTools,
      exportedToAssessment,
      archived,
      sectionCompletions,
      sectionOverrides,
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (typeof title === 'string') {
      updates.push('title = ?');
      values.push(title.trim());
    }
    if (status !== undefined) {
      // SEC — never let the body forge a GATED review status here. The
      // published/in_review (+approved alias) transitions are owned by the
      // lifecycle gate (POST /interview/insights/:insightId/lifecycle), which
      // enforces findings-required + canon + client-readback + the
      // INTERVIEW_INSIGHTS_PUBLISH permission and server-derives reviewed_by /
      // published_at. Accepting status='published' from the body would publish
      // an insight without ANY of those checks (mass-assignment / state-machine
      // bypass). Only the ungated, revert-/edit-style statuses are settable here.
      const requested = String(status);
      if (INSIGHT_GATED_STATUSES.has(requested)) {
        res.status(409).json({
          error:
            'This status is managed by the review workflow. Use the insight lifecycle action (submit/approve/publish) instead of a direct status edit.',
          code: 'INSIGHT_STATUS_GATED',
        });
        return;
      }
      if (!INSIGHT_PATCH_SETTABLE_STATUSES.has(requested as never)) {
        res.status(400).json({ error: 'Invalid status', code: 'INSIGHT_STATUS_INVALID' });
        return;
      }
      updates.push('status = ?');
      values.push(requested);
    }
    if (exportedToTools !== undefined) {
      updates.push('exported_to_tools = ?');
      values.push(exportedToTools ? 1 : 0);
    }
    if (exportedToAssessment !== undefined) {
      updates.push('exported_to_assessment = ?');
      values.push(exportedToAssessment ? 1 : 0);
    }
    // Lifecycle: archive / restore (soft, reversible). Ensure columns exist first.
    if (archived !== undefined) {
      await ensureInterviewInsightLifecycleColumns();
      if (archived) {
        updates.push('archived_at = ?', 'archived_by = ?');
        values.push(new Date().toISOString(), user.id);
      } else {
        updates.push('archived_at = ?', 'archived_by = ?');
        values.push(null, null);
      }
    }

    // Mark Complete — AI signal only; persisted as JSON { sectionId: boolean, ... }
    if (sectionCompletions !== undefined && sectionCompletions !== null) {
      await ensureInsightSectionCompletionsColumn();
      updates.push('section_completions = ?');
      values.push(
        typeof sectionCompletions === 'string'
          ? sectionCompletions
          : JSON.stringify(sectionCompletions)
      );
    }

    // Ręczna redakcja treści sekcji (n-Type §6.2) — parytet z trasą v8
    // (routes/v8/interview.routes.ts, PATCH /insights/:id), z której korzysta
    // front. Ta trasa (legacy /api/interview) zostaje zgodna, żeby ten sam
    // payload działał niezależnie od namespace'u.
    if (sectionOverrides !== undefined) {
      const insightSvc = await import('../services/InterviewInsightService.js');
      const current = await insightSvc.getById(id);
      if (!current || String(current.organizationId) !== String(user.organizationId)) {
        res.status(404).json({ error: 'Insight not found' });
        return;
      }
      const merged = insightSvc.mergeInsightSectionOverrides(
        current.sectionOverrides,
        sectionOverrides,
        user.id
      );
      if (merged.ok === false) {
        res.status(400).json({ error: merged.error, code: merged.code });
        return;
      }
      await ensureInsightSectionOverridesColumn();
      updates.push('section_overrides = ?');
      values.push(Object.keys(merged.value).length === 0 ? null : JSON.stringify(merged.value));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    values.push(user.organizationId);

    await queryHelpers.queryRun(
      `UPDATE interview_insights SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      values
    );

    if (typeof title === 'string') {
      void logInterviewInsightActivity({
        organizationId: user.organizationId,
        insightId: id,
        type: 'edit',
        description: 'Insight updated',
        userId: user.id,
      });
    }
    if (archived !== undefined) {
      void logInterviewInsightActivity({
        organizationId: user.organizationId,
        insightId: id,
        type: 'edit',
        description: archived ? 'Insight archived' : 'Insight restored',
        userId: user.id,
      });
    }

    res.json({ success: true });
  }),

  // Export insight to Tools or Assessment
  exportInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { target, sectionIds } = req.body || {};

    if (!target || !['tools', 'assessment'].includes(target)) {
      res.status(400).json({ error: 'target must be "tools" or "assessment"' });
      return;
    }

    // #25 — optional section filter. When provided we export only the selected
    // sections of the insight; unknown ids are ignored and an empty result falls
    // back to the full insight (logged). Omitted/empty → unchanged behavior.
    const requestedSectionIds: string[] = Array.isArray(sectionIds)
      ? sectionIds.map((s: unknown) => String(s || '').trim()).filter(Boolean)
      : [];

    // Load insight so we can create an actual downstream artifact (Tools/Assessment).
    // NOTE: There are environments with different `interview_insights` schemas.
    // We treat `session_id` as best-effort: export should still work even if session is missing.
    let insightRow: any = null;
    try {
      insightRow = (await queryHelpers.queryOne(
        `SELECT
          id, session_id, organization_id, category, title, description,
          insight_type, status, exported_to_tools, exported_to_assessment
         FROM interview_insights
         WHERE id = ? AND organization_id = ?`,
        [id, user.organizationId]
      )) as any;
    } catch (e: any) {
      // fallback for other schema variants
      try {
        insightRow = (await queryHelpers.queryOne(
          `SELECT
            id, organization_id, title, prompt_type, source_session_ids, content, status
           FROM interview_insights
           WHERE id = ? AND organization_id = ?`,
          [id, user.organizationId]
        )) as any;
      } catch {
        // ignore - handled below
      }
    }

    if (!insightRow) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }

    // #25 — Build the optional section-filtered snapshot. We load the FULL
    // structured insight (themes/issues/opportunities/signals/etc.) and filter it
    // by the requested section ids. Robust: unknown ids ignored; empty match falls
    // back to the full insight content with a logged note.
    let sectionFilter: {
      sectionIds: string[];
      filtered: FilterableInsight;
      markdown: string;
    } | null = null;
    if (requestedSectionIds.length > 0) {
      try {
        const interviewInsightService = await import('../services/InterviewInsightService.js');
        const fullInsight = (await interviewInsightService.getById(
          id
        )) as unknown as FilterableInsight | null;
        if (fullInsight) {
          const { filtered, matched, markdown } = filterInsightBySectionIds(
            fullInsight,
            requestedSectionIds
          );
          if (matched) {
            sectionFilter = { sectionIds: requestedSectionIds, filtered, markdown };
          } else {
            logger.warn(
              `[InterviewController] exportInsight: sectionIds ${JSON.stringify(
                requestedSectionIds
              )} matched no sections for insight ${id}; falling back to full content`
            );
          }
        }
      } catch (e) {
        logger.warn(
          '[InterviewController] exportInsight: section filter failed, exporting full',
          e
        );
      }
    }

    // Resolve a usable sessionId (optional).
    let sessionId: string | null = null;
    if (insightRow.session_id) {
      sessionId = String(insightRow.session_id);
    } else if (insightRow.source_session_ids) {
      try {
        const ids = JSON.parse(String(insightRow.source_session_ids || '[]'));
        if (Array.isArray(ids) && ids[0]) sessionId = String(ids[0]);
      } catch {
        // ignore
      }
    }

    // Export gating (best-effort): only enforce when we can actually load the session + assignment.
    // - Assignments: require status approved (or legacy completed)
    // - Ad-hoc: require session completed
    let sessionRow: any = null;
    if (sessionId) {
      sessionRow = await queryHelpers.queryOne(
        `SELECT id, status, assignment_id, answered_questions, total_questions, project_id FROM interview_sessions
         WHERE id = ? AND organization_id = ?`,
        [sessionId, user.organizationId]
      );
      if (sessionRow) {
        const sessionStatus = String((sessionRow as any).status || '').toLowerCase();
        if ((sessionRow as any).assignment_id) {
          const assignment = await queryHelpers.queryOne(
            `SELECT status FROM interview_assignments WHERE id = ? AND organization_id = ?`,
            [(sessionRow as any).assignment_id, user.organizationId]
          );
          const asgStatus = String((assignment as any)?.status || '').toLowerCase();
          const allowed = asgStatus === 'approved' || asgStatus === 'completed';
          if (!allowed) {
            res.status(409).json({ error: 'Interview not approved - cannot export yet' });
            return;
          }
        } else {
          if (sessionStatus !== 'completed') {
            res.status(409).json({ error: 'Interview not completed - cannot export yet' });
            return;
          }
        }
      }
    }

    // Ensure mapping table exists (idempotent exports by insight+target).
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS interview_insight_exports (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        insight_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_interview_insight_exports_org ON interview_insight_exports(organization_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_interview_insight_exports_insight ON interview_insight_exports(insight_id)`
    );

    const existing = (await queryHelpers.queryOne(
      `SELECT target_id FROM interview_insight_exports
       WHERE organization_id = ? AND insight_id = ? AND target_type = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.organizationId, id, target]
    )) as any;

    // If already exported, just mark flags (if needed) and return the previously created target id.
    if (existing?.target_id) {
      const column = target === 'tools' ? 'exported_to_tools' : 'exported_to_assessment';
      await queryHelpers.queryRun(
        `UPDATE interview_insights SET ${column} = 1, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), id]
      );
      if (target === 'assessment') {
        let assessmentType: string | undefined;
        try {
          const row = (await queryHelpers.queryOne(
            `SELECT assessment_type FROM assessments WHERE id = ? AND organization_id = ?`,
            [existing.target_id, user.organizationId]
          )) as any;
          if (row?.assessment_type) assessmentType = String(row.assessment_type);
        } catch {
          // ignore
        }
        void logInterviewInsightActivity({
          organizationId: user.organizationId,
          insightId: id,
          type: 'exported',
          description: `Exported to ${target}`,
          userId: user.id,
        });
        res.json({
          success: true,
          target,
          targetId: existing.target_id,
          assessmentType: assessmentType || 'DRD',
        });
        return;
      }

      void logInterviewInsightActivity({
        organizationId: user.organizationId,
        insightId: id,
        type: 'exported',
        description: `Exported to ${target}`,
        userId: user.id,
      });
      res.json({ success: true, target, targetId: existing.target_id });
      return;
    }

    const now = new Date().toISOString();

    if (target === 'tools') {
      // Ensure tool_sessions exists (it should via migrations, but keep it safe in dev).
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS tool_sessions (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT,
          tool_type TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT DEFAULT 'DRAFT',
          completion_percent INTEGER DEFAULT 0,
          confidence_avg REAL DEFAULT 0,
          answers_json TEXT DEFAULT '{}',
          context_snapshot TEXT DEFAULT '{}',
          review_requested_at TIMESTAMP,
          approved_at TIMESTAMP,
          created_by TEXT NOT NULL,
          updated_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );

      const projectIdCandidate = (sessionRow as any)?.project_id as string | null | undefined;
      // Best-effort: prefer a valid projectId so Tools hub (project-scoped) can see it.
      // If org has no projects, fall back to NULL (tools still work org-wide).
      let resolvedProjectId: string | null = projectIdCandidate || null;
      try {
        resolvedProjectId = await resolveValidProjectId({
          organizationId: user.organizationId,
          projectId: projectIdCandidate || undefined,
        });
      } catch {
        resolvedProjectId = projectIdCandidate || null;
      }

      const toolSessionId = uuidv4();
      const toolType = 'dynamic-swot';
      // Z139 (data-integrity): insightRow.title may itself already carry HTML
      // entities escaped by the global sanitizer on a prior save. Decode before
      // composing tool_sessions.name so we don't bake an escaped `&amp;` into a
      // brand-new session name (mirrors the notebook/canvas decode-before-store fix).
      const name = decodeHtmlEntities(
        `Interview Insight: ${String(insightRow.title || 'Untitled')}`
      );

      const orgContext = await organizationContextService.buildResolvedContext(user.organizationId);

      const contextSnapshot = {
        source: {
          kind: 'interview_insight',
          insightId: id,
          sessionId: sessionId || null,
          category: insightRow.category,
          title: insightRow.title,
          description: sectionFilter
            ? sectionFilter.markdown || insightRow.description || insightRow.content || null
            : insightRow.description || insightRow.content || null,
          insightType: insightRow.insight_type || insightRow.prompt_type || null,
          // #25 — only present when a section filter was applied and matched.
          sectionFilter: sectionFilter
            ? { sectionIds: sectionFilter.sectionIds, sections: sectionFilter.filtered }
            : undefined,
          exportedAt: now,
        },
        organizationContext: orgContext,
      };

      await queryHelpers.queryRun(
        `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent, confidence_avg, answers_json, context_snapshot, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'DRAFT', 0, 0, ?, ?, ?, ?, ?)`,
        [
          toolSessionId,
          user.organizationId,
          resolvedProjectId || null,
          toolType,
          name,
          JSON.stringify({}),
          JSON.stringify(contextSnapshot),
          user.id,
          now,
          now,
        ]
      );

      await queryHelpers.queryRun(
        `INSERT INTO interview_insight_exports
         (id, organization_id, insight_id, session_id, target_type, target_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          user.organizationId,
          id,
          sessionId || 'unknown',
          'tools',
          toolSessionId,
          user.id,
          now,
        ]
      );

      // Only create a context export record when we actually have a session id.
      if (sessionId) {
        await queryHelpers.queryRun(
          `INSERT INTO interview_context_exports
           (id, interview_session_id, organization_id, target_type, target_id, context_snapshot, exported_by, exported_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            sessionId,
            user.organizationId,
            'tools',
            toolSessionId,
            JSON.stringify(orgContext || {}),
            user.id,
            now,
          ]
        );
      }

      // Best-effort flags (some schemas might not have these columns).
      try {
        await queryHelpers.queryRun(
          `UPDATE interview_insights SET exported_to_tools = 1, updated_at = ? WHERE id = ?`,
          [now, id]
        );
      } catch {
        // ignore
      }

      void logInterviewInsightActivity({
        organizationId: user.organizationId,
        insightId: id,
        type: 'exported',
        description: 'Exported to tools',
        userId: user.id,
      });
      res.json({ success: true, target: 'tools', targetId: toolSessionId });
      return;
    }

    // Create an actual Assessment artifact (so the user can immediately open it).
    // Keep this resilient: the Assessment module can exist in different schema states.
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        assessment_type TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'DRAFT',
        completion_percent INTEGER DEFAULT 0,
        confidence_avg REAL DEFAULT 0,
        answers_json TEXT DEFAULT '{}',
        context_snapshot TEXT DEFAULT '{}',
        score_summary TEXT DEFAULT '{}',
        current_section_id TEXT,
        review_requested_at TIMESTAMP,
        report_approved_at TIMESTAMP,
        approved_at TIMESTAMP,
        created_by TEXT NOT NULL,
        updated_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );

    const projectIdCandidate = (sessionRow as any)?.project_id as string | null | undefined;
    let resolvedProjectId: string | null = projectIdCandidate || null;
    try {
      resolvedProjectId = await resolveValidProjectId({
        organizationId: user.organizationId,
        projectId: projectIdCandidate || undefined,
      });
    } catch {
      resolvedProjectId = projectIdCandidate || null;
    }

    const assessmentId = uuidv4();
    const assessmentType = 'DRD';
    const name = `Interview Insight: ${String(insightRow.title || 'Untitled')}`;

    const orgContext = await organizationContextService.buildResolvedContext(user.organizationId);

    const contextSnapshot = {
      source: {
        kind: 'interview_insight',
        insightId: id,
        sessionId: sessionId || null,
        category: insightRow.category,
        title: insightRow.title,
        description: sectionFilter
          ? sectionFilter.markdown || insightRow.description || insightRow.content || null
          : insightRow.description || insightRow.content || null,
        insightType: insightRow.insight_type || insightRow.prompt_type || null,
        // #25 — only present when a section filter was applied and matched.
        sectionFilter: sectionFilter
          ? { sectionIds: sectionFilter.sectionIds, sections: sectionFilter.filtered }
          : undefined,
        exportedAt: now,
      },
      organizationContext: orgContext,
    };

    await queryHelpers.queryRun(
      `INSERT INTO assessments
       (id, organization_id, project_id, assessment_type, name, status, completion_percent, confidence_avg, answers_json, context_snapshot, score_summary, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'DRAFT', 0, 0, ?, ?, ?, ?, ?, ?)`,
      [
        assessmentId,
        user.organizationId,
        resolvedProjectId || null,
        assessmentType,
        name,
        JSON.stringify({}),
        JSON.stringify(contextSnapshot),
        JSON.stringify({}),
        user.id,
        now,
        now,
      ]
    );

    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_exports
       (id, organization_id, insight_id, session_id, target_type, target_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        user.organizationId,
        id,
        sessionId || 'unknown',
        'assessment',
        assessmentId,
        user.id,
        now,
      ]
    );

    try {
      await queryHelpers.queryRun(
        `UPDATE interview_insights SET exported_to_assessment = 1, updated_at = ? WHERE id = ?`,
        [now, id]
      );
    } catch {
      // ignore
    }

    void logInterviewInsightActivity({
      organizationId: user.organizationId,
      insightId: id,
      type: 'exported',
      description: 'Exported to assessment',
      userId: user.id,
    });
    res.json({ success: true, target: 'assessment', targetId: assessmentId, assessmentType });
  }),

  getInsightActivity: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    if (String((row as any).organization_id) !== String(user.organizationId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await ensureInterviewInsightActivityTable();
    const entries = await queryHelpers.queryAll(
      `SELECT a.id, a.type, a.description, a.created_at, u.first_name, u.last_name
       FROM interview_insight_activity a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.organization_id = ? AND a.insight_id = ?
       ORDER BY a.created_at DESC`,
      [user.organizationId, id]
    );

    res.json(
      (entries || []).map((e: any) => ({
        id: e.id,
        type: e.type,
        description: e.description,
        timestamp: e.created_at,
        userName:
          `${String(e.first_name || '').trim()} ${String(e.last_name || '').trim()}`.trim() ||
          undefined,
      }))
    );
  }),

  getInsightComments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    if (String((row as any).organization_id) !== String(user.organizationId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { CommentService } = await import('../services/content/CommentService.js');
    const commentService = new CommentService();
    const comments = await commentService.getContentComments(id, 'interview_insight', {
      includeResolved: true,
    });

    const safeParsePriority = (positionRef?: string | null) => {
      if (!positionRef) return 'normal';
      try {
        const parsed = JSON.parse(positionRef);
        const p = String((parsed as any)?.priority || '').toLowerCase();
        if (p === 'low' || p === 'high' || p === 'normal') return p;
        return 'normal';
      } catch {
        return 'normal';
      }
    };

    res.json(
      (comments || []).map((c: any) => ({
        id: c.id,
        authorName: c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() : undefined,
        content: c.commentText,
        createdAt: c.createdAt,
        priority: safeParsePriority(c.positionRef),
      }))
    );
  }),

  createInsightComment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { content, priority } = req.body || {};

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    if (String((row as any).organization_id) !== String(user.organizationId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const p = String(priority || '').toLowerCase();
    const safePriority = p === 'low' || p === 'high' || p === 'normal' ? p : 'normal';

    const { CommentService } = await import('../services/content/CommentService.js');
    const commentService = new CommentService();
    const created = await commentService.createComment({
      contentId: id,
      contentType: 'interview_insight',
      userId: user.id,
      commentText: text,
      positionRef: JSON.stringify({ priority: safePriority }),
    });

    void logInterviewInsightActivity({
      organizationId: user.organizationId,
      insightId: id,
      type: 'comment',
      description: 'Comment added',
      userId: user.id,
    });

    res.status(201).json({
      id: created.id,
      authorName: created.user
        ? `${created.user.firstName} ${created.user.lastName}`.trim()
        : undefined,
      content: created.commentText,
      createdAt: created.createdAt,
      priority: safePriority,
    });
  }),

  deleteInsightComment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id, commentId } = req.params as any;

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    if (String((row as any).organization_id) !== String(user.organizationId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { CommentService } = await import('../services/content/CommentService.js');
    const commentService = new CommentService();
    const comment = await commentService.getCommentById(commentId);
    if (!comment || comment.contentId !== id || comment.contentType !== 'interview_insight') {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    const role = String((user as any).role || '').toUpperCase();
    const canDelete = comment.userId === user.id || role === 'ADMIN' || role === 'SUPERADMIN';
    if (!canDelete) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const deleted = await commentService.deleteComment(commentId);
    if (!deleted) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    void logInterviewInsightActivity({
      organizationId: user.organizationId,
      insightId: id,
      type: 'comment',
      description: 'Comment deleted',
      userId: user.id,
    });

    res.json({ success: true });
  }),

  // ==========================================
  // TRANSCRIPT (T013)
  // ==========================================

  getTranscript: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 200;

    // D18-A hard wall — the conversational transcript is raw respondent
    // content; redact it the same way as questions/notes/evidence for
    // anonymous sessions viewed by anyone but the respondent.
    await ensureInterviewAnonymityColumns();
    const sessionOwnerRow = await queryHelpers.queryOne(
      `SELECT owner_id, is_anonymous FROM interview_sessions WHERE id = ?`,
      [sessionId]
    );
    if (isAnonymityWallActive(sessionOwnerRow, user.id, 'owner_id')) {
      res.json({ messages: [], anonymized: true });
      return;
    }

    const transcriptService = await import('../services/interviewTranscriptService.js');
    const messages = await transcriptService.getMessages(user.organizationId, sessionId, limit);
    res.json({ messages });
  }),

  addTranscriptMessage: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { role, content, metadata } = req.body;
    if (!content || !role) {
      res.status(400).json({ error: 'role and content are required' });
      return;
    }
    const transcriptService = await import('../services/interviewTranscriptService.js');
    const msg = await transcriptService.addMessage(
      user.organizationId,
      sessionId,
      role,
      content,
      metadata
    );
    res.status(201).json(msg);
  }),

  // ==========================================
  // TEMPLATE QUALITY (V6-B04)
  // ==========================================

  evaluateTemplateQuality: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    requireUser(req);
    const { questions } = req.body;

    if (!Array.isArray(questions)) {
      res.status(400).json({ error: 'questions array required' });
      return;
    }

    const { evaluateQuestionQuality, calculateQuestionScore } =
      await import('../services/interviewQuestionQualityRules.js');

    const results = questions.map((q: any) => {
      const warnings = evaluateQuestionQuality({
        questionText: q.questionText || q.question_text || '',
        answerType: q.answerType || q.answer_type || 'open',
        answerOptions: q.answerOptions || q.answer_options || [],
        isRequired: q.isRequired ?? q.is_required ?? false,
        helpHint: q.helpHint || q.help_hint || '',
      });
      return {
        questionId: q.id,
        score: calculateQuestionScore(warnings),
        warnings,
      };
    });

    const avgScore =
      results.length > 0
        ? Math.round(results.reduce((sum: number, r: any) => sum + r.score, 0) / results.length)
        : 100;

    res.json({
      results,
      averageScore: avgScore,
      totalWarnings: results.reduce((sum: number, r: any) => sum + r.warnings.length, 0),
    });
  }),

  // ==========================================
  // INFERENCE (T016)
  // ==========================================

  startInferenceRun: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { projectId, sessionIds } = req.body;
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      res.status(400).json({ error: 'sessionIds array is required' });
      return;
    }
    const inferenceService = await import('../services/interviewInferenceService.js');
    const runId = await inferenceService.startInferenceRun(
      user.organizationId,
      projectId,
      sessionIds,
      user.id
    );
    inferenceService.executeInference(user.organizationId, runId).catch((err: any) => {
      logger.error(`[Inference] Run ${runId} failed:`, err.message);
    });
    res.status(201).json({ runId, status: 'running' });
  }),

  getInferenceRuns: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { projectId } = req.query;
    const inferenceService = await import('../services/interviewInferenceService.js');
    const runs = await inferenceService.getInferenceRuns(user.organizationId, projectId as string);
    res.json({ runs });
  }),

  getInferenceRun: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { runId } = req.params;
    const inferenceService = await import('../services/interviewInferenceService.js');
    const run = await inferenceService.getInferenceRun(user.organizationId, runId);
    if (!run) {
      res.status(404).json({ error: 'Inference run not found' });
      return;
    }
    res.json(run);
  }),
};

export default InterviewController;
