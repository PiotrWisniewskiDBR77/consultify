/**
 * @vitest-environment node
 *
 * Unit tests for `buildTabeleTopBarChips` (EPIC-T16 D4).
 *
 * Coverage:
 *   * Returns the documented MELS chip order.
 *   * Confidentiality dot tone reflects supplied state.
 *   * Governance dot tone reflects supplied verdict.
 *   * Missing handlers render disabled chips (lane gating).
 *   * Run chip is `kind: 'primary'` and respects `runEnabled=false`.
 *   * Agent chip is a toggle and reflects `agentOpen`.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  MELS_CHIP_ORDER,
} from '../../../../shared/ExecutiveModuleShell/ChipDescriptor';
import { buildTabeleTopBarChips } from '../TabeleTopBarChips';

describe('buildTabeleTopBarChips', () => {
  it('returns chips in the documented MELS order', () => {
    const chips = buildTabeleTopBarChips({
      handlers: {
        onConfidentiality: vi.fn(),
        onTheme: vi.fn(),
        onHistory: vi.fn(),
        onQa: vi.fn(),
        onGovernance: vi.fn(),
        onAnalytics: vi.fn(),
        onAudit: vi.fn(),
        onShare: vi.fn(),
        onToggleAgent: vi.fn(),
        onRun: vi.fn(),
      },
    });
    expect(chips.map((c) => c.id)).toEqual([...MELS_CHIP_ORDER]);
  });

  it('confidentiality dot tone tracks supplied state', () => {
    const chips = buildTabeleTopBarChips({
      handlers: { onConfidentiality: vi.fn() },
      state: { confidentiality: 'confidential' },
    });
    const internalChip = chips.find((c) => c.id === 'internal');
    expect(internalChip?.dotTone).toBe('danger');

    const chips2 = buildTabeleTopBarChips({
      handlers: { onConfidentiality: vi.fn() },
      state: { confidentiality: 'public' },
    });
    expect(chips2.find((c) => c.id === 'internal')?.dotTone).toBe('success');
  });

  it('governance dot tone tracks the verdict', () => {
    const chipsPass = buildTabeleTopBarChips({
      handlers: { onGovernance: vi.fn() },
      state: { governanceVerdict: 'PASS' },
    });
    expect(chipsPass.find((c) => c.id === 'governance')?.dotTone).toBe('success');

    const chipsBlocked = buildTabeleTopBarChips({
      handlers: { onGovernance: vi.fn() },
      state: { governanceVerdict: 'BLOCKED_P0' },
    });
    expect(chipsBlocked.find((c) => c.id === 'governance')?.dotTone).toBe('danger');
  });

  it('missing handler renders the chip as disabled', () => {
    const chips = buildTabeleTopBarChips({
      handlers: { onRun: vi.fn() },
    });
    const theme = chips.find((c) => c.id === 'theme');
    expect(theme?.disabled).toBe(true);
    const run = chips.find((c) => c.id === 'run');
    expect(run?.disabled).toBe(false);
  });

  it('Run chip is primary and respects runEnabled=false', () => {
    const chips = buildTabeleTopBarChips({
      handlers: { onRun: vi.fn() },
      state: { runEnabled: false },
    });
    const run = chips.find((c) => c.id === 'run');
    expect(run?.kind).toBe('primary');
    expect(run?.disabled).toBe(true);
  });

  it('Agent chip toggles based on state.agentOpen', () => {
    const chipsClosed = buildTabeleTopBarChips({
      handlers: { onToggleAgent: vi.fn() },
      state: { agentOpen: false },
    });
    expect(chipsClosed.find((c) => c.id === 'agent')?.kind).toBe('toggle');
    expect(chipsClosed.find((c) => c.id === 'agent')?.active).toBe(false);

    const chipsOpen = buildTabeleTopBarChips({
      handlers: { onToggleAgent: vi.fn() },
      state: { agentOpen: true },
    });
    expect(chipsOpen.find((c) => c.id === 'agent')?.active).toBe(true);
  });

  it('Analytics is disabled when analyticsEnabled=false', () => {
    const chips = buildTabeleTopBarChips({
      handlers: { onAnalytics: vi.fn() },
      state: { analyticsEnabled: false },
    });
    expect(chips.find((c) => c.id === 'analytics')?.disabled).toBe(true);
  });

  it('honours custom labels', () => {
    const chips = buildTabeleTopBarChips({
      handlers: { onShare: vi.fn() },
      labels: { share: 'Udostępnij' },
    });
    expect(chips.find((c) => c.id === 'share')?.label).toBe('Udostępnij');
  });
});
