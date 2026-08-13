import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

/**
 * Strażnik rejestru dev-render.
 *
 * POWÓD: `dev-render/main.tsx` importuje ekrany leniwie
 * (`React.lazy(() => import('./screens/X'))`). Gdy import trafi do commita,
 * a plik ekranu zostanie untracked, harness działa TYLKO na maszynie autora —
 * każdy świeży klon i każdy worktree dostaje `500 Internal server error`
 * na etapie import-analysis i pada CAŁY harness, nie jeden ekran.
 *
 * To nie jest hipotetyczne: `git log` ma już dwa commity
 * „repair/restore dangling harness import", a trzeci przypadek
 * (`./screens/tools-sesja-wyjscie`) wykryto 2026-08-13 podczas pracy nad Tools.
 *
 * Ten test zamienia nawracającą awarię w natychmiastowy, czytelny błąd.
 */

const REPO_ROOT = path.resolve(__dirname, '../..');
const DEV_RENDER = path.join(REPO_ROOT, 'dev-render');
const SCREENS_DIR = path.join(DEV_RENDER, 'screens');

/** Rozszerzenia, w jakich może istnieć moduł ekranu. */
const CANDIDATES = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'];

function resolveScreen(spec: string): string | null {
  const base = path.join(SCREENS_DIR, spec);
  for (const ext of CANDIDATES) {
    const p = base + ext;
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Wyciąga wszystkie dynamiczne importy ekranów z pliku wejściowego harnessu. */
function screenImportsFrom(file: string): string[] {
  const src = fs.readFileSync(file, 'utf8');
  const found = new Set<string>();
  // import('./screens/x')  oraz  import("./screens/x")
  const re = /import\(\s*['"]\.\/screens\/([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) found.add(m[1]);
  return [...found];
}

/** Statyczne importy ekranów (niektóre wejścia nie używają lazy). */
function staticScreenImportsFrom(file: string): string[] {
  const src = fs.readFileSync(file, 'utf8');
  const found = new Set<string>();
  const re = /from\s+['"]\.\/screens\/([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) found.add(m[1]);
  return [...found];
}

/** Wszystkie wejścia harnessu (main + dedykowane *-main.tsx). */
function harnessEntries(): string[] {
  if (!fs.existsSync(DEV_RENDER)) return [];
  return fs
    .readdirSync(DEV_RENDER)
    .filter((f) => f.endsWith('main.tsx'))
    .map((f) => path.join(DEV_RENDER, f));
}

describe('rejestr dev-render — każdy zadeklarowany ekran istnieje', () => {
  const entries = harnessEntries();

  it('znajduje wejścia harnessu', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries.map((e) => [path.basename(e), e] as const))(
    '%s: wszystkie importy ekranów są rozwiązywalne',
    (_name, file) => {
      const specs = [...screenImportsFrom(file), ...staticScreenImportsFrom(file)];
      const missing = specs.filter((s) => resolveScreen(s) === null);

      expect(
        missing,
        missing.length
          ? `Wiszące importy w ${path.relative(REPO_ROOT, file)}: ${missing.join(', ')}. ` +
              'Plik ekranu prawdopodobnie nie został zacommitowany (untracked). ' +
              'Nie twórz pustej atrapy — dodaj realny plik albo usuń wpis z rejestru.'
          : 'ok'
      ).toEqual([]);
    }
  );

  it('katalog ekranów nie jest pusty', () => {
    expect(fs.existsSync(SCREENS_DIR)).toBe(true);
    expect(fs.readdirSync(SCREENS_DIR).length).toBeGreaterThan(0);
  });

  // Konkretny przypadek, który wywrócił harness 2026-08-13.
  it('tools-sesja-wyjscie istnieje (regresja 2026-08-13)', () => {
    expect(resolveScreen('tools-sesja-wyjscie')).not.toBeNull();
  });
});
