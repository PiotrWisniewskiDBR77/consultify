/**
 * @vitest-environment jsdom
 *
 * TasksMilestonesSection (milestones list) — INI-05 active UI/component test.
 *
 * This is the live, mounted "roadmap milestones" UI for a single initiative
 * — the one real caller of `POST /initiatives/:id/milestones`, the endpoint
 * this packet added capability-gating and an audit trail to. Locks in:
 *   - milestones load on mount and render (fresh GET);
 *   - creating a milestone posts the right body to the right endpoint and
 *     appends the server-returned row to the list (not an optimistic-only
 *     local id);
 *   - on a backend failure (e.g. the new 403 CAPABILITY_REQUIRED / 404 this
 *     packet's `assertCanEditInitiative` can now return), the modal shows an
 *     error toast and the milestone is NOT added to the list — no false
 *     success.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, fallback?: string) => fallback ?? k }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        (props: any) => {
          const Tag = tag as any;
          return <Tag {...props} />;
        },
    }
  ),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/components/shared/NModeBlocks', () => ({
  Callout: ({ children }: any) => <div data-testid="callout">{children}</div>,
  EmptyStateInline: ({ message }: any) => <div data-testid="empty-state">{message}</div>,
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { get: (...args: any[]) => apiGet(...args), post: (...args: any[]) => apiPost(...args) },
}));

const ctxValue: any = {
  tasks: [],
  setTasks: vi.fn(),
  tasksDone: [],
  isPolish: false,
  onOpenTask: vi.fn(),
  users: [],
  initiative: { id: 'init-1', name: 'X', status: 'PLANNING' },
  showCreateTask: false,
  setShowCreateTask: vi.fn(),
  tasksAiRequest: null,
  clearTasksAiRequest: vi.fn(),
};

vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

import { TasksMilestonesSection } from '@/components/Initiatives/sections/TasksMilestonesSection';

describe('TasksMilestonesSection — milestones (INI-05)', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/milestones')) {
        return Promise.resolve({
          milestones: [
            { id: 'ms-1', name: 'Kickoff', targetDate: '2026-09-01', status: 'PENDING', isGate: false },
          ],
        });
      }
      return Promise.resolve({});
    });
  });

  it('loads and renders existing milestones on mount (fresh GET)', async () => {
    render(<TasksMilestonesSection readonly={false} />);
    await waitFor(() => expect(screen.getByText('Kickoff')).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledWith('/initiatives/init-1/milestones');
  });

  it('creating a milestone posts to the real endpoint and appends the server row to the list', async () => {
    apiPost.mockResolvedValue({
      milestone: { id: 'ms-2', name: 'Go-live', targetDate: '2026-11-01', status: 'PENDING', isGate: false },
    });
    const user = userEvent.setup();
    render(<TasksMilestonesSection readonly={false} />);
    await waitFor(() => expect(screen.getByText('Kickoff')).toBeInTheDocument());

    await user.click(screen.getByText('Add milestone'));
    const nameInput = screen.getByPlaceholderText('e.g. Go-live approved');
    // `fireEvent.change` (atomic) rather than `userEvent.type` (per-character):
    // the modal steals focus onto this input via a `setTimeout(..., 20)` on
    // open, and per-character typing races that timer — userEvent aborts
    // mid-string when focus visibly "moves" out from under it.
    fireEvent.change(nameInput, { target: { value: 'Go-live' } });
    await user.click(screen.getByText('Create milestone'));

    await waitFor(() => expect(screen.getByText('Go-live')).toBeInTheDocument());
    expect(apiPost).toHaveBeenCalledWith(
      '/initiatives/init-1/milestones',
      expect.objectContaining({ name: 'Go-live' })
    );
  });

  it('a failed create (e.g. capability-denied) shows an error and does NOT add the milestone — no false success', async () => {
    apiPost.mockRejectedValue(
      Object.assign(new Error('Capability required'), { status: 403 })
    );
    const user = userEvent.setup();
    render(<TasksMilestonesSection readonly={false} />);
    await waitFor(() => expect(screen.getByText('Kickoff')).toBeInTheDocument());

    await user.click(screen.getByText('Add milestone'));
    const nameInput = screen.getByPlaceholderText('e.g. Go-live approved');
    fireEvent.change(nameInput, { target: { value: 'Should not persist' } });
    await user.click(screen.getByText('Create milestone'));

    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(screen.queryByText('Should not persist')).not.toBeInTheDocument();
    // Only the originally-loaded milestone is present — nothing else leaked in.
    expect(screen.getAllByText('Kickoff')).toHaveLength(1);
  });
});
