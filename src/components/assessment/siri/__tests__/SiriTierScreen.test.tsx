/**
 * @vitest-environment jsdom
 *
 * SiriTierScreen — screen-level wiring for CEL 9's TIER requirements
 * (S5, 2026-08-13). The formula itself is already covered by
 * `siriTierView.test.ts` (tests 6-8); this file only asserts the SEPARATE
 * SCREEN's gating and default-vs-flag display are wired correctly:
 *  - TIER niedostępny przed freeze — explicit reason shown, no run controls.
 *  - TIER bez flagi = legacy_v1.
 *  - TIER za flagą + horizon = siri_pm_v2, >=1 focus/block, all 3 blocks shown.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MethodOutputSummary } from '@/method-core/api/methodCoreApi';
import type { MethodSession } from '@/method-core/contracts';
import { SIRI_PRIORITISATION_AREAS } from '@/services/siriStructure';
import { SIRI_PM_V2_FLAG_KEYS } from '@/utils/siriPmV2Flag';

import { SiriTierScreen } from '../SiriTierScreen';

function makeSession(overrides: Partial<MethodSession> = {}): MethodSession {
  return {
    id: 'siri-tier-sess-1',
    organizationId: 'test-org-id',
    projectId: null,
    module: 'assessment',
    methodPackId: 'siri',
    methodPackVersion: '0.1.0-draft',
    state: 'active',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: 'test-user-id',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    version: 1,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
    ...overrides,
  };
}

function makeFullOutput(): MethodOutputSummary {
  const current: Record<string, number | null> = {};
  SIRI_PRIORITISATION_AREAS.forEach((area, i) => {
    current[area.id] = i % 6;
  });
  return {
    id: 'output-tier-1',
    organizationId: 'test-org-id',
    sessionId: 'siri-tier-sess-1',
    module: 'assessment',
    methodPackId: 'siri',
    methodPackVersion: '0.1.0-draft',
    outputVersion: 1,
    scope: 'full',
    current,
    target: {},
    gap: {},
    limitations: [],
    findings: [],
    contentHash: 'hash-1',
    frozenAt: '2026-08-13T02:00:00.000Z',
  };
}

beforeEach(() => {
  window.localStorage.removeItem(SIRI_PM_V2_FLAG_KEYS.localStorage);
});
afterEach(() => {
  window.localStorage.removeItem(SIRI_PM_V2_FLAG_KEYS.localStorage);
});

describe('TIER unavailable before freeze', () => {
  it('shows an explicit reason and no run controls for an active session', () => {
    render(<SiriTierScreen session={makeSession({ state: 'active' })} output={null} onExit={() => {}} />);
    expect(screen.getByTestId('siri-tier-unavailable').textContent).toMatch(/freeze|zamr/i);
    expect(screen.queryByTestId('siri-tier-run')).toBeNull();
  });
});

describe('TIER default (flag OFF) resolves to legacy_v1', () => {
  it('running TIER without touching the flag shows calculationVersion legacy_v1', async () => {
    render(
      <SiriTierScreen
        session={makeSession({ state: 'frozen', frozenSnapshotId: 'snap-1' })}
        output={makeFullOutput()}
        onExit={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('siri-tier-run'));
    await waitFor(() => {
      expect(screen.getByTestId('siri-tier-calculation-version').textContent).toBe('legacy_v1');
    });
  });
});

describe('TIER flag ON + explicit planningHorizon -> siri_pm_v2, >=1 focus per block', () => {
  it('toggling the SIRI_PM_V2 flag and running TIER shows siri_pm_v2 with all 3 blocks covered', async () => {
    render(
      <SiriTierScreen
        session={makeSession({ state: 'frozen', frozenSnapshotId: 'snap-2' })}
        output={makeFullOutput()}
        onExit={() => {}}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('siri-tier-v2-flag-toggle'));
    });
    fireEvent.change(screen.getByTestId('siri-tier-planning-horizon'), { target: { value: 'strategic' } });
    fireEvent.click(screen.getByTestId('siri-tier-run'));

    await waitFor(() => {
      expect(screen.getByTestId('siri-tier-calculation-version').textContent).toBe('siri_pm_v2');
    });

    for (const block of ['PROCESS', 'TECHNOLOGY', 'ORGANIZATION']) {
      const count = screen.getByTestId(`siri-tier-focus-count-${block}`).textContent ?? '';
      expect(count).not.toMatch(/^0 /);
    }
    expect(screen.getAllByRole('row').length).toBeGreaterThan(16); // header + 16 ranked rows
  });
});
