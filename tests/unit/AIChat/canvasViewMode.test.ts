/**
 * Guards the view-mode persistence fix: the default is 'rich', the key is
 * versioned to .v2 so a legacy 'workCanvas.viewMode' value does NOT stick a user
 * on raw markdown, and genuine v2 choices are respected.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  VIEW_MODE_STORAGE_KEY,
  getInitialCanvasMode,
  persistCanvasMode,
} from '@/components/AIChat/CanvasEditor/canvasViewMode';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('getInitialCanvasMode', () => {
  it("defaults to 'rich' when nothing is stored", () => {
    expect(getInitialCanvasMode()).toBe('rich');
  });

  it('ignores a legacy pre-v2 stored value (one-time reset to rich)', () => {
    // Old key from before the rich-editor overhaul.
    window.localStorage.setItem('workCanvas.viewMode', 'md');
    expect(getInitialCanvasMode()).toBe('rich');
  });

  it('respects an explicit v2 choice', () => {
    persistCanvasMode('md');
    expect(window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)).toBe('md');
    expect(getInitialCanvasMode()).toBe('md');

    persistCanvasMode('document');
    expect(getInitialCanvasMode()).toBe('document');

    persistCanvasMode('rich');
    expect(getInitialCanvasMode()).toBe('rich');
  });
});
