import { describe, expect, it } from 'vitest';

import { splitSqlStatements } from '../../../../../server/src/database/migrations/sqlUtils.js';

describe('splitSqlStatements', () => {
  it('splits by semicolon and drops empty', () => {
    const sql = `SELECT 1;SELECT 2;`;
    expect(splitSqlStatements(sql)).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('drops leading -- comment-only chunks', () => {
    const sql = `-- comment\n\nSELECT 1;\n-- tail comment\n`;
    expect(splitSqlStatements(sql)).toEqual(['SELECT 1']);
  });

  it('keeps inline comments inside statements', () => {
    const sql = `SELECT 1 -- x\nFROM t;`;
    expect(splitSqlStatements(sql)).toEqual(['SELECT 1 -- x\nFROM t']);
  });
});
