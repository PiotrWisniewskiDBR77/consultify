import { describe, expect, it } from 'vitest';

import { isDemoCleanupScheduleEnabled } from '../Scheduler.js';

describe('demo cleanup scheduler flag (DEC-518)', () => {
  it('does not start the destructive job without an explicit true value', () => {
    expect(isDemoCleanupScheduleEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isDemoCleanupScheduleEnabled({ ENABLE_DEMO_SANDBOX_TTL: '' } as NodeJS.ProcessEnv)).toBe(
      false
    );
    expect(
      isDemoCleanupScheduleEnabled({ ENABLE_DEMO_SANDBOX_TTL: 'false' } as NodeJS.ProcessEnv)
    ).toBe(false);
    expect(
      isDemoCleanupScheduleEnabled({ ENABLE_DEMO_SANDBOX_TTL: 'unexpected' } as NodeJS.ProcessEnv)
    ).toBe(false);
  });

  it.each(['true', 'TRUE', '1', 'yes', 'on'])('starts only for opt-in value %s', (value) => {
    expect(
      isDemoCleanupScheduleEnabled({ ENABLE_DEMO_SANDBOX_TTL: value } as NodeJS.ProcessEnv)
    ).toBe(true);
  });
});
