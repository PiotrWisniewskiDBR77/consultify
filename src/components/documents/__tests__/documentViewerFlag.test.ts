/**
 * @vitest-environment jsdom
 *
 * DOC-0 (DEC-593) reveal flag — the viewer must be OFF unless something explicitly
 * turns it on, and an unparsable value must FAIL CLOSED (OFF), never ON: a new
 * screen replacing 16 open paths may not go live through a typo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DOCUMENT_VIEWER_FLAG_KEYS, isDocumentViewerEnabled } from '../documentViewerFlag';

const {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} = DOCUMENT_VIEWER_FLAG_KEYS;

/**
 * `tests/setup.ts:34` swaps `window.location` for a plain snapshot object, so
 * `history.replaceState` moves jsdom's URL but NOT the object the flag reads.
 * Write the snapshot instead — that is what the flag actually sees.
 */
function setSearch(search: string) {
  Object.assign(window.location, { search });
}

beforeEach(() => {
  window.localStorage.clear();
  setSearch('');
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isDocumentViewerEnabled', () => {
  it('is OFF by default (nothing set anywhere)', () => {
    expect(isDocumentViewerEnabled()).toBe(false);
  });

  it('is ON when the build-time env flag says true', () => {
    vi.stubEnv(ENV_KEY, 'true');
    expect(isDocumentViewerEnabled()).toBe(true);
  });

  it('fails closed on an unparsable env value', () => {
    vi.stubEnv(ENV_KEY, 'yes-please');
    expect(isDocumentViewerEnabled()).toBe(false);
  });

  it('lets localStorage override the env flag in both directions', () => {
    vi.stubEnv(ENV_KEY, 'true');
    window.localStorage.setItem(LS_KEY, '0');
    expect(isDocumentViewerEnabled()).toBe(false);

    vi.stubEnv(ENV_KEY, 'false');
    window.localStorage.setItem(LS_KEY, 'on');
    expect(isDocumentViewerEnabled()).toBe(true);
  });

  it('lets the URL query win over localStorage and env (dev-render bypass)', () => {
    vi.stubEnv(ENV_KEY, 'true');
    window.localStorage.setItem(LS_KEY, '1');
    setSearch(`?${QUERY_KEY}=0`);
    expect(isDocumentViewerEnabled()).toBe(false);
  });

  it('ignores an unparsable query value and falls through to the next source', () => {
    vi.stubEnv(ENV_KEY, 'true');
    setSearch(`?${QUERY_KEY}=maybe`);
    expect(isDocumentViewerEnabled()).toBe(true);
  });
});
