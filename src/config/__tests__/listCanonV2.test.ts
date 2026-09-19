/**
 * @vitest-environment jsdom
 *
 * list-canon-v2 (Wpis 183): JEDNA flaga `VITE_LIST_CANON_V2` + mapa per-ekran.
 * Te testy pilnują KOLEJNOŚCI rozstrzygania (query > localStorage per-ekran >
 * localStorage globalny > mapa z env jako wyłącznikiem) oraz tego, że w paczce
 * (i) żaden ekran nie jest domyślnie ON — stara tabela pozostaje renderem
 * domyślnym dopóki właściciel nie zaakceptuje karty PRZED/PO.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isListCanonV2Enabled,
  LIST_CANON_V2_FLAG_KEYS,
  LIST_CANON_V2_SCREENS,
} from '../listCanonV2';

// tests/setup.ts podmienia `window.location` na zwykły obiekt-zdjęcie, więc
// `history.replaceState` nie aktualizuje `location.search` — piszemy wprost.
function setQuery(search: string) {
  (window.location as unknown as { search: string }).search = search;
}

describe('listCanonV2 — resolution order', () => {
  beforeEach(() => {
    setQuery('');
    window.localStorage.clear();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    setQuery('');
    window.localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('defaults to OFF for every screen in package (i)', () => {
    for (const screen of Object.keys(LIST_CANON_V2_SCREENS) as Array<
      keyof typeof LIST_CANON_V2_SCREENS
    >) {
      expect(LIST_CANON_V2_SCREENS[screen]).toBe(false);
      expect(isListCanonV2Enabled(screen)).toBe(false);
    }
  });

  it('URL query wins over both localStorage keys', () => {
    window.localStorage.setItem(LIST_CANON_V2_FLAG_KEYS.localStorageScreen('ideas'), '0');
    window.localStorage.setItem(LIST_CANON_V2_FLAG_KEYS.localStorage, '0');
    setQuery('?ff_listCanonV2=1');

    expect(isListCanonV2Enabled('ideas')).toBe(true);

    setQuery('?ff_listCanonV2=off');
    window.localStorage.setItem(LIST_CANON_V2_FLAG_KEYS.localStorage, '1');

    expect(isListCanonV2Enabled('ideas')).toBe(false);
  });

  it('per-screen localStorage wins over the global localStorage key', () => {
    window.localStorage.setItem(LIST_CANON_V2_FLAG_KEYS.localStorage, '1');
    window.localStorage.setItem(LIST_CANON_V2_FLAG_KEYS.localStorageScreen('ideas'), '0');

    expect(isListCanonV2Enabled('ideas')).toBe(false);
    expect(isListCanonV2Enabled('inbox')).toBe(true);
  });

  it('global localStorage turns every screen on without the env flag', () => {
    window.localStorage.setItem(LIST_CANON_V2_FLAG_KEYS.localStorage, 'true');

    expect(isListCanonV2Enabled('myWorkGrid')).toBe(true);
    expect(isListCanonV2Enabled('subscriberDispatch')).toBe(true);
  });

  it('ignores unparsable overrides and falls through to the map', () => {
    window.localStorage.setItem(LIST_CANON_V2_FLAG_KEYS.localStorage, 'może');
    setQuery('?ff_listCanonV2=yes-please');

    expect(isListCanonV2Enabled('ideas')).toBe(false);
  });

  it('env feeds only the hard default: VITE_LIST_CANON_V2=1 does not bypass the map', () => {
    vi.stubEnv('VITE_LIST_CANON_V2', '1');

    expect(isListCanonV2Enabled('ideas')).toBe(false);
    expect(isListCanonV2Enabled('inbox')).toBe(false);
  });

  it('VITE_LIST_CANON_V2=0 keeps the hard default off, operator override still wins', () => {
    vi.stubEnv('VITE_LIST_CANON_V2', '0');

    expect(isListCanonV2Enabled('ideas')).toBe(false);

    window.localStorage.setItem(LIST_CANON_V2_FLAG_KEYS.localStorageScreen('ideas'), '1');

    expect(isListCanonV2Enabled('ideas')).toBe(true);
  });

  it('VITE_LIST_CANON_V2=0 is a kill switch for a screen the map already turned ON', () => {
    // W paczce (i) mapa jest wszędzie `false`, więc samo `=0` nic nie dowodzi:
    // test przeszedłby nawet po wycięciu weta env. Tu symulujemy stan paczki
    // (ii) — ekran domyślnie ON — i dopiero wtedy weto jest obserwowalne.
    const map = LIST_CANON_V2_SCREENS as { ideas: boolean };
    const before = map.ideas;
    map.ideas = true;
    try {
      expect(isListCanonV2Enabled('ideas')).toBe(true);
      vi.stubEnv('VITE_LIST_CANON_V2', '0');
      expect(isListCanonV2Enabled('ideas')).toBe(false);
    } finally {
      map.ideas = before;
    }
  });

  it('exposes the exact key names the operator writes down', () => {
    expect(LIST_CANON_V2_FLAG_KEYS).toMatchObject({
      localStorage: 'ff.list_canon_v2',
      query: 'ff_listCanonV2',
      env: 'VITE_LIST_CANON_V2',
    });
    expect(LIST_CANON_V2_FLAG_KEYS.localStorageScreen('portfolioList')).toBe(
      'ff.list_canon_v2.portfolioList'
    );
  });
});
