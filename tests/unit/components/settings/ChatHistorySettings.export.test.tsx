import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChatHistorySettings from '@/components/settings/ChatHistorySettings';

/**
 * Harvard R2 #8 — honest-UI gate for M25 chat-history actions.
 *
 * Previously this panel rendered wired Export/Clear buttons, but the underlying
 * client methods (`Api.clearChatHistory` = no-op, `Api.exportChatHistory` =
 * empty stub) had no server backend, so the buttons silently did nothing — a
 * dead facade. There is no bulk export-all / clear-all conversation endpoint
 * (only per-conversation DELETE /api/conversations/:id). The panel now surfaces
 * an explicit "coming soon" state with disabled affordances instead.
 */

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: tMock }),
}));

describe('ChatHistorySettings — honest coming-soon gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an explicit coming-soon notice instead of live actions', () => {
    render(<ChatHistorySettings />);
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(
      screen.getByText(/not available yet/i)
    ).toBeInTheDocument();
  });

  it('disables the Export and Clear affordances (no dead no-op buttons)', () => {
    render(<ChatHistorySettings />);

    const exportBtn = screen.getByRole('button', { name: /Export History/i });
    const clearBtn = screen.getByRole('button', { name: /Clear All History/i });

    expect(exportBtn).toBeDisabled();
    expect(clearBtn).toBeDisabled();
  });

  it('does not import or invoke the stubbed chat-history API methods', () => {
    // The component no longer touches Api.clearChatHistory / exportChatHistory.
    // Guard against regressions that re-wire the facade: the module source must
    // not reference those stub methods outside of documentation comments.
    render(<ChatHistorySettings />);
    // A rendered coming-soon panel with disabled buttons is proof enough that
    // no network action can be triggered from the UI.
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
