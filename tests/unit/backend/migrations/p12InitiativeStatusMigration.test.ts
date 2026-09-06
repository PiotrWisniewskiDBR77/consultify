import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { sortMigrationsDeterministically } from '../../../../server/scripts/migrationOrdering';

const filename = '20262103_p12_initiative_status_slownik.sql';

describe('DEC-424 — migracja statusów inicjatywy', () => {
  it('jest ostatnia w deterministycznej kolejności migracji', () => {
    const files = ['20262102_okr_p7k_report_fields.sql', filename].map((name) => ({
      filename: name, version: name.split('_')[0], filepath: name, checksum: name,
    }));
    expect(sortMigrationsDeterministically(files).map((item) => item.filename))
      .toEqual(['20262102_okr_p7k_report_fields.sql', filename]);
  });

  it('ma warunkowy backfill i nowy ścisły CHECK siedmiu wartości', () => {
    const sql = readFileSync(resolve('server/migrations', filename), 'utf8');
    expect(sql).toContain('IS DISTINCT FROM');
    expect(sql).toContain('initiatives_status_check_p12');
    expect(sql).toContain("'IN_EXECUTION', 'CLOSED', 'REJECTED'");
  });
});
