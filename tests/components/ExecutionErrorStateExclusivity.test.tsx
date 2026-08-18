/**
 * @vitest-environment jsdom
 *
 * UI-MVP-001 — Execution rollout panels: error / loading / content are
 * MUTUALLY EXCLUSIVE.
 *
 * These panels used to print a failure as a line ABOVE their content, so a
 * failed load still rendered "nothing here yet — create the first one" copy, or
 * the five wave cells, underneath it. That makes the UI assert an absence it
 * never established, which docs/UI_UX/35_EMPTY_LOADING_ERROR_STATES.md forbids
 * ("MUST NOT: Udawac sukcesu dla krytycznych operacji").
 *
 * Copy in these panels is hardcoded Polish in production (pre-existing), so the
 * assertions here are structural + Polish-literal; the EN/PL split is covered
 * where the surface is actually translated — see
 * MegatrendErrorStateExclusivity.test.tsx.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
  API_URL: '/api',
  getHeaders: () => ({}),
}));

import { BenefitsRegisterPanel } from '@/components/Execution/BenefitsRegisterPanel';
import { CutoverRunbookPanel } from '@/components/Execution/CutoverRunbookPanel';
import { RolloutBaselinePanel } from '@/components/Execution/RolloutBaselinePanel';
import { RolloutStagesPanel } from '@/components/Execution/RolloutStagesPanel';

/** A promise that never settles — holds the panel in its loading state. */
const pending = () => new Promise(() => {});

type Case = {
  name: string;
  render: () => React.ReactElement;
  /** Copy that must NOT appear while the panel is in its error state. */
  forbiddenOnError: RegExp;
  /** Marks the successful/empty render, used for the honest-empty assertion. */
  emptyMarker: RegExp;
  /** Payload that yields a legitimately empty (not failed) list. */
  emptyPayload: unknown;
};

const CASES: Case[] = [
  {
    name: 'BenefitsRegisterPanel',
    render: () => <BenefitsRegisterPanel initiativeId="i-1" />,
    forbiddenOnError: /Brak zarejestrowanych korzyści/i,
    emptyMarker: /Brak zarejestrowanych korzyści/i,
    emptyPayload: { benefits: [] },
  },
  {
    name: 'RolloutBaselinePanel',
    render: () => <RolloutBaselinePanel projectId="p-1" />,
    forbiddenOnError: /Brak zapisanych baseline/i,
    emptyMarker: /Brak zapisanych baseline/i,
    emptyPayload: { baselines: [] },
  },
  {
    name: 'RolloutStagesPanel',
    render: () => <RolloutStagesPanel projectId="p-1" />,
    // The five wave cells are content: they must not be painted over a failure.
    forbiddenOnError: /Pilot|Hypercare|Closure/i,
    emptyMarker: /Pilot/i,
    emptyPayload: { stages: [] },
  },
  {
    name: 'CutoverRunbookPanel',
    render: () => <CutoverRunbookPanel initiativeId="i-1" />,
    forbiddenOnError: /Utwórz runbook cutover/i,
    emptyMarker: /Utwórz runbook cutover/i,
    emptyPayload: { runbook: null },
  },
];

const RETRY = /Try again|Spróbuj ponownie/i;

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe.each(CASES)('$name — error/loading/content exclusivity', (c) => {
  it('on error renders the shared error state and hides content/empty copy', async () => {
    apiGet.mockRejectedValue(new Error('boom'));
    render(c.render());

    // The canonical error state: role="alert" comes from the shared EmptyState.
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByRole('button', { name: RETRY })).toBeInTheDocument();

    // ...and nothing that would imply a known, successful state.
    expect(screen.queryByText(c.forbiddenOnError)).not.toBeInTheDocument();
  });

  it('Retry issues a NEW request', async () => {
    apiGet.mockRejectedValue(new Error('boom'));
    render(c.render());

    await screen.findByRole('alert');
    const before = apiGet.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: RETRY }));

    await waitFor(() => {
      expect(apiGet.mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('while loading renders neither the error state nor content', async () => {
    apiGet.mockImplementation(pending);
    render(c.render());

    // Give the effect a tick to flip into loading.
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: RETRY })).not.toBeInTheDocument();
    expect(screen.queryByText(c.forbiddenOnError)).not.toBeInTheDocument();
  });

  it('a genuinely empty result stays honest — empty copy, no error', async () => {
    apiGet.mockResolvedValue(c.emptyPayload);
    render(c.render());

    await waitFor(() => {
      expect(screen.getByText(c.emptyMarker)).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: RETRY })).not.toBeInTheDocument();
  });
});
