import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { rmSync } from 'node:fs';
import { classifyG19Line, collectG19Rows, parseSnapshotDate } from '../../scripts/dev/g19-waznosc-dowodu.mjs';

const roots = [];
afterEach(() => { while (roots.length) rmSync(roots.pop(), { recursive: true, force: true }); });

function fixture(lines) {
  const root = mkdtempSync(join(tmpdir(), 'g19-waznosc-'));
  roots.push(root);
  lines.forEach((line, index) => {
    const dir = join(root, 'docs/program/waves/WAVE_03_ACCEPTANCE/modules', String(index + 1).padStart(2, '0'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'MODULE_ACCEPTANCE.md'), `${line}\n`);
  });
  return root;
}

describe('G19 evidence validity guard', () => {
  const snapshot = parseSnapshotDate('2026-09-04');

  it('marks a 30-day-old closed row PASS_STALE after the seven-day validity window', () => {
    const row = classifyG19Line('| G19 | label | `PASS` | data=2026-08-05 sha=2a7273e087 |', snapshot);
    assert.equal(row.verdict, 'PASS_STALE');
  });

  it('blocks a row claiming closure without measurement date or SHA', () => {
    const row = classifyG19Line('| G19 | label | `PASS` | no measurement metadata |', snapshot);
    assert.equal(row.verdict, 'BRAK_DATY_POMIARU');
  });

  it('fails closed when fewer than sixteen G19 rows are examined', () => {
    const root = fixture(['| G19 | label | `NOT_PROVEN` | open |']);
    const result = collectG19Rows(root, snapshot);
    assert.equal(result.rows.length, 1);
    assert.equal(result.floorMet, false);
    assert.equal(result.exitCode, 1);
  });

  it('accepts sixteen open rows as not applicable without requiring dates', () => {
    const root = fixture(Array.from({ length: 16 }, () => '| G19 | label | `NOT_PROVEN / OWNER_RETEST_PENDING` | open |'));
    const result = collectG19Rows(root, snapshot);
    assert.equal(result.rows.every((row) => row.verdict === 'NIE_DOTYCZY'), true);
    assert.equal(result.exitCode, 0);
  });
});
