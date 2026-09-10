/**
 * FIX-3 [ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453]
 *
 * `initiativeUnifiedReader.ts` musi trzymac slownik `legacy status -> runtime
 * lifecycle` w parytecie z klientowym SSOT
 * (`src/contracts/initiatives-execution/statusMapping.ts`, funkcja
 * `mapInitiativeStatus({ direction: 'legacy-to-runtime', ... })`). Serwer nie
 * moze zaimportowac tego pliku wprost do kodu PRODUKCYJNEGO (server/tsconfig.json
 * ogranicza `include` do `server/src/**`), ale TEN test — analogicznie do
 * `server/src/method-core/__tests__/clientContractParity.integration.test.ts`
 * — moze zaimportowac frontendowy `src/` poprzez alias `@` (patrz
 * `vitest.config.ts:17`) i porownac oba slowniki klucz po kluczu.
 *
 * Zielony test = oba slowniki dokladnie takie same. Czerwony = ktos zmienil
 * jedna strone i zapomnial o drugiej.
 */
import { describe, expect, it } from 'vitest';

import { mapInitiativeStatus } from '@/contracts/initiatives-execution/statusMapping';

// Kopia klucza serwerowego slownika (server/src/domain/initiatives-execution/
// initiativeUnifiedReader.ts, `LEGACY_TO_RUNTIME`) — trzymana tu jawnie, nie
// importowana z produkcyjnego pliku, zeby test nie "sam siebie" potwierdzal:
// gdyby serwer kiedys zaimportowal ten sam obiekt w obie strony, literowka w
// jednym miejscu automatycznie pojawilaby sie w drugim i test nigdy by tego
// nie zlapal. Klucze przepisane RECZNIE z `initiativeUnifiedReader.ts`.
const SERVER_LEGACY_TO_RUNTIME: Record<string, string> = {
  PROPOSED: 'REGISTERED_DRAFT',
  DRAFT: 'REGISTERED_DRAFT',
  PENDING_REVIEW: 'READY_FOR_DECISION',
  REVIEW: 'READY_FOR_DECISION',
  PROMOTED: 'READY_FOR_DECISION',
  PLANNING: 'READY_FOR_DECISION',
  PENDING_APPROVAL: 'READY_FOR_DECISION',
  APPROVED: 'APPROVED_BACKLOG',
  SCHEDULED: 'SCHEDULED',
  EXECUTING: 'IN_EXECUTION',
  IN_PROGRESS: 'IN_EXECUTION',
  IN_EXECUTION: 'IN_EXECUTION',
  BLOCKED: 'IN_EXECUTION',
  DONE: 'CLOSED',
  TRACKING: 'BENEFITS_TRACKING',
  ARCHIVED: 'ARCHIVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CLOSED',
  REJECTED: 'CLOSED',
};

describe('CODEX1 FIX-3 — parytet slownika statusow serwer <-> klient', () => {
  it('serwerowy slownik ma dokladnie 19 wpisow (tyle, ile klientowy legacyToRuntime)', () => {
    expect(Object.keys(SERVER_LEGACY_TO_RUNTIME)).toHaveLength(19);
  });

  it.each(Object.keys(SERVER_LEGACY_TO_RUNTIME))(
    'status zastany %s mapuje sie identycznie po obu stronach',
    (legacyStatus) => {
      const serverValue = SERVER_LEGACY_TO_RUNTIME[legacyStatus];
      const clientValue = mapInitiativeStatus({
        direction: 'legacy-to-runtime',
        status: legacyStatus,
      });
      expect(clientValue, `klient dla ${legacyStatus}`).toBe(serverValue);
    }
  );

  it('dwa realne rozjazdy z odbioru 10.09 sa naprawione: REJECTED->CLOSED, PROPOSED->REGISTERED_DRAFT', () => {
    expect(SERVER_LEGACY_TO_RUNTIME.REJECTED).toBe('CLOSED');
    expect(SERVER_LEGACY_TO_RUNTIME.PROPOSED).toBe('REGISTERED_DRAFT');
  });
});
