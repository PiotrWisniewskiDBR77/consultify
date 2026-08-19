import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listClaims: vi.fn(),
  listVersions: vi.fn(),
  decide: vi.fn(),
  publish: vi.fn(),
  getVersion: vi.fn(),
  ingestDocument: vi.fn(),
  resolveLatest: vi.fn(),
}));
const translate = (_key: string, fallback: string | Record<string, unknown>) =>
  typeof fallback === 'string'
    ? fallback
    : String(fallback.defaultValue ?? '').replace('{{version}}', String(fallback.version ?? ''));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
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
    localStorage.clear();
    api.listClaims.mockResolvedValue([]);
    api.listVersions.mockResolvedValue([]);
    api.resolveLatest.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
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
    expect(screen.queryByLabelText(/Upload source document/i)).not.toBeInTheDocument();
  });

  it('ingests one admin document, reloads its pending claim, and ignores a duplicate change while busy', async () => {
    let release!: (value: { success: boolean; docId: string; filename: string }) => void;
    const receipt = new Promise<{ success: boolean; docId: string; filename: string }>((resolve) => {
      release = resolve;
    });
    api.ingestDocument.mockReturnValue(receipt);
    api.listClaims.mockResolvedValueOnce([]).mockResolvedValueOnce([pendingClaim]);
    render(<GovernedContextWorkspace isAdmin />);
    await screen.findByText(/No sourced claims/i);
    const input = screen.getByLabelText(/Upload source document/i);
    const file = new File(['strategy'], 'strategy.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(input, { target: { files: [file] } });
    expect(api.ingestDocument).toHaveBeenCalledTimes(1);
    expect(api.ingestDocument.mock.calls[0]?.[0]).toBe(file);
    expect(api.ingestDocument.mock.calls[0]?.[1]).toEqual(expect.any(String));
    release({ success: true, docId: 'doc-1', filename: 'strategy.pdf' });
    expect(await screen.findByText('evidence.documentExtraction')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('pending governed claim');
  });

  it('fails closed on ingest error and retries the exact selected file without false success', async () => {
    api.ingestDocument.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      success: true,
      docId: 'doc-1',
      filename: 'strategy.pdf',
    });
    api.listClaims.mockResolvedValueOnce([]).mockResolvedValueOnce([pendingClaim]);
    render(<GovernedContextWorkspace isAdmin />);
    await screen.findByText(/No sourced claims/i);
    const file = new File(['strategy'], 'strategy.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Upload source document/i), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('No governed claim was accepted');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByText('evidence.documentExtraction')).toBeInTheDocument();
    expect(api.ingestDocument.mock.calls[1]).toEqual(api.ingestDocument.mock.calls[0]);
  });

  it('reuses the persisted upload key after a cold remount', async () => {
    api.ingestDocument.mockResolvedValue({
      success: true,
      docId: 'doc-1',
      filename: 'cold.txt',
    });
    const file = new File(['cold'], 'cold.txt', {
      type: 'text/plain',
      lastModified: 12345,
    });
    const first = render(<GovernedContextWorkspace isAdmin />);
    await screen.findByText(/No sourced claims/i);
    fireEvent.change(screen.getByLabelText(/Upload source document/i), {
      target: { files: [file] },
    });
    await waitFor(() => expect(api.ingestDocument).toHaveBeenCalledTimes(1));
    const firstKey = api.ingestDocument.mock.calls[0]?.[1];
    first.unmount();

    render(<GovernedContextWorkspace isAdmin />);
    await screen.findByText(/No sourced claims/i);
    fireEvent.change(screen.getByLabelText(/Upload source document/i), {
      target: { files: [file] },
    });
    await waitFor(() => expect(api.ingestDocument).toHaveBeenCalledTimes(2));
    expect(api.ingestDocument.mock.calls[1]?.[1]).toBe(firstKey);
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
    expect(screen.getByTestId('selected-governed-ref')).toHaveTextContent('snapshot-1 · v1 · abc123');
  });

  it('shows visible sources and conflicts without exposing server-filtered restricted rows', async () => {
    api.listClaims.mockResolvedValue([
      { ...pendingClaim, visibilityScope: 'organization' },
      { ...pendingClaim, claimId: 'claim-2', itemId: 'item-2', value: { summary: 'Different' }, visibilityScope: 'organization' },
    ]);
    render(<GovernedContextWorkspace isAdmin={false} />);
    expect(await screen.findByRole('heading', { name: 'Sources (2)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conflicts (1)' })).toBeInTheDocument();
    expect(screen.getByText(/Restricted sources and claims are omitted/i)).toBeInTheDocument();
    expect(screen.getAllByText('attachment_extraction')).toHaveLength(2);
  });

  it('does not announce publish success until exact canonical readback matches', async () => {
    api.listClaims.mockResolvedValue([{ ...pendingClaim, reviewState: 'approved', approved: true }]);
    api.publish.mockResolvedValue(version);
    api.getVersion.mockResolvedValue({ ...version, snapshotId: 'different', claims: [], sourceRefs: [] });
    render(<GovernedContextWorkspace isAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: /Publish approved/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('governed state changed');
    expect(screen.queryByText(/Immutable version 1 was published/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('selected-governed-ref')).not.toBeInTheDocument();
  });

  it('resolves latest once, reopens it exactly, and pins all three immutable fields', async () => {
    api.listVersions.mockResolvedValue([version]);
    api.resolveLatest.mockResolvedValue({ snapshotId: 'snapshot-1', version: 1, contentHash: 'abc123' });
    api.getVersion.mockResolvedValue({ ...version, claims: [], sourceRefs: [] });
    render(<GovernedContextWorkspace isAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: /Select latest now/i }));
    expect(await screen.findByTestId('selected-governed-ref')).toHaveTextContent('snapshot-1 · v1 · abc123');
    expect(api.resolveLatest).toHaveBeenCalledTimes(1);
    expect(api.getVersion).toHaveBeenCalledWith(1);
  });

  it('fails closed when latest readback does not match and renders a typed conflict', async () => {
    api.listVersions.mockResolvedValue([version]);
    api.resolveLatest.mockResolvedValue({ snapshotId: 'snapshot-1', version: 1, contentHash: 'abc123' });
    api.getVersion.mockResolvedValue({ ...version, contentHash: 'changed', claims: [], sourceRefs: [] });
    render(<GovernedContextWorkspace isAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: /Select latest now/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('governed state changed');
    expect(screen.queryByTestId('selected-governed-ref')).not.toBeInTheDocument();
    expect(screen.queryByText(/pinned to this exact/i)).not.toBeInTheDocument();
  });

  it('cold reopens an explicit version and surfaces permission denial', async () => {
    api.listVersions.mockResolvedValue([version]);
    api.getVersion.mockRejectedValue(Object.assign(new Error('forbidden'), { status: 403 }));
    render(<GovernedContextWorkspace isAdmin={false} />);
    fireEvent.click(await screen.findByRole('button', { name: /Open exact version/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
    expect(screen.queryByTestId('selected-governed-ref')).not.toBeInTheDocument();
  });
});
