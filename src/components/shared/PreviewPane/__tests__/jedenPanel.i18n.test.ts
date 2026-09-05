import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('T8 list.rightPanel i18n', () => {
  it('ma sześć właściwych wartości w PL i EN', () => {
    const read = (locale: 'pl' | 'en') =>
      JSON.parse(
        fs.readFileSync(path.resolve(`public/locales/${locale}/translation.json`), 'utf8')
      ).list.rightPanel;
    const pl = read('pl');
    const en = read('en');
    const keys = ['tabRecord', 'tabTeresa', 'close', 'show', 'openTeresa', 'teresaEmpty'];
    expect(keys.every((key) => typeof pl[key] === 'string' && typeof en[key] === 'string')).toBe(true);
    expect(pl.close).not.toBe(en.close);
    expect(pl.show).not.toBe(en.show);
    expect(pl.teresaEmpty).not.toBe(en.teresaEmpty);
  });
});
