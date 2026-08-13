/**
 * @vitest-environment jsdom
 *
 * G4-KBD-P0 — F-K1 (Mind Map instance) / F-K2 regression coverage.
 *
 * These are the exact pure functions IdeaRecommendationMap.tsx's keydown
 * listener calls (imported, not reimplemented) — see the "F-K1 fix" /
 * "F-K2 fix" comments around IdeaRecommendationMap.tsx's `isWithinMap` and
 * `grammarAction` computation. Mounting IdeaRecommendationMap.tsx itself in
 * a test is deliberately avoided (it is a multi-thousand-line component with
 * heavy canvas/DnD dependencies — see the precedent set by
 * `tests/components/MyWork/IdeaMapWorkspace.preferredTool-regression.test.tsx`,
 * which mocks it out entirely for exactly this reason).
 */
import { describe, expect, it } from 'vitest';

import {
  isCanvasKeyboardScope,
  resolveMindMapGrammarAction,
} from '../mindmapKeyboardScope';

function makeContainer() {
  const container = document.createElement('div');
  container.tabIndex = -1;
  document.body.appendChild(container);
  return container;
}

describe('isCanvasKeyboardScope (F-K1, Mind Map instance)', () => {
  it('is in-scope when the keydown target is inside the container', () => {
    const container = makeContainer();
    const child = document.createElement('div');
    container.appendChild(child);
    expect(isCanvasKeyboardScope(container, child, document.body)).toBe(true);
  });

  it('is in-scope when the container itself is the live activeElement (post click-focus-walk)', () => {
    const container = makeContainer();
    container.focus();
    expect(isCanvasKeyboardScope(container, document.body, document.activeElement)).toBe(true);
  });

  it('is in-scope when a descendant node is the live activeElement', () => {
    const container = makeContainer();
    const node = document.createElement('div');
    node.tabIndex = 0;
    container.appendChild(node);
    node.focus();
    expect(isCanvasKeyboardScope(container, node, document.activeElement)).toBe(true);
  });

  // F-K1: this is the exact regression. Before the fix, `isWithinMap` treated
  // `document.body`/`documentElement` as "no real focus" and therefore
  // in-scope — true EVERYWHERE on the page before anything else has been
  // focused, not just this canvas. That is what let a bare Tab keypress
  // ANYWHERE hijack focus/add a node.
  it('is OUT of scope when nothing is focused and the event target is document.body (the global-hijack case)', () => {
    const container = makeContainer();
    expect(isCanvasKeyboardScope(container, document.body, document.body)).toBe(false);
  });

  it('is OUT of scope when a completely unrelated element on the page is the target/activeElement', () => {
    const container = makeContainer();
    const somewhereElse = document.createElement('button');
    document.body.appendChild(somewhereElse);
    somewhereElse.focus();
    expect(
      isCanvasKeyboardScope(container, somewhereElse, document.activeElement)
    ).toBe(false);
  });

  it('is OUT of scope when the container has not mounted yet (null)', () => {
    expect(isCanvasKeyboardScope(null, document.body, document.body)).toBe(false);
  });
});

describe('resolveMindMapGrammarAction (F-K2)', () => {
  it('maps plain Tab to add_child', () => {
    expect(resolveMindMapGrammarAction({ key: 'Tab', shiftKey: false })).toBe('add_child');
  });

  // F-K2: the exact regression. Shift+Tab is a pure focus-navigation key and
  // must never create a node.
  it('does NOT map Shift+Tab to add_child (F-K2 regression)', () => {
    expect(resolveMindMapGrammarAction({ key: 'Tab', shiftKey: true })).toBeNull();
  });

  it('maps Enter to add_sibling', () => {
    expect(resolveMindMapGrammarAction({ key: 'Enter', shiftKey: false })).toBe('add_sibling');
  });

  it('maps unrelated keys to null', () => {
    expect(resolveMindMapGrammarAction({ key: 'a', shiftKey: false })).toBeNull();
    expect(resolveMindMapGrammarAction({ key: 'Escape', shiftKey: false })).toBeNull();
  });
});
