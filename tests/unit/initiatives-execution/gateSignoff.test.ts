import { describe, expect, it } from 'vitest';
import { gateSignoffId } from '../../../server/src/domain/initiatives-execution/gateSignoff';
describe('Gate Signoff identity', () => {
  it('is stable per gate decision signer and role', () => {
    expect(gateSignoffId('DEFINITION', 'd1', 'u1', 'TEAM_LEAD')).toBe(
      gateSignoffId('DEFINITION', 'd1', 'u1', 'TEAM_LEAD')
    );
    expect(gateSignoffId('DEFINITION', 'd1', 'u1', 'TEAM_LEAD')).not.toBe(
      gateSignoffId('DEFINITION', 'd1', 'u2', 'TEAM_LEAD')
    );
  });
});
