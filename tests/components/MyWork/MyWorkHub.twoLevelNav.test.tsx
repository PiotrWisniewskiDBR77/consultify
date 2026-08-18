/**
 * @vitest-environment jsdom
 *
 * M02-P01 (Shell/Nav) — verifies the `isMyWorkTwoLevelNavEnabled` flag
 * actually switches `MyWorkHub`'s rendered nav, using the same shared smoke
 * harness as `tests/components/smoke/hubs.smoke.test.tsx` (real component,
 * mocked network/i18n/router — not a hand-written mock shell).
 *
 * The flag reads `localStorage["ff.mywork_two_level_nav"]` (2nd-highest in
 * its resolution order, right under the URL query override) — JSDOM's
 * `window.location` is the top-level test environment URL and is not wired
 * to MemoryRouter's in-app location, so localStorage is the reliable lever
 * here, consistent with how the pre-existing `clientVaultFlag`/
 * `agentPlanFlag` tests are gated in this codebase.
 */
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installFetchStub, renderHub } from '../smoke/hubSmokeHarness';
import { Api } from '@/services/api';

const FLAG_LS_KEY = 'ff.mywork_two_level_nav';

beforeEach(() => {
  installFetchStub();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  window.localStorage.removeItem(FLAG_LS_KEY);
});

afterEach(() => {
  window.localStorage.removeItem(FLAG_LS_KEY);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MyWorkHub — two-level nav flag (M02-P01)', () => {
  it('flag OFF (default): renders the flat single-row tab bar, no MyWorkNav', async () => {
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');
    renderHub(<MyWorkHub />, '/my-work');
    await waitFor(() => {
      expect(document.querySelector('[data-testid^="mywork-tab-"]')).toBeTruthy();
    });
    expect(document.querySelector('[data-testid="mywork-nav-groups"]')).toBeNull();
    expect(document.querySelector('[data-testid="mywork-nav"]')).toBeNull();
  });

  it('flag ON: renders the two-level MyWorkNav (group row + tab row)', async () => {
    window.localStorage.setItem(FLAG_LS_KEY, '1');
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');
    renderHub(<MyWorkHub />, '/my-work');
    await waitFor(() => {
      expect(document.querySelector('[data-testid="mywork-nav-groups"]')).toBeTruthy();
    });
    expect(document.querySelector('[data-testid="mywork-nav-tabs"]')).toBeTruthy();
    // Every visible tab is still reachable via a `mywork-tab-*` testid
    // (deep-link callers and other tests key off this pattern).
    expect(document.querySelector('[data-testid^="mywork-tab-"]')).toBeTruthy();
    // The group tablist must carry a real accessible name (M02-010 fix).
    const groupRow = document.querySelector('[data-testid="mywork-nav-groups"]');
    expect(groupRow?.getAttribute('aria-label')).toBeTruthy();
  });

  it('loads the server-truth notebook title once on a cold deep link', async () => {
    const getNotebook = vi.spyOn(Api, 'getNotebook').mockResolvedValue({
      id: 'notebook-1',
      title: 'Server Truth Notebook',
    });
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');

    renderHub(<MyWorkHub />, '/my-work/notebook?notebook=notebook-1');

    await waitFor(() => {
      expect(screen.getByTestId('stub-notebook-content')).toHaveTextContent(
        'Server Truth Notebook'
      );
    });
    expect(getNotebook).toHaveBeenCalledTimes(1);
    expect(getNotebook).toHaveBeenCalledWith('notebook-1');
  });
});
