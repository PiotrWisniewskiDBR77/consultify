// @vitest-environment jsdom
// KONTRAKT DYŻURU 343 — zastana flaga DEC-388, domyślnie OFF.
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS,
  isInitiativeSectionsCompleteEnabled,
} from '../../../src/utils/initiativeSectionsCompleteFlag';

const browserWindow = window;
const baseLocation = window.location;

describe('initiativeSectionsCompleteFlag — query → localStorage → env → OFF', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(browserWindow, 'location', { value: baseLocation, writable: true });
    browserWindow.localStorage.clear();
    vi.unstubAllEnvs();
  });

  // DEC-393 (04.09): wlasciciel zaakceptowal pare zrzutow 6/3 -> 24/5 slowami 'pelna akceptacja',
  // wiec domyslna wartosc przeszla z OFF na ON (CLAUDE.md §7). Trzy warstwy wylacznika ponizej
  // ZOSTAJA i sa tu bronione — CLAUDE.md §8 wymaga awaryjnego wylacznika dla kazdej flagi.
  it('bez query, localStorage i env zwraca true (domyslne ON po akcepcie DEC-393)', () => {
    vi.stubEnv(INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS.env, '');
    expect(isInitiativeSectionsCompleteEnabled()).toBe(true);
  });

  it('query ma pierwszeństwo przed localStorage i env', () => {
    Object.defineProperty(window, 'location', {
      value: {
        ...baseLocation,
        search: `?${INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS.query}=0`,
      },
      writable: true,
    });
    window.localStorage.setItem(INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS.localStorage, '1');
    vi.stubEnv(INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS.env, '1');
    expect(window.location.search).toBe(`?${INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS.query}=0`);
    expect(isInitiativeSectionsCompleteEnabled()).toBe(false);
  });

  it('localStorage ma pierwszeństwo przed statycznym env', () => {
    window.localStorage.setItem(INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS.localStorage, '0');
    vi.stubEnv(INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS.env, '1');
    expect(isInitiativeSectionsCompleteEnabled()).toBe(false);
  });

  it('statyczny env włącza flagę, gdy brak override', () => {
    vi.stubEnv(INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS.env, '1');
    expect(isInitiativeSectionsCompleteEnabled()).toBe(true);
  });

  it('bez window zwraca true (render serwerowy dostaje komplet sekcji)', () => {
    vi.stubEnv(INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS.env, '1');
    vi.stubGlobal('window', undefined);
    expect(isInitiativeSectionsCompleteEnabled()).toBe(true);
  });
});
