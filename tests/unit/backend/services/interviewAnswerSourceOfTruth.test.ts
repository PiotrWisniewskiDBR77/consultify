/**
 * M03R-003 — strażnik źródła prawdy odpowiedzi wywiadu.
 *
 * Decyzja Master Codex 2026-08-04:
 *   · bieżący stan odpowiedzi  = `interview_questions.answer_text` (+ `status`)
 *   · historia submission/send-back = `interview_answer_history`
 *   · `interview_answers` = MARTWY SCHEMAT — bez czytelników, bez zapisów,
 *     bez trwałego dual-write.
 *
 * Ten test nie sprawdza zachowania runtime, tylko pilnuje decyzji. Powód:
 * objaw „submitted z progresem 0%" naturalnie kusi, żeby „naprawić" go
 * podpięciem pustej tabeli `interview_answers`. To by odwróciło decyzję po
 * cichu i rozbiło stan na dwa rejestry. Jeżeli ktoś świadomie zmienia kanon,
 * musi najpierw zmienić ten plik — czyli zostawić ślad w przeglądzie.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../../..');

/** Katalogi produktu. Migracje i ten test są celowo poza skanem. */
const SCANNED_ROOTS = ['server/src', 'src'];
const SCANNED_EXTENSIONS = ['.ts', '.tsx'];

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      acc.push(full);
    }
  }
  return acc;
}

describe('M03R-003 — źródło prawdy odpowiedzi wywiadu', () => {
  const files = SCANNED_ROOTS.flatMap((root) => collectSourceFiles(join(REPO_ROOT, root)));

  it('kontrola negatywna: skan faktycznie widzi pliki produktu', () => {
    // Bez tego cały test mógłby przechodzić dlatego, że nie przeczytał niczego.
    expect(files.length).toBeGreaterThan(500);
    const canonicalReaders = files.filter((f) =>
      readFileSync(f, 'utf8').includes('interview_questions')
    );
    expect(canonicalReaders.length).toBeGreaterThan(0);
  });

  it('żaden plik produktu nie czyta ani nie pisze do interview_answers', () => {
    const offenders = files.filter((f) => {
      const body = readFileSync(f, 'utf8');
      // `interview_answers` jako nazwa tabeli — nie mylić z `interview_answer_history`.
      return /\binterview_answers\b/.test(body);
    });

    expect(
      offenders.map((f) => f.replace(`${REPO_ROOT}/`, '')),
      'interview_answers jest martwym schematem; bieżący stan trzyma interview_questions.answer_text'
    ).toEqual([]);
  });

  it('historia submission/send-back pozostaje w interview_answer_history', () => {
    const historyUsers = files.filter((f) =>
      readFileSync(f, 'utf8').includes('interview_answer_history')
    );
    expect(historyUsers.length).toBeGreaterThan(0);
  });
});
