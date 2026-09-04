import { describe, expect, it } from 'vitest';

import { adaptQuery } from '../../../../server/src/database/PostgresDatabase.js';

describe('day313 GROUP_CONCAT PostgreSQL adaptation', () => {
  it('adapts a plain aggregate', () => {
    expect(adaptQuery('SELECT GROUP_CONCAT(id) AS ids FROM items')).toContain(
      "STRING_AGG(id::text, ',')"
    );
  });

  it('adapts an aggregate with a separator', () => {
    expect(adaptQuery("SELECT GROUP_CONCAT(name, '|||') AS names FROM items")).toContain(
      "STRING_AGG(name::text, '|||')"
    );
  });

  it('adapts a DISTINCT aggregate', () => {
    expect(adaptQuery('SELECT GROUP_CONCAT(DISTINCT context) FROM items')).toContain(
      "STRING_AGG(DISTINCT context::text, ',')"
    );
  });
});
