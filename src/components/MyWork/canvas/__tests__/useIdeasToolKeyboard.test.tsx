/**
 * @vitest-environment jsdom
 *
 * G4-KBD-P0 — F-K1 (Process Flow + Whiteboard instance) regression coverage.
 *
 * Before this fix, `useCanvasKeyboard` fell back to `document` whenever no
 * `containerRef` was supplied — true for BOTH real call sites
 * (IdeaProcessFlowTool.tsx, IdeaWhiteboardTool.tsx) — with only an
 * input/textarea/select/contentEditable exclusion. Buttons, links and tabs
 * (exactly what a keyboard user tabs between) were not excluded, so a plain
 * Tab press anywhere on the page — while either tool was merely `open`, not
 * even focused — got `preventDefault()`-ed and routed into "add child/step".
 */
import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCanvasKeyboard } from '../useIdeasToolKeyboard';

function dispatchTab(target: EventTarget, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useCanvasKeyboard — F-K1 (containerRef scoping)', () => {
  it('does NOT call onAddChild, and does NOT preventDefault, when Tab is pressed outside the canvas container (global-hijack regression)', () => {
    const containerRef = createRef<HTMLDivElement>();
    const container = document.createElement('div');
    document.body.appendChild(container);
    // Mutable on purpose: `createRef()` yields a writable RefObject here, so no
    // `@ts-expect-error` is needed — adding one makes tsc fail with TS2578.
    containerRef.current = container;

    // Somewhere ELSE on the page, e.g. a nav link the user is genuinely
    // tabbing through — NOT a descendant of the canvas container.
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    const onAddChild = vi.fn();
    renderHook(() =>
      useCanvasKeyboard({
        toolType: 'processflow',
        enabled: true,
        callbacks: { onAddChild },
        containerRef,
      })
    );

    const event = dispatchTab(elsewhere);
    expect(onAddChild).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('DOES call onAddChild when Tab is pressed with focus genuinely inside the canvas container', () => {
    const containerRef = createRef<HTMLDivElement>();
    const container = document.createElement('div');
    container.tabIndex = -1;
    document.body.appendChild(container);
    // Mutable on purpose: `createRef()` yields a writable RefObject here, so no
    // `@ts-expect-error` is needed — adding one makes tsc fail with TS2578.
    containerRef.current = container;
    const nodeEl = document.createElement('div');
    nodeEl.tabIndex = 0;
    container.appendChild(nodeEl);
    nodeEl.focus();

    const onAddChild = vi.fn();
    renderHook(() =>
      useCanvasKeyboard({
        toolType: 'processflow',
        enabled: true,
        callbacks: { onAddChild },
        containerRef,
      })
    );

    const event = dispatchTab(nodeEl);
    expect(onAddChild).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('still ignores Shift+Tab for onAddChild even when the canvas has focus (pre-existing, unrelated to F-K1)', () => {
    const containerRef = createRef<HTMLDivElement>();
    const container = document.createElement('div');
    container.tabIndex = -1;
    document.body.appendChild(container);
    // Mutable on purpose: `createRef()` yields a writable RefObject here, so no
    // `@ts-expect-error` is needed — adding one makes tsc fail with TS2578.
    containerRef.current = container;
    container.focus();

    const onAddChild = vi.fn();
    renderHook(() =>
      useCanvasKeyboard({
        toolType: 'processflow',
        enabled: true,
        callbacks: { onAddChild },
        containerRef,
      })
    );

    dispatchTab(container, { shiftKey: true });
    expect(onAddChild).not.toHaveBeenCalled();
  });

  it('self-corrects once the container mounts AFTER the hook has already run once (loading-skeleton race)', () => {
    // Simulates Process Flow/Whiteboard's "loading ? skeleton : real canvas"
    // branch — the ref starts out null while the tool is `open` but still
    // hydrating.
    const containerRef = createRef<HTMLDivElement>();
    const onAddChild = vi.fn();

    renderHook(() =>
      useCanvasKeyboard({
        toolType: 'whiteboard',
        enabled: true,
        callbacks: { onAddChild },
        containerRef,
      })
    );

    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    // While still "loading" (ref null), Tab must not fire onAddChild — and
    // must not hijack focus navigation either.
    let event = dispatchTab(elsewhere);
    expect(onAddChild).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);

    // Canvas finishes loading; container mounts.
    const container = document.createElement('div');
    container.tabIndex = -1;
    document.body.appendChild(container);
    // Mutable on purpose: `createRef()` yields a writable RefObject here, so no
    // `@ts-expect-error` is needed — adding one makes tsc fail with TS2578.
    containerRef.current = container;
    container.focus();

    // No re-render/re-effect needed — the SAME listener (bound once on
    // `document`) picks up the now-populated ref on the very next keydown.
    event = dispatchTab(container);
    expect(onAddChild).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps legacy global behavior when no containerRef is supplied at all (back-compat)', () => {
    const onAddChild = vi.fn();
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    renderHook(() =>
      useCanvasKeyboard({
        toolType: 'processflow',
        enabled: true,
        callbacks: { onAddChild },
        // no containerRef
      })
    );

    const event = dispatchTab(elsewhere);
    expect(onAddChild).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });
});
