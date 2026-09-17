/**
 * platformOwnerReportDraft.realdb.test — U-31 / DEC-572 (RAPORT-GEN, Wpis 66).
 *
 * POMIAR (diagnoza W98_RAPORT_GEN): właściciel platformy (`platformRole`
 * `owner`/`admin`/`superadmin`) BEZ wpisu w `audit_program_members` nie mógł
 * WYTWORZYĆ szkicu raportu audytu — `PLATFORM_ADMIN_CAPABILITIES`
 * (`permissions.ts:236`) nie zawierało `report.draft`, a `generateReport`
 * (`reportService.ts:135`) zaczyna się od `requireCapability(actor, programId,
 * 'report.draft')`. Moduł zamykał się w błędnym kole: rolę audytową nadaje się
 * W programie, więc bez członkostwa nikt jej nie ma, a bez `report.draft` nie
 * da się szkicować.
 *
 * NAPRAWA: `report.draft` dodane do `PLATFORM_ADMIN_CAPABILITIES` — ale NIE
 * `report.approve`/`report.publish`/`evidence.*`/`finding.*`, więc segregacja
 * obowiązków (autor ≠ zatwierdzający) zostaje zachowana.
 *
 * Ten test dowodzi na REALNEJ Postgres (nie mocki), że:
 *   1. aktor `owner` bez członkostwa w programie PRZECHODZI bramkę
 *      `report.draft` (dokładnie tę, którą `generateReport` stawia jako
 *      pierwszą) — czyli może otworzyć szkic raportu;
 *   2. `resolveProgramAccess` zwraca `isPlatformAdmin=true`, `isMember=false`
 *      i `report.draft` w zbiorze capability;
 *   3. `report.approve` i `report.publish` pozostają ODMÓWIONE (segregacja).
 *
 * DOWÓD MUTACYJNY: usunięcie `report.draft` z `PLATFORM_ADMIN_CAPABILITIES`
 * → krok 1 rzuca `AuditPermissionError` (test RED); po przywróceniu GREEN.
 *
 * RUN:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6611/consultify_dump \
 *   npx vitest run server/src/services/audits/__tests__/platformOwnerReportDraft.realdb.test.ts \
 *     --maxWorkers=1 --no-file-parallelism
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditPermissionError } from '../auditsDb.js';
import { requireCapability, resolveProgramAccess } from '../permissions.js';
import type { AuditActor } from '../types.js';
import { cleanupFixture, createFixture, requireRealPg, uid, type TestFixture } from './testHelpers.js';

describe('U-31 / DEC-572 — platform OWNER drafts an audit report without audit_program_members', () => {
  let fixture: TestFixture;
  let owner: AuditActor;

  beforeAll(async () => {
    requireRealPg();
    fixture = await createFixture();
    // Platform owner, deliberately NOT added to audit_program_members.
    owner = { organizationId: fixture.organizationId, userId: uid('owner'), platformRole: 'owner' };
  });

  afterAll(async () => {
    if (fixture) await cleanupFixture(fixture.organizationId);
  });

  it('resolves report.draft for a non-member platform owner (the generateReport:135 gate)', async () => {
    // generateReport() opens with exactly this call; if it resolves, the OWNER
    // can create the draft.
    const access = await requireCapability(owner, fixture.programId, 'report.draft');
    expect(access.isPlatformAdmin).toBe(true);
    expect(access.isMember).toBe(false);
    expect(access.capabilities.has('report.draft')).toBe(true);
  });

  it('keeps approve/publish behind audit roles (segregation of duties preserved)', async () => {
    const access = await resolveProgramAccess(owner, fixture.programId);
    expect(access.capabilities.has('report.draft')).toBe(true);
    expect(access.capabilities.has('report.approve')).toBe(false);
    expect(access.capabilities.has('report.publish')).toBe(false);

    await expect(
      requireCapability(owner, fixture.programId, 'report.approve')
    ).rejects.toBeInstanceOf(AuditPermissionError);
    await expect(
      requireCapability(owner, fixture.programId, 'report.publish')
    ).rejects.toBeInstanceOf(AuditPermissionError);
  });
});
