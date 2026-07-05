/**
 * M06 FALA3 3.4 — mindmapPptxNative flag (default OFF → legacy HTML export;
 * ON → real .pptx endpoint). See ExportPowerPoint.tsx handleExport for the
 * consumer of this flag.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isMindmapPptxNativeEnabled } from '../../../src/components/MyWork/mindmap/mindmapExportFlags';

const originalLocation = window.location;

function setSearch(search: string) {
  // jsdom's `history.replaceState` does not reliably update `window.location.search`
  // in this test environment, so stub `window.location` directly instead.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, search },
  });
}

describe('isMindmapPptxNativeEnabled (REAL)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setSearch('');
  });

  afterEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('defaults to OFF (HTML fallback) with no query/localStorage/env override', () => {
    expect(isMindmapPptxNativeEnabled()).toBe(false);
  });

  it('localStorage "on" turns the flag ON', () => {
    window.localStorage.setItem('ff.mindmap_pptx_native', 'true');
    expect(isMindmapPptxNativeEnabled()).toBe(true);
  });

  it('localStorage "off" keeps the flag OFF', () => {
    window.localStorage.setItem('ff.mindmap_pptx_native', 'false');
    expect(isMindmapPptxNativeEnabled()).toBe(false);
  });

  it('URL query param overrides localStorage', () => {
    window.localStorage.setItem('ff.mindmap_pptx_native', 'true');
    setSearch('?ff_mindmapPptxNative=off');
    expect(isMindmapPptxNativeEnabled()).toBe(false);
  });

  it('URL query param can turn it ON even without localStorage', () => {
    setSearch('?ff_mindmapPptxNative=1');
    expect(isMindmapPptxNativeEnabled()).toBe(true);
  });
});
