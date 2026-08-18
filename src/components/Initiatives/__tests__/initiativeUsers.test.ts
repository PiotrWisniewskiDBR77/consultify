import { describe, expect, it } from 'vitest';

import { dedupeInitiativeUsersById } from '../initiativeUsers';

describe('dedupeInitiativeUsersById', () => {
  it('keeps one stable option per server user id without changing the selected id', () => {
    const selectedOwnerId = 'user-2';
    const users = dedupeInitiativeUsersById([
      { id: 'user-1', firstName: 'First' },
      { id: 'user-2', firstName: 'Selected' },
      { id: 'user-1', firstName: 'Duplicate first' },
      { id: 'user-2', firstName: 'Duplicate selected' },
    ]);

    expect(users.map((user) => user.id)).toEqual(['user-1', 'user-2']);
    expect(users.find((user) => user.id === selectedOwnerId)?.firstName).toBe('Selected');
  });
});
