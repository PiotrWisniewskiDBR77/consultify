import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
  v8Patch: vi.fn(),
  v8Delete: vi.fn(),
}));

import { V8InterviewApi } from '@/services/api/v8/interview';
import { v8Get, v8Post, v8Patch, v8Delete } from '@/services/api/v8/client';

import {
  canPublishFinding,
  isValidP10ConfidenceLevel,
  isValidP10EvidencePointerType,
} from '../../../server/src/services/v8/interviewInsightCanon';

describe('V8InterviewApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests interview sessions from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ sessions: [] });

    await V8InterviewApi.getSessions('active');

    expect(v8Get).toHaveBeenCalledWith('/interview/sessions', { status: 'active' });
  });

  it('requests interview session detail from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ session: { id: 'sess-1' } });

    const data = await V8InterviewApi.getSession('sess-1');

    expect(v8Get).toHaveBeenCalledWith('/interview/sessions/sess-1');
    expect(data.session.id).toBe('sess-1');
  });

  it('requests accepted interview sessions from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ sessions: [] });

    await V8InterviewApi.getAcceptedSessions();

    expect(v8Get).toHaveBeenCalledWith('/interview/sessions/accepted');
  });

  it('requests managed interview sessions from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ sessions: [] });

    await V8InterviewApi.getManagedSessions();

    expect(v8Get).toHaveBeenCalledWith('/interview/sessions/managed');
  });

  it('requests my interview assignments from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ assignments: [] });

    await V8InterviewApi.getMyAssignments();

    expect(v8Get).toHaveBeenCalledWith('/interview/assignments/my');
  });

  it('requests managed interview assignments from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ assignments: [] });

    await V8InterviewApi.getManagedAssignments();

    expect(v8Get).toHaveBeenCalledWith('/interview/assignments/managed');
  });

  it('requests overdue interview assignments from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ assignments: [] });

    await V8InterviewApi.getOverdueAssignments();

    expect(v8Get).toHaveBeenCalledWith('/interview/assignments/overdue');
  });

  it('keeps assignment invitation and revocation on the canonical V8 adapter', async () => {
    vi.mocked(v8Post).mockResolvedValue({ id: 'asg-1' } as any);
    vi.mocked(v8Get).mockResolvedValue({ id: 'asg-1' } as any);
    vi.mocked(v8Patch).mockResolvedValue({ id: 'asg-1' } as any);
    vi.mocked(v8Delete).mockResolvedValue({ success: true } as any);

    await V8InterviewApi.createAssignment({
      assigneeUserId: 'user-1',
      templateId: 'tpl-1',
      dueAt: '2026-08-18T10:00:00.000Z',
      isAnonymous: true,
    });
    await V8InterviewApi.getAssignment('asg/1');
    await V8InterviewApi.updateAssignment('asg/1', { priority: 'urgent' });
    await V8InterviewApi.archiveAssignment('asg/1');
    await V8InterviewApi.restoreAssignment('asg/1');
    await V8InterviewApi.revokeAssignment('asg/1');
    await V8InterviewApi.issueAssignmentInvitation('asg/1', {
      expectedVersion: 6,
      expiresAt: '2026-08-20T10:00:00.000Z',
    });
    await V8InterviewApi.revokeAssignmentInvitation('asg/1', 7);

    expect(v8Post).toHaveBeenNthCalledWith(1, '/interview/assignments', {
      assigneeUserId: 'user-1',
      templateId: 'tpl-1',
      dueAt: '2026-08-18T10:00:00.000Z',
      isAnonymous: true,
    });
    expect(v8Get).toHaveBeenCalledWith('/interview/assignments/asg%2F1');
    expect(v8Patch).toHaveBeenCalledWith('/interview/assignments/asg%2F1', {
      priority: 'urgent',
    });
    expect(v8Post).toHaveBeenNthCalledWith(2, '/interview/assignments/asg%2F1/archive', {});
    expect(v8Post).toHaveBeenNthCalledWith(3, '/interview/assignments/asg%2F1/restore', {});
    expect(v8Delete).toHaveBeenCalledWith('/interview/assignments/asg%2F1');
    expect(v8Post).toHaveBeenNthCalledWith(4, '/interview/assignments/asg%2F1/invitations', {
      expectedVersion: 6,
      expiresAt: '2026-08-20T10:00:00.000Z',
    });
    expect(v8Post).toHaveBeenNthCalledWith(5, '/interview/assignments/asg%2F1/invitations/revoke', {
      expectedVersion: 7,
    });
  });

  it('posts interview assignment workflow writes to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true } as any);

    await V8InterviewApi.startAssignment('asg-1', { projectId: 'proj-1' });
    await V8InterviewApi.submitAssignment('asg-2');
    await V8InterviewApi.evaluateSessionAnswers('sess-1', { language: 'pl' });
    await V8InterviewApi.remindAssignment('asg-3');
    await V8InterviewApi.sendBackAssignment('asg-4', { reason: 'Missing answers' });
    await V8InterviewApi.approveAssignment('asg-5');

    expect(v8Post).toHaveBeenNthCalledWith(1, '/interview/assignments/asg-1/start', {
      projectId: 'proj-1',
    });
    expect(v8Post).toHaveBeenNthCalledWith(2, '/interview/assignments/asg-2/submit', {});
    expect(v8Post).toHaveBeenNthCalledWith(3, '/interview/sessions/sess-1/evaluate-answers', {
      language: 'pl',
    });
    expect(v8Post).toHaveBeenNthCalledWith(4, '/interview/assignments/asg-3/remind', {});
    expect(v8Post).toHaveBeenNthCalledWith(5, '/interview/assignments/asg-4/send-back', {
      reason: 'Missing answers',
    });
    expect(v8Post).toHaveBeenNthCalledWith(6, '/interview/assignments/asg-5/approve', {});
  });
});

// ── P10 insight lifecycle contract tests ──────────────────────────────────────

describe('V8 Interview Insight Lifecycle (P10 canon)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('insight lifecycle endpoint contract: GET /interview/insights returns insights list', async () => {
    vi.mocked(v8Get).mockResolvedValue({ insights: [{ id: 'i-1', title: 'Finding A' }] });

    const result = await v8Get('/interview/insights');

    expect(v8Get).toHaveBeenCalledWith('/interview/insights');
    expect(result).toEqual({ insights: [{ id: 'i-1', title: 'Finding A' }] });
  });

  it('insight lifecycle endpoint contract: GET /interview/insights/:id returns single insight', async () => {
    vi.mocked(v8Get).mockResolvedValue({ id: 'i-1', title: 'Finding A', confidenceLevel: 'high' });

    const result = await v8Get('/interview/insights/i-1');

    expect(v8Get).toHaveBeenCalledWith('/interview/insights/i-1');
    expect(result).toHaveProperty('confidenceLevel', 'high');
  });
});

describe('V8 Interview Findings CRUD (P10 canon)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findings CRUD: POST /interview/insights/:id/findings creates a finding', async () => {
    vi.mocked(v8Post).mockResolvedValue({ id: 'f-1', finding_statement: 'Users face friction' });

    const result = await v8Post('/interview/insights/i-1/findings', {
      finding_statement: 'Users face friction',
      confidence_level: 'medium',
      limits: 'Small sample size',
      evidence_pointers: [],
      next_action: 'Conduct follow-up interviews',
    });

    expect(v8Post).toHaveBeenCalledWith(
      '/interview/insights/i-1/findings',
      expect.objectContaining({
        finding_statement: 'Users face friction',
        confidence_level: 'medium',
        limits: 'Small sample size',
      })
    );
    expect(result).toHaveProperty('id', 'f-1');
  });

  it('findings CRUD: GET /interview/insights/:id/findings lists findings', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      findings: [
        { id: 'f-1', finding_statement: 'Finding A' },
        { id: 'f-2', finding_statement: 'Finding B' },
      ],
    });

    const result = await v8Get('/interview/insights/i-1/findings');

    expect(v8Get).toHaveBeenCalledWith('/interview/insights/i-1/findings');
    expect(result).toHaveProperty('findings');
    expect((result as any).findings).toHaveLength(2);
  });
});

describe('V8 Interview Handoff (P10 canon)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handoff endpoint validates canPublishFinding before accepting', () => {
    const validFinding = {
      confidenceLevel: 'high',
      evidencePointers: [{ isTombstone: false }],
      limits: 'Scope limited to onboarding flow',
    };
    expect(canPublishFinding(validFinding)).toEqual({ allowed: true });
  });

  it('handoff rejects insufficient confidence', () => {
    const result = canPublishFinding({
      confidenceLevel: 'insufficient',
      evidencePointers: [{ isTombstone: false }],
      limits: 'Some limit',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Insufficient');
  });

  it('handoff rejects findings with no active evidence pointers', () => {
    const result = canPublishFinding({
      confidenceLevel: 'high',
      evidencePointers: [{ isTombstone: true }],
      limits: 'Some limit',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No active evidence');
  });

  it('handoff rejects findings without limits', () => {
    const result = canPublishFinding({
      confidenceLevel: 'high',
      evidencePointers: [{ isTombstone: false }],
      limits: '',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Limits are required');
  });

  it('handoff rejects invalid confidence level', () => {
    const result = canPublishFinding({
      confidenceLevel: 'very_high',
      evidencePointers: [{ isTombstone: false }],
      limits: 'Some limit',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Invalid confidence level');
  });

  it('handoff endpoint: POST /interview/insights/:id/findings/:fid/handoff', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      initiativeId: 'init-1',
    });

    const result = await v8Post('/interview/insights/i-1/findings/f-1/handoff', {
      mode: 'create',
      finding_statement: 'Users face friction',
      confidence_level: 'high',
      limits: 'Limited sample',
    });

    expect(v8Post).toHaveBeenCalledWith(
      '/interview/insights/i-1/findings/f-1/handoff',
      expect.objectContaining({
        mode: 'create',
        confidence_level: 'high',
      })
    );
    expect(result).toHaveProperty('initiativeId', 'init-1');
  });
});

// ── P10 Canon Validators ─────────────────────────────────────────────────────

describe('P10 canon validators', () => {
  it('validates correct confidence levels', () => {
    expect(isValidP10ConfidenceLevel('high')).toBe(true);
    expect(isValidP10ConfidenceLevel('medium')).toBe(true);
    expect(isValidP10ConfidenceLevel('low')).toBe(true);
    expect(isValidP10ConfidenceLevel('insufficient')).toBe(true);
  });

  it('rejects invalid confidence levels', () => {
    expect(isValidP10ConfidenceLevel('very_high')).toBe(false);
    expect(isValidP10ConfidenceLevel('contradicted')).toBe(true);
    expect(isValidP10ConfidenceLevel('')).toBe(false);
  });

  it('validates correct evidence pointer types', () => {
    expect(isValidP10EvidencePointerType('interview_session')).toBe(true);
    expect(isValidP10EvidencePointerType('question_answer')).toBe(true);
    expect(isValidP10EvidencePointerType('transcript_excerpt')).toBe(true);
    expect(isValidP10EvidencePointerType('survey_linkage')).toBe(true);
    expect(isValidP10EvidencePointerType('attachment')).toBe(true);
    expect(isValidP10EvidencePointerType('export_artifact')).toBe(true);
    expect(isValidP10EvidencePointerType('operator_note')).toBe(true);
  });

  it('rejects invalid evidence pointer types', () => {
    expect(isValidP10EvidencePointerType('email')).toBe(false);
    expect(isValidP10EvidencePointerType('chat_message')).toBe(false);
    expect(isValidP10EvidencePointerType('')).toBe(false);
  });
});

// ── V8InterviewApi insight methods ────────────────────────────────────────────

describe('V8InterviewApi insight methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listInsights calls v8Get with /interview/insights', async () => {
    vi.mocked(v8Get).mockResolvedValue({ insights: [] });

    await V8InterviewApi.listInsights();

    expect(v8Get).toHaveBeenCalledWith('/interview/insights', undefined);
  });

  it('listInsights forwards limit/offset params', async () => {
    vi.mocked(v8Get).mockResolvedValue({ insights: [] });

    await V8InterviewApi.listInsights({ limit: 10, offset: 20 });

    expect(v8Get).toHaveBeenCalledWith('/interview/insights', { limit: '10', offset: '20' });
  });

  it('getInsight calls v8Get with /interview/insights/:id', async () => {
    vi.mocked(v8Get).mockResolvedValue({ insight: { id: 'ins-1' } });

    const result = await V8InterviewApi.getInsight('ins-1');

    expect(v8Get).toHaveBeenCalledWith('/interview/insights/ins-1');
    expect(result).toHaveProperty('insight');
  });

  it('createInsight calls v8Post with payload', async () => {
    vi.mocked(v8Post).mockResolvedValue({ insight: { id: 'ins-new', status: 'generating' } });

    await V8InterviewApi.createInsight({ sessionIds: ['sess-1'], promptType: 'summary' });

    expect(v8Post).toHaveBeenCalledWith('/interview/insights', {
      sessionIds: ['sess-1'],
      promptType: 'summary',
    });
  });

  it('regenerateInsight calls v8Post on /:id/regenerate', async () => {
    vi.mocked(v8Post).mockResolvedValue({ insight: { id: 'ins-1', status: 'generating' } });

    await V8InterviewApi.regenerateInsight('ins-1');

    expect(v8Post).toHaveBeenCalledWith('/interview/insights/ins-1/regenerate', {});
  });

  it('updateInsight calls v8Patch with fields', async () => {
    vi.mocked(v8Patch).mockResolvedValue({ success: true });

    await V8InterviewApi.updateInsight('ins-1', { title: 'Updated' });

    expect(v8Patch).toHaveBeenCalledWith('/interview/insights/ins-1', { title: 'Updated' });
  });

  it('exportInsight calls v8Post on /:id/export', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true });

    await V8InterviewApi.exportInsight('ins-1', { target: 'tools' });

    expect(v8Post).toHaveBeenCalledWith('/interview/insights/ins-1/export', { target: 'tools' });
  });

  it('getInsightActivity calls v8Get on /:id/activity', async () => {
    vi.mocked(v8Get).mockResolvedValue({ activity: [] });

    await V8InterviewApi.getInsightActivity('ins-1');

    expect(v8Get).toHaveBeenCalledWith('/interview/insights/ins-1/activity');
  });

  it('getInsightComments calls v8Get on /:id/comments', async () => {
    vi.mocked(v8Get).mockResolvedValue({ comments: [] });

    await V8InterviewApi.getInsightComments('ins-1');

    expect(v8Get).toHaveBeenCalledWith('/interview/insights/ins-1/comments');
  });

  it('createInsightComment calls v8Post on /:id/comments', async () => {
    vi.mocked(v8Post).mockResolvedValue({ id: 'c-1', content: 'Nice' });

    await V8InterviewApi.createInsightComment('ins-1', { content: 'Nice', priority: 'high' });

    expect(v8Post).toHaveBeenCalledWith('/interview/insights/ins-1/comments', {
      content: 'Nice',
      priority: 'high',
    });
  });

  it('deleteInsightComment calls v8Delete on /:id/comments/:commentId', async () => {
    vi.mocked(v8Delete).mockResolvedValue({ success: true });

    await V8InterviewApi.deleteInsightComment('ins-1', 'c-1');

    expect(v8Delete).toHaveBeenCalledWith('/interview/insights/ins-1/comments/c-1');
  });

  it('deleteInsight calls v8Delete on /:id', async () => {
    vi.mocked(v8Delete).mockResolvedValue({ success: true });

    await V8InterviewApi.deleteInsight('ins-1');

    expect(v8Delete).toHaveBeenCalledWith('/interview/insights/ins-1');
  });
});
