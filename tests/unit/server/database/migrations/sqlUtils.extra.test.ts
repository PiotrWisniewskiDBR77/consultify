import { describe, expect, it } from 'vitest';

import { splitSqlStatements } from '../../../../../server/src/database/migrations/sqlUtils.js';

describe('splitSqlStatements (extra)', () => {
  it('strips UTF-8 BOM', () => {
    const sql = `\uFEFFSELECT 1;`;
    expect(splitSqlStatements(sql)).toEqual(['SELECT 1']);
  });

  it('handles Windows newlines', () => {
    const sql = `-- c\r\nSELECT 1;\r\nSELECT 2;\r\n`;
    expect(splitSqlStatements(sql)).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('drops empty/comment-only tail after semicolon', () => {
    const sql = `SELECT 1; -- trailing comment only\n-- another\n`;
    expect(splitSqlStatements(sql)).toEqual(['SELECT 1']);
  });

  it('preserves multiple lines in one statement', () => {
    const sql = `SELECT\n  1\nFROM t;`;
    expect(splitSqlStatements(sql)).toEqual(['SELECT\n  1\nFROM t']);
  });

  it('returns [] for blank input', () => {
    expect(splitSqlStatements(' \n-- x\n')).toEqual([]);
  });
});
