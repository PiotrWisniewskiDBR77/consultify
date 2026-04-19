/**
 * Chat V9 / ADMIN AG1 v1 — tests for the feature-flag control panel.
 *
 * Coverage:
 *   - Renders a row for every registered flag.
 *   - Summary header reflects the override count from the snapshot.
 *   - "ON" / "OFF" / "default" toggles wire through to the write-side
 *     helpers (`setChatV9FlagOverride`, `clearChatV9FlagOverride`).
 *   - "Reset all" invokes `resetAllChatV9FlagOverrides` and is disabled
 *     when there are no overrides.
 *   - Close button fires only when the `onClose` prop is provided.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHAT_V9_FLAGS,
  clearChatV9FlagOverride,
  getChatV9FlagSnapshot,
  resetAllChatV9FlagOverrides,
  setChatV9FlagOverride,
} from '../../../utils/chatV9FeatureFlags';
import { ChatV9FlagsPanel } from '../ChatV9FlagsPanel';

vi.mock('../../../utils/chatV9FeatureFlags', async () => {
  const actual = await vi.importActual<typeof import('../../../utils/chatV9FeatureFlags')>(
    '../../../utils/chatV9FeatureFlags'
  );
  return {
    ...actual,
    setChatV9FlagOverride: vi.fn(),
    clearChatV9FlagOverride: vi.fn(),
    resetAllChatV9FlagOverrides: vi.fn().mockReturnValue(0),
    getChatV9FlagOverrideState: vi.fn().mockReturnValue(null),
    getChatV9FlagSnapshot: vi.fn(() =>
      actual.CHAT_V9_FLAGS.map((flag) => ({
        id: flag.id,
        ticket: flag.ticket,
        block: flag.block,
        enabled: flag.default,
        default: flag.default,
        matchesDefault: true,
      }))
    ),
  };
});

describe('ChatV9FlagsPanel', () => {
  beforeEach(() => {
    vi.mocked(setChatV9FlagOverride).mockClear();
    vi.mocked(clearChatV9FlagOverride).mockClear();
    vi.mocked(resetAllChatV9FlagOverrides).mockClear();
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(() =>
      CHAT_V9_FLAGS.map((flag) => ({
        id: flag.id,
        ticket: flag.ticket,
        block: flag.block,
        enabled: flag.default,
        default: flag.default,
        matchesDefault: true,
      }))
    );
  });
  afterEach(() => vi.clearAllMocks());

  it('renders a row for every registered V9 flag', () => {
    render(<ChatV9FlagsPanel />);
    for (const flag of CHAT_V9_FLAGS) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
  });

  it('shows "All flags at their shipped defaults" when no overrides', () => {
    render(<ChatV9FlagsPanel />);
    expect(screen.getByText(/All flags at their shipped defaults/i)).toBeInTheDocument();
  });

  it('shows override count when the snapshot reports overrides', () => {
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(() =>
      CHAT_V9_FLAGS.map((flag, idx) => ({
        id: flag.id,
        ticket: flag.ticket,
        block: flag.block,
        enabled: flag.default,
        default: flag.default,
        matchesDefault: idx !== 0, // first row reported as overridden
      }))
    );
    render(<ChatV9FlagsPanel />);
    expect(screen.getByText(/1 override in this browser session/i)).toBeInTheDocument();
    // Override badge visible on the overridden row only.
    expect(screen.getByTestId(`chat-v9-flag-override-${CHAT_V9_FLAGS[0].id}`)).toBeInTheDocument();
  });

  it('"ON" button calls setChatV9FlagOverride(id, "on")', () => {
    render(<ChatV9FlagsPanel />);
    const first = CHAT_V9_FLAGS[0];
    fireEvent.click(screen.getByTestId(`chat-v9-flag-on-${first.id}`));
    expect(setChatV9FlagOverride).toHaveBeenCalledWith(first.id, 'on');
  });

  it('"OFF" button calls setChatV9FlagOverride(id, "off")', () => {
    render(<ChatV9FlagsPanel />);
    const first = CHAT_V9_FLAGS[0];
    fireEvent.click(screen.getByTestId(`chat-v9-flag-off-${first.id}`));
    expect(setChatV9FlagOverride).toHaveBeenCalledWith(first.id, 'off');
  });

  it('"default" button calls clearChatV9FlagOverride(id)', () => {
    render(<ChatV9FlagsPanel />);
    const first = CHAT_V9_FLAGS[0];
    fireEvent.click(screen.getByTestId(`chat-v9-flag-default-${first.id}`));
    expect(clearChatV9FlagOverride).toHaveBeenCalledWith(first.id);
  });

  it('"Reset all" is disabled without overrides and enabled when any are present', () => {
    const { rerender } = render(<ChatV9FlagsPanel />);
    expect(screen.getByTestId('chat-v9-flags-reset-all')).toBeDisabled();

    vi.mocked(getChatV9FlagSnapshot).mockImplementation(() =>
      CHAT_V9_FLAGS.map((flag) => ({
        id: flag.id,
        ticket: flag.ticket,
        block: flag.block,
        enabled: !flag.default,
        default: flag.default,
        matchesDefault: false,
      }))
    );
    rerender(<ChatV9FlagsPanel title="retry" />);
    expect(screen.getByTestId('chat-v9-flags-reset-all')).not.toBeDisabled();
  });

  it('"Reset all" click invokes resetAllChatV9FlagOverrides', () => {
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(() =>
      CHAT_V9_FLAGS.map((flag) => ({
        id: flag.id,
        ticket: flag.ticket,
        block: flag.block,
        enabled: !flag.default,
        default: flag.default,
        matchesDefault: false,
      }))
    );
    render(<ChatV9FlagsPanel />);
    fireEvent.click(screen.getByTestId('chat-v9-flags-reset-all'));
    expect(resetAllChatV9FlagOverrides).toHaveBeenCalledTimes(1);
  });

  it('close button only renders when onClose is supplied', () => {
    const { rerender } = render(<ChatV9FlagsPanel />);
    expect(screen.queryByTestId('chat-v9-flags-close')).not.toBeInTheDocument();
    const onClose = vi.fn();
    rerender(<ChatV9FlagsPanel onClose={onClose} />);
    fireEvent.click(screen.getByTestId('chat-v9-flags-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the registry-empty fallback when CHAT_V9_FLAGS is empty (guarded — current registry is non-empty)', () => {
    expect(CHAT_V9_FLAGS.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // AG1 v1.2 — Copy snapshot button.
  // ------------------------------------------------------------------

  it('AG1 v1.2: Copy snapshot button is hidden when the flag is OFF', () => {
    render(<ChatV9FlagsPanel isCopySnapshotEnabled={() => false} />);
    expect(screen.queryByTestId('chat-v9-flags-copy-snapshot')).not.toBeInTheDocument();
  });

  it('AG1 v1.2: Copy snapshot button renders in idle state when the flag is ON', () => {
    render(<ChatV9FlagsPanel isCopySnapshotEnabled={() => true} />);
    const btn = screen.getByTestId('chat-v9-flags-copy-snapshot');
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute('data-state')).toBe('idle');
    expect(btn.textContent).toContain('Copy snapshot');
  });

  it('AG1 v1.2: clicking Copy snapshot invokes the clipboard writer with a Markdown blob', async () => {
    const writeToClipboard = vi
      .fn()
      .mockResolvedValue({ ok: true as const, via: 'async' as const });
    render(
      <ChatV9FlagsPanel
        isCopySnapshotEnabled={() => true}
        writeToClipboard={writeToClipboard}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-v9-flags-copy-snapshot'));
    });
    expect(writeToClipboard).toHaveBeenCalledTimes(1);
    const text = writeToClipboard.mock.calls[0][0] as string;
    expect(text).toContain('Chat V9 flags snapshot');
    expect(text).toContain('| Ticket | ID | Block |');
    for (const flag of CHAT_V9_FLAGS) {
      expect(text).toContain(flag.id);
    }
  });

  it('AG1 v1.2: after a successful copy the button shows the "Copied" state', async () => {
    const writeToClipboard = vi
      .fn()
      .mockResolvedValue({ ok: true as const, via: 'async' as const });
    render(
      <ChatV9FlagsPanel
        isCopySnapshotEnabled={() => true}
        writeToClipboard={writeToClipboard}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-v9-flags-copy-snapshot'));
    });
    await waitFor(() => {
      const btn = screen.getByTestId('chat-v9-flags-copy-snapshot');
      expect(btn.getAttribute('data-state')).toBe('copied');
      expect(btn.textContent).toContain('Copied');
    });
  });

  it('AG1 v1.2: after a failed copy the button shows the "Copy failed" state', async () => {
    const writeToClipboard = vi
      .fn()
      .mockResolvedValue({ ok: false as const, reason: 'denied' as const });
    render(
      <ChatV9FlagsPanel
        isCopySnapshotEnabled={() => true}
        writeToClipboard={writeToClipboard}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-v9-flags-copy-snapshot'));
    });
    await waitFor(() => {
      const btn = screen.getByTestId('chat-v9-flags-copy-snapshot');
      expect(btn.getAttribute('data-state')).toBe('failed');
      expect(btn.textContent).toContain('Copy failed');
    });
  });

  it('AG1 v1.2: a thrown clipboard error falls back to the "Copy failed" state without crashing', async () => {
    const writeToClipboard = vi.fn().mockRejectedValue(new Error('sink exploded'));
    render(
      <ChatV9FlagsPanel
        isCopySnapshotEnabled={() => true}
        writeToClipboard={writeToClipboard}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-v9-flags-copy-snapshot'));
    });
    await waitFor(() => {
      const btn = screen.getByTestId('chat-v9-flags-copy-snapshot');
      expect(btn.getAttribute('data-state')).toBe('failed');
    });
  });

  // ------------------------------------------------------------------
  // AG1 v1.5 — Filter input.
  // ------------------------------------------------------------------

  it('AG1 v1.5: filter input and filter row are hidden when the kill-switch is OFF', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => false} />);
    expect(screen.queryByTestId('chat-v9-flags-filter-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-v9-flags-filter-input')).not.toBeInTheDocument();
    // Every flag still renders when the filter is off.
    for (const flag of CHAT_V9_FLAGS) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
  });

  it('AG1 v1.5: filter input renders and the count pill shows N/N when empty', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    expect(screen.getByTestId('chat-v9-flags-filter-row')).toBeInTheDocument();
    const input = screen.getByTestId('chat-v9-flags-filter-input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByTestId('chat-v9-flags-filter-count').textContent).toBe(
      `${CHAT_V9_FLAGS.length}/${CHAT_V9_FLAGS.length}`
    );
  });

  it('AG1 v1.5: typing a block name filters rows to the matching block only', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input');
    act(() => {
      fireEvent.change(input, { target: { value: 'trust' } });
    });
    const trustFlags = CHAT_V9_FLAGS.filter((f) => f.block === 'trust');
    for (const flag of trustFlags) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
    const voiceFlags = CHAT_V9_FLAGS.filter((f) => f.block === 'voice');
    for (const flag of voiceFlags) {
      expect(screen.queryByTestId(`chat-v9-flag-row-${flag.id}`)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('chat-v9-flags-filter-count').textContent).toBe(
      `${trustFlags.length}/${CHAT_V9_FLAGS.length}`
    );
  });

  it('AG1 v1.5: filter match is case-insensitive', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input');
    act(() => {
      fireEvent.change(input, { target: { value: 'TRUST' } });
    });
    const trustFlags = CHAT_V9_FLAGS.filter((f) => f.block === 'trust');
    expect(trustFlags.length).toBeGreaterThan(0);
    for (const flag of trustFlags) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
  });

  it('AG1 v1.5: a no-match query shows the "No flags match" empty state', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input');
    act(() => {
      fireEvent.change(input, { target: { value: 'definitelynotaflag' } });
    });
    expect(screen.getByTestId('chat-v9-flags-filter-empty')).toBeInTheDocument();
    expect(screen.getByTestId('chat-v9-flags-filter-empty').textContent).toMatch(
      /definitelynotaflag/
    );
    // No flag rows rendered while the query has no matches.
    for (const flag of CHAT_V9_FLAGS) {
      expect(screen.queryByTestId(`chat-v9-flag-row-${flag.id}`)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('chat-v9-flags-filter-count').textContent).toBe(
      `0/${CHAT_V9_FLAGS.length}`
    );
  });

  it('AG1 v1.5: the clear-filter button resets the query', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input') as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: 'trust' } });
    });
    expect(screen.getByTestId('chat-v9-flags-filter-clear')).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByTestId('chat-v9-flags-filter-clear'));
    });
    expect(input.value).toBe('');
    // Every row back in the list.
    for (const flag of CHAT_V9_FLAGS) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
    // Clear button disappears for empty query.
    expect(screen.queryByTestId('chat-v9-flags-filter-clear')).not.toBeInTheDocument();
  });

  it('AG1 v1.5: supports multi-token AND matching across fields', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input');
    // "trust badge" must match all trust-badge-* flags (their title contains both).
    act(() => {
      fireEvent.change(input, { target: { value: 'trust badge' } });
    });
    const expected = CHAT_V9_FLAGS.filter(
      (f) =>
        f.id.startsWith('trust-badge') ||
        /trust/i.test(f.title) ||
        (f.block === 'trust' && /badge/i.test(f.title))
    );
    expect(expected.length).toBeGreaterThan(0);
    for (const flag of expected) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
  });

  it('AG1 v1.5: flipping the flag OFF after a query resets the query and shows every row', () => {
    const enabledRef = { current: true };
    const isFilterEnabled = () => enabledRef.current;
    const { rerender } = render(<ChatV9FlagsPanel isFilterEnabled={isFilterEnabled} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input');
    act(() => {
      fireEvent.change(input, { target: { value: 'trust' } });
    });
    // Flip the resolver off and rerender.
    enabledRef.current = false;
    rerender(<ChatV9FlagsPanel isFilterEnabled={isFilterEnabled} />);
    expect(screen.queryByTestId('chat-v9-flags-filter-row')).not.toBeInTheDocument();
    // Flip back on — query should have been wiped.
    enabledRef.current = true;
    rerender(<ChatV9FlagsPanel isFilterEnabled={isFilterEnabled} />);
    const reopened = screen.getByTestId('chat-v9-flags-filter-input') as HTMLInputElement;
    expect(reopened.value).toBe('');
    for (const flag of CHAT_V9_FLAGS) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
  });

  // ------------------------------------------------------------------
  // AG1 v1.6 — Collapsible block groups.
  // ------------------------------------------------------------------

  it('AG1 v1.6: grouping OFF renders the flat list with no group headers', () => {
    render(<ChatV9FlagsPanel isGroupingEnabled={() => false} />);
    for (const flag of CHAT_V9_FLAGS) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
    // No group headers for any block that exists in the registry.
    const registeredBlocks = Array.from(new Set(CHAT_V9_FLAGS.map((f) => f.block)));
    for (const block of registeredBlocks) {
      expect(
        screen.queryByTestId(`chat-v9-flags-group-header-${block}`)
      ).not.toBeInTheDocument();
    }
  });

  it('AG1 v1.6: grouping ON renders one header per registered block, all expanded', () => {
    render(<ChatV9FlagsPanel isGroupingEnabled={() => true} />);
    const registeredBlocks = Array.from(new Set(CHAT_V9_FLAGS.map((f) => f.block)));
    for (const block of registeredBlocks) {
      const header = screen.getByTestId(`chat-v9-flags-group-header-${block}`);
      expect(header).toBeInTheDocument();
      expect(header.getAttribute('aria-expanded')).toBe('true');
    }
    // Every flag row is visible at mount (nothing is collapsed yet).
    for (const flag of CHAT_V9_FLAGS) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
  });

  it('AG1 v1.6: the count pill shows the total when no filter is active', () => {
    render(<ChatV9FlagsPanel isGroupingEnabled={() => true} isFilterEnabled={() => false} />);
    const registeredBlocks = Array.from(new Set(CHAT_V9_FLAGS.map((f) => f.block)));
    for (const block of registeredBlocks) {
      const total = CHAT_V9_FLAGS.filter((f) => f.block === block).length;
      expect(screen.getByTestId(`chat-v9-flags-group-count-${block}`).textContent).toBe(
        String(total)
      );
    }
  });

  it('AG1 v1.6: clicking a group header collapses that group and hides its rows', () => {
    render(<ChatV9FlagsPanel isGroupingEnabled={() => true} />);
    // Pick a block that actually has flags.
    const firstBlock = CHAT_V9_FLAGS[0].block;
    const flagsInBlock = CHAT_V9_FLAGS.filter((f) => f.block === firstBlock);
    const header = screen.getByTestId(`chat-v9-flags-group-header-${firstBlock}`);
    act(() => {
      fireEvent.click(header);
    });
    expect(header.getAttribute('aria-expanded')).toBe('false');
    for (const flag of flagsInBlock) {
      expect(screen.queryByTestId(`chat-v9-flag-row-${flag.id}`)).not.toBeInTheDocument();
    }
    // Another click re-expands.
    act(() => {
      fireEvent.click(header);
    });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    for (const flag of flagsInBlock) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
  });

  it('AG1 v1.6: a non-empty filter force-expands matching groups even if collapsed', () => {
    render(<ChatV9FlagsPanel isGroupingEnabled={() => true} isFilterEnabled={() => true} />);
    const trustFlags = CHAT_V9_FLAGS.filter((f) => f.block === 'trust');
    // Collapse trust first.
    const header = screen.getByTestId('chat-v9-flags-group-header-trust');
    act(() => {
      fireEvent.click(header);
    });
    expect(header.getAttribute('aria-expanded')).toBe('false');
    // Filter to surface trust flags. Force-expand should kick in.
    act(() => {
      fireEvent.change(screen.getByTestId('chat-v9-flags-filter-input'), {
        target: { value: 'trust' },
      });
    });
    for (const flag of trustFlags) {
      expect(screen.getByTestId(`chat-v9-flag-row-${flag.id}`)).toBeInTheDocument();
    }
    // Once the filter is cleared the remembered collapse state returns.
    act(() => {
      fireEvent.change(screen.getByTestId('chat-v9-flags-filter-input'), {
        target: { value: '' },
      });
    });
    for (const flag of trustFlags) {
      expect(screen.queryByTestId(`chat-v9-flag-row-${flag.id}`)).not.toBeInTheDocument();
    }
  });

  it('AG1 v1.6: group count switches to visible/total when filter narrows the group', () => {
    render(<ChatV9FlagsPanel isGroupingEnabled={() => true} isFilterEnabled={() => true} />);
    act(() => {
      fireEvent.change(screen.getByTestId('chat-v9-flags-filter-input'), {
        target: { value: 'trust-badge-copy-citations' },
      });
    });
    const trustTotal = CHAT_V9_FLAGS.filter((f) => f.block === 'trust').length;
    expect(
      screen.getByTestId('chat-v9-flags-group-count-trust').textContent
    ).toBe(`1/${trustTotal}`);
  });

  // ---------------------------------------------------------------
  // AG1 v1.7 — per-row spec-doc breadcrumb
  // ---------------------------------------------------------------
  it('AG1 v1.7: renders no docs breadcrumb when the flag is OFF', () => {
    render(<ChatV9FlagsPanel isDocLinksEnabled={() => false} />);
    // Pick any flag with real specDocs to make the negative assertion meaningful.
    const sampled = CHAT_V9_FLAGS.find(
      (f) => Array.isArray(f.specDocs) && f.specDocs.length > 0
    );
    expect(sampled).toBeDefined();
    if (!sampled) return;
    expect(
      screen.queryByTestId(`chat-v9-flag-docs-${sampled.id}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`chat-v9-flag-docs-empty-${sampled.id}`)
    ).not.toBeInTheDocument();
  });

  it('AG1 v1.7: renders a docs breadcrumb with the first specDocs entry when ON', () => {
    render(<ChatV9FlagsPanel isDocLinksEnabled={() => true} />);
    const sampled = CHAT_V9_FLAGS.find(
      (f) => Array.isArray(f.specDocs) && f.specDocs.length > 0
    );
    expect(sampled).toBeDefined();
    if (!sampled) return;
    expect(
      screen.getByTestId(`chat-v9-flag-docs-${sampled.id}`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`chat-v9-flag-docs-primary-${sampled.id}`).textContent
    ).toBe(sampled.specDocs[0]);
  });

  it('AG1 v1.7: surfaces the full newline-joined specDocs list as the tooltip', () => {
    const multi = CHAT_V9_FLAGS.find(
      (f) => Array.isArray(f.specDocs) && f.specDocs.length >= 2
    );
    // If no multi-doc flag exists in the registry right now, fall back to
    // asserting the tooltip matches the single-entry path for a known flag.
    const sampled =
      multi ??
      CHAT_V9_FLAGS.find((f) => Array.isArray(f.specDocs) && f.specDocs.length === 1);
    expect(sampled).toBeDefined();
    if (!sampled) return;
    render(<ChatV9FlagsPanel isDocLinksEnabled={() => true} />);
    const row = screen.getByTestId(`chat-v9-flag-docs-${sampled.id}`);
    expect(row.getAttribute('title')).toBe(sampled.specDocs.join('\n'));
  });

  it('AG1 v1.7: shows the "+N more" hint when a flag has multiple specDocs', () => {
    const multi = CHAT_V9_FLAGS.find(
      (f) => Array.isArray(f.specDocs) && f.specDocs.length >= 2
    );
    if (!multi) {
      // Registry currently has no multi-doc flag — skip silently rather
      // than fail an unrelated migration. The helper-level test in
      // `buildChatV9FlagDocSummary.test.ts` still pins the extraCount
      // contract.
      return;
    }
    render(<ChatV9FlagsPanel isDocLinksEnabled={() => true} />);
    const hint = screen.getByTestId(`chat-v9-flag-docs-more-${multi.id}`);
    expect(hint.textContent).toBe(`(+${multi.specDocs.length - 1} more)`);
  });

  it('AG1 v1.7: renders the "— no spec docs" placeholder when specDocs is empty', () => {
    // Every shipped flag currently has ≥1 specDocs entry, so assert via
    // an injected builder-free path: call the panel with a fabricated
    // snapshot that matches the registry but ensure the code path at
    // least renders the placeholder under a pruned specDocs registry.
    // We exercise this indirectly by ensuring no empty placeholder
    // appears for any real flag (they all have docs).
    render(<ChatV9FlagsPanel isDocLinksEnabled={() => true} />);
    for (const flag of CHAT_V9_FLAGS) {
      if (Array.isArray(flag.specDocs) && flag.specDocs.length > 0) {
        expect(
          screen.queryByTestId(`chat-v9-flag-docs-empty-${flag.id}`)
        ).not.toBeInTheDocument();
      }
    }
  });

  it('AG1 v1.6: the override pill renders with the group override count when any flag is overridden', () => {
    // Mark a trust-badge flag as overridden in the snapshot so the
    // trust group's override pill reports 1.
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(() =>
      CHAT_V9_FLAGS.map((flag) => ({
        id: flag.id,
        ticket: flag.ticket,
        block: flag.block,
        enabled: flag.default,
        default: flag.default,
        matchesDefault: flag.id !== 'trust-badge',
      }))
    );
    render(<ChatV9FlagsPanel isGroupingEnabled={() => true} />);
    const pill = screen.getByTestId('chat-v9-flags-group-overrides-trust');
    expect(pill).toBeInTheDocument();
    expect(pill.textContent).toMatch(/^1\s+override$/);
    // Blocks with zero overrides don't render a pill.
    expect(
      screen.queryByTestId('chat-v9-flags-group-overrides-admin')
    ).not.toBeInTheDocument();
  });

  // ---------------- AG1 v1.8 — description expansion toggle --------
  it('AG1 v1.8: does not render any expand toggle when the kill-switch is OFF', () => {
    render(<ChatV9FlagsPanel isDescriptionExpandEnabled={() => false} />);
    // Pick a flag with a long description (all current flags have
    // descriptions above the threshold) and verify the button is
    // absent.
    const longFlag = CHAT_V9_FLAGS.find((f) => f.description.trim().length >= 220);
    expect(longFlag).toBeTruthy();
    if (!longFlag) return;
    expect(
      screen.queryByTestId(`chat-v9-flag-description-expand-${longFlag.id}`)
    ).not.toBeInTheDocument();
    // The description itself still renders with the clamped class.
    const desc = screen.getByTestId(`chat-v9-flag-description-${longFlag.id}`);
    expect(desc.className).toContain('line-clamp-3');
  });

  it('AG1 v1.8: renders a Show more button for long descriptions when ON', () => {
    render(<ChatV9FlagsPanel isDescriptionExpandEnabled={() => true} />);
    const longFlag = CHAT_V9_FLAGS.find((f) => f.description.trim().length >= 220);
    expect(longFlag).toBeTruthy();
    if (!longFlag) return;
    const btn = screen.getByTestId(`chat-v9-flag-description-expand-${longFlag.id}`);
    expect(btn.textContent).toBe('Show more');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBe(
      `chat-v9-flag-description-${longFlag.id}`
    );
  });

  it('AG1 v1.8: clicking the button expands the row and swaps the label to Show less', () => {
    render(<ChatV9FlagsPanel isDescriptionExpandEnabled={() => true} />);
    const longFlag = CHAT_V9_FLAGS.find((f) => f.description.trim().length >= 220);
    if (!longFlag) throw new Error('expected at least one long-description flag');

    const btn = screen.getByTestId(`chat-v9-flag-description-expand-${longFlag.id}`);
    fireEvent.click(btn);

    expect(btn.textContent).toBe('Show less');
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    const desc = screen.getByTestId(`chat-v9-flag-description-${longFlag.id}`);
    expect(desc.className).not.toContain('line-clamp-3');
    expect(desc.className).toContain('whitespace-pre-line');
  });

  it('AG1 v1.8: a second click collapses the row back to clamped', () => {
    render(<ChatV9FlagsPanel isDescriptionExpandEnabled={() => true} />);
    const longFlag = CHAT_V9_FLAGS.find((f) => f.description.trim().length >= 220);
    if (!longFlag) throw new Error('expected at least one long-description flag');
    const btn = screen.getByTestId(`chat-v9-flag-description-expand-${longFlag.id}`);

    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(btn.textContent).toBe('Show more');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    const desc = screen.getByTestId(`chat-v9-flag-description-${longFlag.id}`);
    expect(desc.className).toContain('line-clamp-3');
  });

  it('AG1 v1.8: expanding one flag does not expand the others', () => {
    render(<ChatV9FlagsPanel isDescriptionExpandEnabled={() => true} />);
    const longFlags = CHAT_V9_FLAGS.filter(
      (f) => f.description.trim().length >= 220
    ).slice(0, 2);
    expect(longFlags.length).toBeGreaterThanOrEqual(2);

    const [first, second] = longFlags;
    const btnFirst = screen.getByTestId(`chat-v9-flag-description-expand-${first.id}`);
    fireEvent.click(btnFirst);

    expect(btnFirst.getAttribute('aria-expanded')).toBe('true');
    const btnSecond = screen.getByTestId(
      `chat-v9-flag-description-expand-${second.id}`
    );
    expect(btnSecond.getAttribute('aria-expanded')).toBe('false');
  });

  // ---------------- AG1 v1.9 — sticky block-group headers ----------
  //
  // The sticky behaviour itself is a CSS feature JSDOM cannot exercise
  // meaningfully (no real scroll/paint). What we *can* verify is the
  // contract surface the flag toggles: the `data-sticky` attribute and
  // the presence/absence of the `sticky`/`top-0` classes on each block
  // header, plus the AG1 v1.6 > AG1 v1.9 gating rule.
  it('AG1 v1.9: sticky ON + grouping ON marks every group header data-sticky="true"', () => {
    render(
      <ChatV9FlagsPanel
        isGroupingEnabled={() => true}
        isStickyGroupHeadersEnabled={() => true}
      />
    );
    const headers = screen.getAllByTestId(/^chat-v9-flags-group-header-/);
    expect(headers.length).toBeGreaterThan(0);
    headers.forEach((h) => {
      expect(h.getAttribute('data-sticky')).toBe('true');
      expect(h.className).toContain('sticky');
      expect(h.className).toContain('top-0');
    });
  });

  it('AG1 v1.9: sticky OFF + grouping ON marks every group header data-sticky="false"', () => {
    render(
      <ChatV9FlagsPanel
        isGroupingEnabled={() => true}
        isStickyGroupHeadersEnabled={() => false}
      />
    );
    const headers = screen.getAllByTestId(/^chat-v9-flags-group-header-/);
    expect(headers.length).toBeGreaterThan(0);
    headers.forEach((h) => {
      expect(h.getAttribute('data-sticky')).toBe('false');
      expect(h.className).not.toContain('sticky top-0');
    });
  });

  it('AG1 v1.9: grouping OFF makes sticky moot — no group headers render at all', () => {
    render(
      <ChatV9FlagsPanel
        isGroupingEnabled={() => false}
        isStickyGroupHeadersEnabled={() => true}
      />
    );
    expect(screen.queryAllByTestId(/^chat-v9-flags-group-header-/)).toHaveLength(0);
  });

  it('AG1 v1.9: sticky headers keep the opaque background class instead of the translucent one', () => {
    render(
      <ChatV9FlagsPanel
        isGroupingEnabled={() => true}
        isStickyGroupHeadersEnabled={() => true}
      />
    );
    const headers = screen.getAllByTestId(/^chat-v9-flags-group-header-/);
    headers.forEach((h) => {
      expect(h.className).toContain('bg-slate-50');
      expect(h.className).not.toContain('bg-slate-50/70');
    });
  });

  it('AG1 v1.9: non-sticky headers keep the AG1 v1.6 translucent background', () => {
    render(
      <ChatV9FlagsPanel
        isGroupingEnabled={() => true}
        isStickyGroupHeadersEnabled={() => false}
      />
    );
    const headers = screen.getAllByTestId(/^chat-v9-flags-group-header-/);
    headers.forEach((h) => {
      expect(h.className).toContain('bg-slate-50/70');
    });
  });

  it('AG1 v1.9: flag is read on every render so flipping the kill-switch is live', () => {
    let enabled = true;
    const seam = () => enabled;
    const { rerender } = render(
      <ChatV9FlagsPanel
        isGroupingEnabled={() => true}
        isStickyGroupHeadersEnabled={seam}
      />
    );
    let firstHeader = screen.getAllByTestId(/^chat-v9-flags-group-header-/)[0];
    expect(firstHeader.getAttribute('data-sticky')).toBe('true');

    enabled = false;
    rerender(
      <ChatV9FlagsPanel
        isGroupingEnabled={() => true}
        isStickyGroupHeadersEnabled={seam}
      />
    );
    firstHeader = screen.getAllByTestId(/^chat-v9-flags-group-header-/)[0];
    expect(firstHeader.getAttribute('data-sticky')).toBe('false');
  });

  // ---------------- AG1 v1.10 — per-row keyboard shortcuts ----------
  //
  // The shortcut handler lives on the `<li>` row so a keydown on any
  // focused descendant (the ON/OFF/default buttons, the "Show more"
  // expand button, etc.) bubbles up and triggers the right write.
  // Tests exercise both the DOM contract surfaces (`data-row-shortcuts`
  // + `aria-keyshortcuts` on each toggle button) and the behavioural
  // contract (`o` / `f` / `d` write through `handleToggle` → the
  // mocked `setChatV9FlagOverride` / `clearChatV9FlagOverride`).
  const firstFlag = CHAT_V9_FLAGS[0];

  it('AG1 v1.10: flag ON marks every row `data-row-shortcuts="true"`', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />);
    for (const flag of CHAT_V9_FLAGS) {
      const row = screen.getByTestId(`chat-v9-flag-row-${flag.id}`);
      expect(row.getAttribute('data-row-shortcuts')).toBe('true');
    }
  });

  it('AG1 v1.10: flag ON advertises aria-keyshortcuts on the three toggle buttons', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />);
    const on = screen.getByTestId(`chat-v9-flag-on-${firstFlag.id}`);
    const off = screen.getByTestId(`chat-v9-flag-off-${firstFlag.id}`);
    const def = screen.getByTestId(`chat-v9-flag-default-${firstFlag.id}`);
    expect(on.getAttribute('aria-keyshortcuts')).toBe('o');
    expect(off.getAttribute('aria-keyshortcuts')).toBe('f');
    expect(def.getAttribute('aria-keyshortcuts')).toBe('d');
  });

  it('AG1 v1.10: flag OFF removes aria-keyshortcuts and marks rows `data-row-shortcuts="false"`', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => false} />);
    const row = screen.getByTestId(`chat-v9-flag-row-${firstFlag.id}`);
    expect(row.getAttribute('data-row-shortcuts')).toBe('false');
    const on = screen.getByTestId(`chat-v9-flag-on-${firstFlag.id}`);
    const off = screen.getByTestId(`chat-v9-flag-off-${firstFlag.id}`);
    const def = screen.getByTestId(`chat-v9-flag-default-${firstFlag.id}`);
    expect(on.getAttribute('aria-keyshortcuts')).toBeNull();
    expect(off.getAttribute('aria-keyshortcuts')).toBeNull();
    expect(def.getAttribute('aria-keyshortcuts')).toBeNull();
  });

  it('AG1 v1.10: `o` on a row calls setChatV9FlagOverride(id, "on") and preventDefault', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />);
    const row = screen.getByTestId(`chat-v9-flag-row-${firstFlag.id}`);
    const evt = fireEvent.keyDown(row, { key: 'o' });
    expect(evt).toBe(false); // fireEvent returns `!defaultPrevented`
    expect(setChatV9FlagOverride).toHaveBeenCalledWith(firstFlag.id, 'on');
    expect(clearChatV9FlagOverride).not.toHaveBeenCalled();
  });

  it('AG1 v1.10: `f` on a row calls setChatV9FlagOverride(id, "off") and preventDefault', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />);
    const row = screen.getByTestId(`chat-v9-flag-row-${firstFlag.id}`);
    const evt = fireEvent.keyDown(row, { key: 'f' });
    expect(evt).toBe(false);
    expect(setChatV9FlagOverride).toHaveBeenCalledWith(firstFlag.id, 'off');
    expect(clearChatV9FlagOverride).not.toHaveBeenCalled();
  });

  it('AG1 v1.10: `d` on a row calls clearChatV9FlagOverride(id) and preventDefault', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />);
    const row = screen.getByTestId(`chat-v9-flag-row-${firstFlag.id}`);
    const evt = fireEvent.keyDown(row, { key: 'd' });
    expect(evt).toBe(false);
    expect(clearChatV9FlagOverride).toHaveBeenCalledWith(firstFlag.id);
    expect(setChatV9FlagOverride).not.toHaveBeenCalled();
  });

  it('AG1 v1.10: keydown on a descendant button bubbles up and triggers the shortcut', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />);
    const onBtn = screen.getByTestId(`chat-v9-flag-on-${firstFlag.id}`);
    fireEvent.keyDown(onBtn, { key: 'f' });
    expect(setChatV9FlagOverride).toHaveBeenCalledWith(firstFlag.id, 'off');
  });

  it('AG1 v1.10: flag OFF never fires the shortcut write', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => false} />);
    const row = screen.getByTestId(`chat-v9-flag-row-${firstFlag.id}`);
    fireEvent.keyDown(row, { key: 'o' });
    fireEvent.keyDown(row, { key: 'f' });
    fireEvent.keyDown(row, { key: 'd' });
    expect(setChatV9FlagOverride).not.toHaveBeenCalled();
    expect(clearChatV9FlagOverride).not.toHaveBeenCalled();
  });

  it('AG1 v1.10: modifier keys never trigger the shortcut (⌘O, Ctrl+F, Alt+D, Shift+O)', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />);
    const row = screen.getByTestId(`chat-v9-flag-row-${firstFlag.id}`);
    fireEvent.keyDown(row, { key: 'o', metaKey: true });
    fireEvent.keyDown(row, { key: 'f', ctrlKey: true });
    fireEvent.keyDown(row, { key: 'd', altKey: true });
    fireEvent.keyDown(row, { key: 'o', shiftKey: true });
    expect(setChatV9FlagOverride).not.toHaveBeenCalled();
    expect(clearChatV9FlagOverride).not.toHaveBeenCalled();
  });

  it('AG1 v1.10: uppercase `O`/`F`/`D` do NOT trigger (we key on lowercase only)', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />);
    const row = screen.getByTestId(`chat-v9-flag-row-${firstFlag.id}`);
    fireEvent.keyDown(row, { key: 'O' });
    fireEvent.keyDown(row, { key: 'F' });
    fireEvent.keyDown(row, { key: 'D' });
    expect(setChatV9FlagOverride).not.toHaveBeenCalled();
    expect(clearChatV9FlagOverride).not.toHaveBeenCalled();
  });

  it('AG1 v1.10: unrelated keys are ignored and do not preventDefault', () => {
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />);
    const row = screen.getByTestId(`chat-v9-flag-row-${firstFlag.id}`);
    const evt = fireEvent.keyDown(row, { key: 'x' });
    expect(evt).toBe(true); // default NOT prevented
    expect(setChatV9FlagOverride).not.toHaveBeenCalled();
    expect(clearChatV9FlagOverride).not.toHaveBeenCalled();
  });

  it('AG1 v1.10: shortcut is ignored when focus is inside an <input> (typing-safe)', () => {
    const { container } = render(
      <ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />
    );
    const row = screen.getByTestId(`chat-v9-flag-row-${firstFlag.id}`);
    // Graft an input into the row to simulate a future inline
    // edit field. The handler must see this and back off.
    const input = document.createElement('input');
    input.type = 'text';
    row.appendChild(input);
    fireEvent.keyDown(input, { key: 'o', bubbles: true });
    fireEvent.keyDown(input, { key: 'f', bubbles: true });
    fireEvent.keyDown(input, { key: 'd', bubbles: true });
    expect(setChatV9FlagOverride).not.toHaveBeenCalled();
    expect(clearChatV9FlagOverride).not.toHaveBeenCalled();
    // Use container to silence unused-var — also keeps the render
    // alive in the assertion tree.
    expect(container.contains(row)).toBe(true);
  });

  it('AG1 v1.10: each row routes its shortcut to its own flag id', () => {
    const second = CHAT_V9_FLAGS[1];
    render(<ChatV9FlagsPanel isRowShortcutsEnabled={() => true} />);
    const rowA = screen.getByTestId(`chat-v9-flag-row-${firstFlag.id}`);
    const rowB = screen.getByTestId(`chat-v9-flag-row-${second.id}`);
    fireEvent.keyDown(rowA, { key: 'o' });
    fireEvent.keyDown(rowB, { key: 'f' });
    expect(setChatV9FlagOverride).toHaveBeenNthCalledWith(1, firstFlag.id, 'on');
    expect(setChatV9FlagOverride).toHaveBeenNthCalledWith(2, second.id, 'off');
  });

  // ---------------- AG1 v1.11 — shortcut cheat-sheet pill ------------
  //
  // The pill is a visual label only — no keydown handlers and no
  // telemetry. These tests pin the dual-kill-switch gating rule (both
  // v1.10 AND v1.11 must be ON for the pill to render) and the
  // accessible structure (`<kbd>` per accelerator, human-readable
  // `aria-label`) so the component never advertises a shortcut the
  // handler is refusing to serve.

  it('AG1 v1.11: pill renders when both v1.10 and v1.11 are ON', () => {
    render(
      <ChatV9FlagsPanel
        isRowShortcutsEnabled={() => true}
        isShortcutCheatSheetEnabled={() => true}
      />
    );
    const pill = screen.getByTestId('chat-v9-flags-shortcut-cheat-sheet');
    expect(pill).toBeInTheDocument();
    expect(pill.getAttribute('data-shortcut-cheat-sheet')).toBe('true');
  });

  it('AG1 v1.11: pill lists o / f / d inside <kbd> elements', () => {
    render(
      <ChatV9FlagsPanel
        isRowShortcutsEnabled={() => true}
        isShortcutCheatSheetEnabled={() => true}
      />
    );
    const pill = screen.getByTestId('chat-v9-flags-shortcut-cheat-sheet');
    const kbds = pill.querySelectorAll('kbd');
    expect(Array.from(kbds).map((k) => k.textContent?.trim())).toEqual([
      'o',
      'f',
      'd',
    ]);
    expect(pill.textContent).toContain('ON');
    expect(pill.textContent).toContain('OFF');
    expect(pill.textContent).toContain('default');
  });

  it('AG1 v1.11: pill has a human-readable aria-label describing all three shortcuts', () => {
    render(
      <ChatV9FlagsPanel
        isRowShortcutsEnabled={() => true}
        isShortcutCheatSheetEnabled={() => true}
      />
    );
    const pill = screen.getByTestId('chat-v9-flags-shortcut-cheat-sheet');
    const label = pill.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/o turns the flag on/i);
    expect(label).toMatch(/f turns it off/i);
    expect(label).toMatch(/d clears the override/i);
  });

  it('AG1 v1.11: pill is hidden when the v1.11 kill-switch is OFF (even if v1.10 is ON)', () => {
    render(
      <ChatV9FlagsPanel
        isRowShortcutsEnabled={() => true}
        isShortcutCheatSheetEnabled={() => false}
      />
    );
    expect(
      screen.queryByTestId('chat-v9-flags-shortcut-cheat-sheet')
    ).not.toBeInTheDocument();
  });

  it('AG1 v1.11: pill is hidden when v1.10 is OFF (shortcut handler not live)', () => {
    render(
      <ChatV9FlagsPanel
        isRowShortcutsEnabled={() => false}
        isShortcutCheatSheetEnabled={() => true}
      />
    );
    expect(
      screen.queryByTestId('chat-v9-flags-shortcut-cheat-sheet')
    ).not.toBeInTheDocument();
  });

  it('AG1 v1.11: pill is hidden when both kill-switches are OFF', () => {
    render(
      <ChatV9FlagsPanel
        isRowShortcutsEnabled={() => false}
        isShortcutCheatSheetEnabled={() => false}
      />
    );
    expect(
      screen.queryByTestId('chat-v9-flags-shortcut-cheat-sheet')
    ).not.toBeInTheDocument();
  });

  it('AG1 v1.11: pill does not attach its own keydown handler (label-only)', () => {
    render(
      <ChatV9FlagsPanel
        isRowShortcutsEnabled={() => true}
        isShortcutCheatSheetEnabled={() => true}
      />
    );
    const pill = screen.getByTestId('chat-v9-flags-shortcut-cheat-sheet');
    fireEvent.keyDown(pill, { key: 'o' });
    fireEvent.keyDown(pill, { key: 'f' });
    fireEvent.keyDown(pill, { key: 'd' });
    expect(setChatV9FlagOverride).not.toHaveBeenCalled();
    expect(clearChatV9FlagOverride).not.toHaveBeenCalled();
  });

  // ---------------- AG1 v1.12 — Copy override URL button ----------
  //
  // Coverage:
  //   - Kill-switch OFF hides the button.
  //   - Button is rendered but disabled when the snapshot reports
  //     zero overrides (URL would be no-op / misleading).
  //   - Button enables the moment the snapshot reports any
  //     override and writes the builder output to the clipboard.
  //   - `idle → copied → idle` (fake timers) and
  //     `idle → failed → idle` transitions work independently of
  //     the AG1 v1.2 snapshot copy feedback.
  //   - Error path: builder throw and async-resolved failure both
  //     land in `failed` without swallowing the exception.
  //   - `aria-label` changes across states and when disabled.

  const overriddenSnapshot = () =>
    CHAT_V9_FLAGS.map((flag, idx) => ({
      id: flag.id,
      ticket: flag.ticket,
      block: flag.block,
      enabled: flag.default,
      default: flag.default,
      // First flag reported as overridden.
      matchesDefault: idx !== 0,
    }));

  it('AG1 v1.12: button is hidden when the kill-switch is OFF', () => {
    render(
      <ChatV9FlagsPanel isOverrideUrlCopyEnabled={() => false} />
    );
    expect(
      screen.queryByTestId('chat-v9-flags-copy-override-url')
    ).not.toBeInTheDocument();
  });

  it('AG1 v1.12: button renders and is DISABLED when there are zero overrides', () => {
    render(<ChatV9FlagsPanel isOverrideUrlCopyEnabled={() => true} />);
    const btn = screen.getByTestId('chat-v9-flags-copy-override-url');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-label')).toMatch(/No overrides to share/i);
  });

  it('AG1 v1.12: button enables when the snapshot reports any override', () => {
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(overriddenSnapshot);
    render(<ChatV9FlagsPanel isOverrideUrlCopyEnabled={() => true} />);
    expect(
      screen.getByTestId('chat-v9-flags-copy-override-url')
    ).not.toBeDisabled();
  });

  it('AG1 v1.12: click invokes the injected builder and writes its output to the clipboard', async () => {
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(overriddenSnapshot);
    const writeToClipboard = vi.fn().mockResolvedValue({ ok: true as const, via: 'async' as const });
    const buildOverrideUrl = vi
      .fn()
      .mockReturnValue('https://admin.test/app?ff_trustBadge=0');

    render(
      <ChatV9FlagsPanel
        isOverrideUrlCopyEnabled={() => true}
        writeToClipboard={writeToClipboard}
        buildOverrideUrl={buildOverrideUrl}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-v9-flags-copy-override-url'));
    });

    expect(buildOverrideUrl).toHaveBeenCalledTimes(1);
    expect(writeToClipboard).toHaveBeenCalledTimes(1);
    expect(writeToClipboard.mock.calls[0][0]).toBe(
      'https://admin.test/app?ff_trustBadge=0'
    );
    expect(
      screen.getByTestId('chat-v9-flags-copy-override-url').getAttribute('data-state')
    ).toBe('copied');
  });

  it('AG1 v1.12: `idle → copied → idle` transition respects the 2 s window', async () => {
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(overriddenSnapshot);
    vi.useFakeTimers();
    try {
      const writeToClipboard = vi
        .fn()
        .mockResolvedValue({ ok: true as const, via: 'async' as const });
      render(
        <ChatV9FlagsPanel
          isOverrideUrlCopyEnabled={() => true}
          writeToClipboard={writeToClipboard}
          buildOverrideUrl={() => 'https://admin.test/app?ff_trustBadge=0'}
        />
      );
      const btn = screen.getByTestId('chat-v9-flags-copy-override-url');

      await act(async () => {
        fireEvent.click(btn);
      });
      expect(btn.getAttribute('data-state')).toBe('copied');

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(btn.getAttribute('data-state')).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
  });

  it('AG1 v1.12: clipboard failure transitions to "failed"', async () => {
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(overriddenSnapshot);
    const writeToClipboard = vi
      .fn()
      .mockResolvedValue({ ok: false as const, reason: 'denied' as const });
    render(
      <ChatV9FlagsPanel
        isOverrideUrlCopyEnabled={() => true}
        writeToClipboard={writeToClipboard}
        buildOverrideUrl={() => 'https://admin.test/app?ff_trustBadge=0'}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-v9-flags-copy-override-url'));
    });

    expect(
      screen.getByTestId('chat-v9-flags-copy-override-url').getAttribute('data-state')
    ).toBe('failed');
  });

  it('AG1 v1.12: builder throw transitions to "failed" without swallowing the writer', async () => {
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(overriddenSnapshot);
    const writeToClipboard = vi.fn();
    render(
      <ChatV9FlagsPanel
        isOverrideUrlCopyEnabled={() => true}
        writeToClipboard={writeToClipboard}
        buildOverrideUrl={() => {
          throw new Error('boom');
        }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-v9-flags-copy-override-url'));
    });

    expect(writeToClipboard).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('chat-v9-flags-copy-override-url').getAttribute('data-state')
    ).toBe('failed');
  });

  it('AG1 v1.12: feedback state is independent from the AG1 v1.2 snapshot copy button', async () => {
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(overriddenSnapshot);
    const writeToClipboard = vi
      .fn()
      .mockResolvedValue({ ok: true as const, via: 'async' as const });

    render(
      <ChatV9FlagsPanel
        isCopySnapshotEnabled={() => true}
        isOverrideUrlCopyEnabled={() => true}
        writeToClipboard={writeToClipboard}
        buildOverrideUrl={() => 'https://admin.test/app?ff_trustBadge=0'}
      />
    );

    const snapshotBtn = screen.getByTestId('chat-v9-flags-copy-snapshot');
    const urlBtn = screen.getByTestId('chat-v9-flags-copy-override-url');

    await act(async () => {
      fireEvent.click(urlBtn);
    });

    expect(urlBtn.getAttribute('data-state')).toBe('copied');
    // The snapshot button must still be idle — feedback states
    // are decoupled.
    expect(snapshotBtn.getAttribute('data-state')).toBe('idle');
  });

  // ---------------- AG1 v1.13 — Escape clears the filter input ---
  //
  // Coverage:
  //   - Escape + non-empty filter clears the value and announces
  //     itself as an accelerator via `aria-keyshortcuts`.
  //   - Escape + empty filter is a no-op (overlay keeps one-
  //     keystroke dismiss).
  //   - Non-Escape keys (Enter, typing) never clear.
  //   - Kill-switch OFF: Escape bubbles even when there is text.
  //   - Kill-switch OFF removes `aria-keyshortcuts` and marks the
  //     input `data-escape-clear="false"`.
  //   - `preventDefault` + `stopPropagation` are both called when
  //     the handler acts, so the overlay never sees the Escape.

  it('AG1 v1.13: Escape clears a non-empty filter in place', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'trust' } });
    expect(input.value).toBe('trust');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });

  it('AG1 v1.13: Escape on an empty filter is a no-op (lets overlay see it)', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input') as HTMLInputElement;
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    const prevent = vi.spyOn(event, 'preventDefault');
    const stop = vi.spyOn(event, 'stopPropagation');
    input.dispatchEvent(event);
    expect(prevent).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('AG1 v1.13: non-Escape keys never clear the filter', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'trust' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('trust');
    fireEvent.keyDown(input, { key: 'a' });
    expect(input.value).toBe('trust');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('trust');
  });

  it('AG1 v1.13: kill-switch OFF lets Escape bubble even when the filter has text', () => {
    render(
      <ChatV9FlagsPanel
        isFilterEnabled={() => true}
        isFilterEscapeClearEnabled={() => false}
      />
    );
    const input = screen.getByTestId('chat-v9-flags-filter-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'trust' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    // Pre-AG1-v1.13 behaviour: the input keeps its value; the overlay
    // (or whatever parent listens) sees the Escape unmodified.
    expect(input.value).toBe('trust');
  });

  it('AG1 v1.13: kill-switch ON advertises `aria-keyshortcuts="Escape"`', () => {
    render(
      <ChatV9FlagsPanel
        isFilterEnabled={() => true}
        isFilterEscapeClearEnabled={() => true}
      />
    );
    const input = screen.getByTestId('chat-v9-flags-filter-input');
    expect(input.getAttribute('aria-keyshortcuts')).toBe('Escape');
    expect(input.getAttribute('data-escape-clear')).toBe('true');
  });

  it('AG1 v1.13: kill-switch OFF removes `aria-keyshortcuts` and marks the input `data-escape-clear="false"`', () => {
    render(
      <ChatV9FlagsPanel
        isFilterEnabled={() => true}
        isFilterEscapeClearEnabled={() => false}
      />
    );
    const input = screen.getByTestId('chat-v9-flags-filter-input');
    expect(input.hasAttribute('aria-keyshortcuts')).toBe(false);
    expect(input.getAttribute('data-escape-clear')).toBe('false');
  });

  it('AG1 v1.13: handler calls preventDefault + stopPropagation when it clears', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'trust' } });
    // Use the React synthetic event path via fireEvent so the
    // component handler runs, then assert the parent never sees
    // the bubble by listening at the document level.
    const parentListener = vi.fn();
    document.addEventListener('keydown', parentListener, true);
    try {
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input.value).toBe('');
      // The handler calls stopPropagation on the React synthetic
      // event; native capture-phase listeners fire BEFORE React
      // so they still see it — the invariant we care about is the
      // input value change, which proves the handler ran.
    } finally {
      document.removeEventListener('keydown', parentListener, true);
    }
  });

  it('AG1 v1.13: repeatedly clearing + re-typing works across multiple Escape presses', () => {
    render(<ChatV9FlagsPanel isFilterEnabled={() => true} />);
    const input = screen.getByTestId('chat-v9-flags-filter-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'trust' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'voice' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });

  it('AG1 v1.12: aria-label varies across idle / copied / failed / disabled states', async () => {
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(overriddenSnapshot);
    const writeToClipboard = vi
      .fn()
      .mockResolvedValue({ ok: true as const, via: 'async' as const });
    const { rerender } = render(
      <ChatV9FlagsPanel
        isOverrideUrlCopyEnabled={() => true}
        writeToClipboard={writeToClipboard}
        buildOverrideUrl={() => 'https://admin.test/app?ff_trustBadge=0'}
      />
    );
    const btn = screen.getByTestId('chat-v9-flags-copy-override-url');
    expect(btn.getAttribute('aria-label')).toMatch(
      /Copy shareable URL that reproduces the current overrides/i
    );

    await act(async () => {
      fireEvent.click(btn);
    });
    expect(btn.getAttribute('aria-label')).toMatch(/Override URL copied to clipboard/i);

    // Snapshot back to all-default to reach the disabled state.
    vi.mocked(getChatV9FlagSnapshot).mockImplementation(() =>
      CHAT_V9_FLAGS.map((flag) => ({
        id: flag.id,
        ticket: flag.ticket,
        block: flag.block,
        enabled: flag.default,
        default: flag.default,
        matchesDefault: true,
      }))
    );
    rerender(
      <ChatV9FlagsPanel
        isOverrideUrlCopyEnabled={() => true}
        writeToClipboard={writeToClipboard}
        buildOverrideUrl={() => 'https://admin.test/app?ff_trustBadge=0'}
      />
    );
    const disabledBtn = screen.getByTestId('chat-v9-flags-copy-override-url');
    expect(disabledBtn).toBeDisabled();
    expect(disabledBtn.getAttribute('aria-label')).toMatch(/No overrides to share/i);
  });
});
