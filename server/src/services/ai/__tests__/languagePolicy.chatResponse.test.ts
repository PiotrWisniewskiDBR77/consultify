/**
 * DEC-511 — jezyk odpowiedzi czatu: profil uzytkownika przed jezykiem watku.
 *
 * PRZYCZYNA (zgloszenie testera `78e8df54`, staging 2026-09-14 06:31 UTC):
 * pytanie po angielsku przy UI=EN dostalo odpowiedz po niemiecku. Front wysyla
 * w `body.language` jezyk WATKU (`chatLanguageByConversationId`), a
 * `resolveLocale()` traktowalo kazda wartosc z zadania jak jawny wybor, wiec
 * `users.language` nigdy nie bylo czytane.
 *
 * MUTACJA: przywrocenie w `resolveChatResponseLanguage` kolejnosci
 * „watek przed profilem" wywraca pierwszy test; dopuszczenie jezyka spoza
 * `IMPLICIT_THREAD_LANGUAGES` bez jawnego wyboru wywraca trzeci.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('resolveChatResponseLanguage — DEC-511', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('../../../utils/DbPromise.js');
  });

  it('watek DE + users.language=en → en (profil wygrywa z watkiem)', async () => {
    const get = vi.fn().mockResolvedValue({ language: 'en', locale: null, organization_id: 'o1' });
    vi.doMock('../../../utils/DbPromise.js', () => ({ get, all: vi.fn() }));
    const mod = await import('../languagePolicy.js');
    const req: any = { body: { language: 'de' }, userId: 'u1' };
    const decision = await mod.resolveChatResponseLanguage(req, { thread: 'de' });
    expect(decision).toEqual({ language: 'en', source: 'profile' });
    expect(req.resolvedLocale).toBe('en');
  });

  it('pytanie/watek PL przy users.language=en → en (E2d: brak detekcji jezyka pytania)', async () => {
    const get = vi.fn().mockResolvedValue({ language: 'en', locale: null, organization_id: 'o1' });
    vi.doMock('../../../utils/DbPromise.js', () => ({ get, all: vi.fn() }));
    const mod = await import('../languagePolicy.js');
    const decision = await mod.resolveChatResponseLanguage(
      { body: { language: 'pl' }, userId: 'u1' } as any,
      { thread: 'pl' }
    );
    expect(decision.language).toBe('en');
  });

  it('brak profilu + watek DE → en (jezyk spoza {en,pl} nie wchodzi bez jawnego wyboru)', async () => {
    const get = vi.fn().mockResolvedValue({ language: null, locale: null, organization_id: null });
    vi.doMock('../../../utils/DbPromise.js', () => ({ get, all: vi.fn() }));
    const mod = await import('../languagePolicy.js');
    const decision = await mod.resolveChatResponseLanguage(
      { body: { language: 'de' }, userId: 'u1' } as any,
      { thread: 'de' }
    );
    expect(decision).toEqual({ language: 'en', source: 'default' });
  });

  it('brak profilu + watek PL → pl (jezyk domyslnie dopuszczalny)', async () => {
    const get = vi.fn().mockResolvedValue({ language: null, locale: null, organization_id: null });
    vi.doMock('../../../utils/DbPromise.js', () => ({ get, all: vi.fn() }));
    const mod = await import('../languagePolicy.js');
    const decision = await mod.resolveChatResponseLanguage(
      { body: { language: 'pl' }, userId: 'u1' } as any,
      { thread: 'pl' }
    );
    expect(decision).toEqual({ language: 'pl', source: 'thread' });
  });

  it('jawny wybor uzytkownika wygrywa z profilem i nie pyta bazy', async () => {
    const get = vi.fn();
    vi.doMock('../../../utils/DbPromise.js', () => ({ get, all: vi.fn() }));
    const mod = await import('../languagePolicy.js');
    const decision = await mod.resolveChatResponseLanguage(
      { body: { language: 'de', languageExplicit: true }, userId: 'u1' } as any,
      { explicit: 'de', thread: 'de' }
    );
    expect(decision).toEqual({ language: 'de', source: 'explicit' });
    expect(get).not.toHaveBeenCalled();
  });

  it('resolveProfileLocale zwraca null, gdy zadne zrodlo tozsamosci nic nie mowi', async () => {
    const get = vi.fn().mockResolvedValue({ language: null, locale: null, organization_id: null });
    vi.doMock('../../../utils/DbPromise.js', () => ({ get, all: vi.fn() }));
    const mod = await import('../languagePolicy.js');
    await expect(mod.resolveProfileLocale({ body: {}, userId: 'u1' } as any)).resolves.toBeNull();
  });

  it('IMPLICIT_THREAD_LANGUAGES to dokladnie {en, pl}', async () => {
    const mod = await import('../languagePolicy.js');
    expect([...mod.IMPLICIT_THREAD_LANGUAGES].sort()).toEqual(['en', 'pl']);
    expect(mod.isImplicitThreadLanguage('de')).toBe(false);
    expect(mod.isImplicitThreadLanguage('pl-PL')).toBe(true);
  });
});
