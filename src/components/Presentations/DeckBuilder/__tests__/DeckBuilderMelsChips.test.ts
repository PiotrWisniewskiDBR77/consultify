/**
 * @vitest-environment node
 *
 * Unit tests for `buildDeckBuilderTopBarChips` (EE / Deliverables WS-A4).
 *
 * Mirrors the Tabele chip-builder contract so the three editors expose an
 * identical, MELS-ordered top bar.
 */

import { describe, expect, it, vi } from 'vitest';

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
        onToggleComments: vi.fn(),
        onShare: vi.fn(),
        onToggleAgent: vi.fn(),
        onRun: vi.fn(),
        onRunFromStart: vi.fn(),
        onPresenter: vi.fn(),
      },
    });
    // Builder emits chips in declaration order; TopBar re-tiers them
    // (primary/secondary/overflow) at render time. `comments` and `presenter`
    // are deck-specific chips beyond the shared MELS_CHIP_ORDER canon.
    // J12-S2: `presenter` (overflow) sits between `audit` and `share`.
    expect(chips.map((c) => c.id)).toEqual([
      'internal',
      'theme',
      'history',
      'qa',
      'governance',
      'analytics',
      'audit',
      'run-from-start',
      'presenter',
      'share',
      'comments',
      'agent',
      'run',
    ]);
  });

  it('offers presentation from the beginning as an overflow action', () => {
    const onRunFromStart = vi.fn();
    const chips = buildDeckBuilderTopBarChips({ handlers: { onRunFromStart } });
    const fromStart = chips.find((chip) => chip.id === 'run-from-start');
    expect(fromStart?.group).toBe('overflow');
    expect(fromStart?.disabled).toBe(false);
    fromStart?.onClick?.();
    expect(onRunFromStart).toHaveBeenCalledTimes(1);
  });

  it('J12-S2: presenter chip is an overflow chip wired to onPresenter', () => {
    const onPresenter = vi.fn();
    const chips = buildDeckBuilderTopBarChips({ handlers: { onPresenter } });
    const presenter = chips.find((c) => c.id === 'presenter');
    expect(presenter?.group).toBe('overflow');
    expect(presenter?.disabled).toBe(false);
    presenter?.onClick?.();
    expect(onPresenter).toHaveBeenCalledTimes(1);
  });

  it('J12-S2: presenter chip is disabled when no handler / empty deck', () => {
    const noHandler = buildDeckBuilderTopBarChips({ handlers: {} });
    expect(noHandler.find((c) => c.id === 'presenter')?.disabled).toBe(true);
    const emptyDeck = buildDeckBuilderTopBarChips({
      handlers: { onPresenter: vi.fn() },
      state: { runEnabled: false },
    });
    expect(emptyDeck.find((c) => c.id === 'presenter')?.disabled).toBe(true);
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
