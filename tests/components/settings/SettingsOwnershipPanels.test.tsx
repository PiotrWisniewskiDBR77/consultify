/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsOwnershipPanels from '../../../src/components/settings/SettingsOwnershipPanels';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => h.navigate,
  };
});

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => h.apiGet(...args),
  },
}));

vi.mock('../../../src/components/settings/SettingsTaxonomyPanel', () => ({
  SettingsTaxonomyPanel: () => <div>SettingsTaxonomyPanel</div>,
}));

describe('SettingsOwnershipPanels triad handoffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    h.apiGet.mockImplementation(async (path: string) => {
      if (path === '/organization-context') {
        return {
          profile: {
            defaultLanguage: 'pl',
            defaultTimezone: 'Europe/Warsaw',
            currency: 'PLN',
            brandColor: '#4338ca',
            accentColor: '#7c3aed',
            customDomain: 'workspace.example.com',
          },
          trust: {
            mfa: { required: true },
            sso: { enforced: true, provider: 'Okta', configured: true },
            security: { sessionTimeout: 45 },
          },
        };
      }

      if (path.includes('/settings/registry/')) {
        const key = path.split('/settings/registry/')[1].replace('/resolve', '');
        const values: Record<string, { value: unknown; source: 'tenant' | 'module' | 'personal' }> = {
          default_language: { value: 'pl', source: 'tenant' },
          default_timezone: { value: 'Europe/Warsaw', source: 'tenant' },
          default_currency: { value: 'PLN', source: 'tenant' },
          default_sharing_mode: { value: 'workspace', source: 'tenant' },
          mfa_required: { value: true, source: 'tenant' },
          sso_enforced: { value: true, source: 'tenant' },
          session_timeout_minutes: { value: 45, source: 'tenant' },
          guest_access_enabled: { value: false, source: 'tenant' },
          external_link_sharing: { value: false, source: 'tenant' },
          tool_approval_required: { value: true, source: 'tenant' },
          default_tool_visibility: { value: 'team', source: 'module' },
          recording_auto_start: { value: true, source: 'module' },
          ai_transcription_enabled: { value: true, source: 'module' },
          default_export_format: { value: 'pdf', source: 'module' },
          scoring_scale: { value: '1-5', source: 'module' },
          model_preference: { value: 'gpt-5.4', source: 'personal' },
          citation_style: { value: 'apa', source: 'module' },
        };
        return values[key] ?? { value: null, source: 'tenant' };
      }

      throw new Error(`Unexpected API path: ${path}`);
    });
  });

  it('keeps tenant security visible but routes writes to Admin', async () => {
    const user = userEvent.setup();
    render(<SettingsOwnershipPanels mode="tenant-security" />);

    expect(await screen.findByText('Security handoff to Admin')).toBeInTheDocument();
    expect(screen.getByText('MFA required')).toBeInTheDocument();
    expect(screen.getByText('SSO enforced')).toBeInTheDocument();
    expect(screen.getAllByText('Read-only').length).toBeGreaterThanOrEqual(3);

    // DEC-2026-08-24-12: guest access / external link sharing / tool approval
    // are unenforced no-ops, so they no longer render as read-only values —
    // they share the same planned notice as AdminCollaborationControlsPanel.
    expect(screen.queryByText('Guest access')).not.toBeInTheDocument();
    expect(screen.queryByText('External link sharing')).not.toBeInTheDocument();
    expect(screen.queryByText('Tool approval required')).not.toBeInTheDocument();
    expect(
      screen.getByText('Planned — this policy will be enforced once implemented.')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open Admin Security' }));

    expect(h.navigate).toHaveBeenCalledWith('/admin?tab=security');
  });

  it('routes tenant branding and defaults back to Organization ownership', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SettingsOwnershipPanels mode="tenant-defaults" />);

    expect(await screen.findByText('Tenant defaults')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Organization' }));
    expect(h.navigate).toHaveBeenCalledWith('/organization/profile');

    rerender(<SettingsOwnershipPanels mode="tenant-branding" />);

    expect(await screen.findByText('Branding reuse from P30')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Branding' }));
    expect(h.navigate).toHaveBeenCalledWith('/organization/branding');
  });

  it('keeps module preferences under Settings while allowing deep links', async () => {
    const user = userEvent.setup();
    const onOpenSection = vi.fn();
    render(<SettingsOwnershipPanels mode="module-preferences" onOpenSection={onOpenSection} />);

    expect(await screen.findByText('Module preferences')).toBeInTheDocument();
    expect(screen.getByText('Interview')).toBeInTheDocument();
    expect(screen.getByText('AI / Copilot')).toBeInTheDocument();

    // DEC-2026-08-24-12: the Tools card no longer shows the unenforced
    // "Tool approval" value — it shows the shared planned notice instead.
    expect(screen.queryByText(/Tool approval:/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Planned — this policy will be enforced once implemented.')
    ).toBeInTheDocument();

    const buttons = await screen.findAllByRole('button');
    await user.click(buttons[0]);

    await waitFor(() => {
      expect(onOpenSection).toHaveBeenCalledWith('work-preferences');
    });
  });
});
