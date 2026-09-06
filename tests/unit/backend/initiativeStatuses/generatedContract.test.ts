import { describe, expect, it } from 'vitest';

import {
  InitiativeStatus as serverStatuses,
  INITIATIVE_FLAGS as serverFlags,
} from '../../../../server/src/constants/initiativeStatuses';
import {
  InitiativeStatus as frontendStatuses,
  INITIATIVE_FLAGS as frontendFlags,
  INITIATIVE_STATUS_LABEL_KEYS,
} from '../../../../packages/shared/src/constants/initiativeStatuses.generated';

describe('DEC-424 — generowany kontrakt frontu', () => {
  it('ma dokładnie te same kody i flagi co serwerowy SSOT', () => {
    expect(frontendStatuses).toEqual(serverStatuses);
    expect(frontendFlags).toEqual(serverFlags);
  });

  it('każdy kod wskazuje kanoniczny klucz i18n', () => {
    for (const status of Object.values(frontendStatuses)) {
      expect(INITIATIVE_STATUS_LABEL_KEYS[status]).toBe(`initiatives.status.${status}`);
    }
  });
});
