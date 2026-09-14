import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  user: { id: 'respondent', role: 'MEMBER' },
  organizationId: 'org',
  canManage: false,
  assignment: {
    id: 'assignment',
    status: 'submitted',
    sentBackReason: null as string | null,
    missingItems: [],
  },
  ownerId: 'respondent',
  sessionStatus: 'submitted',
  managedEmpty: false,
  hasAssignment: true,
  questions: [
    {
      id: 'question',
      category: 'strategy',
      questionText: 'A question',
      answerText: 'Original answer',
      status: 'answered',
      updatedAt: '2026-09-01',
      isRequired: true,
    },
  ],
}));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
const v8 = vi.hoisted(() => ({
  getSession: vi.fn(),
  getManagedAssignments: vi.fn(),
  getMyAssignments: vi.fn(),
  evaluateSessionAnswers: vi.fn(),
  approveAssignment: vi.fn(),
  sendBackAssignment: vi.fn(),
  getAnswerApprovals: vi.fn(),
  retryAiAnswerApprovals: vi.fn(),
  decideAnswerApprovals: vi.fn(),
  submitAssignment: vi.fn(),
}));
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(() => 'toast'),
}));
vi.mock('react-hot-toast', () => ({ default: toast, toast }));
vi.mock('@/services/api', () => ({ Api: api }));
vi.mock('@/services/api/v8/interview', () => ({ V8InterviewApi: v8 }));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: fixture.user,
    currentOrganization: { id: fixture.organizationId },
  }),
}));
vi.mock('@/hooks/useInterviewPermissions', () => ({
  useInterviewReviewAccess: () => ({
    canReview: fixture.canManage,
    refresh: vi.fn(),
    canAssign: fixture.canManage,
    isLoading: false,
  }),
}));
vi.mock('@/hooks/useOpenChatWithContext', () => ({ useOpenChatWithContext: () => vi.fn() }));
vi.mock('@/hooks/usePresentationMode', () => ({
  usePresentationMode: () => ({ mode: 'n', setMode: vi.fn() }),
}));
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, opts: any) => (typeof opts === 'string' ? opts : key),
    i18n: { language: 'en' },
  }),
}));
vi.mock('../InterviewSingleQuestionRuntime', () => ({
  InterviewSingleQuestionRuntime: (p: any) => (
    <section>
      {p.questions.map((question: any) => {
        const approval = p.answerApprovals?.find(
          (candidate: any) => candidate.questionId === question.id
        );
        const questionReadOnly = p.isQuestionReadOnly
          ? p.isQuestionReadOnly(question.id)
          : p.readOnly;
        return (
          <div key={question.id}>
            <textarea
              aria-label={`answer-${question.id}`}
              readOnly={questionReadOnly}
              defaultValue={question.answerText}
            />
            <span>{approval?.status}</span>
            <span>{approval?.reason}</span>
            <button
              onClick={() =>
                p.onUpdateQuestion(question.id, { answerText: `changed-${question.id}` })
              }
            >
              exercise answer callback {question.id}
            </button>
          </div>
        );
      })}
      <button onClick={() => p.onSubmitSession()}>exercise submit</button>
      <button onClick={() => p.onSubmitSession({ bypassGate: true })}>
        exercise direct submit
      </button>
    </section>
  ),
}));
import { InterviewWorkspace } from '../InterviewWorkspace';
const session = () => ({
  id: 'session',
  organizationId: 'org',
  name: 'Review session',
  ownerId: fixture.ownerId,
  status: fixture.sessionStatus,
  assignmentId: fixture.hasAssignment ? 'assignment' : undefined,
  totalQuestions: fixture.questions.length,
  answeredQuestions: fixture.questions.filter((question) => question.status === 'answered').length,
  runtimeModeDefault: 'single_question',
  progress: {},
  summaryFacts: [],
  summaryGaps: [],
  summaryConstraints: [],
  summaryPainPoints: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  fixture.user = { id: 'respondent', role: 'MEMBER' };
  fixture.organizationId = 'org';
  fixture.canManage = false;
  fixture.ownerId = 'respondent';
  fixture.sessionStatus = 'submitted';
  fixture.assignment = {
    id: 'assignment',
    status: 'submitted',
    sentBackReason: null,
    missingItems: [],
  };
  fixture.managedEmpty = false;
  fixture.hasAssignment = true;
  fixture.questions = [
    {
      id: 'question',
      category: 'strategy',
      questionText: 'A question',
      answerText: 'Original answer',
      status: 'answered',
      updatedAt: '2026-09-01',
      isRequired: true,
    },
  ];
  v8.getSession.mockImplementation(async () => ({ session: session() }));
  v8.getManagedAssignments.mockImplementation(async () => ({
    assignments: fixture.managedEmpty ? [] : [fixture.assignment],
  }));
  v8.getMyAssignments.mockImplementation(async () => ({ assignments: [fixture.assignment] }));
  v8.evaluateSessionAnswers.mockRejectedValue(new Error('AI unavailable'));
  v8.getAnswerApprovals.mockResolvedValue({
    assignmentId: 'assignment',
    approvals: [],
  });
  api.get.mockImplementation(async (url: string) =>
    url.endsWith('/questions')
      ? fixture.questions
      : url === '/interview/assignments/assignment'
        ? fixture.assignment
        : url.endsWith('/answer-history')
          ? { byQuestion: {} }
          : []
  );
  v8.approveAssignment.mockResolvedValue({
    assignment: { id: 'assignment', status: 'approved' },
    session: { ...session(), status: 'completed' },
  });
  v8.submitAssignment.mockResolvedValue({
    assignment: { id: 'assignment', status: 'submitted' },
    session: { ...session(), status: 'submitted' },
    answerApproval: [],
  });
});
afterEach(cleanup);
describe('manager review uses the real Workspace lifecycle controls', () => {
  it('submitted respondent cannot edit or invoke the answer writer', async () => {
    render(<InterviewWorkspace sessionId="session" />);
    const answer = await screen.findByRole('textbox', { name: 'answer-question' });
    expect((answer as HTMLTextAreaElement).readOnly).toBe(true);
    fireEvent.click(screen.getByText('exercise answer callback question'));
    expect(api.patch).not.toHaveBeenCalled();
  });
  it('a non-manager viewing another owner cannot approve', async () => {
    fixture.ownerId = 'another-person';
    render(<InterviewWorkspace sessionId="session" />);
    await screen.findByRole('textbox', { name: 'answer-question' });
    expect(screen.queryByRole('button', { name: 'interview.workspace.approve' })).toBeNull();
  });
  it('a permitted manager sees review even when session owner equals their identity, and publishes the assignment readback', async () => {
    fixture.canManage = true;
    fixture.user = { id: 'manager', role: 'ADMIN' };
    fixture.ownerId = 'manager';
    const changed = vi.fn();
    render(<InterviewWorkspace sessionId="session" {...{ onAssignmentChange: changed }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'interview.workspace.approve' }));
    await waitFor(() =>
      expect(changed).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'assignment', status: 'approved' })
      )
    );
  });
  it('managed list 200 without this assignment still loads respondent feedback and permits correction', async () => {
    fixture.managedEmpty = true;
    fixture.sessionStatus = 'active';
    fixture.assignment = {
      ...fixture.assignment,
      status: 'in_progress',
      sentBackReason: 'Add the observed evidence',
    };
    render(<InterviewWorkspace sessionId="session" />);
    await screen.findByRole('textbox', { name: 'answer-question' });
    expect(await screen.findByText('Add the observed evidence')).toBeTruthy();
    expect(
      v8.getMyAssignments.mock.calls.length +
        api.get.mock.calls.filter(([url]) => url === '/interview/assignments/assignment').length
    ).toBeGreaterThan(0);
    expect(
      (screen.getByRole('textbox', { name: 'answer-question' }) as HTMLTextAreaElement).readOnly
    ).toBe(false);
  });
  it('manager absent from the own list loads the protected assignment detail', async () => {
    fixture.canManage = true;
    fixture.user = { id: 'manager', role: 'ADMIN' };
    v8.getMyAssignments.mockResolvedValue({ assignments: [] });
    render(<InterviewWorkspace sessionId="session" />);
    expect(await screen.findByRole('button', { name: 'interview.workspace.approve' })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/interview/assignments/assignment');
  });
  it('send-back publishes the canonical response and unlocks the returned answer', async () => {
    fixture.canManage = true;
    fixture.user = { id: 'manager', role: 'ADMIN' };
    const changed = vi.fn();
    v8.sendBackAssignment.mockResolvedValue({
      assignment: { id: 'assignment', status: 'in_progress', sentBackReason: 'Add transport cost' },
      session: { ...session(), status: 'active' },
    });
    render(<InterviewWorkspace sessionId="session" onAssignmentChange={changed} />);
    fireEvent.click(await screen.findByRole('button', { name: 'interview.workspace.sendBack' }));
    fireEvent.change(
      screen.getByPlaceholderText('interview.workspace.describeWhatNeedsImprovement'),
      { target: { value: 'Add transport cost' } }
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'interview.workspace.sendBack' }).at(-1)!
    );
    await waitFor(() =>
      expect(changed).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'in_progress', sentBackReason: 'Add transport cost' })
      )
    );
    expect(await screen.findByText('Add transport cost')).toBeTruthy();
    expect(
      (screen.getByRole('textbox', { name: 'answer-question' }) as HTMLTextAreaElement).readOnly
    ).toBe(false);
  });

  it('own-list unavailable still lets a permitted manager use the protected detail reader', async () => {
    fixture.canManage = true;
    fixture.user = { id: 'manager', role: 'ADMIN' };
    v8.getMyAssignments.mockRejectedValue(
      Object.assign(new Error('Forbidden own list'), { status: 403 })
    );
    render(<InterviewWorkspace sessionId="session" />);
    expect(await screen.findByRole('button', { name: 'interview.workspace.approve' })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/interview/assignments/assignment');
  });

  it('lets a respondent retry a pending AI stage and translates the server messageKey', async () => {
    v8.getAnswerApprovals.mockResolvedValue({
      assignmentId: 'assignment',
      approvals: [
        {
          questionId: 'question',
          submissionId: 'submission-1',
          answerUpdatedAt: '2026-09-01',
          policyMode: 'ai',
          status: 'pending',
          nextStage: 'ai',
          latestDecision: null,
        },
      ],
    });
    v8.retryAiAnswerApprovals.mockRejectedValueOnce({
      response: {
        data: {
          code: 'INTERVIEW_ANSWER_AI_UNAVAILABLE',
          error: 'INTERVIEW_ANSWER_AI_UNAVAILABLE',
          messageKey: 'interview.workspace.aiAnswerReviewUnavailable',
        },
      },
    });

    render(<InterviewWorkspace sessionId="session" />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'interview.workspace.retryAiAnswerReview' })
    );

    await waitFor(() => {
      expect(v8.retryAiAnswerApprovals).toHaveBeenCalledWith('assignment', expect.any(String));
      expect(toast.error).toHaveBeenCalledWith('interview.workspace.aiAnswerReviewUnavailable');
    });
    expect(toast.error).not.toHaveBeenCalledWith('INTERVIEW_ANSWER_AI_UNAVAILABLE');
  });

  it('translates the normalized ApiClient error.data.messageKey shape', async () => {
    v8.getAnswerApprovals.mockResolvedValue({
      assignmentId: 'assignment',
      approvals: [
        {
          questionId: 'question',
          submissionId: 'submission-1',
          answerUpdatedAt: '2026-09-01',
          policyMode: 'ai',
          status: 'pending',
          nextStage: 'ai',
          latestDecision: null,
        },
      ],
    });
    v8.retryAiAnswerApprovals.mockRejectedValueOnce({
      data: {
        code: 'INTERVIEW_ANSWER_AI_UNAVAILABLE',
        error: 'INTERVIEW_ANSWER_AI_UNAVAILABLE',
        messageKey: 'interview.workspace.answerDecisionConflict',
      },
    });

    render(<InterviewWorkspace sessionId="session" />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'interview.workspace.retryAiAnswerReview' })
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('interview.workspace.answerDecisionConflict')
    );
    expect(toast.error).not.toHaveBeenCalledWith('INTERVIEW_ANSWER_AI_UNAVAILABLE');
  });

  it('fails closed for a respondent until the same-scope projection resolves, then preserves resolved-empty legacy behavior', async () => {
    fixture.sessionStatus = 'active';
    fixture.assignment = { ...fixture.assignment, status: 'in_progress' };
    v8.getMyAssignments.mockResolvedValue({ assignments: [fixture.assignment] });
    let resolveProjection!: (value: any) => void;
    v8.getAnswerApprovals.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProjection = resolve;
        })
    );

    render(<InterviewWorkspace sessionId="session" />);
    const answer = await screen.findByRole('textbox', { name: 'answer-question' });
    await waitFor(() => expect(v8.getAnswerApprovals).toHaveBeenCalledWith('assignment'));
    expect(answer).toHaveAttribute('readonly');
    fireEvent.click(screen.getByText('exercise answer callback question'));
    fireEvent.click(screen.getByRole('button', { name: 'exercise direct submit' }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(v8.submitAssignment).not.toHaveBeenCalled();
    expect(v8.evaluateSessionAnswers).not.toHaveBeenCalled();

    resolveProjection({ assignmentId: 'assignment', approvals: [] });
    await waitFor(() => expect(answer).not.toHaveAttribute('readonly'));
    fireEvent.click(screen.getByText('exercise answer callback question'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
  });

  it('fails closed after a projection error with zero answer writer, submit, or legacy AI calls', async () => {
    fixture.sessionStatus = 'active';
    fixture.assignment = { ...fixture.assignment, status: 'in_progress' };
    v8.getMyAssignments.mockResolvedValue({ assignments: [fixture.assignment] });
    v8.getAnswerApprovals.mockRejectedValueOnce(new Error('projection unavailable'));

    render(<InterviewWorkspace sessionId="session" />);
    const answer = await screen.findByRole('textbox', { name: 'answer-question' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'interview.workspace.answerApprovalsUnavailable'
    );
    expect(answer).toHaveAttribute('readonly');
    fireEvent.click(screen.getByText('exercise answer callback question'));
    fireEvent.click(screen.getByRole('button', { name: 'exercise submit' }));
    fireEvent.click(screen.getByRole('button', { name: 'exercise direct submit' }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(v8.submitAssignment).not.toHaveBeenCalled();
    expect(v8.evaluateSessionAnswers).not.toHaveBeenCalled();
  });

  it('hides legacy manager decisions until a same-scope resolved-empty projection', async () => {
    fixture.canManage = true;
    fixture.user = { id: 'manager', role: 'ADMIN' };
    let resolveProjection!: (value: any) => void;
    v8.getAnswerApprovals.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProjection = resolve;
        })
    );

    render(<InterviewWorkspace sessionId="session" />);
    await waitFor(() => expect(v8.getAnswerApprovals).toHaveBeenCalledWith('assignment'));
    expect(screen.queryByRole('button', { name: 'interview.workspace.approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'interview.workspace.sendBack' })).toBeNull();

    resolveProjection({ assignmentId: 'assignment', approvals: [] });
    expect(
      await screen.findByRole('button', { name: 'interview.workspace.approve' })
    ).toBeVisible();
  });

  it('keeps legacy manager decisions hidden after a projection error', async () => {
    fixture.canManage = true;
    fixture.user = { id: 'manager', role: 'ADMIN' };
    v8.getAnswerApprovals.mockRejectedValueOnce(new Error('projection unavailable'));

    render(<InterviewWorkspace sessionId="session" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'interview.workspace.answerApprovalsUnavailable'
    );
    expect(screen.queryByRole('button', { name: 'interview.workspace.approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'interview.workspace.sendBack' })).toBeNull();
  });

  it('lets a manager approve one exact answer without deciding its sibling', async () => {
    fixture.canManage = true;
    fixture.user = { id: 'manager', role: 'ADMIN' };
    fixture.questions = [
      { ...fixture.questions[0], id: 'q1', questionText: 'Question one' },
      { ...fixture.questions[0], id: 'q2', questionText: 'Question two' },
    ];
    v8.getAnswerApprovals.mockResolvedValue({
      assignmentId: 'assignment',
      approvals: fixture.questions.map((question) => ({
        questionId: question.id,
        submissionId: 'submission-1',
        answerUpdatedAt: question.updatedAt,
        policyMode: 'manager',
        status: 'pending',
        nextStage: 'manager',
        latestDecision: null,
        reason: null,
      })),
    });
    v8.decideAnswerApprovals.mockResolvedValue({ assignmentId: 'assignment', approvals: [] });

    render(<InterviewWorkspace sessionId="session" />);
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'interview.workspace.approveAnswer' }))[0]
    );
    await waitFor(() =>
      expect(v8.decideAnswerApprovals).toHaveBeenCalledWith(
        'assignment',
        expect.objectContaining({
          submissionId: 'submission-1',
          answers: [{ questionId: 'q1', expectedAnswerUpdatedAt: '2026-09-01' }],
          decision: 'approved',
        })
      )
    );
    expect(screen.queryByRole('button', { name: 'interview.workspace.approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'interview.workspace.sendBack' })).toBeNull();
  });

  it('requires a reason before a manager sends one exact answer back', async () => {
    fixture.canManage = true;
    fixture.user = { id: 'manager', role: 'ADMIN' };
    v8.getAnswerApprovals.mockResolvedValue({
      assignmentId: 'assignment',
      approvals: [
        {
          questionId: 'question',
          submissionId: 'submission-1',
          answerUpdatedAt: '2026-09-01',
          policyMode: 'manager',
          status: 'pending',
          nextStage: 'manager',
          latestDecision: null,
          reason: null,
        },
      ],
    });

    render(<InterviewWorkspace sessionId="session" />);
    const sendBack = await screen.findByRole('button', {
      name: 'interview.workspace.sendBackAnswer',
    });
    expect(sendBack).toBeDisabled();
    fireEvent.change(screen.getByLabelText('interview.workspace.answerDecisionReason'), {
      target: { value: 'Add the source and measured date.' },
    });
    expect(sendBack).not.toBeDisabled();
    fireEvent.click(sendBack);
    await waitFor(() =>
      expect(v8.decideAnswerApprovals).toHaveBeenCalledWith(
        'assignment',
        expect.objectContaining({
          answers: [{ questionId: 'question', expectedAnswerUpdatedAt: '2026-09-01' }],
          decision: 'sent_back',
          reason: 'Add the source and measured date.',
        })
      )
    );
  });

  it('shows the returned reason and keeps an approved sibling read-only during correction', async () => {
    fixture.sessionStatus = 'active';
    fixture.assignment = { ...fixture.assignment, status: 'in_progress' };
    v8.getMyAssignments.mockResolvedValue({ assignments: [fixture.assignment] });
    fixture.questions = [
      { ...fixture.questions[0], id: 'q-returned', questionText: 'Returned question' },
      { ...fixture.questions[0], id: 'q-approved', questionText: 'Approved question' },
    ];
    v8.getAnswerApprovals.mockResolvedValue({
      assignmentId: 'assignment',
      approvals: [
        {
          questionId: 'q-returned',
          submissionId: 'submission-1',
          answerUpdatedAt: '2026-09-01',
          policyMode: 'manager',
          status: 'sent_back',
          nextStage: null,
          latestDecision: 'sent_back',
          reason: 'Add measured evidence.',
        },
        {
          questionId: 'q-approved',
          submissionId: 'submission-1',
          answerUpdatedAt: '2026-09-01',
          policyMode: 'manager',
          status: 'stages_complete',
          nextStage: null,
          latestDecision: 'approved',
          reason: null,
        },
      ],
    });

    render(<InterviewWorkspace sessionId="session" />);
    expect((await screen.findAllByText('Add measured evidence.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('textbox', { name: 'answer-q-returned' })).not.toHaveAttribute(
      'readonly'
    );
    expect(screen.getByRole('textbox', { name: 'answer-q-approved' })).toHaveAttribute('readonly');
    fireEvent.click(screen.getByText('exercise answer callback q-returned'));
    fireEvent.click(screen.getByText('exercise answer callback q-approved'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch).toHaveBeenCalledWith(
      '/interview/questions/q-returned',
      expect.objectContaining({ answerText: 'changed-q-returned' })
    );
  });

  it('shows answer status to a respondent without exposing manager decision actions', async () => {
    v8.getAnswerApprovals.mockResolvedValue({
      assignmentId: 'assignment',
      approvals: [
        {
          questionId: 'question',
          submissionId: 'submission-1',
          answerUpdatedAt: '2026-09-01',
          policyMode: 'manager',
          status: 'pending',
          nextStage: 'manager',
          latestDecision: null,
          reason: null,
        },
      ],
    });
    render(<InterviewWorkspace sessionId="session" />);
    expect(await screen.findByText('pending')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'interview.workspace.approveAnswer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'interview.workspace.sendBackAnswer' })).toBeNull();
  });

  it('does not start a second legacy AI evaluation when the submit command freezes answer approval policy', async () => {
    fixture.sessionStatus = 'active';
    fixture.assignment = { ...fixture.assignment, status: 'in_progress' };
    v8.getMyAssignments.mockResolvedValue({ assignments: [fixture.assignment] });
    fixture.questions = [
      {
        ...fixture.questions[0],
        answerText:
          'This answer is long enough to pass the existing optional quality hint before submission.',
      },
    ];
    v8.submitAssignment.mockResolvedValue({
      assignment: { id: 'assignment', status: 'submitted' },
      session: { ...session(), status: 'submitted' },
      answerApproval: {
        assignmentId: 'assignment',
        policyMode: 'manager',
        decisions: [{ questionId: 'question', eventType: 'submitted' }],
      },
    });

    render(<InterviewWorkspace sessionId="session" />);
    const answer = await screen.findByRole('textbox', { name: 'answer-question' });
    await waitFor(() => expect(answer).not.toHaveAttribute('readonly'));
    fireEvent.click(screen.getByRole('button', { name: 'exercise direct submit' }));

    await waitFor(() => expect(v8.submitAssignment).toHaveBeenCalledWith('assignment'));
    expect(v8.evaluateSessionAnswers).not.toHaveBeenCalled();
  });

  it('retains the legacy post-submit quality review when no answer approval command exists', async () => {
    fixture.sessionStatus = 'active';
    fixture.assignment = { ...fixture.assignment, status: 'in_progress' };
    v8.getMyAssignments.mockResolvedValue({ assignments: [fixture.assignment] });
    fixture.questions = [
      {
        ...fixture.questions[0],
        answerText:
          'This answer is long enough to pass the existing optional quality hint before submission.',
      },
    ];

    render(<InterviewWorkspace sessionId="session" />);
    const answer = await screen.findByRole('textbox', { name: 'answer-question' });
    await waitFor(() => expect(answer).not.toHaveAttribute('readonly'));
    fireEvent.click(screen.getByRole('button', { name: 'exercise direct submit' }));

    await waitFor(() =>
      expect(v8.evaluateSessionAnswers).toHaveBeenCalledWith('session', { language: 'en' })
    );
  });

  it('does not run the legacy quality evaluator before resubmitting a governed returned answer', async () => {
    fixture.sessionStatus = 'active';
    fixture.assignment = { ...fixture.assignment, status: 'in_progress' };
    v8.getMyAssignments.mockResolvedValue({ assignments: [fixture.assignment] });
    fixture.questions = [
      {
        ...fixture.questions[0],
        answerText:
          'This corrected answer is long enough and belongs to the governed returned revision.',
      },
    ];
    v8.getAnswerApprovals.mockResolvedValue({
      assignmentId: 'assignment',
      approvals: [
        {
          questionId: 'question',
          submissionId: 'submission-1',
          answerUpdatedAt: '2026-09-01',
          policyMode: 'manager',
          status: 'sent_back',
          nextStage: null,
          latestDecision: 'sent_back',
          reason: 'Add the source.',
        },
      ],
    });
    v8.submitAssignment.mockResolvedValue({
      assignment: { id: 'assignment', status: 'submitted' },
      session: { ...session(), status: 'submitted' },
      answerApproval: {
        assignmentId: 'assignment',
        policyMode: 'manager',
        decisions: [{ questionId: 'question', eventType: 'submitted' }],
      },
    });

    render(<InterviewWorkspace sessionId="session" />);
    expect((await screen.findAllByText('Add the source.')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'exercise submit' }));

    await waitFor(() => expect(v8.submitAssignment).toHaveBeenCalledWith('assignment'));
    expect(v8.evaluateSessionAnswers).not.toHaveBeenCalled();
  });

  it('does not load or expose answer approval actions without an assignment identity', async () => {
    fixture.hasAssignment = false;
    render(<InterviewWorkspace sessionId="session" />);
    await screen.findByRole('textbox', { name: 'answer-question' });
    expect(v8.getAnswerApprovals).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'interview.workspace.retryAiAnswerReview' })
    ).toBeNull();
  });

  it('does not render a late answer-approval response from a previous organization scope', async () => {
    let resolveFirst!: (value: any) => void;
    let resolveSecond!: (value: any) => void;
    v8.getAnswerApprovals
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const view = render(<InterviewWorkspace sessionId="session" />);
    await waitFor(() => expect(v8.getAnswerApprovals).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('textbox', { name: 'answer-question' })).toHaveAttribute('readonly');
    fireEvent.click(screen.getByText('exercise answer callback question'));
    fireEvent.click(screen.getByRole('button', { name: 'exercise direct submit' }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(v8.submitAssignment).not.toHaveBeenCalled();
    fixture.organizationId = 'org-next';
    view.rerender(<InterviewWorkspace sessionId="session" />);
    await waitFor(() => expect(v8.getAnswerApprovals).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('textbox', { name: 'answer-question' })).toHaveAttribute('readonly');
    resolveSecond({
      assignmentId: 'assignment',
      approvals: [
        {
          questionId: 'question',
          submissionId: 'submission-next',
          answerUpdatedAt: '2026-09-02',
          policyMode: 'manager',
          status: 'sent_back',
          nextStage: null,
          latestDecision: 'sent_back',
          reason: 'Current organization reason',
        },
      ],
    });
    expect(await screen.findAllByText('Current organization reason')).not.toHaveLength(0);
    resolveFirst({
      assignmentId: 'assignment',
      approvals: [
        {
          questionId: 'question',
          submissionId: 'submission-old',
          answerUpdatedAt: '2026-09-01',
          policyMode: 'manager',
          status: 'sent_back',
          nextStage: null,
          latestDecision: 'sent_back',
          reason: 'Previous organization reason',
        },
      ],
    });
    await Promise.resolve();
    expect(screen.queryByText('Previous organization reason')).toBeNull();
  });
});

for (const withSnapshot of [false, true]) {
  it(`submitted open and remount do not evaluate with snapshot=${withSnapshot}`, async () => {
    Object.assign(fixture.assignment, {
      aiReview: withSnapshot
        ? {
            overallScore: 4,
            overallVerdict: 'ready_for_approval',
            recommendations: [],
            questionEvaluations: [],
          }
        : null,
      aiReviewedAt: withSnapshot ? '2026-09-12T10:00:00Z' : null,
    });
    const first = render(<InterviewWorkspace sessionId="session" />);
    await screen.findByRole('textbox', { name: 'answer-question' });
    await waitFor(() => expect(v8.getMyAssignments).toHaveBeenCalled());
    expect(v8.evaluateSessionAnswers).not.toHaveBeenCalled();
    first.unmount();
    render(<InterviewWorkspace sessionId="session" />);
    await screen.findByRole('textbox', { name: 'answer-question' });
    expect(v8.evaluateSessionAnswers).not.toHaveBeenCalled();
  });
}

it('explicit Refresh still calls the existing evaluation action after readonly open', async () => {
  v8.evaluateSessionAnswers.mockResolvedValue({
    overallScore: 4,
    overallVerdict: 'ready_for_approval',
    recommendations: [],
    questionEvaluations: [],
  });
  render(<InterviewWorkspace sessionId="session" />);
  await screen.findByRole('textbox', { name: 'answer-question' });
  expect(v8.evaluateSessionAnswers).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'interview.workspace.refresh' }));
  await waitFor(() => expect(v8.evaluateSessionAnswers).toHaveBeenCalledTimes(1));
  expect(v8.evaluateSessionAnswers).toHaveBeenCalledWith('session', { language: 'en' });
});
