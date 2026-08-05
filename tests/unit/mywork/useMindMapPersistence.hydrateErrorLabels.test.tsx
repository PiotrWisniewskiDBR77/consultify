/**
 * M02-P11 regression test — Mind Map hydrate-failure fallback labels.
 *
 * Found via manual dev-render evidence capture (?tool=mindmap&state=error):
 * when `GET /my-work/my-ideas/:id/map` fails, `useMindMapPersistence`'s
 * `hydrate()` catch path (useMindMapPersistence.ts) correctly shows a toast
 * and falls back to a local default template (root + 5 branch nodes) rather
 * than leaving a broken canvas — but `buildLocalDefaultIdeaMap()` calls
 * `i18n.t()` synchronously, and i18next's HttpBackend loads translation JSON
 * asynchronously. If the locale bundle hasn't resolved yet (a real race: a
 * same-tick/fast API rejection can beat the `/locales/**` fetch), `t()` with
 * no `defaultValue` returns the raw dotted key — and because these labels
 * are baked into node `data.label` once (not a live `t()` in JSX), they
 * never self-heal once the bundle does arrive. Fixed by adding
 * `{ defaultValue }` to every `t()` call in `buildLocalDefaultIdeaMap`.
 *
 * This test simulates "i18n resources not loaded yet" by mocking
 * `react-i18next`'s `t()` to behave like real i18next without a loaded
 * bundle: return the key when no defaultValue is given, the defaultValue
 * otherwise. It does NOT mock `@/i18n` (the hook calls the real i18n
 * singleton directly, not the `useTranslation()` hook) — instead it
 * verifies via the real `i18n.t()` call after forcing an unresolved/empty
 * resource bundle for the active language.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMyIdeaMapMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeaMap: (...args: unknown[]) => getMyIdeaMapMock(...args),
    syncMyIdeaMap: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import i18n from '@/i18n';

import { useMindMapPersistence } from '@/components/MyWork/mindmap/useMindMapPersistence';

describe('useMindMapPersistence — hydrate-failure fallback template labels', () => {
  beforeEach(() => {
    getMyIdeaMapMock.mockReset();
  });

  it('renders real English branch labels, not raw i18n keys, even when the translation bundle has not loaded yet', async () => {
    getMyIdeaMapMock.mockRejectedValue(new Error('network error'));

    // Simulate "i18n resources not loaded yet": add a language with an EMPTY
    // resource bundle and switch to it, so any t() call without a
    // defaultValue falls through to the raw key (real i18next behavior).
    i18n.addResourceBundle('zz-test', 'translation', {}, true, true);
    await i18n.changeLanguage('zz-test');

    let nodes: any[] = [];
    const setNodes = vi.fn((updater: any) => {
      nodes = typeof updater === 'function' ? updater(nodes) : updater;
    });

    const { result } = renderHook(() =>
      useMindMapPersistence({
        ideaId: 'idea-hydrate-fail-1',
        ideaTitle: 'Test idea',
        isPolish: false,
        locked: false,
        i18nLanguage: 'zz-test',
        nodes: [],
        edges: [],
        setNodes: setNodes as any,
        setEdges: vi.fn() as any,
        setCollapsedNodeIds: vi.fn() as any,
        collapsedNodeIds: new Set(),
        fitView: vi.fn(),
        setViewport: vi.fn(),
        getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
        clearUndoHistory: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.hydrate();
    });

    expect(getMyIdeaMapMock).toHaveBeenCalled();
    expect(nodes.length).toBeGreaterThan(0);
    const labels = nodes.map((n) => String(n?.data?.label ?? ''));
    // None of the fallback template's labels should be raw i18n keys.
    for (const label of labels) {
      expect(label).not.toMatch(/^mindmap\.persistence\./);
    }
    expect(labels).toContain('Problem');
    expect(labels).toContain('Options');
    expect(labels).toContain('Evidence');
    expect(labels).toContain('Risks');
    expect(labels).toContain('Experiments');

    await i18n.changeLanguage('en');
  });
});
