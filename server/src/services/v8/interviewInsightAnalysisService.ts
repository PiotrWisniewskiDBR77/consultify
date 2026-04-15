import type {
  Insight,
  InsightIssue,
  InsightOpportunity,
  InsightTheme,
} from '../InterviewInsightService.js';
import { getById as getInsightById } from '../InterviewInsightService.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

import { listFindings, type P10ConfidenceLevel, type P10Finding } from './interviewInsightFindingsService.js';

type TopicKind = 'theme' | 'issue' | 'opportunity';
type LensKind = 'session' | 'stakeholder';
type MatrixCellState = 'supported' | 'contradicted' | 'local_only' | 'not_observed';

interface SourceSessionRow {
  id: string;
  name: string;
  completed_at?: string | null;
  owner_id?: string | null;
  respondent_name?: string | null;
  job_title?: string | null;
  department?: string | null;
}

interface TopicBase {
  title: string;
  description: string;
  evidence_refs: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

interface TopicEntry {
  id: string;
  sourceKey: string;
  kind: TopicKind;
  title: string;
  description: string;
  confidenceLevel: P10ConfidenceLevel;
  reviewStatus?: 'draft' | 'in_review' | 'published';
  limits: string;
  nextAction: string;
  evidenceCount: number;
  answerRefs: string[];
  supportSessionIds: string[];
  crossSessionPattern: boolean;
  isContradicted: boolean;
  perspectiveLabels: string[];
  divergenceNote?: string;
}

export interface InsightAnalysisScope {
  sourceSessionIds: string[];
  sourceSessionCount: number;
  distinctStakeholderCount: number;
  stakeholderLabels: string[];
  departments: string[];
  roles: string[];
  posture: 'single_perspective' | 'cross_perspective' | 'organization_synthesis';
}

export interface InsightAnalysisLens {
  id: string;
  kind: LensKind;
  label: string;
  sessionIds: string[];
  respondentName?: string;
  role?: string;
  department?: string;
  supportedTopicIds: string[];
  supportedFindingIds: string[];
  localSummary: string;
}

export interface InsightAnalysisTopic {
  id: string;
  sourceKey: string;
  kind: TopicKind;
  label: string;
  description: string;
  findingId?: string;
  confidenceLevel: P10ConfidenceLevel;
  reviewStatus?: 'draft' | 'in_review' | 'published';
  limits: string;
  nextAction: string;
  evidenceCount: number;
  supportingSessionIds: string[];
  supportingStakeholderLabels: string[];
  crossSessionPattern: boolean;
  isContradicted: boolean;
  perspectiveLabels: string[];
  divergenceNote?: string;
}

export interface InsightAnalysisMatrixCell {
  topicId: string;
  lensId: string;
  state: MatrixCellState;
  supportingSessionIds: string[];
  evidenceCount: number;
}

export interface InsightAnalysisMatrix {
  rows: Array<{
    id: string;
    label: string;
    kind: TopicKind;
    confidenceLevel: P10ConfidenceLevel;
  }>;
  sessionColumns: Array<{ id: string; label: string }>;
  stakeholderColumns: Array<{ id: string; label: string }>;
  sessionCells: InsightAnalysisMatrixCell[];
  stakeholderCells: InsightAnalysisMatrixCell[];
}

export interface InsightAnalysisSynthesis {
  consensusTopicIds: string[];
  localOnlyTopicIds: string[];
  contradictedTopicIds: string[];
  coverageGaps: string[];
}

export interface InsightAnalysis {
  insightId: string;
  insightTitle: string;
  scope: InsightAnalysisScope;
  people: {
    sessionLenses: InsightAnalysisLens[];
    stakeholderLenses: InsightAnalysisLens[];
  };
  topics: InsightAnalysisTopic[];
  matrix: InsightAnalysisMatrix;
  synthesis: InsightAnalysisSynthesis;
}

function uniqueStrings(items: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      items
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
}

function toSafeLabel(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (trimmed) return trimmed;
  }
  return 'Unknown';
}

function inferFallbackConfidence(kind: TopicKind, item: TopicBase & Partial<InsightTheme & InsightIssue & InsightOpportunity>): P10ConfidenceLevel {
  if (kind === 'theme') {
    const strength = String((item as InsightTheme).strength || '').toLowerCase();
    if (strength === 'strong') return 'high';
    if (strength === 'moderate') return 'medium';
    return 'low';
  }
  if (kind === 'issue') {
    const severity = String((item as InsightIssue).severity || '').toLowerCase();
    if (severity === 'high') return 'medium';
    if (severity === 'medium') return 'low';
    return 'low';
  }
  const impact = String((item as InsightOpportunity).impact || '').toLowerCase();
  if (impact === 'high') return 'medium';
  if (impact === 'medium') return 'low';
  return 'low';
}

function parsePointerSessionId(sourceRef: string): string | null {
  if (sourceRef.startsWith('session:')) return sourceRef.slice('session:'.length).trim() || null;
  return null;
}

function parsePointerAnswerId(sourceRef: string): string | null {
  if (sourceRef.startsWith('answer:')) return sourceRef.slice('answer:'.length).trim() || null;
  return null;
}

async function loadSourceSessions(sessionIds: string[]): Promise<SourceSessionRow[]> {
  if (sessionIds.length === 0) return [];
  const placeholders = sessionIds.map(() => '?').join(', ');
  const rows = await queryHelpers.queryAll(
    `SELECT
       s.id,
       s.name,
       s.completed_at,
       s.owner_id,
       COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') AS respondent_name,
       u.job_title,
       u.department
     FROM interview_sessions s
     LEFT JOIN users u ON u.id = s.owner_id
     WHERE s.id IN (${placeholders})`,
    sessionIds
  );
  return (rows || []) as SourceSessionRow[];
}

async function loadAnswerSessionMap(answerIds: string[]): Promise<Record<string, string>> {
  if (answerIds.length === 0) return {};
  const placeholders = answerIds.map(() => '?').join(', ');
  const rows = await queryHelpers.queryAll(
    `SELECT q.id, q.session_id
     FROM interview_questions q
     WHERE q.id IN (${placeholders})`,
    answerIds
  );
  return (rows || []).reduce<Record<string, string>>((acc, row: any) => {
    const answerId = String(row.id || '').trim();
    const sessionId = String(row.session_id || '').trim();
    if (answerId && sessionId) acc[answerId] = sessionId;
    return acc;
  }, {});
}

function buildTopicEntries(params: {
  insight: Insight;
  findings: P10Finding[];
  answerSessionMap: Record<string, string>;
}): TopicEntry[] {
  const { insight, findings, answerSessionMap } = params;
  const findingsBySourceKey = findings.reduce<Record<string, P10Finding>>((acc, finding) => {
    if (finding.source_key) acc[finding.source_key] = finding;
    return acc;
  }, {});

  const makeEntries = <T extends TopicBase>(
    kind: TopicKind,
    items: T[]
  ): TopicEntry[] =>
    items.map((item, index) => {
      const sourceKey = `${kind}:${index}`;
      const finding = findingsBySourceKey[sourceKey];
      const pointerSessionIds = uniqueStrings(
        (finding?.evidence_pointers || []).flatMap((pointer) => {
          if (pointer.isTombstone) return [];
          const directSessionId = parsePointerSessionId(pointer.sourceRef);
          if (directSessionId) return [directSessionId];
          const answerId = parsePointerAnswerId(pointer.sourceRef);
          if (!answerId) return [];
          return answerSessionMap[answerId] ? [answerSessionMap[answerId]] : [];
        })
      );
      const answerRefSessionIds = uniqueStrings(
        (item.evidence_refs || []).map((ref) => answerSessionMap[ref]).filter(Boolean)
      );
      const supportSessionIds = uniqueStrings([...pointerSessionIds, ...answerRefSessionIds]);
      const evidenceCount =
        finding?.evidence_pointers?.filter((pointer) => !pointer.isTombstone).length ||
        uniqueStrings(item.evidence_refs || []).length;
      const confidenceLevel = finding?.confidence_level || inferFallbackConfidence(kind, item);
      return {
        id: `${sourceKey}`,
        sourceKey,
        kind,
        title: item.title,
        description: finding?.finding_statement || item.description,
        confidenceLevel,
        reviewStatus: finding?.review_status,
        limits: finding?.limits || '',
        nextAction: finding?.next_action || '',
        evidenceCount,
        answerRefs: uniqueStrings(item.evidence_refs || []),
        supportSessionIds,
        crossSessionPattern: Boolean(item.crossSessionPattern) || supportSessionIds.length > 1,
        isContradicted: confidenceLevel === 'contradicted',
        perspectiveLabels: uniqueStrings(item.perspective_labels || []),
        divergenceNote: String(item.divergence_note || '').trim() || undefined,
      };
    });

  return [
    ...makeEntries('theme', insight.themes || []),
    ...makeEntries('issue', insight.issues || []),
    ...makeEntries('opportunity', insight.opportunities || []),
  ];
}

function buildSessionLenses(
  sourceSessions: SourceSessionRow[],
  topicEntries: TopicEntry[],
  findings: P10Finding[]
): InsightAnalysisLens[] {
  const findingIdsByTopicId = topicEntries.reduce<Record<string, string | undefined>>((acc, topic) => {
    const finding = findings.find((item) => item.source_key === topic.sourceKey);
    acc[topic.id] = finding?.id;
    return acc;
  }, {});

  return sourceSessions.map((session) => {
    const supportedTopics = topicEntries.filter((topic) => topic.supportSessionIds.includes(session.id));
    const supportedFindingIds = uniqueStrings(
      supportedTopics.map((topic) => findingIdsByTopicId[topic.id]).filter(Boolean)
    );
    const role = String(session.job_title || '').trim() || undefined;
    const department = String(session.department || '').trim() || undefined;
    const respondentName = String(session.respondent_name || '').trim() || undefined;
    return {
      id: `session:${session.id}`,
      kind: 'session',
      label: toSafeLabel(respondentName, session.name, session.id),
      sessionIds: [session.id],
      respondentName,
      role,
      department,
      supportedTopicIds: supportedTopics.map((topic) => topic.id),
      supportedFindingIds,
      localSummary:
        supportedTopics.length > 0
          ? `Supports ${supportedTopics.length} topic${supportedTopics.length === 1 ? '' : 's'}`
          : 'No supported topics detected yet',
    };
  });
}

function buildStakeholderLenses(
  sessionLenses: InsightAnalysisLens[],
  topicEntries: TopicEntry[],
  findings: P10Finding[]
): InsightAnalysisLens[] {
  const groups = new Map<string, InsightAnalysisLens[]>();
  sessionLenses.forEach((lens) => {
    const key = toSafeLabel(lens.role, lens.department, lens.label);
    const existing = groups.get(key) || [];
    existing.push(lens);
    groups.set(key, existing);
  });

  const findingIdsByTopicId = topicEntries.reduce<Record<string, string | undefined>>((acc, topic) => {
    const finding = findings.find((item) => item.source_key === topic.sourceKey);
    acc[topic.id] = finding?.id;
    return acc;
  }, {});

  return Array.from(groups.entries()).map(([label, lenses]) => {
    const sessionIds = uniqueStrings(lenses.flatMap((lens) => lens.sessionIds));
    const supportedTopics = topicEntries.filter((topic) =>
      topic.supportSessionIds.some((sessionId) => sessionIds.includes(sessionId))
    );
    return {
      id: `stakeholder:${label.toLowerCase().replace(/\s+/g, '_')}`,
      kind: 'stakeholder',
      label,
      sessionIds,
      role: lenses[0]?.role,
      department: lenses[0]?.department,
      supportedTopicIds: supportedTopics.map((topic) => topic.id),
      supportedFindingIds: uniqueStrings(
        supportedTopics.map((topic) => findingIdsByTopicId[topic.id]).filter(Boolean)
      ),
      localSummary:
        sessionIds.length > 1
          ? `Aggregates ${sessionIds.length} respondent perspectives`
          : 'Single stakeholder perspective',
    };
  });
}

function buildCells(topicEntries: TopicEntry[], lenses: InsightAnalysisLens[]): InsightAnalysisMatrixCell[] {
  return topicEntries.flatMap((topic) =>
    lenses.map((lens) => {
      const supportingSessionIds = topic.supportSessionIds.filter((sessionId) =>
        lens.sessionIds.includes(sessionId)
      );
      let state: MatrixCellState = 'not_observed';
      if (supportingSessionIds.length > 0) {
        if (topic.isContradicted) {
          state = 'contradicted';
        } else if (topic.supportSessionIds.length === 1) {
          state = 'local_only';
        } else {
          state = 'supported';
        }
      }
      return {
        topicId: topic.id,
        lensId: lens.id,
        state,
        supportingSessionIds,
        evidenceCount: supportingSessionIds.length > 0 ? topic.evidenceCount : 0,
      };
    })
  );
}

function buildCoverageGaps(params: {
  insight: Insight;
  sourceSessions: SourceSessionRow[];
  stakeholderLenses: InsightAnalysisLens[];
  topicEntries: TopicEntry[];
}): string[] {
  const { insight, sourceSessions, stakeholderLenses, topicEntries } = params;
  const gaps = [...(insight.missingData || [])];
  if (sourceSessions.some((session) => !String(session.job_title || '').trim())) {
    gaps.push('Some source sessions are missing role metadata, which narrows stakeholder analysis.');
  }
  if (sourceSessions.some((session) => !String(session.department || '').trim())) {
    gaps.push('Some source sessions are missing department metadata, which limits cross-functional analysis.');
  }
  if (stakeholderLenses.length <= 1 && sourceSessions.length > 1) {
    gaps.push('Most respondents currently collapse into one stakeholder lens; wide comparison remains limited.');
  }
  if (topicEntries.some((topic) => !topic.crossSessionPattern && topic.supportSessionIds.length <= 1)) {
    gaps.push('Several topics are still local-only signals and should not be treated as organization-wide truth.');
  }
  return uniqueStrings(gaps);
}

export async function buildInsightAnalysis(insightId: string): Promise<InsightAnalysis | null> {
  const insight = await getInsightById(insightId);
  if (!insight) return null;

  const findings = await listFindings(insightId);
  const sourceSessions = await loadSourceSessions(insight.sourceSessionIds || []);
  const answerIds = uniqueStrings([
    ...(insight.themes || []).flatMap((theme) => theme.evidence_refs || []),
    ...(insight.issues || []).flatMap((issue) => issue.evidence_refs || []),
    ...(insight.opportunities || []).flatMap((opportunity) => opportunity.evidence_refs || []),
    ...findings.flatMap((finding) =>
      (finding.evidence_pointers || [])
        .map((pointer) => parsePointerAnswerId(pointer.sourceRef))
        .filter(Boolean) as string[]
    ),
  ]);
  const answerSessionMap = await loadAnswerSessionMap(answerIds);
  const topicEntries = buildTopicEntries({ insight, findings, answerSessionMap });
  const sessionLenses = buildSessionLenses(sourceSessions, topicEntries, findings);
  const stakeholderLenses = buildStakeholderLenses(sessionLenses, topicEntries, findings);

  const topics: InsightAnalysisTopic[] = topicEntries.map((topic) => {
    const finding = findings.find((item) => item.source_key === topic.sourceKey);
    const supportingStakeholderLabels = uniqueStrings(
      [
        ...topic.perspectiveLabels,
        ...stakeholderLenses
        .filter((lens) => topic.supportSessionIds.some((sessionId) => lens.sessionIds.includes(sessionId)))
        .map((lens) => lens.label),
      ]
    );
    return {
      id: topic.id,
      sourceKey: topic.sourceKey,
      kind: topic.kind,
      label: topic.title,
      description: topic.description,
      findingId: finding?.id,
      confidenceLevel: topic.confidenceLevel,
      reviewStatus: topic.reviewStatus,
      limits: topic.limits,
      nextAction: topic.nextAction,
      evidenceCount: topic.evidenceCount,
      supportingSessionIds: topic.supportSessionIds,
      supportingStakeholderLabels,
      crossSessionPattern: topic.crossSessionPattern,
      isContradicted: topic.isContradicted,
      perspectiveLabels: topic.perspectiveLabels,
      divergenceNote: topic.divergenceNote,
    };
  });

  const roles = uniqueStrings(sourceSessions.map((session) => session.job_title));
  const departments = uniqueStrings(sourceSessions.map((session) => session.department));
  const stakeholderLabels = stakeholderLenses.map((lens) => lens.label);
  const posture: InsightAnalysisScope['posture'] =
    topics.some((topic) => topic.crossSessionPattern && topic.supportingStakeholderLabels.length > 1)
      ? 'organization_synthesis'
      : sourceSessions.length > 1
        ? 'cross_perspective'
        : 'single_perspective';

  return {
    insightId,
    insightTitle: insight.title,
    scope: {
      sourceSessionIds: insight.sourceSessionIds || [],
      sourceSessionCount: sourceSessions.length,
      distinctStakeholderCount: stakeholderLenses.length,
      stakeholderLabels,
      departments,
      roles,
      posture,
    },
    people: {
      sessionLenses,
      stakeholderLenses,
    },
    topics,
    matrix: {
      rows: topics.map((topic) => ({
        id: topic.id,
        label: topic.label,
        kind: topic.kind,
        confidenceLevel: topic.confidenceLevel,
      })),
      sessionColumns: sessionLenses.map((lens) => ({ id: lens.id, label: lens.label })),
      stakeholderColumns: stakeholderLenses.map((lens) => ({ id: lens.id, label: lens.label })),
      sessionCells: buildCells(topicEntries, sessionLenses),
      stakeholderCells: buildCells(topicEntries, stakeholderLenses),
    },
    synthesis: {
      consensusTopicIds: topics
        .filter((topic) => !topic.isContradicted && topic.supportingSessionIds.length > 1)
        .map((topic) => topic.id),
      localOnlyTopicIds: topics
        .filter((topic) => topic.supportingSessionIds.length <= 1)
        .map((topic) => topic.id),
      contradictedTopicIds: topics.filter((topic) => topic.isContradicted).map((topic) => topic.id),
      coverageGaps: buildCoverageGaps({ insight, sourceSessions, stakeholderLenses, topicEntries }),
    },
  };
}
