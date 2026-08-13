/**
 * @vitest-environment jsdom
 *
 * P0D — AssessmentInitiativesTab reads `listInitiativeDrafts`
 * (method_initiative_drafts via method-core) — Initiative Proposal DRAFTS,
 * not Registered Initiatives (a separate, human-triggered write elsewhere).
 * Covers StandardTable rendering, current/superseded distinction, and
 * honest empty/error/forbidden states.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  listInitiativeDrafts: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return {
    ...actual,
    listInitiativeDrafts: hoisted.listInitiativeDrafts,
  };
});

import { MethodCoreApiError } from '@/method-core/api/methodCoreApi';

import { AssessmentInitiativesTab } from '../AssessmentInitiativesTab';

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    organizationId: 'org-1',
    outputId: 'out-1',
    sessionId: 'sess-1',
    title: 'Automate invoice intake',
    summary: 'Groups three findings about manual invoice handling.',
    findingIds: ['f1', 'f2', 'f3'],
    rationale: 'Manual intake is the largest time sink identified.',
    expectedOutcome: 'Reduce processing time by 40%.',
    confidence: 'high',
    status: 'current',
    supersededByOutputId: null,
    supersededAt: null,
    createdAt: '2026-08-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('AssessmentInitiativesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the kernel Initiative Drafts list via StandardTable', async () => {
    hoisted.listInitiativeDrafts.mockResolvedValue([draftRow()]);

    render(<AssessmentInitiativesTab />);

    expect(await screen.findByText('Automate invoice intake')).toBeInTheDocument();
    expect(hoisted.listInitiativeDrafts).toHaveBeenCalledWith({});
  });

  it('scopes the request to one Output when outputId is provided', async () => {
    hoisted.listInitiativeDrafts.mockResolvedValue([]);

    render(<AssessmentInitiativesTab outputId="out-1" />);

    await waitFor(() => {
      expect(hoisted.listInitiativeDrafts).toHaveBeenCalledWith({ outputId: 'out-1' });
    });
  });

  it('visually distinguishes current vs superseded drafts', async () => {
    hoisted.listInitiativeDrafts.mockResolvedValue([
      draftRow({ id: 'd-1', status: 'superseded', title: 'Old draft' }),
      draftRow({ id: 'd-2', status: 'current', title: 'New draft' }),
    ]);

    render(<AssessmentInitiativesTab />);

    await screen.findByText('Old draft');
    expect(screen.getByText('Superseded')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('selecting a row shows its rationale and expected outcome from the fetched list row', async () => {
    hoisted.listInitiativeDrafts.mockResolvedValue([draftRow()]);
    const user = userEvent.setup();

    render(<AssessmentInitiativesTab />);
    await user.click(await screen.findByText('Automate invoice intake'));

    expect(
      await screen.findByText(/Manual intake is the largest time sink identified\./)
    ).toBeInTheDocument();
  });

  it('shows an honest empty state explaining why the list is empty', async () => {
    hoisted.listInitiativeDrafts.mockResolvedValue([]);

    render(<AssessmentInitiativesTab />);

    expect(await screen.findByText('No initiative drafts yet')).toBeInTheDocument();
    expect(
      screen.getByText('Initiative Proposal Drafts grouped from findings will appear here.')
    ).toBeInTheDocument();
  });

  it('shows an error state with retry when the list fails to load', async () => {
    hoisted.listInitiativeDrafts.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();

    render(<AssessmentInitiativesTab />);

    expect(
      await screen.findByText('Failed to load initiative drafts. Please try again.')
    ).toBeInTheDocument();

    hoisted.listInitiativeDrafts.mockResolvedValueOnce([draftRow()]);
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText('Automate invoice intake')).toBeInTheDocument();
    });
  });

  it('shows a distinct "no access" state on a 401/403', async () => {
    hoisted.listInitiativeDrafts.mockRejectedValueOnce(new MethodCoreApiError('Forbidden', 403, {}));

    render(<AssessmentInitiativesTab />);

    expect(await screen.findByText('No access to Initiative Drafts')).toBeInTheDocument();
    expect(screen.queryByText('No initiative drafts yet')).not.toBeInTheDocument();
  });
});
