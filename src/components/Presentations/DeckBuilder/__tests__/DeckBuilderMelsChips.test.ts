/**
 * @vitest-environment node
 *
 * Unit tests for `buildDeckBuilderTopBarChips` (EE / Deliverables WS-A4).
 *
 * Mirrors the Tabele chip-builder contract so the three editors expose an
 * identical, MELS-ordered top bar.
 */

import { describe, expect, it, vi } from 'vitest';

import { MELS_CHIP_ORDER } from '../../../shared/ExecutiveModuleShell/ChipDescriptor';
import { buildDeckBuilderTopBarChips } from '../DeckBuilderMelsChips';

describe('buildDeckBuilderTopBarChips', () => {
  it('returns chips in the documented MELS order', () => {
    const chips = buildDeckBuilderTopBarChips({
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
    const danger = buildDeckBuilderTopBarChips({
      handlers: { onConfidentiality: vi.fn() },
      state: { confidentiality: 'confidential' },
    });
    expect(danger.find((c) => c.id === 'internal')?.dotTone).toBe('danger');

    const success = buildDeckBuilderTopBarChips({
      handlers: { onConfidentiality: vi.fn() },
      state: { confidentiality: 'public' },
    });
    expect(success.find((c) => c.id === 'internal')?.dotTone).toBe('success');
  });

  it('governance dot tone tracks the verdict', () => {
    const pass = buildDeckBuilderTopBarChips({
      handlers: { onGovernance: vi.fn() },
      state: { governanceVerdict: 'PASS' },
    });
    expect(pass.find((c) => c.id === 'governance')?.dotTone).toBe('success');

    const blocked = buildDeckBuilderTopBarChips({
      handlers: { onGovernance: vi.fn() },
      state: { governanceVerdict: 'BLOCKED_P0' },
    });
    expect(blocked.find((c) => c.id === 'governance')?.dotTone).toBe('danger');
  });

  it('missing handler renders the chip as disabled', () => {
    const chips = buildDeckBuilderTopBarChips({ handlers: { onRun: vi.fn() } });
    expect(chips.find((c) => c.id === 'theme')?.disabled).toBe(true);
    expect(chips.find((c) => c.id === 'run')?.disabled).toBe(false);
  });

  it('Present (run) chip is primary and respects runEnabled=false', () => {
    const chips = buildDeckBuilderTopBarChips({
      handlers: { onRun: vi.fn() },
      state: { runEnabled: false },
    });
    const run = chips.find((c) => c.id === 'run');
    expect(run?.kind).toBe('primary');
    expect(run?.disabled).toBe(true);
  });

  it('Teresa (agent) chip is a toggle reflecting agentOpen', () => {
    const closed = buildDeckBuilderTopBarChips({
      handlers: { onToggleAgent: vi.fn() },
      state: { agentOpen: false },
    });
    expect(closed.find((c) => c.id === 'agent')?.kind).toBe('toggle');
    expect(closed.find((c) => c.id === 'agent')?.active).toBe(false);

    const open = buildDeckBuilderTopBarChips({
      handlers: { onToggleAgent: vi.fn() },
      state: { agentOpen: true },
    });
    expect(open.find((c) => c.id === 'agent')?.active).toBe(true);
  });

  it('honours custom labels (PL)', () => {
    const chips = buildDeckBuilderTopBarChips({
      handlers: { onRun: vi.fn() },
      labels: { run: 'Prezentuj', agent: 'Teresa' },
    });
    expect(chips.find((c) => c.id === 'run')?.label).toBe('Prezentuj');
  });
});
