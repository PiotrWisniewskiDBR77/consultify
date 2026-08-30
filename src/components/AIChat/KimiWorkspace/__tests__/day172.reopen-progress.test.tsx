/** @vitest-environment jsdom */

import { writeFileSync } from 'node:fs';

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  patch: vi.fn(),
  get: vi.fn(),
}));

vi.mock('@/services/api', () => ({ Api: apiMocks }));
vi.mock('@/services/api/v8/planning', () => ({
  V8PlanningApi: {
    getInitiative: vi.fn(async () => ({ id: 'initiative-172', status: 'PENDING_REVIEW' })),
    getGateReadiness: vi.fn(async () => ({ availableTransitions: [], readiness: [] })),
    getStatusHistory: vi.fn(async () => []),
    getHistory: vi.fn(async () => []),
  },
}));
vi.mock('@/store/useInitiativeRefreshStore', () => ({ bumpInitiativeRefresh: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : _key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: unknown) => unknown) =>
    selector({ setDisplayMode: () => undefined, setWorkspaceContext: () => undefined }),
}));

import { updateInitiativeStatusWriteTruth } from '@/services/initiativeWriteTruth';

import { type KimiLane, KimiWorkspaceShell, type TaskStep } from '../KimiWorkspaceShell';

const ARTIFACT = '/private/tmp/cx-day172-ekrany-nieprawda-artefakty/day172-reopen-dom.html';
const persistedSteps: TaskStep[] = [
  { id: 'plan', label: 'plan', status: 'completed' },
  { id: 'generate', label: 'generate', status: 'completed' },
];
const rendered: string[] = [];

afterEach(() => cleanup());

function renderReopen(lane: KimiLane, showProgressCount: boolean) {
  const view = render(
    <KimiWorkspaceShell
      lane={lane}
      taskSteps={lane === 'excele' ? persistedSteps : []}
      totalSteps={lane === 'excele' ? 2 : 8}
      completedSteps={lane === 'excele' ? 2 : 0}
      showProgressCount={showProgressCount}
      isGenerating={false}
      isCompleted
      preview={{
        type: lane === 'excele' ? 'xlsx' : lane === 'tabele' ? 'tabele' : 'deck',
        title: `${lane} reopen`,
      }}
    />
  );
  rendered.push(`<section data-lane="${lane}">${view.container.innerHTML}</section>`);
  writeFileSync(ARTIFACT, rendered.join('\n'), 'utf8');
}

describe('Day 172 truthful reopen progress headers', () => {
  it('Excele renders completed together with the persisted 2/2 step count', () => {
    renderReopen('excele', true);
    expect(screen.getByText('Task completed')).toBeTruthy();
    expect(screen.getByText('2/2')).toBeTruthy();
  });

  it('Tabele renders completed without inventing a 0/8 count', () => {
    renderReopen('tabele', false);
    expect(screen.getByText('Task completed')).toBeTruthy();
    expect(screen.queryByText('0/8')).toBeNull();
  });

  it('Prezentacje renders completed without inventing a 0/8 count', () => {
    renderReopen('prezentacje', false);
    expect(screen.getByText('Task completed')).toBeTruthy();
    expect(screen.queryByText('0/8')).toBeNull();
  });
});

describe('Day 172 initiative status client', () => {
  it('calls the governed PATCH before returning cold readback truth', async () => {
    apiMocks.patch.mockResolvedValueOnce({ status: 'PENDING_REVIEW' });
    const truth = await updateInitiativeStatusWriteTruth(
      'initiative-172',
      'PENDING_REVIEW',
      'measured override'
    );
    expect(apiMocks.patch).toHaveBeenCalledWith('/initiatives/initiative-172/status', {
      status: 'PENDING_REVIEW',
      overrideReason: 'measured override',
    });
    expect(truth.initiative).toMatchObject({ id: 'initiative-172', status: 'PENDING_REVIEW' });
  });
});
