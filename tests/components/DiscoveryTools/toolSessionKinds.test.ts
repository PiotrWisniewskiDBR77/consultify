/**
 * Odbiór 05.09 (04-narzędzia, defekt 5) — dwie reguły huba narzędzi.
 * Patrz nagłówek src/components/DiscoveryTools/toolSessionKinds.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  isMyWorkTraceToolType,
  toolShortCodeFallback,
} from '@/components/DiscoveryTools/toolSessionKinds';

describe('toolShortCodeFallback — nieznany typ nie udaje SWOT-a', () => {
  it('buduje kod z prawdziwego typu, nie z SWT', () => {
    expect(toolShortCodeFallback('MYWORK')).toBe('MYWO');
    expect(toolShortCodeFallback('MYWORK')).not.toBe('SWT');
    expect(toolShortCodeFallback('some-new-tool')).toBe('SOME');
  });

  it('dla pustego typu daje neutralne TOOL, nadal nie SWT', () => {
    expect(toolShortCodeFallback('')).toBe('TOOL');
    expect(toolShortCodeFallback(null)).toBe('TOOL');
    expect(toolShortCodeFallback(undefined)).toBe('TOOL');
  });
});

describe('isMyWorkTraceToolType — ślad z Mojej Pracy, nie sesja narzędzia', () => {
  it('rozpoznaje MYWORK niezależnie od wielkości liter i spacji', () => {
    expect(isMyWorkTraceToolType('MYWORK')).toBe(true);
    expect(isMyWorkTraceToolType('mywork')).toBe(true);
    expect(isMyWorkTraceToolType(' MyWork ')).toBe(true);
  });

  it('nie przechwytuje realnych narzędzi', () => {
    expect(isMyWorkTraceToolType('dynamic-swot')).toBe(false);
    expect(isMyWorkTraceToolType('mywork-thing')).toBe(false);
    expect(isMyWorkTraceToolType('')).toBe(false);
    expect(isMyWorkTraceToolType(null)).toBe(false);
  });
});
