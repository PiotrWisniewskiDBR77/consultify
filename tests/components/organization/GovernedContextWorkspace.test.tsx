import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listClaims: vi.fn(),
  listVersions: vi.fn(),
  decide: vi.fn(),
  publish: vi.fn(),
  getVersion: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string | Record<string, unknown>) =>
      typeof fallback === 'string'
        ? fallback
        : String(fallback.defaultValue ?? '').replace(
            '{{version}}',
            String(fallback.version ?? '')
          ),
  }),
}));

vi.mock('../../../src/services/organizationGovernedContextApi', () => ({
  organizationGovernedContextApi: api,
}));

import { GovernedContextWorkspace } from '../../../src/components/Organization/GovernedContextWorkspace';

const pendingClaim = {
  claimId: 'claim-1',
  itemId: 'item-1',
  claimPath: 'evidence.documentExtraction',
  value: { filename: 'strategy.pdf', summary: 'Industrial transformation' },
  confidence: 0.91,
  sourceType: 'attachment_extraction',
  visibilityScope: 'restricted',
  reviewState: 'pending',
  approved: false,
  approvalSource: 'explicit_review',
  decidedBy: null,
  decidedAt: null,
  createdAt: '2026-08-17T10:00:00.000Z',
};

const version = {
  snapshotId: 'snapshot-1',
  organizationId: 'org-1',
  version: 1,
  schemaVersion: 1,
  contentHash: 'abc123',
  claimCount: 1,
  createdAt: '2026-08-17T10:01:00.000Z',
  createdBy: 'owner-1',
};

describe('GovernedContextWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listClaims.mockResolvedValue([]);
    api.listVersions.mockResolvedValue([]);
  });

  it('renders loading followed by the explicit empty state', async () => {
    let release: (value: unknown[]) => void = () => {};
    api.listClaims.mockReturnValue(new Promise((resolve) => (release = resolve)));
    render(<GovernedContextWorkspace isAdmin />);
    expect(screen.getByText('Loading governed context…')).toBeInTheDocument();
    release([]);
    await waitFor(() => expect(screen.getByText(/No sourced claims/i)).toBeInTheDocument());
    expect(screen.getByText(/No immutable context version/i)).toBeInTheDocument();
  });

  it('shows a visible retry state instead of treating a failed fetch as empty', async () => {
    api.listClaims.mockRejectedValue(new Error('offline'));
    render(<GovernedContextWorkspace isAdmin />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    api.listClaims.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByText(/No sourced claims/i)).toBeInTheDocument();
    expect(api.listClaims.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('lets an admin review a pending claim and reloads a concurrency winner', async () => {
    let currentClaims = [pendingClaim];
    api.listClaims.mockImplementation(async () => currentClaims);
    api.decide.mockImplementation(async () => {
      currentClaims = [{ ...pendingClaim, reviewState: 'rejected' }];
      return {
      claimId: 'claim-1',
      reviewState: 'rejected',
      wonDecision: false,
      };
    });
    render(<GovernedContextWorkspace isAdmin />);
    expect(await screen.findByText('evidence.documentExtraction')).toBeInTheDocument();
    expect(screen.getByText(/strategy.pdf/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('claim-1', 'reject'));
    expect(await screen.findByRole('status')).toHaveTextContent('Another reviewer');
    expect(screen.getByText('rejected')).toBeInTheDocument();
  });

  it('keeps member access read-only and never renders review or publish controls', async () => {
    api.listClaims.mockResolvedValue([{ ...pendingClaim, visibilityScope: 'organization' }]);
    render(<GovernedContextWorkspace isAdmin={false} />);
    expect(await screen.findByText(/read-only access/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish approved/i })).not.toBeInTheDocument();
  });

  it.each([
    ['an empty claim set', []],
    [
      'an all-rejected claim set',
      [{ ...pendingClaim, reviewState: 'rejected', approved: false }],
    ],
  ])('does not call publish for %s', async (_label, claims) => {
    api.listClaims.mockResolvedValue(claims);
    render(<GovernedContextWorkspace isAdmin />);
    const publish = await screen.findByRole('button', { name: /Publish approved claims/i });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription(/At least one approved claim is required/i);
    fireEvent.click(publish);
    expect(api.publish).not.toHaveBeenCalled();
  });

  it('publishes approved claims and reopens the exact immutable version with stale-source warning', async () => {
    api.listClaims.mockResolvedValue([{ ...pendingClaim, reviewState: 'approved', approved: true }]);
    let currentVersions: typeof version[] = [];
    api.listVersions.mockImplementation(async () => currentVersions);
    api.publish.mockImplementation(async () => {
      currentVersions = [version];
      return version;
    });
    api.getVersion.mockResolvedValue({
      ...version,
      claims: [{ ...pendingClaim, reviewState: 'approved', approved: true }],
      sourceRefs: [
        {
          claimId: 'claim-1',
          itemId: 'item-1',
          sourceType: 'attachment_extraction',
          sourceDocId: 'doc-1',
          fileHash: 'old-hash',
          docVersion: 1,
          dangling: true,
          danglingReason: 'hash_mismatch',
        },
      ],
    });
    render(<GovernedContextWorkspace isAdmin />);
    const publish = await screen.findByRole('button', { name: /Publish approved/i });
    expect(publish).toBeEnabled();
    fireEvent.click(publish);
    expect(await screen.findByText('Immutable version 1 was published.')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('deleted or changed');
    expect(screen.getAllByText('abc123')).toHaveLength(2);
  });
});
