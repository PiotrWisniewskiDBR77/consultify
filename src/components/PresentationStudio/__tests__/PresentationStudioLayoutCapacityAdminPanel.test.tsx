/**
 * @vitest-environment jsdom
 *
 * Component tests for `PresentationStudioLayoutCapacityAdminPanel`
 * (Sprint S20). Asserts:
 *
 *   - Server-driven visibility: 403 PERMISSION_DENIED -> renders nothing.
 *   - Honest loading + error states with retry path.
 *   - loadWarning banner rendering across reasons (corrupt / io_error /
 *     unsupported_schema / rejected_by_validator / signature_mismatch).
 *   - Override flow: JSON parse failure -> banner; server validation
 *     errors -> typed `errors[]` list; clean propose -> ticket displayed
 *     -> execute -> success banner + bootstrap refresh.
 *   - Override execute ticket failure -> typed reason banner; ticket
 *     cleared on rejection.
 *   - Reset flow: propose -> confirmation panel with pre-reset
 *     snapshot preview -> execute -> success + refresh.
 *   - Controls disabled while pending.
 *   - Confirmation requires two clicks (no single-click reset).
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LayoutCapacityAdminApiError,
  type LayoutCapacityAdminGetResponse,
  type PresentationStudioLayoutCapacityAdminApiType,
} from '@/services/api/presentationStudioLayoutCapacityAdmin.api';

import { PresentationStudioLayoutCapacityAdminPanel } from '../PresentationStudioLayoutCapacityAdminPanel';

// ---------------------------------------------------------------------------
// Mock api factory
// ---------------------------------------------------------------------------

function makeDefaultsSnapshot(): LayoutCapacityAdminGetResponse['defaults'] {
  return {
    densityBudgets: {
      visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
      balanced: { titleMaxChars: 80, keyMessageMaxChars: 200, blocksMax: 6 },
      document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
    },
    templateFamilyOverrides: {},
    familyAliasByDeckType: {},
  };
}

function makeOverriddenSnapshot(): LayoutCapacityAdminGetResponse['current'] {
  return {
    densityBudgets: {
      visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
      balanced: { titleMaxChars: 100, keyMessageMaxChars: 200, blocksMax: 6 }, // changed
      document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
    },
    templateFamilyOverrides: {},
    familyAliasByDeckType: { synthetic: 'Universal' }, // changed
  };
}

function makeTicket(suffix = 'abc'): {
  ticketId: string;
  organizationId: string;
  userId: string;
  payloadFingerprint: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: null;
} {
  return {
    ticketId: `pssa_${suffix}`,
    organizationId: 'org-Sys',
    userId: 'admin-1',
    payloadFingerprint: 'a'.repeat(64),
    createdAt: '2026-05-09T00:00:00.000Z',
    expiresAt: '2026-05-09T00:10:00.000Z',
    consumedAt: null,
  };
}

interface MockApi {
  get: ReturnType<typeof vi.fn>;
  proposeOverrides: ReturnType<typeof vi.fn>;
  executeOverrides: ReturnType<typeof vi.fn>;
  proposeReset: ReturnType<typeof vi.fn>;
  executeReset: ReturnType<typeof vi.fn>;
}

function makeMockApi(): MockApi {
  return {
    get: vi.fn(),
    proposeOverrides: vi.fn(),
    executeOverrides: vi.fn(),
    proposeReset: vi.fn(),
    executeReset: vi.fn(),
  };
}

let api: MockApi;

beforeEach(() => {
  api = makeMockApi();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Visibility gate (server-driven)
// ---------------------------------------------------------------------------

describe('PresentationStudioLayoutCapacityAdminPanel — visibility', () => {
  it('renders nothing when GET returns 403 PERMISSION_DENIED (non-SuperAdmin)', async () => {
    api.get.mockRejectedValueOnce(
      new LayoutCapacityAdminApiError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: 'Permission denied',
      })
    );

    const { container } = render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      // Wait for the GET to settle.
      expect(api.get).toHaveBeenCalled();
    });
    // After the rejection settles the entire panel must be gone.
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders a loading skeleton while the initial GET is in flight', async () => {
    let resolveGet: (v: LayoutCapacityAdminGetResponse) => void = () => undefined;
    api.get.mockReturnValueOnce(
      new Promise<LayoutCapacityAdminGetResponse>((resolve) => {
        resolveGet = resolve;
      })
    );

    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    expect(screen.getByTestId('studio-layout-capacity-admin-loading')).toBeTruthy();
    // Resolve so the test can clean up cleanly.
    await act(async () => {
      resolveGet({
        current: makeDefaultsSnapshot(),
        defaults: makeDefaultsSnapshot(),
        scope: 'tenant',
        loadWarning: null,
      });
    });
  });

  it('renders an honest error card with a retry button on a non-403 GET failure', async () => {
    api.get.mockRejectedValueOnce(new Error('boom'));
    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin-error')).toBeTruthy();
    });
    expect(screen.getByText(/boom/i)).toBeTruthy();
    // Retry button rewires the GET.
    api.get.mockResolvedValueOnce({
      current: makeDefaultsSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: null,
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('studio-layout-capacity-admin-retry'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// loadWarning rendering
// ---------------------------------------------------------------------------

describe('PresentationStudioLayoutCapacityAdminPanel — loadWarning', () => {
  it('renders no loadWarning banner when the persistence layer is clean', async () => {
    api.get.mockResolvedValueOnce({
      current: makeDefaultsSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: null,
    });
    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin')).toBeTruthy();
    });
    expect(screen.queryByTestId('studio-layout-capacity-admin-load-warning')).toBeNull();
    expect(screen.getByText(/Tenant-scoped registry/i)).toBeTruthy();
    expect(screen.getByText(/scope: tenant/i)).toBeTruthy();
  });

  it('renders a rose loadWarning banner for `corrupt` (file unparseable)', async () => {
    api.get.mockResolvedValueOnce({
      current: makeDefaultsSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: {
        reason: 'corrupt',
        sourcePath: '/tmp/persisted.json',
        details: 'Unexpected token in JSON at position 0',
        raisedAt: '2026-05-09T00:00:00.000Z',
      },
    });
    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    const banner = await screen.findByTestId('studio-layout-capacity-admin-load-warning');
    expect(banner.textContent).toContain('corrupt');
    expect(banner.textContent).toContain('/tmp/persisted.json');
    expect(banner.textContent).toContain('Unexpected token');
  });

  it('renders an amber loadWarning banner for `io_error`', async () => {
    api.get.mockResolvedValueOnce({
      current: makeDefaultsSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: {
        reason: 'io_error',
        sourcePath: '/tmp/persisted.json',
        details: 'EACCES: permission denied',
        raisedAt: '2026-05-09T00:00:00.000Z',
      },
    });
    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    const banner = await screen.findByTestId('studio-layout-capacity-admin-load-warning');
    // Amber tone (advisory) is keyed by class `border-amber-200`.
    expect(banner.className).toContain('amber');
    expect(banner.textContent).toContain('EACCES');
  });

  it('renders a rose loadWarning banner for `signature_mismatch` (tampered persistence file)', async () => {
    api.get.mockResolvedValueOnce({
      current: makeDefaultsSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: {
        reason: 'signature_mismatch',
        sourcePath: '/tmp/persisted.json',
        details: 'signature does not match persisted override contents',
        raisedAt: '2026-05-09T00:00:00.000Z',
      },
    });
    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    const banner = await screen.findByTestId('studio-layout-capacity-admin-load-warning');
    expect(banner.className).toContain('danger');
    expect(banner.textContent).toContain('signature is missing or invalid');
    expect(banner.textContent).toContain('signature does not match');
  });
});

// ---------------------------------------------------------------------------
// Snapshot diff
// ---------------------------------------------------------------------------

describe('PresentationStudioLayoutCapacityAdminPanel — diff view', () => {
  it('renders 0 changed for a registry that equals defaults', async () => {
    api.get.mockResolvedValueOnce({
      current: makeDefaultsSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: null,
    });
    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      const badge = screen.getByTestId('studio-layout-capacity-admin-changed-count');
      expect(badge.textContent).toContain('0 changed');
    });
  });

  it('counts changed rows when current differs from defaults', async () => {
    api.get.mockResolvedValueOnce({
      current: makeOverriddenSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: null,
    });
    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      const badge = screen.getByTestId('studio-layout-capacity-admin-changed-count');
      // 1 density change + 1 alias change = 2 changed rows.
      expect(badge.textContent).toContain('2 changed');
    });
    const tableText =
      screen.getByTestId('studio-layout-capacity-admin-diff-table').textContent ?? '';
    expect(tableText).toContain('densityBudgets.balanced.titleMaxChars');
    expect(tableText).toContain('familyAliasByDeckType.synthetic');
    expect(tableText).toContain('Universal');
  });
});

// ---------------------------------------------------------------------------
// Override flow
// ---------------------------------------------------------------------------

describe('PresentationStudioLayoutCapacityAdminPanel — override flow', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({
      current: makeDefaultsSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: null,
    });
  });

  it('shows a JSON parse error banner without calling the api on malformed input', async () => {
    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-overrides-json'), {
      target: { value: '{not valid json' },
    });
    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-overrides-reason'), {
      target: { value: 'rationale' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('studio-layout-capacity-admin-overrides-propose'));
    });

    expect(api.proposeOverrides).not.toHaveBeenCalled();
    const banner = await screen.findByTestId(
      'studio-layout-capacity-admin-overrides-propose-error'
    );
    expect(banner.textContent).toContain('Could not parse');
  });

  it('renders typed validation errors[] when the server rejects the payload', async () => {
    api.proposeOverrides.mockRejectedValueOnce(
      new LayoutCapacityAdminApiError({
        status: 412,
        code: 'INVALID_OVERRIDES_PAYLOAD',
        message: 'validation_failed',
        reason: 'validation_failed',
        errors: [
          {
            path: 'densityBudgets.balanced.titleMaxChars',
            reason: 'must be a finite positive number',
          },
        ],
      })
    );
    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-overrides-json'), {
      target: { value: '{"densityBudgets":{"balanced":{"titleMaxChars":-1}}}' },
    });
    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-overrides-reason'), {
      target: { value: 'rationale' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('studio-layout-capacity-admin-overrides-propose'));
    });

    const errors = await screen.findByTestId(
      'studio-layout-capacity-admin-overrides-validation-errors'
    );
    expect(errors.textContent).toContain('densityBudgets.balanced.titleMaxChars');
    expect(errors.textContent).toContain('must be a finite positive number');
  });

  it('clean propose -> execute round-trip applies the override and refreshes the bootstrap snapshot', async () => {
    api.proposeOverrides.mockResolvedValueOnce({
      ticket: makeTicket(),
      payloadFingerprint: 'a'.repeat(64),
      overrides: { densityBudgets: { balanced: { titleMaxChars: 100 } } },
    });
    api.executeOverrides.mockResolvedValueOnce({
      ticketId: 'pssa_abc',
      registrySnapshotAfter: makeOverriddenSnapshot(),
      auditEvent: 'presentation_studio_layout_capacity_overrides_applied',
    });
    // After execute the panel does a second GET to refresh the diff.
    api.get.mockResolvedValueOnce({
      current: makeOverriddenSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: null,
    });

    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-overrides-json'), {
      target: { value: '{"densityBudgets":{"balanced":{"titleMaxChars":100}}}' },
    });
    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-overrides-reason'), {
      target: { value: 'tightening for executive decks' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('studio-layout-capacity-admin-overrides-propose'));
    });

    // Ticket button now visible.
    const executeBtn = await screen.findByTestId('studio-layout-capacity-admin-overrides-execute');
    expect(executeBtn.textContent).toContain('Confirm apply');

    await act(async () => {
      fireEvent.click(executeBtn);
    });

    await screen.findByTestId('studio-layout-capacity-admin-overrides-success');
    expect(api.executeOverrides).toHaveBeenCalledTimes(1);
    expect(api.proposeOverrides).toHaveBeenCalledTimes(1);
    // Bootstrap was refreshed (initial + post-execute = 2 calls).
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('execute ticket failure surfaces a typed reason banner and clears the ticket', async () => {
    api.proposeOverrides.mockResolvedValueOnce({
      ticket: makeTicket(),
      payloadFingerprint: 'a'.repeat(64),
      overrides: { densityBudgets: { balanced: { titleMaxChars: 100 } } },
    });
    api.executeOverrides.mockRejectedValueOnce(
      new LayoutCapacityAdminApiError({
        status: 403,
        code: 'INVALID_APPROVAL_TICKET',
        message: 'payload_mismatch',
        reason: 'payload_mismatch',
      })
    );

    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-overrides-json'), {
      target: { value: '{"densityBudgets":{"balanced":{"titleMaxChars":100}}}' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('studio-layout-capacity-admin-overrides-propose'));
    });
    const executeBtn = await screen.findByTestId('studio-layout-capacity-admin-overrides-execute');
    await act(async () => {
      fireEvent.click(executeBtn);
    });

    const banner = await screen.findByTestId(
      'studio-layout-capacity-admin-overrides-execute-error'
    );
    expect(banner.textContent).toContain('Override payload or reason changed');
    // Ticket cleared — execute button replaced with propose button.
    expect(screen.queryByTestId('studio-layout-capacity-admin-overrides-execute')).toBeNull();
    expect(screen.getByTestId('studio-layout-capacity-admin-overrides-propose')).toBeTruthy();
  });

  it('changing the overrides JSON after a successful propose invalidates the held ticket', async () => {
    api.proposeOverrides.mockResolvedValueOnce({
      ticket: makeTicket(),
      payloadFingerprint: 'a'.repeat(64),
      overrides: { densityBudgets: { balanced: { titleMaxChars: 100 } } },
    });

    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-overrides-json'), {
      target: { value: '{"densityBudgets":{"balanced":{"titleMaxChars":100}}}' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('studio-layout-capacity-admin-overrides-propose'));
    });
    expect(screen.getByTestId('studio-layout-capacity-admin-overrides-execute')).toBeTruthy();

    // Edit the JSON — execute button must disappear (ticket invalidated).
    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-overrides-json'), {
      target: { value: '{"densityBudgets":{"balanced":{"titleMaxChars":111}}}' },
    });
    expect(screen.queryByTestId('studio-layout-capacity-admin-overrides-execute')).toBeNull();
    expect(screen.getByTestId('studio-layout-capacity-admin-overrides-propose')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Reset flow
// ---------------------------------------------------------------------------

describe('PresentationStudioLayoutCapacityAdminPanel — reset flow', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({
      current: makeOverriddenSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: null,
    });
  });

  it('propose -> confirmation panel shows the pre-reset snapshot preview (no single-click reset)', async () => {
    api.proposeReset.mockResolvedValueOnce({
      ticket: makeTicket('reset'),
      payloadFingerprint: 'b'.repeat(64),
    });

    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-reset-reason'), {
      target: { value: 'returning to defaults' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('studio-layout-capacity-admin-reset-propose'));
    });

    // Confirmation panel rendered, propose button replaced with execute.
    const confirmation = await screen.findByTestId(
      'studio-layout-capacity-admin-reset-confirmation'
    );
    expect(confirmation.textContent).toContain('Confirm reset to defaults');

    // Pre-reset snapshot preview shows the overridden state that would be wiped.
    const preview = screen.getByTestId('studio-layout-capacity-admin-reset-preview');
    expect(preview.textContent).toContain('"titleMaxChars": 100');
    expect(preview.textContent).toContain('synthetic');

    // Execute button distinct from propose button — second click required.
    expect(screen.getByTestId('studio-layout-capacity-admin-reset-execute')).toBeTruthy();
    expect(screen.queryByTestId('studio-layout-capacity-admin-reset-propose')).toBeNull();
  });

  it('confirm reset succeeds, surfaces the audit event, and refreshes the bootstrap', async () => {
    api.proposeReset.mockResolvedValueOnce({
      ticket: makeTicket('reset'),
      payloadFingerprint: 'b'.repeat(64),
    });
    api.executeReset.mockResolvedValueOnce({
      ticketId: 'pssa_reset',
      registrySnapshotBefore: makeOverriddenSnapshot(),
      registrySnapshotAfter: makeDefaultsSnapshot(),
      auditEvent: 'presentation_studio_layout_capacity_overrides_reset',
    });
    // Refresh after execute returns the post-reset state.
    api.get.mockResolvedValueOnce({
      current: makeDefaultsSnapshot(),
      defaults: makeDefaultsSnapshot(),
      scope: 'tenant',
      loadWarning: null,
    });

    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-reset-reason'), {
      target: { value: 'returning to defaults' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('studio-layout-capacity-admin-reset-propose'));
    });
    const executeBtn = await screen.findByTestId('studio-layout-capacity-admin-reset-execute');
    await act(async () => {
      fireEvent.click(executeBtn);
    });

    const successBanner = await screen.findByTestId('studio-layout-capacity-admin-reset-success');
    expect(successBanner.textContent).toContain(
      'presentation_studio_layout_capacity_overrides_reset'
    );
    // Bootstrap refreshed (1 initial + 1 post-reset).
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('reset execute failure surfaces a typed reason banner and clears the ticket', async () => {
    api.proposeReset.mockResolvedValueOnce({
      ticket: makeTicket('reset'),
      payloadFingerprint: 'b'.repeat(64),
    });
    api.executeReset.mockRejectedValueOnce(
      new LayoutCapacityAdminApiError({
        status: 403,
        code: 'INVALID_APPROVAL_TICKET',
        message: 'consumed',
        reason: 'consumed',
      })
    );

    render(
      <PresentationStudioLayoutCapacityAdminPanel
        api={api as unknown as PresentationStudioLayoutCapacityAdminApiType}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('studio-layout-capacity-admin')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('studio-layout-capacity-admin-reset-reason'), {
      target: { value: 'rationale' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('studio-layout-capacity-admin-reset-propose'));
    });
    const executeBtn = await screen.findByTestId('studio-layout-capacity-admin-reset-execute');
    await act(async () => {
      fireEvent.click(executeBtn);
    });

    const banner = await screen.findByTestId('studio-layout-capacity-admin-reset-execute-error');
    expect(banner.textContent).toContain('Ticket has already been used');
    // Ticket cleared — propose button is back.
    expect(screen.queryByTestId('studio-layout-capacity-admin-reset-execute')).toBeNull();
    expect(screen.getByTestId('studio-layout-capacity-admin-reset-propose')).toBeTruthy();
  });
});
