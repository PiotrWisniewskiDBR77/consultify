import { beforeEach, describe, expect, it, vi } from 'vitest';

import { persistentCommandId } from '../../../src/services/initiatives-execution/persistentCommandId';

describe('persistentCommandId', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
  });

  it('reuses the same id after a retry/reload and isolates a different command fingerprint', () => {
    const first = persistentCommandId('work', 'case:3:task:complete');
    const afterReload = persistentCommandId('work', 'case:3:task:complete');
    const anotherCommand = persistentCommandId('work', 'case:4:task:complete');

    expect(afterReload).toBe(first);
    expect(anotherCommand).not.toBe(first);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(2);
  });
});
