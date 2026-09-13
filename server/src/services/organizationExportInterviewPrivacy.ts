/** D18-A export projection. No database writes and no administrative bypass.
 * Mirrors accepted InterviewController D18 semantics, including recommendations.
 * Storage-only payloads absent from the safe reader are removed under the wall.
 */
type Row = Record<string, unknown>;
export type InterviewExportKind = 'session' | 'question' | 'note' | 'evidence' | 'assignment';
export interface InterviewExportAuthority {
  is_anonymous: unknown;
  respondentId: unknown;
}
const object = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const pick = (value: unknown, names: string[]): Row => {
  const row = object(value);
  return Object.fromEntries(names.filter((name) => name in row).map((name) => [name, row[name]]));
};
const rubric = (value: unknown) =>
  list(value).map((item) => ({
    ...pick(item, ['criterion', 'label', 'score', 'maxScore']),
    justification: '',
  }));
function redactSnapshot(value: unknown): unknown {
  const wasText = typeof value === 'string';
  let parsed: unknown = value;
  if (wasText) {
    try {
      parsed = JSON.parse(value as string);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const source = object(parsed);
  const safe = {
    ...pick(source, ['overallScore', 'overallVerdict', 'rubricVersion', 'rubricCriteria']),
    recommendations: [],
    questionEvaluations: list(source.questionEvaluations).map((item) => ({
      ...pick(item, ['questionId', 'score', 'verdict', 'fixType', 'rubricTotal', 'rubricMax']),
      rubric: rubric(object(item).rubric),
      feedback: '',
    })),
    weakAnswerMap: list(source.weakAnswerMap).map((item) => ({
      ...pick(item, [
        'key',
        'label',
        'questionId',
        'score',
        'verdict',
        'fixType',
        'isRequired',
        'depthHint',
      ]),
      rubric: rubric(object(item).rubric),
      feedback: '',
    })),
  };
  return wasText ? JSON.stringify(safe) : safe;
}
export function projectInterviewExportRow(
  kind: InterviewExportKind,
  row: Row,
  authority: InterviewExportAuthority,
  actorId?: string
): Row {
  const anonymous =
    authority.is_anonymous === true ||
    authority.is_anonymous === 1 ||
    authority.is_anonymous === '1' ||
    authority.is_anonymous === 'true';
  const isRespondent =
    Boolean(actorId) &&
    Boolean(authority.respondentId) &&
    String(authority.respondentId) === actorId;
  if (!anonymous || isRespondent) return { ...row };
  const safe = { ...row, anonymized: true } as Row;
  const clear = (columns: string[], value: unknown = '') => {
    for (const column of columns) if (column in safe) safe[column] = value;
  };
  if (kind === 'session') {
    clear(['summary_facts', 'summary_gaps', 'summary_constraints', 'summary_pain_points'], '[]');
  } else if (kind === 'question') {
    clear(['answer_text', 'context_note', 'voice_transcript']);
    clear(['answer_payload'], '{}');
    clear(
      ['voice_audio_evidence_id', 'answer_knowledge_doc_id', 'context_note_knowledge_doc_id'],
      null
    );
  } else if (kind === 'note') {
    clear(['content']);
  } else if (kind === 'evidence') {
    clear(['transcript_text', 'file_path', 'url', 'storage_key']);
    clear(['knowledge_document_id'], null);
  } else {
    safe.ai_review_snapshot_json = redactSnapshot(row.ai_review_snapshot_json);
    // These stored free-text review fields can reproduce respondent answers.
    clear(['sent_back_reason', 'notes']);
    clear(['missing_items_json', 'review_decision_memory_json'], '[]');
  }
  return safe;
}
