/**
 * @vitest-environment jsdom
 *
 * SlashMenu — behavioral tests (M04 notebook editor, L-09).
 *
 * Covers the slash-command menu's real, exposed surface:
 *   - renders the full command list when the query is empty;
 *   - typing a query filters commands (by id / label / keyword);
 *   - empty filter → renders nothing (returns null);
 *   - closed state → renders nothing;
 *   - keyboard ArrowDown/ArrowUp wrap-around selection + Enter invokes the
 *     selected command's action through the editor chain;
 *   - Enter on an AI command routes to onAICommand instead of cmd.action;
 *   - Escape calls onClose;
 *   - mouse click invokes a command;
 *   - bilingual labels (en vs pl) via i18n.language;
 *   - detectSlashTrigger pure-function trigger detection.
 *
 * Source is read-only (Harvard 2 zone). No source edits.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- i18n mock: SlashMenu only reads i18n.language ('pl' → Polish labels) ---
let mockLanguage = 'en';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, d?: string) => d ?? _k,
    i18n: { language: mockLanguage },
  }),
}));

import {
  detectSlashTrigger,
  INITIAL_SLASH_STATE,
  SlashMenu,
  type SlashMenuState,
} from '../SlashMenu';

/**
 * Minimal Tiptap Editor stub. executeCommand calls:
 *   editor.state.selection.from
 *   editor.chain().focus().deleteRange(...).run()
 *   cmd.action(editor)  — most actions call editor.chain()... too
 * We record the chain method names so we can assert the right command ran.
 */
function makeEditorStub() {
  const chainCalls: string[] = [];
  const chain: Record<string, (...a: unknown[]) => unknown> = {};
  const chainMethods = [
    'focus',
    'deleteRange',
    'toggleHeading',
    'toggleBulletList',
    'toggleOrderedList',
    'toggleTaskList',
    'setHorizontalRule',
    'insertTable',
    'toggleCodeBlock',
    'run',
  ];
  for (const m of chainMethods) {
    chain[m] = (...args: unknown[]) => {
      chainCalls.push(args.length ? `${m}:${JSON.stringify(args[0])}` : m);
      return chain;
    };
  }
  const editor = {
    chainCalls,
    state: {
      selection: {
        from: 5,
        to: 5,
        $from: { pos: 5, parent: { textContent: '/h1', childCount: 1 } },
      },
      doc: { textBetween: () => '' },
    },
    commands: { setCallout: vi.fn(), setDetails: vi.fn() },
    chain: () => chain,
    view: { coordsAtPos: () => ({ top: 10, bottom: 20, left: 30, right: 40 }) },
  };
  return editor as unknown as Parameters<typeof SlashMenu>[0]['editor'] & { chainCalls: string[] };
}

function openState(over: Partial<SlashMenuState> = {}): SlashMenuState {
  return { ...INITIAL_SLASH_STATE, open: true, triggerPos: 2, ...over };
}

function renderMenu(opts: {
  state: SlashMenuState;
  onClose?: () => void;
  onAICommand?: (c: string) => void;
  receiptCapableActionIds?: string[];
}) {
  const editor = makeEditorStub();
  const onClose = opts.onClose ?? vi.fn();
  const onAICommand = opts.onAICommand;
  const containerRef = React.createRef<HTMLDivElement>();
  const utils = render(
    <div ref={containerRef}>
      <SlashMenu
        editor={editor}
        state={opts.state}
        onClose={onClose}
        containerRef={containerRef}
        onAICommand={onAICommand as never}
        receiptCapableActionIds={opts.receiptCapableActionIds}
      />
    </div>
  );
  return { editor, onClose, onAICommand, ...utils };
}

describe('SlashMenu', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the full command list when the query is empty', () => {
    renderMenu({ state: openState({ query: '' }) });
    // A representative spread across the command groups.
    expect(screen.getByText('Heading 1')).toBeTruthy();
    expect(screen.getByText('Bullet List')).toBeTruthy();
    expect(screen.getByText('Table')).toBeTruthy();
    expect(screen.getByText('AI: Ask')).toBeTruthy();
    expect(screen.getByText('Create Task')).toBeTruthy();
    // 23 commands total (added: Image, Quote, Date, 2 Columns) → 23 buttons.
    expect(screen.getAllByRole('menuitem')).toHaveLength(23);
  });

  it('filters commands by label/keyword when a query is typed', () => {
    renderMenu({ state: openState({ query: 'head' }) });
    expect(screen.getByText('Heading 1')).toBeTruthy();
    expect(screen.getByText('Heading 2')).toBeTruthy();
    expect(screen.getByText('Heading 3')).toBeTruthy();
    expect(screen.queryByText('Bullet List')).toBeNull();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('filters by id substring (e.g. "ai")', () => {
    renderMenu({ state: openState({ query: 'ai' }) });
    // All four ai-* commands match on id "ai-..." / keyword "ai".
    expect(screen.getByText('AI: Ask')).toBeTruthy();
    expect(screen.getByText('AI: Expand')).toBeTruthy();
    expect(screen.getByText('AI: Challenge')).toBeTruthy();
    expect(screen.getByText('AI: Next Steps')).toBeTruthy();
  });

  it('keeps unqualified durable handoffs focusable, explained and fail closed', () => {
    const dispatched = vi.fn();
    window.addEventListener('notebook-create-task', dispatched);
    renderMenu({ state: openState({ query: 'create task' }), receiptCapableActionIds: [] });
    const item = screen.getByRole('menuitem', { name: /Create Task/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    // FIX-1/FIX-7 (Day 3 acceptance): the reason is now a real i18n key
    // (t('notebook.slashMenu.receiptUnavailable', '<polish fallback>')),
    // PL-led per this codebase's convention — this file's simplified mock
    // (`(_k, d) => d ?? _k`) returns that fallback regardless of
    // `mockLanguage`, since it does not do real per-key JSON resolution.
    // Real i18next resolves this correctly per-language via
    // public/locales/{pl,en}/translation.json.
    expect(item).toHaveAccessibleDescription(/trwałego potwierdzenia/);
    fireEvent.mouseDown(item);
    expect(dispatched).not.toHaveBeenCalled();
    window.removeEventListener('notebook-create-task', dispatched);
  });

  it('renders nothing when no command matches the query', () => {
    const { container } = renderMenu({ state: openState({ query: 'zzzznomatch' }) });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('.absolute')).toBeNull();
  });

  it('renders nothing when the menu is closed', () => {
    renderMenu({ state: { ...INITIAL_SLASH_STATE, open: false } });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('Enter invokes the first (selected) command via the editor chain', () => {
    const onClose = vi.fn();
    const { editor } = renderMenu({ state: openState({ query: 'head', triggerPos: 2 }), onClose });
    // selectedIdx starts at 0 → Heading 1 → toggleHeading({level:1}).
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(editor.chainCalls).toContain('deleteRange:{"from":2,"to":5}');
    expect(editor.chainCalls).toContain('toggleHeading:{"level":1}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ArrowDown then Enter selects the next command', () => {
    const { editor } = renderMenu({ state: openState({ query: 'head' }) });
    fireEvent.keyDown(document, { key: 'ArrowDown' }); // → Heading 2
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(editor.chainCalls).toContain('toggleHeading:{"level":2}');
  });

  it('ArrowUp wraps around to the last command', () => {
    const { editor } = renderMenu({ state: openState({ query: 'head' }) });
    // 3 items, idx 0 → ArrowUp wraps to idx 2 (Heading 3).
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(editor.chainCalls).toContain('toggleHeading:{"level":3}');
  });

  it('Enter on an AI command routes to onAICommand, not cmd.action', () => {
    const onAICommand = vi.fn();
    const onClose = vi.fn();
    // query "ai-ask" → only the AI: Ask command, idx 0.
    renderMenu({ state: openState({ query: 'ai-ask' }), onAICommand, onClose });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onAICommand).toHaveBeenCalledTimes(1);
    expect(onAICommand).toHaveBeenCalledWith('ask');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape calls onClose without running a command', () => {
    const onClose = vi.fn();
    const { editor } = renderMenu({ state: openState({ query: '' }), onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // No command executed → no deleteRange in the chain.
    expect(editor.chainCalls.some((c) => c.startsWith('deleteRange'))).toBe(false);
  });

  it('mouseDown on a command button invokes it', () => {
    const onClose = vi.fn();
    const { editor } = renderMenu({ state: openState({ query: 'bullet' }), onClose });
    fireEvent.mouseDown(screen.getByText('Bullet List'));
    expect(editor.chainCalls).toContain('toggleBulletList');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders Polish labels when i18n.language is pl', () => {
    mockLanguage = 'pl';
    renderMenu({ state: openState({ query: '' }) });
    expect(screen.getByText('Nagłówek 1')).toBeTruthy();
    expect(screen.getByText('Lista punktowana')).toBeTruthy();
    expect(screen.getByText('AI: Zapytaj')).toBeTruthy();
    expect(screen.queryByText('Heading 1')).toBeNull();
  });
});

describe('detectSlashTrigger', () => {
  function editorWithTextBefore(textBefore: string, opts: { throwCoords?: boolean } = {}) {
    return {
      state: {
        selection: {
          $from: {
            parent: { textContent: textBefore },
            parentOffset: textBefore.length,
            pos: textBefore.length,
          },
        },
      },
      view: {
        coordsAtPos: opts.throwCoords
          ? () => {
              throw new Error('no coords');
            }
          : () => ({ top: 10, bottom: 20, left: 30, right: 40 }),
      },
    } as unknown as Parameters<typeof detectSlashTrigger>[0];
  }

  it('returns an open state with the query when a slash trigger precedes the cursor', () => {
    const result = detectSlashTrigger(editorWithTextBefore('hello /head'));
    expect(result).not.toBeNull();
    expect(result!.open).toBe(true);
    expect(result!.query).toBe('head');
    // triggerPos = pos - matchLength ('/head' = 5 chars), pos = 11.
    expect(result!.triggerPos).toBe(6);
  });

  it('returns an empty query for a bare slash', () => {
    const result = detectSlashTrigger(editorWithTextBefore('/'));
    expect(result).not.toBeNull();
    expect(result!.query).toBe('');
  });

  it('returns null when there is no slash before the cursor', () => {
    expect(detectSlashTrigger(editorWithTextBefore('just text'))).toBeNull();
  });

  it('returns null when the slash is followed by a space (not an active trigger)', () => {
    expect(detectSlashTrigger(editorWithTextBefore('/head '))).toBeNull();
  });

  it('returns null when coordsAtPos throws', () => {
    expect(detectSlashTrigger(editorWithTextBefore('/x', { throwCoords: true }))).toBeNull();
  });
});
