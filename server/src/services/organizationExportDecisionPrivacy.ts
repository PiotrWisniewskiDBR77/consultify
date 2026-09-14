import {
  validateFindingGenerationReceipt,
  type ValidateFindingGenerationReceiptInput,
} from './interviewInsightFindingGenerationReceipt.js';

/** Current, unchanged Interview handoff content only. Inputs must come from
 * explicit schema-verified tenant reads in the same export snapshot.
 * Literal source fingerprints are identity claims, never content hashes.
 */
type Row = Record<string, unknown>;
const PERSON_IDENTITY_KEY = /^(?:actor_id|user_id|owner_id|assignee_id|reporter_id|created_by|created_by_user_id|updated_by|updated_by_user_id|archived_by|decided_by|decision_maker_id|decision_owner_id|assigned_to|escalated_to|recipient_email|recipient_name|email)$/i;
const DEC493_BUSINESS_COLUMNS = new Set([
  'id', 'organization_id', 'project_id', 'initiative_id', 'task_id', 'source_type', 'source_id',
  'insight_id', 'finding_id', 'target_id', 'target_kind', 'target_ref_type', 'pointer_type',
  'pointer_state', 'source_ref', 'source_fingerprint', 'captured_excerpt', 'captured_at',
  'removal_reason', 'removed_at', 'duplicate_observed_count', 'metadata_json', 'status',
  'workflow_status', 'review_status', 'readback_status', 'readback_summary', 'readback_updated_at',
  'version', 'created_at', 'updated_at', 'deadline', 'decided_at', 'title', 'description', 'type',
  'priority', 'impact', 'pmo_domain', 'required', 'finding_statement', 'confidence_level',
  'limits_text', 'limits_json', 'next_action_text', 'next_action_json', 'prompt_type', 'content',
  'structured_content', 'evidence_links', 'unknowns', 'counterpoints', 'assumptions',
  'confidence_score', 'insight_category', 'category', 'evidence_map_json', 'executive_summary',
  'issues_json', 'missing_data_json', 'opportunities_json', 'section_completions', 'signals_json',
  'themes_json', 'payload_json', 'operator_decision_json',
]);
const removeNestedPersonIdentity = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(removeNestedPersonIdentity);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Row)
        .filter(([key]) => !PERSON_IDENTITY_KEY.test(key))
        .map(([key, nested]) => [key, removeNestedPersonIdentity(nested)])
    );
  }
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
    try {
      return JSON.stringify(removeNestedPersonIdentity(JSON.parse(value)));
    } catch {
      return value;
    }
  }
  return value;
};

/** DEC-493 projection: retain substantive Interview/Decision content and strip person identity. */
export function projectDecisionSourceIdentity(row: Row): Row {
  return {
    ...Object.fromEntries(
      Object.entries(row)
        .filter(([key]) => DEC493_BUSINESS_COLUMNS.has(key) && !PERSON_IDENTITY_KEY.test(key))
        .map(([key, value]) => [key, removeNestedPersonIdentity(value)])
    ),
    export_payload_scope: 'interview_and_decision_content_identity_removed_dec493',
  };
}
export interface DecisionSourceSnapshot {
  handoffs: readonly Row[];
  findings: readonly Row[];
  insights: readonly Row[];
  pointers: readonly Row[];
  questions: readonly Row[];
  sessions: readonly Row[];
  findingReceiptSnapshotVerified?: boolean;
  findingReceipts?: readonly Row[];
  findingReceiptInvalidations?: readonly Row[];
}
const object = (v: unknown): Row | undefined => {
  if (typeof v === 'string') {
    try {
      return object(JSON.parse(v));
    } catch {
      return undefined;
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : undefined;
};
const array = (v: unknown): unknown[] | undefined => {
  if (typeof v === 'string') {
    try {
      return array(JSON.parse(v));
    } catch {
      return undefined;
    }
  }
  return Array.isArray(v) ? v : undefined;
};
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const time = (v: unknown): number =>
  v instanceof Date ? v.getTime() : typeof v === 'string' ? Date.parse(v) : NaN;
const unique = (rows: readonly Row[], id: unknown, org: string): Row | undefined => {
  const matches = rows.filter((r) => r.id === id && r.organization_id === org);
  return matches.length === 1 ? matches[0] : undefined;
};
const before = (row: Row, cutoff: number): boolean =>
  Number.isFinite(time(row.updated_at)) && time(row.updated_at) <= cutoff;
const sameSet = (a: unknown[], b: unknown[]): boolean =>
  a.length === b.length && new Set(a).size === a.length && a.every((x) => text(x) && b.includes(x));

export function canExportInterviewDecisionContent(
  decision: Row,
  organizationId: string,
  actorId: string | undefined,
  sources: DecisionSourceSnapshot
): boolean {
  if (
    !actorId ||
    decision.organization_id !== organizationId ||
    decision.source_type !== 'interview_insight' ||
    !text(decision.source_id)
  )
    return false;
  const receipts = sources.handoffs.filter(
    (r) =>
      r.organization_id === organizationId &&
      r.target_kind === 'decision' &&
      r.target_id === decision.id &&
      r.finding_id === decision.source_id
  );
  if (receipts.length !== 1) return false;
  const receipt = receipts[0],
    payload = object(receipt.payload_json),
    cutoff = time(receipt.created_at);
  if (
    !payload ||
    !Number.isFinite(cutoff) ||
    receipt.status !== 'linked' ||
    receipt.target_ref_type !== 'linked' ||
    payload.source_finding_id !== decision.source_id ||
    payload.source_insight_artifact_id !== receipt.insight_id
  )
    return false;
  const finding = unique(sources.findings, decision.source_id, organizationId);
  const insight = unique(sources.insights, receipt.insight_id, organizationId);
  // Creation time alone cannot bind generated content to a generation run.
  const insightCompletedAt = insight ? time(insight.updated_at) : NaN;
  const findingCreatedAt = finding ? time(finding.created_at) : NaN;
  if (
    !finding ||
    !insight ||
    finding.insight_id !== insight.id ||
    insight.status !== 'completed' ||
    (insight.error_message != null && String(insight.error_message).trim().length > 0) ||
    !Number.isFinite(insightCompletedAt) ||
    !Number.isFinite(findingCreatedAt) ||
    !before(finding, cutoff) ||
    !before(insight, cutoff)
  )
    return false;
  if (
    finding.readback_status !== 'confirmed_by_client' ||
    finding.finding_statement !== payload.finding_statement ||
    finding.limits_text !== payload.limits ||
    finding.next_action_text !== payload.next_action
  )
    return false;
  if (
    sources.findingReceiptSnapshotVerified !== true ||
    !Array.isArray(sources.findingReceipts) ||
    !Array.isArray(sources.findingReceiptInvalidations) ||
    sources.findingReceiptInvalidations.some((row) => row.finding_id === finding.id)
  )
    return false;
  try {
    const binding = validateFindingGenerationReceipt({
      finding,
      insight,
      pointers: sources.pointers.filter((row) => row.finding_id === finding.id),
      receipts: sources.findingReceipts.filter((row) => row.finding_id === finding.id),
      handoffCutoff: receipt.created_at,
    } as unknown as ValidateFindingGenerationReceiptInput);
    if (!binding.valid) return false;
  } catch {
    // Malformed persisted source rows cannot authorize copied content.
    return false;
  }
  const scope = object(insight.analysis_scope_json),
    context = object(insight.generation_context_json);
  const selected = array(insight.source_session_ids),
    scopeSelected = array(scope?.source_session_ids);
  if (
    !scope ||
    !context ||
    !selected?.length ||
    !scopeSelected ||
    !sameSet(selected, scopeSelected)
  )
    return false;
  const generationRun = object(context.generationRun);
  const runStartedAt = time(generationRun?.startedAt);
  const runCompletedAt = time(generationRun?.completedAt);
  if (
    !generationRun ||
    generationRun.version !== 1 ||
    !text(generationRun.runId) ||
    generationRun.status !== 'completed' ||
    !Number.isFinite(runStartedAt) ||
    !Number.isFinite(runCompletedAt) ||
    runStartedAt > runCompletedAt ||
    time(context.createdAt) !== runStartedAt ||
    insightCompletedAt !== runCompletedAt ||
    findingCreatedAt < runCompletedAt
  )
    return false;
  // The prompt consumes more than evidence pointers: customPrompt survives in
  // filters and topic focus is copied into three provenance representations.
  // No actor authority for these free-text inputs is established by session ACLs.
  const filters = insight.filters == null ? {} : object(insight.filters);
  const emptyText = (v: unknown): boolean =>
    v == null || (typeof v === 'string' && v.trim().length === 0);
  if (
    !filters ||
    !emptyText(filters.customPrompt) ||
    (filters.topicFocus != null && array(filters.topicFocus)?.length !== 0) ||
    array(insight.topic_focus_json)?.length !== 0 ||
    array(scope.topic_focus)?.length !== 0 ||
    array(context.topicFocus)?.length !== 0
  )
    return false;
  const modes = ['selected_interview_material_only', 'selected_material_only'];
  if (
    ![insight.context_mode, scope.context_mode, context.contextMode].every((v) =>
      modes.includes(String(v))
    ) ||
    scope.source_scope_status !== 'approved_only' ||
    scope.consultant_note ||
    scope.leading_question
  )
    return false;
  // Historical rows without a server-recorded enrichment lookup are unresolved.
  // Empty contextDocuments does not exclude the independent question-evidence KB path.
  const enrichment = object(context.evidenceEnrichment);
  const consultedQuestions = array(enrichment?.questionIds);
  if (
    !enrichment ||
    enrichment.version !== 1 ||
    enrichment.lookupComplete !== true ||
    !consultedQuestions ||
    new Set(consultedQuestions).size !== consultedQuestions.length ||
    array(enrichment.evidenceIds)?.length !== 0 ||
    array(enrichment.knowledgeDocumentIds)?.length !== 0 ||
    !consultedQuestions.every((id) => {
      const q = unique(sources.questions, id, organizationId);
      return q && selected.includes(q.session_id) && before(q, cutoff);
    })
  )
    return false;
  const knowledge = object(context.approvedOrgKnowledgePack),
    documents = object(context.contextDocuments);
  if (
    !knowledge ||
    knowledge.included !== false ||
    knowledge.sourceCount !== 0 ||
    array(knowledge.sources)?.length !== 0 ||
    !documents ||
    array(documents.selectedIds)?.length !== 0 ||
    array(documents.documents)?.length !== 0
  )
    return false;
  const sessionAllowed = (id: unknown): boolean => {
    const s = unique(sources.sessions, id, organizationId);
    if (!s || !before(s, cutoff)) return false;
    if (![true, false, 0, 1, '0', '1', 'true', 'false'].includes(s.is_anonymous as never))
      return false;
    const anonymous = [true, 1, '1', 'true'].includes(s.is_anonymous as never);
    return !anonymous || s.owner_id === actorId;
  };
  if (!selected.every(sessionAllowed)) return false;
  const pointers = array(payload.evidence_pointers);
  if (!pointers?.length) return false;
  for (const raw of pointers) {
    const p = object(raw);
    if (!p || p.isTombstone !== false || !text(p.sourceRef)) return false;
    const stored = unique(sources.pointers, p.pointerId, organizationId);
    if (
      !stored ||
      stored.insight_id !== insight.id ||
      stored.finding_id !== finding.id ||
      !before(stored, cutoff) ||
      stored.pointer_state !== 'active' ||
      stored.pointer_type !== p.type ||
      stored.source_ref !== p.sourceRef ||
      stored.source_fingerprint !== p.sourceFingerprint ||
      stored.captured_excerpt !== (p.capturedExcerpt ?? null) ||
      time(stored.captured_at) !== time(p.capturedAt)
    )
      return false;
    let sessionId: unknown;
    if (p.type === 'interview_session' && p.sourceRef.startsWith('session:'))
      sessionId = p.sourceRef.slice(8);
    else if (p.type === 'question_answer' && p.sourceRef.startsWith('answer:')) {
      const question = unique(sources.questions, p.sourceRef.slice(7), organizationId);
      if (!question || !before(question, cutoff)) return false;
      sessionId = question.session_id;
    } else return false;
    if (!selected.includes(sessionId) || !sessionAllowed(sessionId)) return false;
  }
  if (!text(payload.finding_statement) || !text(payload.limits) || !text(payload.next_action))
    return false;
  const summary = [
    payload.finding_statement,
    `\n\nLimits: ${payload.limits}`,
    `\n\nRecommended next action: ${payload.next_action}`,
    `\n\nEvidence (${pointers.length}):\n${pointers
      .slice(0, 8)
      .map((raw) => {
        const p = object(raw)!;
        return `- ${String(p.capturedExcerpt || p.sourceRef || '').slice(0, 240)}`;
      })
      .join('\n')}`,
  ].join('');
  return (
    decision.title === payload.finding_statement.slice(0, 200) && decision.description === summary
  );
}
