import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// FIX-21 (Day 3 layer-2 acceptance) — caught during the required dev-render
// pass before showing the owner (CLAUDE.md rule #7): <Modal> renders through
// a React portal straight to document.body, but the confirm dialog from
// useConfirmDialog() did not — with the two sharing the same `z-modal`
// z-index, the already-portaled (and therefore later-in-body) Modal painted
// OVER the inline confirm dialog, making "Powiel na kolejne 4 tygodnie"'s
// confirmation invisible behind the still-open event modal. This test uses
// the REAL Modal component (not mocked, unlike the other calendar modal
// tests) so the portal is actually exercised, and asserts the confirm
// dialog's DOM node ends up AFTER the Modal's portaled node in
// document.body's child order — the property that determines paint order
// for two `position: fixed` siblings at equal z-index.

const { createEvent, duplicate } = vi.hoisted(() => ({
  createEvent: vi.fn(),
  duplicate: vi.fn(),
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
    searchOrgUsers: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../CalendarV2/duplicateCalendarEvent', () => ({
  duplicateCalendarEventFourWeeks: (...args: unknown[]) => duplicate(...args),
}));
// Deliberately NOT mocking @/components/ui/primitives/Modal — the real
// component's portal-to-document.body is exactly what this test verifies.

import { CalendarCreateEventModal } from '../CalendarCreateEventModal';

describe('CalendarCreateEventModal — confirm dialog stacks above the portaled Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createEvent.mockResolvedValue({ id: 'event-1' });
  });

  it('portals the confirm dialog after the Modal in document.body child order', async () => {
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

    // Locate the Modal's own portaled dialog node (aria-labelledby="modal-title")
    // BEFORE the confirm dialog exists.
    const eventModal = await screen.findByRole('dialog', { name: /add to calendar/i });
    expect(eventModal.parentElement?.parentElement).toBe(document.body);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const confirmDialog = await screen.findByRole('dialog', {
      name: /duplicate for the next 4 weeks/i,
    });

    // Both are direct (grand)children of body — assert DOM order, which is
    // what determines paint order at equal z-index for `position: fixed`.
    const bodyChildren = Array.from(document.body.children);
    const eventModalRoot = eventModal.closest('body > *');
    const confirmDialogRoot = confirmDialog.closest('body > *');
    expect(eventModalRoot).not.toBeNull();
    expect(confirmDialogRoot).not.toBeNull();
    const eventModalIndex = bodyChildren.indexOf(eventModalRoot as Element);
    const confirmDialogIndex = bodyChildren.indexOf(confirmDialogRoot as Element);
    expect(confirmDialogIndex).toBeGreaterThan(eventModalIndex);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /duplicate/i })).toBeInTheDocument());
  });
});
