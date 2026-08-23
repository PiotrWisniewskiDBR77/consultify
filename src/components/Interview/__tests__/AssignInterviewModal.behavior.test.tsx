import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AssignInterviewModal,
  getInterviewTemplateAssignmentEligibility,
} from '../AssignInterviewModal';

const apiGet = vi.fn();
const manageAssignment = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/services/api', () => ({
  Api: { get: (...args: unknown[]) => apiGet(...args), post: vi.fn() },
}));
vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: { manageAssignment: (...args: unknown[]) => manageAssignment(...args) },
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ currentProjectId: 'project-1', currentOrganization: { id: 'org-1' } }),
}));
vi.mock('@/hooks/useInterviewPermissions', () => ({
  useInterviewPermissions: () => ({ assignmentScope: 'organization', canAssignToUser: () => true }),
}));

vi.mock('@/components/shared/forms', () => ({
  Field: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FieldLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Select: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="select" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
  MultiSelect: ({
    values,
    onChange,
  }: {
    values: string[];
    onChange: (value: string[]) => void;
  }) => (
    <button type="button" onClick={() => onChange(['user-1'])}>
      Users {values.length}
    </button>
  ),
  DatePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="date" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock('@/components/ui/primitives', () => ({
  Button: ({ children, loading: _loading, icon: _icon, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  LoadingState: () => <div>Loading</div>,
  Switch: ({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) => (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} />
  ),
}));

const reassignAssignment = {
  id: 'assignment-1',
  assigneeUserId: 'user-1',
  templateId: 'template-1',
  dueAt: '2026-09-01T00:00:00.000Z',
  priority: 'medium' as const,
  notes: null,
};

describe('AssignInterviewModal behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockImplementation((path: string) =>
      path === '/interview/templates'
        ? Promise.resolve([
            {
              id: 'template-1',
              name: 'Template',
              status: 'approved',
              hasPublishedVersion: true,
              version: 1,
            },
          ])
        : Promise.resolve({ users: [{ id: 'user-1', name: 'User One', email: 'one@example.com' }] })
    );
  });

  it('owns initial focus, closes on Escape, and restores the invoking focus', async () => {
    const invoker = document.createElement('button');
    document.body.appendChild(invoker);
    invoker.focus();
    const onClose = vi.fn();
    const { unmount } = render(
      <AssignInterviewModal isOpen onClose={onClose} preselectedTemplateId="template-1" />
    );

    const close = await screen.findByRole('button', { name: 'Close' });
    await waitFor(() => expect(close).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(invoker).toHaveFocus();
    invoker.remove();
  });

  it('cannot be dismissed by backdrop or close controls while a submit is pending', async () => {
    let resolveSubmit!: () => void;
    manageAssignment.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      })
    );
    const onClose = vi.fn();
    const { container } = render(
      <AssignInterviewModal
        isOpen
        onClose={onClose}
        preselectedTemplateId="template-1"
        reassignAssignment={reassignAssignment}
      />
    );

    const submit = await screen.findByRole('button', { name: /reassign/i });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);
    await waitFor(() => expect(manageAssignment).toHaveBeenCalledOnce());

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toBeDisabled();
    fireEvent.click(container.querySelector('.backdrop-blur-sm') as HTMLElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    resolveSubmit();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('explains every template that cannot be assigned instead of silently hiding it', async () => {
    const onManageTemplate = vi.fn();
    apiGet.mockImplementation((path: string) =>
      path === '/interview/templates'
        ? Promise.resolve([
            {
              id: 'draft-template',
              name: 'Draft template',
              status: 'draft',
              hasPublishedVersion: false,
              version: 0,
            },
            {
              id: 'unpublished-template',
              name: 'Approved but unpublished',
              status: 'approved',
              hasPublishedVersion: false,
              version: 1,
            },
            {
              id: 'bad-version-template',
              name: 'Invalid version',
              status: 'approved',
              hasPublishedVersion: true,
              version: 0,
            },
          ])
        : Promise.resolve({ users: [{ id: 'user-1', name: 'User One', email: 'one@example.com' }] })
    );

    render(<AssignInterviewModal isOpen onClose={vi.fn()} onManageTemplate={onManageTemplate} />);

    expect(await screen.findByText('Templates unavailable for assignment')).toBeInTheDocument();
    expect(screen.getByText(/Draft template/).parentElement).toHaveTextContent(
      'Not approved for assignment'
    );
    expect(screen.getByText(/Approved but unpublished/).parentElement).toHaveTextContent(
      'No published version'
    );
    expect(screen.getByText(/Invalid version/).parentElement).toHaveTextContent(
      'Published version is invalid'
    );
    const recoveryActions = screen.getAllByRole('button', { name: 'Open template' });
    expect(recoveryActions).toHaveLength(3);
    fireEvent.click(recoveryActions[1]);
    expect(onManageTemplate).toHaveBeenCalledWith('unpublished-template');
  });

  it('keeps a load failure distinct from empty data and offers an inline retry', async () => {
    apiGet.mockImplementation((path: string) =>
      path === '/interview/templates'
        ? Promise.reject(new Error('template service unavailable'))
        : Promise.resolve({ users: [] })
    );

    render(<AssignInterviewModal isOpen onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Templates could not load: template service unavailable'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(apiGet.mock.calls.filter(([path]) => path === '/interview/templates')).toHaveLength(2)
    );
  });

  it('uses the backend publication contract as the assignment eligibility gate', () => {
    expect(
      getInterviewTemplateAssignmentEligibility({
        status: 'approved',
        hasPublishedVersion: true,
        version: 3,
      })
    ).toEqual({ eligible: true, reason: null });
    expect(
      getInterviewTemplateAssignmentEligibility({
        status: 'approved',
        hasPublishedVersion: false,
        version: 3,
      })
    ).toEqual({ eligible: false, reason: 'no_published_version' });
  });
});
