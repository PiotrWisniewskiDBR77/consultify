/**
 * Minimal browser primitives for jsdom-backed performance harnesses.
 *
 * These shims provide APIs that jsdom does not implement. They intentionally
 * do not mock ReactFlow, React, timers, hooks, or any measured product logic.
 */

const DEFAULT_VIEWPORT_WIDTH = 1024;
const DEFAULT_VIEWPORT_HEIGHT = 768;

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number =>
    globalThis.setTimeout(() => callback(performance.now()), 0) as unknown as number;
}

if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (handle: number): void => {
    globalThis.clearTimeout(handle);
  };
}

if (typeof HTMLElement !== 'undefined') {
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    const original = originalGetBoundingClientRect.call(this);
    if (original.width > 0 || original.height > 0) return original;

    const width = Number.parseFloat(this.style.width) || DEFAULT_VIEWPORT_WIDTH;
    const height = Number.parseFloat(this.style.height) || DEFAULT_VIEWPORT_HEIGHT;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({ x: 0, y: 0, width, height }),
    } as DOMRect;
  };
}
