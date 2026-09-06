/**
 * [ODMROZENIE 13_CHAT DEC-397] Kontrakt klasyfikatora „czat → dokument".
 *
 * Zgłoszenie właściciela 06.09 (1.1-D). Zdanie:
 *   „Słuchaj wiesz co chodzi mi o to żebyś zrobiła taką krótką zajawkę jak wygląda
 *    normalnie plan strategiczny w tym zakresie bez głębszej analizy"
 * uruchamiało w czacie tryb „Dokument: …" (karta + checklista), bo
 * `hasStrongDocumentNoun` szukało czasownika i rzeczownika GDZIEKOLWIEK w zdaniu:
 * „zrobiła" + „analizy" z frazy „BEZ głębszej analizy". Prośba była o krótką
 * odpowiedź w rozmowie, nie o artefakt.
 *
 * Dowód mutacyjny (ręcznie zweryfikowany): usunięcie którejkolwiek z dwóch bramek
 * (`documentNounIsExcluded` / `CHAT_TEASER_REQUEST`) w
 * `documentIntentDetector.ts` czerwieni ten plik — pierwszy blok („nie porywa
 * prośby o krótką zajawkę") przestaje przechodzić.
 */
import { describe, expect, it } from 'vitest';

import {
  detectDocumentIntent,
  hasStrongDocumentNoun,
  isChatTeaserRequest,
} from '../documentIntentDetector';

/** Bramka orkiestracji czatu — UnifiedChatPanel: `detect… || hasStrong…`. */
const bramkaDokumentu = (message: string): boolean =>
  detectDocumentIntent(message) || hasStrongDocumentNoun(message);

const ZDANIE_WLASCICIELA =
  'Słuchaj wiesz co chodzi mi o to żebyś zrobiła taką krótką zajawkę jak wygląda normalnie plan strategiczny w tym zakresie bez głębszej analizy';

describe('klasyfikator czat → dokument: nie porywa prośby o krótką zajawkę', () => {
  it('zdanie właściciela z 06.09 NIE uruchamia generacji dokumentu', () => {
    expect(hasStrongDocumentNoun(ZDANIE_WLASCICIELA)).toBe(false);
    expect(detectDocumentIntent(ZDANIE_WLASCICIELA)).toBe(false);
    expect(bramkaDokumentu(ZDANIE_WLASCICIELA)).toBe(false);
  });

  it.each([
    // rzeczownik-dokument ZANEGOWANY („bez …")
    'Zrób mi krótkie podsumowanie bez analizy',
    'Opowiedz o tym, ale zrób to bez raportu',
    'Tell me about it, but make it without a report',
    // prośba o formę odpowiedzi, nie o artefakt
    'Opowiedz w skrócie o raporcie i zrób notatkę',
    'Zrób zajawkę tej analizy',
  ])('nie porywa: %s', (message) => {
    expect(bramkaDokumentu(message)).toBe(false);
  });

  it('rozpoznaje prośbę o zajawkę jako osobny sygnał', () => {
    expect(isChatTeaserRequest(ZDANIE_WLASCICIELA)).toBe(true);
    expect(isChatTeaserRequest('Napisz raport z analizy rynku')).toBe(false);
  });
});

describe('klasyfikator czat → dokument: realne zamówienia dokumentu dalej działają', () => {
  it.each([
    'Napisz raport z analizy rynku',
    'Zrób krótki raport: tabela kosztów wdrożenia',
    'Przygotuj obszerny raport kwartalny',
    'Sporządź notatkę ze spotkania zarządu',
    'Write a detailed report on the supply chain',
    // „bez" dotyczy INNEGO fragmentu — zamówienie zostaje
    'Bez raportu, napisz notatkę',
  ])('routuje do dokumentu: %s', (message) => {
    expect(bramkaDokumentu(message)).toBe(true);
  });

  it('zwykła rozmowa o raporcie nie jest zamówieniem', () => {
    expect(bramkaDokumentu('co sądzisz o tym raporcie?')).toBe(false);
    expect(bramkaDokumentu('')).toBe(false);
  });
});
