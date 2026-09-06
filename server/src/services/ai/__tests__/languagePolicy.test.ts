/**
 * SSOT języka Teresy — test kontraktowy + dowód mutacyjny.
 *
 * Każdy blok „MUTACJA" opisuje konkretne uszkodzenie kodu produkcyjnego i test,
 * który przez to musi paść. Sprawdzone ręcznie 2026-09-06 (patrz
 * `evidence/teresa-20260906/RAPORT.md`, sekcja „Mutacje").
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  AI_LANGUAGE_LABELS,
  DEFAULT_AI_LANGUAGE,
  buildLanguageInstruction,
  normalizeAiLanguage,
  parseAcceptLanguage,
  resolveAiLanguage,
  resolveAiLanguageForRequest,
  resolveAiLanguageFromRequest,
} from '../languagePolicy.js';

describe('languagePolicy — domyślka', () => {
  it('domyślnym językiem Teresy jest polski (ZASADY_AI_TERESA_SSOT §8 J1)', () => {
    // MUTACJA: DEFAULT_AI_LANGUAGE = 'en' → ten test pada.
    expect(DEFAULT_AI_LANGUAGE).toBe('pl');
  });

  it('brak jakiejkolwiek wskazówki → pl, nie en', () => {
    // MUTACJA: `return DEFAULT_AI_LANGUAGE` → `return 'en'` w resolveAiLanguage → pada.
    expect(resolveAiLanguage(undefined, null, '')).toBe('pl');
  });

  it('pierwszy sensowny kandydat wygrywa nad późniejszymi', () => {
    expect(resolveAiLanguage(null, 'en-US', 'pl')).toBe('en');
    expect(resolveAiLanguage('', undefined, 'de')).toBe('de');
  });
});

describe('languagePolicy — normalizacja', () => {
  it('sprowadza warianty locale do kodu bazowego', () => {
    expect(normalizeAiLanguage('pl-PL')).toBe('pl');
    expect(normalizeAiLanguage('PL')).toBe('pl');
    expect(normalizeAiLanguage('pl_PL')).toBe('pl');
    expect(normalizeAiLanguage('jp')).toBe('ja');
  });

  it('nieznany/pusty kod → null (żeby wołający mógł przejść do kolejnego kandydata)', () => {
    // MUTACJA: zwrócenie tu 'en' zamiast null → `resolveAiLanguage('xx','pl')` da 'en' → pada.
    expect(normalizeAiLanguage('xx')).toBeNull();
    expect(normalizeAiLanguage('')).toBeNull();
    expect(normalizeAiLanguage(123)).toBeNull();
    expect(resolveAiLanguage('xx', 'pl')).toBe('pl');
  });
});

describe('languagePolicy — Accept-Language', () => {
  it('czyta język o najwyższej wadze q', () => {
    expect(parseAcceptLanguage('en-US;q=0.8,pl-PL;q=0.9')).toBe('pl');
    expect(parseAcceptLanguage('pl-PL,pl;q=0.9,en-US;q=0.8')).toBe('pl');
  });

  it('pomija * i wartości nieobsługiwane', () => {
    expect(parseAcceptLanguage('*')).toBeNull();
    expect(parseAcceptLanguage('sv-SE,fi;q=0.5')).toBeNull();
    expect(parseAcceptLanguage('')).toBeNull();
  });
});

describe('languagePolicy — instrukcja dla modelu (mutacja promptu)', () => {
  it('instrukcja nazywa język po nazwie i jest oznaczona jako LANGUAGE INSTRUCTION', () => {
    const instruction = buildLanguageInstruction('pl');
    // MUTACJA: usunięcie z buildLanguageInstruction znacznika `[LANGUAGE INSTRUCTION:`
    // albo etykiety języka → ten test pada, a model przestaje mieć czym wymusić język.
    expect(instruction).toContain('[LANGUAGE INSTRUCTION:');
    expect(instruction).toContain(AI_LANGUAGE_LABELS.pl);
    expect(instruction).toContain('Polish');
  });

  it('instrukcja jest bezwarunkowa — mówi wprost, że język pytania nie ma znaczenia', () => {
    // MUTACJA: skasowanie zdania "Even if the user writes their message in a different
    // language" → pada. To ono broni przed odpowiadaniem w języku pytania.
    const instruction = buildLanguageInstruction('pl');
    expect(instruction).toMatch(/Even if the user writes their message in a different language/i);
    expect(instruction).toMatch(/non-negotiable/i);
  });

  it('zabrania meta-odpowiedzi typu „I operate in English"', () => {
    // To dokładnie ta odpowiedź, którą zmierzono na stanowisku 05.09.
    const instruction = buildLanguageInstruction('pl');
    expect(instruction).toMatch(/Never answer with a meta-remark about which\s+language you operate in/i);
  });

  it('każdy wspierany język ma własną, niepustą etykietę', () => {
    for (const [code, label] of Object.entries(AI_LANGUAGE_LABELS)) {
      expect(label.length).toBeGreaterThan(1);
      expect(buildLanguageInstruction(code as any)).toContain(label);
    }
  });
});

describe('languagePolicy — rozstrzyganie z żądania', () => {
  it('body.language wygrywa nad nagłówkiem i profilem', () => {
    const lang = resolveAiLanguageFromRequest({
      body: { language: 'en' },
      headers: { 'accept-language': 'pl-PL' },
      user: { language: 'de' },
    });
    expect(lang).toBe('en');
  });

  it('bez body.language schodzi na profil użytkownika', () => {
    expect(
      resolveAiLanguageFromRequest({
        body: {},
        headers: { 'accept-language': 'en-US' },
        user: { language: 'pl' },
      })
    ).toBe('pl');
  });

  it('bez body i profilu schodzi na Accept-Language', () => {
    expect(
      resolveAiLanguageFromRequest({ body: {}, headers: { 'accept-language': 'de-DE,de;q=0.9' } })
    ).toBe('de');
  });

  it('BEZ NICZEGO → polski (to jest naprawiony defekt: było angielskie)', () => {
    // MUTACJA: przywrócenie w routach `(language || "en")` → pada test integracyjny,
    // a tutaj pada ta asercja, jeśli ktoś zmieni domyślkę SSOT.
    expect(resolveAiLanguageFromRequest({ body: {}, headers: {} })).toBe('pl');
    expect(resolveAiLanguageFromRequest(null)).toBe('pl');
  });

  it('czyta Accept-Language także przez req.get() (Express)', () => {
    expect(
      resolveAiLanguageFromRequest({ body: {}, get: (n: string) => (n === 'Accept-Language' ? 'pl' : undefined) })
    ).toBe('pl');
  });
});

describe('languagePolicy — dociąganie users.language z bazy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('../../../utils/DbPromise.js');
  });

  it('gdy żądanie nic nie mówi, pyta users.language', async () => {
    const get = vi.fn().mockResolvedValue({ language: 'pl' });
    vi.doMock('../../../utils/DbPromise.js', () => ({ get, all: vi.fn() }));
    const mod = await import('../languagePolicy.js');
    const lang = await mod.resolveAiLanguageForRequest({
      body: {},
      headers: { 'accept-language': 'en-US' },
      userId: 'u1',
    });
    expect(get).toHaveBeenCalledWith('SELECT language FROM users WHERE id = ?', ['u1']);
    expect(lang).toBe('pl');
  });

  it('nie pyta bazy, gdy język podano wprost w żądaniu (ścieżka gorąca)', async () => {
    const get = vi.fn();
    vi.doMock('../../../utils/DbPromise.js', () => ({ get, all: vi.fn() }));
    const mod = await import('../languagePolicy.js');
    const lang = await mod.resolveAiLanguageForRequest({ body: { language: 'en' }, userId: 'u1' });
    expect(get).not.toHaveBeenCalled();
    expect(lang).toBe('en');
  });

  it('błąd bazy nie wywraca czatu — fail-safe jest polski', async () => {
    const get = vi.fn().mockRejectedValue(new Error('db down'));
    vi.doMock('../../../utils/DbPromise.js', () => ({ get, all: vi.fn() }));
    const mod = await import('../languagePolicy.js');
    await expect(
      mod.resolveAiLanguageForRequest({ body: {}, headers: {}, userId: 'u1' })
    ).resolves.toBe('pl');
  });

  it('pusta kolumna language nie blokuje Accept-Language', async () => {
    const get = vi.fn().mockResolvedValue({ language: null });
    vi.doMock('../../../utils/DbPromise.js', () => ({ get, all: vi.fn() }));
    const mod = await import('../languagePolicy.js');
    await expect(
      mod.resolveAiLanguageForRequest({ body: {}, headers: { 'accept-language': 'de' }, userId: 'u1' })
    ).resolves.toBe('de');
  });
});

describe('languagePolicy — jedno źródło prawdy (bramka anty-regresyjna)', () => {
  it('resolveAiLanguageForRequest jest funkcją asynchroniczną i zawsze zwraca wspierany kod', async () => {
    const out = await resolveAiLanguageForRequest({ body: {}, headers: {} });
    expect(Object.keys(AI_LANGUAGE_LABELS)).toContain(out);
  });
});
