/**
 * @vitest-environment jsdom
 *
 * Flaga redesignu Organizacji (`orgRedesignV1`).
 *
 * DEFAULT OFF jest tu NOŚNY, nie kosmetyczny: dopóki właściciel nie zaakceptuje
 * realnych zrzutów, moduł 01 musi wyglądać dokładnie jak dziś (CLAUDE.md §7 —
 * „Piotr nigdy nie jest pierwszym testerem wizualnym").
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

  it('domyślnie OFF', () => {
    expect(isOrgRedesignV1Enabled()).toBe(false);
  });

  it('localStorage włącza i wyłącza', () => {
    window.localStorage.setItem(ORG_REDESIGN_V1_FLAG_KEYS.localStorage, '1');
    expect(isOrgRedesignV1Enabled()).toBe(true);
    window.localStorage.setItem(ORG_REDESIGN_V1_FLAG_KEYS.localStorage, 'off');
    expect(isOrgRedesignV1Enabled()).toBe(false);
  });

  it('query wygrywa nad localStorage', () => {
    window.localStorage.setItem(ORG_REDESIGN_V1_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${ORG_REDESIGN_V1_FLAG_KEYS.query}=0`);
    expect(isOrgRedesignV1Enabled()).toBe(false);
  });

  it('śmieciowa wartość spada do niższego priorytetu, nie włącza flagi', () => {
    setLocationSearch(`?${ORG_REDESIGN_V1_FLAG_KEYS.query}=banana`);
    expect(isOrgRedesignV1Enabled()).toBe(false);
    window.localStorage.setItem(ORG_REDESIGN_V1_FLAG_KEYS.localStorage, 'true');
    expect(isOrgRedesignV1Enabled()).toBe(true);
  });

  it('klucze flagi są stabilne', () => {
    expect(ORG_REDESIGN_V1_FLAG_KEYS.localStorage).toBe('ff.orgRedesignV1');
    expect(ORG_REDESIGN_V1_FLAG_KEYS.query).toBe('ff_org_redesign_v1');
    expect(ORG_REDESIGN_V1_FLAG_KEYS.env).toBe('VITE_ORG_REDESIGN_V1_ENABLED');
  });
});
