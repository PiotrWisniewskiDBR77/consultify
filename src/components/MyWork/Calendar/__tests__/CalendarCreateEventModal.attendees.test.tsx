import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// FIX-20 (Day 3 layer-2 acceptance): accepted prototype (kalendarz-prototyp.html
// — "Uczestnicy (opcjonalnie, tylko z organizacji)") + the owner's own request.
// Backend already validates attendee ids against `users WHERE organization_id`
// (server/src/routes/my-work/calendar.routes.ts) — this locks in the UI picker
// that was missing.

const { createEvent, searchOrgUsers } = vi.hoisted(() => ({
  createEvent: vi.fn(),
  searchOrgUsers: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, value?: string | Record<string, unknown>) =>
      typeof value === 'string' ? value : String(value?.defaultValue ?? _key),
  }),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/utils/myWorkCalendarV2Flag', () => ({ isMyWorkCalendarV2Enabled: () => true }));
vi.mock('@/services/api', () => ({
  default: {
    getMyWorkCalendarConflicts: vi.fn().mockResolvedValue({ totalItems: 0 }),
    createMyWorkCalendarEvent: (...args: unknown[]) => createEvent(...args),
    searchOrgUsers: (...args: unknown[]) => searchOrgUsers(...args),
  },
}));
vi.mock('../../CalendarV2/duplicateCalendarEvent', () => ({
  duplicateCalendarEventFourWeeks: vi.fn(),
}));
vi.mock('@/components/ui/primitives/Button', () => ({
  Button: ({ children, loading, ...props }: any) => (
    <button disabled={loading} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/ui/primitives/Modal', () => ({
  Modal: ({ open, children, footer }: any) => (open ? <div>{children}{footer}</div> : null),
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
}

describe('CalendarCreateEventModal attendees picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createEvent.mockResolvedValue({ id: 'event-1' });
    searchOrgUsers.mockResolvedValue([
      { id: 'user-1', name: 'Anna Kowalska', email: 'anna@acme.test' },
      { id: 'user-2', name: 'Piotr Nowak', email: 'piotr@acme.test' },
    ]);
  });

  it('does not search before 2 characters', async () => {
    renderModal();
    await screen.findByText('This day looks clear.');
    fireEvent.change(screen.getByPlaceholderText('Add person…'), { target: { value: 'a' } });
    expect(searchOrgUsers).not.toHaveBeenCalled();
  });

  it('searches org users, adds a selected attendee as a chip, and removes it again', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Add person…'), { target: { value: 'an' } });
    await waitFor(() => expect(searchOrgUsers).toHaveBeenCalledWith('an'));

    fireEvent.click(await screen.findByText('Anna Kowalska'));
    expect(screen.getByText('Anna Kowalska')).toBeInTheDocument();
    // Selecting clears the query and the results list.
    expect(screen.queryByText('anna@acme.test')).not.toBeInTheDocument();

    // The mocked t() does not interpolate {{name}}, so query the remove
    // button scoped to the chip instead of asserting the literal aria-label.
    const chip = screen.getByText('Anna Kowalska').closest('span') as HTMLElement;
    fireEvent.click(within(chip).getByRole('button'));
    expect(screen.queryByText('Anna Kowalska')).not.toBeInTheDocument();
  });

  it('includes selected attendee ids in the create-event payload', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Add person…'), { target: { value: 'an' } });
    fireEvent.click(await screen.findByText('Anna Kowalska'));

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
    expect(createEvent.mock.calls[0][0]).toEqual(
      expect.objectContaining({ attendees: ['user-1'] })
    );
  });

  it('submits an empty attendees array when nobody was added', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
    expect(createEvent.mock.calls[0][0]).toEqual(expect.objectContaining({ attendees: [] }));
  });
});
