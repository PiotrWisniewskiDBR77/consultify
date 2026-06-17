/**
 * M27 L-09 — regression: SuperAdmin must not (a) leak secret paths/SQLSTATE on
 * a failed feedback-backlog load, nor (b) crash when an SSO config has a
 * null/undefined providerType.
 *
 * Originally fixed in 69ffc1fd86. This test pins both invariants so they can't
 * silently regress.
 */
// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// --- shared light mocks -----------------------------------------------------
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, def?: string) => def ?? _key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

// Keep peripheral components shallow so the test targets the guarded logic only.
vi.mock('../../src/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));
vi.mock('../../src/components/Admin/AdminState', () => ({
  DegradedState: ({ message }: { message?: string }) => <div>{message}</div>,
}));

// --- Api mock (hoisted so component import sees it) --------------------------
const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getFeedbackBacklogTasks: vi.fn(),
    getSsoConfigs: vi.fn(),
    getOrganizations: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../src/services/api', () => ({ Api: apiMock }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('M27 L-09a — FeedbackBacklog never leaks secret paths on failure', () => {
  it('shows a generic message and hides the raw DB error (no /secrets, no SQLSTATE)', async () => {
    const SECRET_PATH = '/secrets/db/password.txt';
    const RAW = `error: relation does not exist at ${SECRET_PATH} [SQLSTATE 42P01]`;
    apiMock.getFeedbackBacklogTasks.mockRejectedValue(
      Object.assign(new Error(RAW), { code: 'DB_ERROR', stack: `Error: ${RAW}` })
    );

    const { SuperAdminFeedbackBacklogView } = await import(
      '../../src/views/superadmin/SuperAdminFeedbackBacklogView'
    );
    render(<SuperAdminFeedbackBacklogView />);

    await waitFor(() => {
      expect(screen.getByText('Feedback backlog is temporarily unavailable.')).toBeTruthy();
    });

    // Only the safe discrete code is allowed through.
    expect(screen.getByTestId('feedback-backlog-error-code').textContent).toContain('DB_ERROR');

    const html = document.body.innerHTML;
    expect(html).not.toContain(SECRET_PATH);
    expect(html).not.toContain('SQLSTATE');
    expect(html).not.toContain('relation does not exist');
  });
});

describe('M27 L-09b — SSOConfigurationView survives a null providerType', () => {
  it('renders the config row without throwing when providerType is null', async () => {
    apiMock.getSsoConfigs.mockResolvedValue({
      configs: [
        {
          id: 'sso-1',
          organizationId: 'org-1',
          organizationName: 'Acme',
          providerType: null, // the historical crash trigger
          providerName: null,
          isActive: true,
          isVerified: false,
        },
      ],
    });
    apiMock.getOrganizations.mockResolvedValue([{ id: 'org-1', name: 'Acme' }]);
    apiMock.get.mockResolvedValue({ mappings: [] });

    const { SSOConfigurationView } = await import(
      '../../src/views/superadmin/SSOConfigurationView'
    );

    // The assertion is simply that rendering + effects resolve without a thrown
    // TypeError from `.replace()` on a null providerType.
    expect(() => render(<SSOConfigurationView />)).not.toThrow();

    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeTruthy();
    });
  });
});
