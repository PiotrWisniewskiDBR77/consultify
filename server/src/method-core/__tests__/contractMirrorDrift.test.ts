/**
 * Strażnik rozjazdu kontraktu (Opus, właściciel kontraktu).
 *
 * Kontrakt kernela jest zamrożony w `src/method-core/contracts/`, ale
 * `server/tsconfig.json` ma `rootDir: "."` i `include: ["src/**\/*"]`,
 * a produkcja startuje przez `cd server && tsc --build && node dist/src/index.js`.
 * Import z `server/src` poza katalog `server/` łamie ten build (TS6059), więc
 * serwer trzyma lustrzaną kopię kontraktu.
 *
 * Kopia bez strażnika to dług, który cicho gnije: ktoś zmieni typ po jednej
 * stronie, druga zostanie w tyle, a rozjazd wyjdzie dopiero w runtime.
 * Ten test zamienia ryzyko na natychmiastowy, czytelny FAIL.
 *
 * Reguła: plik lustrzany = nagłówek wyjaśniający + DOKŁADNA treść oryginału.
 * Nic poza nagłówkiem nie może się różnić.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/** Repo root — dwa poziomy nad server/src/method-core/__tests__. */
const REPO_ROOT = path.resolve(__dirname, '../../../..');

const CONTRACT_FILES = ['events', 'session', 'methodPack', 'teresa', 'index'] as const;

const sourcePath = (name: string) =>
  path.join(REPO_ROOT, 'src', 'method-core', 'contracts', `${name}.ts`);
const mirrorPath = (name: string) =>
  path.join(REPO_ROOT, 'server', 'src', 'method-core', 'contracts', `${name}.ts`);

describe('kontrakt kernela — strażnik rozjazdu kopii serwerowej', () => {
  it('oba komplety plików istnieją', () => {
    for (const name of CONTRACT_FILES) {
      expect(fs.existsSync(sourcePath(name)), `brak oryginału ${name}.ts`).toBe(true);
      expect(fs.existsSync(mirrorPath(name)), `brak kopii ${name}.ts`).toBe(true);
    }
  });

  it.each(CONTRACT_FILES)(
    'kopia serwerowa %s.ts zawiera DOKŁADNĄ treść oryginału (tylko nagłówek może się różnić)',
    (name) => {
      const source = fs.readFileSync(sourcePath(name), 'utf8');
      const mirror = fs.readFileSync(mirrorPath(name), 'utf8');

      if (!mirror.endsWith(source)) {
        // Zbuduj czytelny komunikat zamiast gołego false.
        const sourceLines = source.split('\n');
        const mirrorLines = mirror.split('\n');
        const tail = mirrorLines.slice(-sourceLines.length);
        const firstDiff = sourceLines.findIndex((l, i) => l !== tail[i]);
        throw new Error(
          `ROZJAZD KONTRAKTU w ${name}.ts.\n` +
            `Kopia server/src/method-core/contracts/${name}.ts przestała odpowiadać ` +
            `oryginałowi src/method-core/contracts/${name}.ts.\n` +
            (firstDiff >= 0
              ? `Pierwsza różnica ok. linii ${firstDiff + 1} oryginału:\n` +
                `  oryginał: ${JSON.stringify(sourceLines[firstDiff])}\n` +
                `  kopia   : ${JSON.stringify(tail[firstDiff])}\n`
              : `Różnica w długości: oryginał ${source.length} zn., kopia ${mirror.length} zn.\n`) +
            `NAPRAWA: skopiuj treść oryginału pod nagłówek MIRROR w pliku serwerowym.`
        );
      }

      expect(mirror.endsWith(source)).toBe(true);
    }
  );

  it('kopia nie dokłada niczego poza nagłówkiem (żadnego kodu przed treścią)', () => {
    for (const name of CONTRACT_FILES) {
      const source = fs.readFileSync(sourcePath(name), 'utf8');
      const mirror = fs.readFileSync(mirrorPath(name), 'utf8');
      const header = mirror.slice(0, mirror.length - source.length);

      // Nagłówek musi być wyłącznie komentarzem blokowym + białymi znakami.
      const withoutComments = header.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      expect(
        withoutComments,
        `kopia ${name}.ts ma kod przed treścią kontraktu: ${JSON.stringify(withoutComments.slice(0, 120))}`
      ).toBe('');
    }
  });
});
