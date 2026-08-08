import { describe, expect, it } from 'vitest';

import { resolveNotificationReadColumn } from '../../../server/src/database/PostgresDatabase.js';

describe('Postgres notification read-index compatibility', () => {
  it('prefers the canonical is_read column when both schemas are visible', () => {
    expect(resolveNotificationReadColumn(['read', 'is_read'])).toBe('is_read');
  });

  it('supports the legacy read column', () => {
    expect(resolveNotificationReadColumn(['read'])).toBe('read');
  });

  it('fails closed to no index column when neither schema is present', () => {
    expect(resolveNotificationReadColumn(['user_id', 'created_at'])).toBeNull();
  });
});
