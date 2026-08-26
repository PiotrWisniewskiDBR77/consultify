/**
 * @vitest-environment jsdom
 *
 * Flaga redesignu Organizacji (`orgRedesignV1`).
 *
 * DEFAULT ON od DEC-2026-08-26-78: ekran wzorcowy przeszedł odbiór na
 * realnych zrzutach 2026-08-24 (DEC-2026-08-24-11), zakres 11 ekranów +
 * anatomia karty (pochodzenie faktu, „Szczegóły techniczne", 5 wymiarów
 * Gotowości) — 2026-08-26 na prototypie zaakceptowanym przez właściciela
 * (CLAUDE.md §7). Flaga OFF zostaje jako awaryjny wyłącznik (§8), nie jako
 * ścieżka domyślna.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ORG_REDESIGN_V1_FLAG_KEYS, isOrgRedesignV1Enabled } from '../orgRedesignFlag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search },
  });
}

describe('isOrgRedesignV1Enabled', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  it('domyślnie ON (DEC-2026-08-26-78)', () => {
    expect(isOrgRedesignV1Enabled()).toBe(true);
  });

  it('localStorage wyłącza — awaryjny wyłącznik CLAUDE.md §8', () => {
    window.localStorage.setItem(ORG_REDESIGN_V1_FLAG_KEYS.localStorage, 'off');
    expect(isOrgRedesignV1Enabled()).toBe(false);
    window.localStorage.setItem(ORG_REDESIGN_V1_FLAG_KEYS.localStorage, '1');
    expect(isOrgRedesignV1Enabled()).toBe(true);
  });

  it('query wygrywa nad localStorage', () => {
    window.localStorage.setItem(ORG_REDESIGN_V1_FLAG_KEYS.localStorage, '0');
    setLocationSearch(`?${ORG_REDESIGN_V1_FLAG_KEYS.query}=1`);
    expect(isOrgRedesignV1Enabled()).toBe(true);
    setLocationSearch(`?${ORG_REDESIGN_V1_FLAG_KEYS.query}=0`);
    expect(isOrgRedesignV1Enabled()).toBe(false);
  });

  it('śmieciowa wartość spada do niższego priorytetu, nie zmienia wyniku', () => {
    setLocationSearch(`?${ORG_REDESIGN_V1_FLAG_KEYS.query}=banana`);
    expect(isOrgRedesignV1Enabled()).toBe(true);
    window.localStorage.setItem(ORG_REDESIGN_V1_FLAG_KEYS.localStorage, 'banana');
    expect(isOrgRedesignV1Enabled()).toBe(true);
    window.localStorage.setItem(ORG_REDESIGN_V1_FLAG_KEYS.localStorage, 'off');
    expect(isOrgRedesignV1Enabled()).toBe(false);
  });

  it('klucze flagi są stabilne', () => {
    expect(ORG_REDESIGN_V1_FLAG_KEYS.localStorage).toBe('ff.orgRedesignV1');
    expect(ORG_REDESIGN_V1_FLAG_KEYS.query).toBe('ff_org_redesign_v1');
    expect(ORG_REDESIGN_V1_FLAG_KEYS.env).toBe('VITE_ORG_REDESIGN_V1_ENABLED');
  });
});
