/**
 * @vitest-environment node
 *
 * Domyślnym środowiskiem w `vitest.config.ts` jest `jsdom`, a
 * `environmentMatchGlobs` nie wymienia `scripts/**`. Pod jsdom vite serwuje ten
 * plik przez `/@vite/client` i wywraca się na shebangu `#!/usr/bin/env node`
 * z `pomiar-jezyka.mjs` (`RollupError: Parse failure: Expected ident`) — test
 * był więc w `npm run test:unit` CZERWONY z powodu przyrządu, nie produktu.
 * Ta dyrektywa przestawia środowisko per plik, bez ruszania wspólnej konfiguracji.
 */
// Testy trzech warstw POZA UI dodanych do bramki językowej falą E2f
// (DEC-510, Wpis 48 pkt E2f). Mapa warstw: docs/ui-standards/MAPA_JEZYKA.md.
//
// Każda warstwa ma parę POZYTYW / NEGATYW — bo licznik, który tylko rośnie na
// wszystkim, jest tak samo bezużyteczny jak licznik, który zawsze zwraca zero
// („brak pomiaru nie jest wynikiem"). Para dowodzi, że przyrząd ODRÓŻNIA.
//
//   K8s  — literał serwera widoczny dla użytkownika (poza routes/*)
//   K9p  — prompt AI (PL / mieszany) + plik budujący system prompt bez
//          `withResolvedLocaleInstruction`
//   K10d — method pack DRD skompilowany dla `en`
import { describe, it, expect } from 'vitest';
import {
  analizujSerwerK8sZawartosc,
  jestKodemSerwerowymK8s,
  bezSlownikowDwujezycznych,
  analizujPromptyZawartosc,
  jestPlikiemPromptowym,
  policzDrd,
} from '../pomiar-jezyka.mjs';

describe('E2f / K8s — literały serwera widoczne dla użytkownika', () => {
  it('POZYTYW: polski i angielski komunikat w `message`/`throw` jest liczony', () => {
    const kod = [
      "export function a() {",
      "  return { message: 'Nie mogę wysłać wiadomości do użytkownika.' };",
      "}",
      "export function b() {",
      "  throw new Error('The scheduled report could not be generated');",
      "}",
    ].join('\n');
    const w = analizujSerwerK8sZawartosc(kod);
    expect(w.K8spl).toBe(1);
    expect(w.K8sen).toBe(1);
  });

  it('NEGATYW: słownik dwujęzyczny (`en:`+`pl:`) i kod błędu NIE są liczone', () => {
    // Tak wygląda MESSAGES w services/report/reportLocale.ts i TEKSTY_OUTPUTU
    // w method-core/outputs/EventDerivedOutputBridge.ts — to mechanizm naprawy,
    // nie dług. Liczenie go nagradzałoby usunięcie tłumaczenia.
    const kod = [
      'const MESSAGES = {',
      "  'report.empty': { en: 'No data is available for this period.', pl: 'Brak danych w tym okresie.' },",
      '};',
      "export const err = { error: 'INITIATIVE_LOCKED' };",
    ].join('\n');
    const w = analizujSerwerK8sZawartosc(kod);
    expect(w.K8spl).toBe(0);
    expect(w.K8sen).toBe(0);
    expect(bezSlownikowDwujezycznych(kod)).not.toContain('Brak danych');
    // zamazanie nie może przesunąć numerów linii — inaczej `plik:linia` kłamie
    expect(bezSlownikowDwujezycznych(kod).split('\n').length).toBe(kod.split('\n').length);
  });

  it('zakres: K8s bierze resztę server/src, a NIE katalogi liczone już przez K5', () => {
    expect(jestKodemSerwerowymK8s('server/src/services/emailService.ts')).toBe(true);
    expect(jestKodemSerwerowymK8s('server/src/method-core/outputs/EventDerivedOutputBridge.ts')).toBe(true);
    expect(jestKodemSerwerowymK8s('server/src/routes/ai.routes.ts')).toBe(false); // K5
    expect(jestKodemSerwerowymK8s('server/src/services/ai/languagePolicy.ts')).toBe(false); // SSOT języka
    expect(jestKodemSerwerowymK8s('server/src/services/__tests__/x.test.ts')).toBe(false);
  });
});

describe('E2f / K9p — prompty AI', () => {
  it('POZYTYW: polski prompt systemowy i brak withResolvedLocaleInstruction', () => {
    const kod = [
      'const systemPrompt = `Jesteś asystentem audytora. Wyjaśniasz wymaganie kryterium własnymi',
      'słowami, wyłącznie na podstawie dostarczonych danych, i nie dodajesz nic od siebie.`;',
      'export function run() { return systemPrompt; }',
    ].join('\n');
    const w = analizujPromptyZawartosc(kod);
    expect(w.K9pPL).toBe(1);
    expect(w.K9pBRAK).toBe(1);
  });

  it('POZYTYW: prompt mieszany PL+EN w jednym literale jest liczony osobno', () => {
    const kod = [
      'const systemPrompt = `Jesteś partnerem konsultingowym klienta i odpowiadasz rzeczowo.',
      'You must always return valid JSON and you should never invent any numbers that are not',
      'present in the supplied facts.`;',
      "import { withResolvedLocaleInstruction } from './languagePolicy';",
      'export const p = withResolvedLocaleInstruction(systemPrompt, "en");',
    ].join('\n');
    const w = analizujPromptyZawartosc(kod);
    expect(w.K9pMIX).toBe(1);
    expect(w.K9pPL).toBe(0);
    expect(w.K9pBRAK).toBe(0);
  });

  it('NEGATYW: angielski prompt dopięty przez withResolvedLocaleInstruction = 0', () => {
    const kod = [
      'const systemPrompt = `You are the consulting partner inside the product. Answer using only',
      'the supplied facts, never invent numbers, and always return a valid JSON object.`;',
      "import { withResolvedLocaleInstruction } from './languagePolicy';",
      'export const p = withResolvedLocaleInstruction(systemPrompt, locale);',
    ].join('\n');
    const w = analizujPromptyZawartosc(kod);
    expect(w).toMatchObject({ K9pPL: 0, K9pMIX: 0, K9pBRAK: 0 });
  });

  it('zakres: liczymy server/src i src/services|lib, bez testów', () => {
    expect(jestPlikiemPromptowym('server/src/ai/persona.ts')).toBe(true);
    expect(jestPlikiemPromptowym('src/services/aiPrompts.ts')).toBe(true);
    expect(jestPlikiemPromptowym('src/components/Chat/ChatView.tsx')).toBe(false);
    expect(jestPlikiemPromptowym('server/src/ai/__tests__/persona.test.ts')).toBe(false);
  });
});

describe('E2f / K10d — method pack DRD dla języka en', () => {
  const paczka = (title, definicja) => ({
    pack: {
      units: [{ unitId: 'A1', name: 'Sales Processes', description: 'Sales Processes — area of axis 1.' }],
      levels: [{ unitId: 'A1', level: 2, title, canonicalDefinition: definicja, expectedEvidence: [], technologyExamples: [] }],
      questions: [],
    },
    report: { discrepancies: ['model rozjazdu 1', 'model rozjazdu 2'] },
  });

  it('POZYTYW: polski tytuł poziomu w kompilacji `en` jest liczony (cel to 0)', () => {
    const w = policzDrd(paczka('Zarządzanie procesem sprzedaży', 'Proces jest opisany i mierzony.'));
    expect(w.K10dPL).toBe(2);
    expect(w.trafienia.some(([k, gdzie]) => k === 'K10dPL' && gdzie.includes('#title'))).toBe(true);
  });

  it('NEGATYW: wariant EN (titleEN/descriptionEN) daje 0, a rozjazdy liczą się osobno', () => {
    const w = policzDrd(paczka('Sales process management', 'The process is documented and measured.'));
    expect(w.K10dPL).toBe(0);
    expect(w.K10dROZ).toBe(2); // report.discrepancies — ujawnione, nie zerowane
  });
});
