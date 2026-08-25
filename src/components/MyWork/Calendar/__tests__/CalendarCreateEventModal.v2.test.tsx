import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createEvent, duplicate, success, error } = vi.hoisted(() => ({
  createEvent: vi.fn(),
  duplicate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, value?: string | Record<string, unknown>) =>
      typeof value === 'string' ? value : String(value?.defaultValue ?? _key),
  }),
}));
vi.mock('react-hot-toast', () => ({ default: { success, error } }));
vi.mock('@/utils/myWorkCalendarV2Flag', () => ({ isMyWorkCalendarV2Enabled: () => true }));
vi.mock('@/services/api', () => ({
  default: {
    getMyWorkCalendarConflicts: vi.fn().mockResolvedValue({ totalItems: 0 }),
    createMyWorkCalendarEvent: (...args: unknown[]) => createEvent(...args),
  },
}));
vi.mock('../../CalendarV2/duplicateCalendarEvent', () => ({
  duplicateCalendarEventFourWeeks: (...args: unknown[]) => duplicate(...args),
}));
vi.mock('@/components/ui/primitives/Button', () => ({
  Button: ({ children, loading, ...props }: any) => <button disabled={loading} {...props}>{children}</button>,
}));
vi.mock('@/components/ui/primitives/Modal', () => ({
  Modal: ({ open, children, footer }: any) => open ? <div>{children}{footer}</div> : null,
}));

import { CalendarCreateEventModal } from '../CalendarCreateEventModal';

function renderModal() {
  render(
    <CalendarCreateEventModal
      open
      defaultDate={new Date(2026, 7, 25)}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />
  );
  fireEvent.change(screen.getByPlaceholderText('e.g. Prepare review deck'), {
    target: { value: 'Focus block' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('CalendarCreateEventModal V2 duplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createEvent.mockResolvedValue({ id: 'event-1' });
  });

  // FIX-20 (Day 3 layer-2 acceptance): window.confirm() replaced with the
  // canonical ConfirmDialog (src/components/MyWork/shared/ConfirmDialog.tsx)
  // — these two cases now drive the real dialog's buttons instead of
  // mocking window.confirm.

  it('asks before the first write and cancel produces zero POSTs', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Duplicate for the next 4 weeks');
    // Two "Cancel"-named controls live inside the dialog: the icon-only ×
    // close button (aria-label="Cancel") and the visible footer button — the
    // footer one is last in DOM order.
    const cancelButtons = within(dialog).getAllByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createEvent).not.toHaveBeenCalled();
    expect(duplicate).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it('reports partial duplication only as an error', async () => {
    duplicate.mockResolvedValue({
      created: [{ date: '2026-09-01' }],
      failed: [{ date: '2026-09-08', error: new Error('conflict') }],
    });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Create copies' }));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(duplicate).toHaveBeenCalledTimes(1);
    expect(success).not.toHaveBeenCalled();
  });
});
