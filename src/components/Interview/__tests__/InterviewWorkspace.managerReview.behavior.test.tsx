import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  user: { id: 'respondent', role: 'MEMBER' },
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
}));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
const v8 = vi.hoisted(() => ({
  getSession: vi.fn(),
  getManagedAssignments: vi.fn(),
  getMyAssignments: vi.fn(),
  evaluateSessionAnswers: vi.fn(),
  approveAssignment: vi.fn(),
  sendBackAssignment: vi.fn(),
}));
vi.mock('@/services/api', () => ({ Api: api }));
vi.mock('@/services/api/v8/interview', () => ({ V8InterviewApi: v8 }));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ currentUser: fixture.user, currentOrganization: { id: 'org' } }),
}));
vi.mock('@/hooks/useInterviewPermissions', () => ({
  useInterviewPermissions: () => ({
    canViewManaged: fixture.canManage,
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
      <textarea
        aria-label="answer"
        readOnly={p.readOnly}
        defaultValue={p.questions[0]?.answerText}
      />
      <button onClick={() => p.onUpdateQuestion('question', { answerText: 'changed' })}>
        exercise answer callback
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
  assignmentId: 'assignment',
  totalQuestions: 1,
  answeredQuestions: 1,
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
  v8.getSession.mockImplementation(async () => ({ session: session() }));
  v8.getManagedAssignments.mockImplementation(async () => ({
    assignments: fixture.managedEmpty ? [] : [fixture.assignment],
  }));
  v8.getMyAssignments.mockImplementation(async () => ({ assignments: [fixture.assignment] }));
  v8.evaluateSessionAnswers.mockRejectedValue(new Error('AI unavailable'));
  api.get.mockImplementation(async (url: string) =>
    url.endsWith('/questions')
      ? [
          {
            id: 'question',
            category: 'strategy',
            questionText: 'A question',
            answerText: 'Original answer',
            status: 'answered',
            updatedAt: '2026-09-01',
            isRequired: true,
          },
        ]
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
});
afterEach(cleanup);
describe('manager review uses the real Workspace lifecycle controls', () => {
  it('submitted respondent cannot edit or invoke the answer writer', async () => {
    render(<InterviewWorkspace sessionId="session" />);
    const answer = await screen.findByRole('textbox', { name: 'answer' });
    expect((answer as HTMLTextAreaElement).readOnly).toBe(true);
    fireEvent.click(screen.getByText('exercise answer callback'));
    expect(api.patch).not.toHaveBeenCalled();
  });
  it('a non-manager viewing another owner cannot approve', async () => {
    fixture.ownerId = 'another-person';
    render(<InterviewWorkspace sessionId="session" />);
    await screen.findByRole('textbox', { name: 'answer' });
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
    await screen.findByRole('textbox', { name: 'answer' });
    expect(await screen.findByText('Add the observed evidence')).toBeTruthy();
    expect(
      v8.getMyAssignments.mock.calls.length +
        api.get.mock.calls.filter(([url]) => url === '/interview/assignments/assignment').length
    ).toBeGreaterThan(0);
    expect((screen.getByRole('textbox', { name: 'answer' }) as HTMLTextAreaElement).readOnly).toBe(
      false
    );
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
    expect((screen.getByRole('textbox', { name: 'answer' }) as HTMLTextAreaElement).readOnly).toBe(
      false
    );
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
});
