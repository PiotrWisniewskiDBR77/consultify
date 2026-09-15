import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

type LocaleTree = Record<string, unknown>;

const repoRoot = process.cwd();
const locale = (language: 'en' | 'pl'): LocaleTree =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, `public/locales/${language}/translation.json`), 'utf8'));

const get = (tree: LocaleTree, key: string): unknown =>
  key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as LocaleTree)[part];
  }, tree);

const collectFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(absolute) : absolute.endsWith('.tsx') ? [absolute] : [];
  });

describe('W73 K2 SuperAdmin language debt', () => {
  it('keeps every SuperAdmin key present in EN and PL with a real Polish value', () => {
    const en = locale('en');
    const pl = locale('pl');
    const roots = [
      path.join(repoRoot, 'src/views/superadmin'),
      path.join(repoRoot, 'src/components/SuperAdmin'),
    ];
    const keys = roots
      .flatMap(collectFiles)
      .flatMap((file) => [
        ...fs.readFileSync(file, 'utf8').matchAll(/tlumaczPozaHookiem\(["'](superadmin\.[^"']+)["']/g),
      ])
      .map((match) => match[1]);

    expect(keys.length).toBeGreaterThan(500);
    for (const key of keys) {
      const english = get(en, key);
      expect(typeof english, `${key} missing in EN`).toBe('string');
      expect(typeof get(pl, key), `${key} missing in PL`).toBe('string');
      expect(get(pl, key), `${key} still equals EN`).not.toBe(english);
    }
  });

  it('uses the account locale for every measured date and number formatter in the owned paths', () => {
    const roots = [
      path.join(repoRoot, 'src/views/superadmin'),
      path.join(repoRoot, 'src/components/SuperAdmin'),
    ];
    const source = roots.flatMap(collectFiles).map((file) => fs.readFileSync(file, 'utf8')).join('\n');

    expect(source).not.toMatch(/\.toLocale(?:DateString|TimeString|String)\(\s*\)/);
    expect(source).not.toMatch(/\.toLocale(?:DateString|TimeString|String)\(\s*['"](?:en-US|pl-PL)['"]/);
    expect(source).not.toMatch(/new Intl\.(?:DateTimeFormat|NumberFormat)\(\s*(?:\)|['"](?:en-US|pl-PL)['"])/);
  });
});
