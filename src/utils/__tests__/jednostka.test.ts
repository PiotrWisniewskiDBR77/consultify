/**
 * Separator wartość↔jednostka. Test celuje w REGUŁĘ (słowo dostaje spację, symbol nie),
 * nie w mechanizm sklejania.
 *
 * Dowód mutacyjny: zamiana `return \`${w} ${j}\`` na `return \`${w}${j}\`` w
 * src/utils/jednostka.ts wywala grupę „słowo"; zamiana gałęzi symbolu na wersję
 * ze spacją wywala grupę „symbol". Żadna pojedyncza mutacja nie przechodzi.
 */
import { describe, expect, it } from 'vitest';

import { zJednostka } from '../jednostka';

describe('zJednostka — separator zależny od jednostki', () => {
  it('jednostka będąca SŁOWEM dostaje spację', () => {
    expect(zJednostka(8, 'dni')).toBe('8 dni');       // defekt zgłoszony: „8dni"
    expect(zJednostka(12, 'dni')).toBe('12 dni');
    expect(zJednostka(120, 'zł')).toBe('120 zł');
    expect(zJednostka(4, 'h')).toBe('4 h');
    expect(zJednostka(12, 'szt.')).toBe('12 szt.');
    expect(zJednostka(3, 'µm')).toBe('3 µm');          // litera spoza ASCII
    expect(zJednostka(2, 'łóżka')).toBe('2 łóżka');    // polski znak na początku
  });

  it('jednostka będąca SYMBOLEM przykleja się — stan poprawny, którego nie wolno zepsuć', () => {
    expect(zJednostka(74, '%')).toBe('74%');           // to maskowało defekt „8dni"
    expect(zJednostka(20, '°')).toBe('20°');
    expect(zJednostka(3, '×')).toBe('3×');
    expect(zJednostka(5, '‰')).toBe('5‰');
  });

  it('nie podwaja spacji, gdy wołacz wpisał ją do samej jednostki', () => {
    // druga konwencja żyjąca w repo: unit=" MB", unit={` ${usage.storage.unit}`}
    expect(zJednostka(512, ' MB')).toBe('512 MB');
    expect(zJednostka(74, ' %')).toBe('74%');
  });

  it('brak jednostki — sama wartość, bez ogona', () => {
    expect(zJednostka(42, '')).toBe('42');
    expect(zJednostka(42, null)).toBe('42');
    expect(zJednostka(42, undefined)).toBe('42');
  });

  it('brak wartości — uczciwa kreska, nie „undefined" ani puste', () => {
    expect(zJednostka(null, 'dni')).toBe('—');
    expect(zJednostka(undefined, 'dni')).toBe('—');
    expect(zJednostka('', 'dni')).toBe('—');
    expect(zJednostka(null, 'dni', 'Brak danych')).toBe('Brak danych');
  });

  it('zero jest WARTOŚCIĄ, nie brakiem (pułapka falsy)', () => {
    expect(zJednostka(0, 'dni')).toBe('0 dni');
    expect(zJednostka(0, '%')).toBe('0%');
  });
});
