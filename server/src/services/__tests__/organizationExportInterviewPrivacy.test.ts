import { describe, expect, it } from 'vitest';
import { projectInterviewExportRow } from '../organizationExportInterviewPrivacy.js';

const privateText = 'ANONYMOUS_RESPONSE_SENTINEL';
const authority = { is_anonymous: true, respondentId: 'respondent' };
describe('Interview export D18 projection', () => {
  it('redacts answer, payload, transcript and material pointers for another actor without mutating storage values', () => {
    const raw = {
      answer_text: privateText,
      answer_payload: JSON.stringify({ answer: privateText }),
      context_note: privateText,
      voice_transcript: privateText,
      voice_audio_evidence_id: privateText,
      answer_knowledge_doc_id: privateText,
      context_note_knowledge_doc_id: privateText,
      question_text: 'Question',
      confidence_score: 4,
    };
    const before = JSON.stringify(raw);
    const safe = projectInterviewExportRow('question', raw, authority, 'admin');
    expect(JSON.stringify(safe)).not.toContain(privateText);
    expect(safe).toMatchObject({
      question_text: 'Question',
      confidence_score: 4,
      anonymized: true,
    });
    expect(JSON.stringify(raw)).toBe(before);
  });
  it('retains full anonymous respondent and nonanonymous answer content', () => {
    const raw = { answer_text: privateText, answer_payload: privateText };
    expect(projectInterviewExportRow('question', raw, authority, 'respondent')).toEqual(raw);
    expect(
      projectInterviewExportRow('question', raw, { ...authority, is_anonymous: false }, 'admin')
    ).toEqual(raw);
  });
  it('missing actor and missing respondent cannot turn off the anonymity wall', () => {
    expect(
      projectInterviewExportRow(
        'question',
        { answer_text: privateText },
        { is_anonymous: true, respondentId: null }
      ).answer_text
    ).toBe('');
  });
  it('redacts anonymous notes, evidence locations and session summaries', () => {
    for (const [kind, raw] of [
      ['note', { content: privateText }],
      [
        'evidence',
        {
          transcript_text: privateText,
          file_path: privateText,
          url: privateText,
          storage_key: privateText,
          knowledge_document_id: privateText,
        },
      ],
      [
        'session',
        {
          summary_facts: privateText,
          summary_gaps: privateText,
          summary_constraints: privateText,
          summary_pain_points: privateText,
        },
      ],
    ] as const)
      expect(
        JSON.stringify(projectInterviewExportRow(kind, raw, authority, 'admin'))
      ).not.toContain(privateText);
  });
  it('redacts AI recommendations, feedback and justification while preserving scores in TEXT and JSON snapshots', () => {
    const snapshot = {
      overallScore: 3.5,
      overallVerdict: 'needs_work',
      recommendations: [privateText],
      questionEvaluations: [
        {
          questionId: 'q',
          score: 4,
          feedback: privateText,
          rubric: [{ criterion: 'Depth', score: 3, maxScore: 5, justification: privateText }],
        },
      ],
      weakAnswerMap: [
        {
          key: 'q',
          score: 4,
          feedback: privateText,
          rubric: [{ score: 3, justification: privateText }],
        },
      ],
      unexpectedRaw: privateText,
    };
    for (const value of [snapshot, JSON.stringify(snapshot)]) {
      const safe = projectInterviewExportRow(
        'assignment',
        {
          ai_review_snapshot_json: value,
          notes: privateText,
          sent_back_reason: privateText,
          missing_items_json: privateText,
          review_decision_memory_json: privateText,
        },
        authority,
        'admin'
      );
      expect(JSON.stringify(safe)).not.toContain(privateText);
      const review =
        typeof safe.ai_review_snapshot_json === 'string'
          ? JSON.parse(safe.ai_review_snapshot_json)
          : (safe.ai_review_snapshot_json as any);
      expect(review.overallScore).toBe(3.5);
      expect(review.questionEvaluations[0].rubric[0].score).toBe(3);
      expect(
        projectInterviewExportRow(
          'assignment',
          { ai_review_snapshot_json: value },
          authority,
          'respondent'
        ).ai_review_snapshot_json
      ).toEqual(value);
    }
  });
  it('malformed anonymous AI snapshots fail closed instead of returning raw text', () => {
    expect(
      projectInterviewExportRow(
        'assignment',
        { ai_review_snapshot_json: '{' + privateText },
        authority,
        'admin'
      ).ai_review_snapshot_json
    ).toBeNull();
  });
});
