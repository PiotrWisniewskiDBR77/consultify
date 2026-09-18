/**
 * IS-3b v2 (Wpis 122/123 pkt 2) — licznik „OFFICIAL ANSWERS" z rejestru zatwierdzeń.
 * [ODMROZENIE 02_INTERVIEW DEC-607]
 *
 * Warunek CTO: „6 zatwierdzonych i 8 odpowiedzi → 6"; `sent_back` NIE liczy się.
 * MUTACJA: zliczanie WSZYSTKICH wierszy (lub `!== 'sent_back'`) zamiast
 * `latestDecision === 'approved'` wywraca `it('6 zatwierdzonych + 2 sent_back → 6')`.
 */
import { describe, expect, it } from 'vitest';

import type { V8InterviewAnswerApproval } from '@/services/api/v8/interview';
import { countApprovedAnswers, sumApprovedAnswers } from '../interviewOfficialAnswers';

const approval = (
  questionId: string,
  latestDecision: V8InterviewAnswerApproval['latestDecision']
): V8InterviewAnswerApproval =>
  ({
    questionId,
    submissionId: `sub-${questionId}`,
    answerUpdatedAt: '2026-09-15T04:08:00.000Z',
    answerDigest: `digest-${questionId}`,
    policyMode: 'two_stage',
    policyVersion: 1,
    status: latestDecision === 'approved' ? 'stages_complete' : latestDecision === 'sent_back' ? 'sent_back' : 'pending',
    nextStage: latestDecision === 'approved' ? null : 'manager',
    latestDecision,
    reason: null,
    decidedAt: null,
    actor: null,
  }) as V8InterviewAnswerApproval;

describe('countApprovedAnswers — rejestr zatwierdzeń, nie liczba odpowiedzi', () => {
  it('6 zatwierdzonych + 2 sent_back → 6 (sent_back NIE liczy się)', () => {
    const approvals = [
      approval('q1', 'approved'),
      approval('q2', 'approved'),
      approval('q3', 'approved'),
      approval('q4', 'approved'),
      approval('q5', 'approved'),
      approval('q6', 'approved'),
      approval('q7', 'sent_back'),
      approval('q8', 'sent_back'),
    ];
    expect(approvals).toHaveLength(8); // 8 pozycji w rejestrze = 8 odpowiedzi
    expect(countApprovedAnswers(approvals)).toBe(6);
  });

  it('pending (latestDecision null) NIE liczy się jako oficjalny', () => {
    expect(countApprovedAnswers([approval('q1', null), approval('q2', 'approved')])).toBe(1);
  });

  it('pusta / null / undefined → 0 (bez crasha)', () => {
    expect(countApprovedAnswers([])).toBe(0);
    expect(countApprovedAnswers(null)).toBe(0);
    expect(countApprovedAnswers(undefined)).toBe(0);
  });

  it('sumApprovedAnswers across dwóch przydziałów: 4+2 zatwierdzone, 1 sent_back → 6', () => {
    const a1 = [
      approval('a1', 'approved'),
      approval('a2', 'approved'),
      approval('a3', 'approved'),
      approval('a4', 'approved'),
    ];
    const a2 = [approval('b1', 'approved'), approval('b2', 'approved'), approval('b3', 'sent_back')];
    expect(sumApprovedAnswers([a1, a2])).toBe(6);
  });

  it('sumApprovedAnswers ignoruje null/undefined przydziały (fail-soft)', () => {
    expect(sumApprovedAnswers([[approval('x', 'approved')], null, undefined])).toBe(1);
  });
});
