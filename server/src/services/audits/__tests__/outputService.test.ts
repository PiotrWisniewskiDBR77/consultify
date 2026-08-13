/**
 * outputService.test — REALNA baza (consultify_audits_u5). Uruchamiaj z
 * korzenia worktree z prefiksem:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false
 *   POSTGRES_SKIP_INIT_IN_TEST=1
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u5"
 *
 * Bez `RUN_DB_TESTS=1 MOCK_DB=false` cała suita cicho mockuje bazę i
 * „przechodzi", nic nie testując — dlatego wykrywamy realne żądanie na
 * początku pliku i pomijamy resztę (`describe.skipIf`) zamiast fałszywie
 * zielenić się na mocku.
 *
 * UWAGA O KOLEJNOŚCI: korzeniowy vitest.config.ts włącza losową kolejność
 * testów. Scenariusz wersjonowania/hasha/niezmienności/diff/supersede jest
 * więc CELOWO jednym sekwencyjnym `it()` (proste `await` w linii), zamiast
 * kilku osobnych testów dzielących mutowalny stan — inaczej losowa kolejność
 * potrafiłaby uruchomić „wersja rośnie" przed „finalizuje Output v1" i dać
 * fałszywy czerwony wynik niezależny od poprawności kodu.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');

describe.skipIf(!REAL_PG)('outputService (real Postgres)', () => {
  let pool: InstanceType<typeof import('pg').Pool>;
  let outputService: typeof import('../outputService.js');
  let permissions: typeof import('../permissions.js');

  const orgA = `org-u5-out-${randomUUID()}`;
  const orgB = `org-u5-out-b-${randomUUID()}`;
  const leadUser = `user-u5-lead-${randomUUID()}`;

  const allOrgIds = [orgA, orgB];

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    outputService = await import('../outputService.js');
    permissions = await import('../permissions.js');
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    for (const table of [
      'audit_outputs',
      'audit_verifications',
      'audit_corrective_actions',
      'audit_management_responses',
      'audit_program_findings',
      'audit_evidence',
      'audit_program_criteria',
      'audit_program_members',
      'audit_programs',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id = ANY($1)`, [allOrgIds]);
    }
    await pool.end();
  });

  async function makeProgram(orgId: string, opts: { withLead?: boolean } = {}): Promise<string> {
    const id = `prog-u5-out-${randomUUID()}`;
    await pool.query(
      `INSERT INTO audit_programs (id, organization_id, name, objective, scope_text, scope_json, status, created_by)
       VALUES ($1,$2,'Audyt kontroli dostępu',$3,$4,$5,'fieldwork',$6)`,
      [
        id,
        orgId,
        'Potwierdzić zgodność zarządzania dostępem',
        'Systemy finansowe i katalog AD',
        JSON.stringify({ systems: ['ERP', 'AD'] }),
        leadUser,
      ],
    );
    if (opts.withLead !== false) {
      await pool.query(
        `INSERT INTO audit_program_members (id, program_id, organization_id, user_id, member_role, independence_declared)
         VALUES ($1,$2,$3,$4,'lead_auditor', TRUE)`,
        [`memb-${randomUUID()}`, id, orgId, leadUser],
      );
    }
    return id;
  }

  async function insertFinding(
    programId: string,
    orgId: string,
    status: string,
    extra: Partial<Record<string, unknown>> = {},
  ): Promise<string> {
    const id = `find-${randomUUID()}`;
    await pool.query(
      `INSERT INTO audit_program_findings
         (id, program_id, organization_id, statement, classification, severity, status,
          root_cause, root_cause_confirmed, residual_risk)
       VALUES ($1,$2,$3,$4,'nonconforming',$5,$6,$7,$8,$9)`,
      [
        id,
        programId,
        orgId,
        (extra.statement as string) ?? 'Ustalenie testowe',
        (extra.severity as string) ?? 'medium',
        status,
        (extra.rootCause as string) ?? null,
        (extra.rootCauseConfirmed as boolean) ?? false,
        (extra.residualRisk as string) ?? null,
      ],
    );
    return id;
  }

  async function insertEvidence(
    programId: string,
    orgId: string,
    criterionId: string | null,
    extra: Partial<Record<string, unknown>> = {},
  ): Promise<string> {
    const id = `ev-${randomUUID()}`;
    await pool.query(
      `INSERT INTO audit_evidence
         (id, program_id, organization_id, criterion_id, evidence_kind, title,
          material_id, material_version, content_hash, sufficiency, supports_conformity)
       VALUES ($1,$2,$3,$4,'document',$5,$6,$7,$8,$9,$10)`,
      [
        id,
        programId,
        orgId,
        criterionId,
        (extra.title as string) ?? 'Dowód testowy',
        (extra.materialId as string) ?? 'mat-1',
        (extra.materialVersion as string) ?? 'v1',
        (extra.contentHash as string) ?? 'sha256:test',
        (extra.sufficiency as string) ?? 'sufficient',
        (extra.supportsConformity as boolean) ?? true,
      ],
    );
    return id;
  }

  function actorFor(orgId: string, userId: string = leadUser) {
    return { userId, organizationId: orgId };
  }

  it('blokuje finalizację, gdy program ma ustalenie w statusie draft', async () => {
    const programId = await makeProgram(orgA);
    await insertFinding(programId, orgA, 'draft');
    await expect(
      outputService.finalizeOutput(orgA, actorFor(orgA), programId, { title: 'Output v1' }),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_STATE' });
  });

  it('blokuje finalizację, gdy program ma ustalenie w statusie in_review', async () => {
    const programId = await makeProgram(orgA);
    await insertFinding(programId, orgA, 'in_review');
    await expect(outputService.finalizeOutput(orgA, actorFor(orgA), programId, {})).rejects.toMatchObject({
      code: 'AUDIT_INVALID_STATE',
    });
  });

  it('finalizeOutput odmawia dostępu aktorowi bez roli audytowej w programie (segregacja obowiązków)', async () => {
    const programId = await makeProgram(orgA);
    const strangerId = `user-u5-stranger-${randomUUID()}`;
    await expect(
      outputService.finalizeOutput(orgA, actorFor(orgA, strangerId), programId, {}),
    ).rejects.toMatchObject({ code: 'AUDIT_FORBIDDEN' });
    const access = await permissions.resolveProgramAccess(actorFor(orgA, strangerId), programId);
    expect(access.capabilities.has('output.finalize')).toBe(false);
  });

  it('Output jest niezmienny — moduł nie eksportuje żadnej funkcji update/edit/patch', () => {
    const mod = outputService as unknown as Record<string, unknown>;
    expect(mod.updateOutput).toBeUndefined();
    expect(mod.editOutput).toBeUndefined();
    expect(mod.patchOutput).toBeUndefined();
  });

  it('izolacja organizacji — program bez outputów w org B nie widzi outputów org A; wiersz org A jest niewidoczny pod org B', async () => {
    const programA = await makeProgram(orgA);
    await insertFinding(programA, orgA, 'confirmed', { rootCauseConfirmed: true, rootCause: 'x' });
    const outputA = await outputService.finalizeOutput(orgA, actorFor(orgA), programA, { title: 'Izolacja A' });

    const programB = await makeProgram(orgB);
    const outputsOrgB = await outputService.listOutputs(orgB, { programId: programB });
    expect(outputsOrgB).toHaveLength(0);

    const crossOrgLookup = await outputService.getOutput(orgB, outputA.id);
    expect(crossOrgLookup).toBeNull();
  });

  it(
    'cykl życia Outputu: finalizacja → wersja rośnie → hash deterministyczny → payload z provenance ' +
      'dowodu → diff wykrywa zmianę zgodności → supersede nie kasuje starej wersji',
    async () => {
      const programId = await makeProgram(orgA);
      await insertEvidence(programId, orgA, null, { materialVersion: 'v7', contentHash: 'sha256:deadbeef' });
      await insertFinding(programId, orgA, 'confirmed', {
        statement: 'Konto serwisowe ma nadmiarowy dostęp',
        severity: 'high',
        rootCause: 'Brak przeglądu uprawnień',
        rootCauseConfirmed: true,
      });

      // 1) pierwsza finalizacja startuje od wersji 1
      const outputV1 = await outputService.finalizeOutput(orgA, actorFor(orgA), programId, { title: 'Output v1' });
      expect(outputV1.version).toBe(1);
      expect(outputV1.contentHash).toBeTruthy();

      // 2) druga finalizacja tego samego programu → wersja rośnie do 2
      const outputV2 = await outputService.finalizeOutput(orgA, actorFor(orgA), programId, { title: 'Output v2' });
      expect(outputV2.version).toBe(2);

      // 3) hash jest deterministyczny w 10 kolejnych wywołaniach na tym samym payloadzie
      const hashes = new Set<string>();
      for (let i = 0; i < 10; i++) {
        hashes.add(outputService.computeOutputHash(outputV1.payload));
      }
      expect(hashes.size).toBe(1);
      expect(hashes.has(outputV1.contentHash as string)).toBe(true);

      // 4) payload zawiera provenance dowodu
      const payload = outputV1.payload as { evidence: Array<Record<string, unknown>> };
      expect(payload.evidence.length).toBeGreaterThan(0);
      expect(payload.evidence[0].materialId).toBeTruthy();
      expect(payload.evidence[0].materialVersion).toBe('v7');
      expect(payload.evidence[0].contentHash).toBe('sha256:deadbeef');

      // 5) diffOutputs wykrywa zmianę statusu zgodności kryterium między wersjami
      const critId = `crit-${randomUUID()}`;
      await pool.query(
        `INSERT INTO audit_program_criteria (id, program_id, organization_id, title, conformity_status)
         VALUES ($1,$2,$3,'Kontrola haseł','conforming')`,
        [critId, programId, orgA],
      );
      const outputV3 = await outputService.finalizeOutput(orgA, actorFor(orgA), programId, { title: 'Output v3' });
      await pool.query(`UPDATE audit_program_criteria SET conformity_status='nonconforming' WHERE id=$1`, [critId]);
      const outputV4 = await outputService.finalizeOutput(orgA, actorFor(orgA), programId, { title: 'Output v4' });

      const diff = await outputService.diffOutputs(orgA, outputV3.id, outputV4.id);
      const change = diff.conformityChanges.find((c) => c.criterionId === critId);
      expect(change).toBeDefined();
      expect(change?.before).toBe('conforming');
      expect(change?.after).toBe('nonconforming');

      // 6) supersede oznacza starą wersję jako zastąpioną BEZ modyfikacji jej payloadu
      await outputService.supersedeOutput(orgA, actorFor(orgA), outputV1.id, outputV4.id);
      const reloadedV1 = await outputService.getOutput(orgA, outputV1.id);
      expect(reloadedV1).not.toBeNull();
      expect(reloadedV1!.supersededBy).toBe(outputV4.id);
      expect(reloadedV1!.payload).toEqual(outputV1.payload);
      expect(reloadedV1!.contentHash).toBe(outputV1.contentHash);
    },
  );
});
