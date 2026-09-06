/**
 * generujTrescPola — język wyjścia AI = język UI (DEC-407 uzupełnienie, 2026-09-06).
 *
 * PRZYCZYNA: do 2026-09-06 ten moduł wymuszał `language: 'en'` i
 * `Output language MUST be English` NIEZALEŻNIE od `i18n.language` — w polskim
 * UI karta „Pracuj z AI → Uzupełnij tę sekcję" zwracała propozycję po
 * angielsku (K2, zrzut `09-propozycja-do-zatwierdzenia.png`).
 *
 * MUTACYJNY test (a): przywrócenie stałej `const JEZYK_AI = 'en'` i użycie
 * jej zamiast `jezykAIzUI(...)` w ciele `generujTrescPola` musi wywrócić
 * „wysyła pl przy i18n.language='pl'" poniżej — to jest bramka na regresję.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// `generujTrescPola` → `@/services/api` → `@/i18n` (`.use(initReactI18next)`).
// Bez tego mocka `i18n.ts` wybucha na braku prawdziwego providera react-i18next.
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@/services/api', () => ({
  Api: { post: vi.fn(async () => ({ text: 'wygenerowana treść' })) },
}));

import i18n from '@/i18n';
import { Api } from '@/services/api';

import { generujTrescPola, jezykAIzUI } from '../generujTrescPola';

describe('generujTrescPola — język wyjścia = język UI (DEC-407 uzupełnienie)', () => {
  const oryginalnyJezyk = i18n.language;

  beforeEach(() => {
    (Api.post as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  afterAll(() => {
    i18n.language = oryginalnyJezyk;
  });

  it('wysyła language="pl" i polską nazwę w prompcie, gdy i18n.language="pl"', async () => {
    i18n.language = 'pl';

    await generujTrescPola({
      etykietaPola: 'Opis',
      kontekstArtefaktu: { type: 'task', title: 'Zadanie testowe' },
    });

    const post = Api.post as unknown as ReturnType<typeof vi.fn>;
    expect(post).toHaveBeenCalledTimes(1);
    const [, body] = post.mock.calls[0];
    expect(body.language).toBe('pl');
    expect(String(body.systemInstruction)).toContain('Polish');
    expect(String(body.systemInstruction)).not.toContain('MUST be English');
  });

  it('wysyła language="en", gdy i18n.language="en" — zero regresji dla en', async () => {
    i18n.language = 'en';

    await generujTrescPola({
      etykietaPola: 'Opis',
      kontekstArtefaktu: { type: 'task', title: 'Zadanie testowe' },
    });

    const post = Api.post as unknown as ReturnType<typeof vi.fn>;
    const [, body] = post.mock.calls[0];
    expect(body.language).toBe('en');
    expect(String(body.systemInstruction)).toContain('English');
  });

  it('jawny opts.language nadpisuje i18n.language', async () => {
    i18n.language = 'en';

    await generujTrescPola({
      etykietaPola: 'Opis',
      kontekstArtefaktu: { type: 'task', title: 'Zadanie testowe' },
      language: 'pl',
    });

    const post = Api.post as unknown as ReturnType<typeof vi.fn>;
    const [, body] = post.mock.calls[0];
    expect(body.language).toBe('pl');
  });

  it('jezykAIzUI: jawny kod nieznany spada do domyślnego "pl" (SSOT, nie "en")', () => {
    expect(jezykAIzUI('xx-nieznany-kod').kod).toBe('pl');
  });

  it('jezykAIzUI: bez jawnego kodu czyta aktualny i18n.language', () => {
    i18n.language = 'de';
    expect(jezykAIzUI().kod).toBe('de');
    i18n.language = 'pl';
    expect(jezykAIzUI().kod).toBe('pl');
  });
});
