import { afterEach, describe, expect, it, vi } from 'vitest';

import { isInitiativesFourButtonsEnabled } from '../initiativesFourButtonsFlag';

describe('VITE_INITIATIVES_FOUR_BUTTONS', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is disabled when the flag is absent or false', () => {
    vi.stubEnv('VITE_INITIATIVES_FOUR_BUTTONS', '');
    expect(isInitiativesFourButtonsEnabled()).toBe(false);
    vi.stubEnv('VITE_INITIATIVES_FOUR_BUTTONS', 'false');
    expect(isInitiativesFourButtonsEnabled()).toBe(false);
  });

  it('enables the four-button Initiatives surface only for true', () => {
    vi.stubEnv('VITE_INITIATIVES_FOUR_BUTTONS', 'true');
    expect(isInitiativesFourButtonsEnabled()).toBe(true);
    for (const alias of ['1', 'yes', 'on', 'TRUE', ' true ']) {
      vi.stubEnv('VITE_INITIATIVES_FOUR_BUTTONS', alias);
      expect(isInitiativesFourButtonsEnabled()).toBe(false);
    }
  });
});
