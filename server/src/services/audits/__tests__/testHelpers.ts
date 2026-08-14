/**
 * testHelpers — U4 — fixture'y do testów przeciw realnej Postgres.
 *
 * Nie zależymy od U2/U3 (packService/programService jeszcze nie istnieją na
 * tej gałęzi) — program, pakiet, kryterium i dowód wstawiamy bezpośrednio
 * SQL-em, dokładnie tak jak wymaga to zadanie U4. Każdy fixture dostaje własne
 * `organizationId`, więc testy mogą się sprzątać przez `DELETE ... WHERE
 * organization_id = $1` bez ryzyka zabrania danych innej sesji testowej.
 */

import { randomUUID } from 'crypto';

import { auditRun } from '../auditsDb.js';
import type { AuditActor, AuditRole } from '../types.js';

export function uid(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function requireRealPg(): void {
  const url = process.env.DATABASE_URL || '';
  const ok =
    process.env.RUN_DB_TESTS === '1' &&
    process.env.MOCK_DB === 'false' &&
    process.env.NODE_ENV === 'test' &&
    url.startsWith('postgres');
  if (!ok) {
    throw new Error(
      'Ten plik testowy wymaga realnej Postgres: uruchom z ' +
        'NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... ' +
        '(bez tego DbPromise cicho zamockuje bazę i testy "przejdą" nic nie sprawdzając)'
    );
  }
}

export interface TestFixture {
  organizationId: string;
  programId: string;
  packId: string;
  criterionId: string;
  evidenceId: string;
}

export interface CreateFixtureOptions {
  decisionRules?: Record<string, unknown>;
  findingTaxonomy?: Array<Record<string, unknown>>;
}

const DEFAULT_TAXONOMY = [
  {
    key: 'nonconforming',
    label: 'Niezgodność',
    nonConforming: true,
    requiresCorrectiveAction: true,
  },
  {
    key: 'observation',
    label: 'Obserwacja',
    nonConforming: false,
    requiresCorrectiveAction: false,
  },
  {
    key: 'evidence_insufficient',
    label: 'Dowód niewystarczający',
    nonConforming: false,
    requiresCorrectiveAction: false,
  },
];

export async function createFixture(opts: CreateFixtureOptions = {}): Promise<TestFixture> {
  const organizationId = uid('org');
  const packId = uid('pack');
  const programId = uid('prog');
  const criterionId = uid('crit');
  const evidenceId = uid('ev');

  await auditRun(
    `INSERT INTO audit_packs
       (id, organization_id, pack_key, version, title, classification, publication_status,
        decision_rules, finding_taxonomy)
     VALUES ($1,$2,$3,1,$4,'DEMONSTRATION','draft',$5,$6)`,
    [
      packId,
      organizationId,
      `u4-test-pack-${packId}`,
      'Pakiet testowy U4',
      JSON.stringify(opts.decisionRules ?? {}),
      JSON.stringify(opts.findingTaxonomy ?? DEFAULT_TAXONOMY),
    ]
  );

  await auditRun(
    `INSERT INTO audit_programs (id, organization_id, name, status, created_by, pack_id, lifecycle_state)
     VALUES ($1,$2,'Program testowy U4','active','seed',$3,'fieldwork')`,
    [programId, organizationId, packId]
  );

  await auditRun(
    `INSERT INTO audit_program_criteria
       (id, program_id, organization_id, ordinal, ref_code, title, requirement_text)
     VALUES ($1,$2,$3,1,'A.1','Kryterium testowe','Wymaganie testowe U4')`,
    [criterionId, programId, organizationId]
  );

  await auditRun(
    `INSERT INTO audit_evidence (id, program_id, organization_id, criterion_id, evidence_kind, title)
     VALUES ($1,$2,$3,$4,'document','Dowód testowy U4')`,
    [evidenceId, programId, organizationId, criterionId]
  );

  return { organizationId, programId, packId, criterionId, evidenceId };
}

export async function addMember(
  organizationId: string,
  programId: string,
  userId: string,
  role: AuditRole
): Promise<void> {
  await auditRun(
    `INSERT INTO audit_program_members (id, program_id, organization_id, user_id, member_role)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (program_id, user_id, member_role) DO NOTHING`,
    [uid('mem'), programId, organizationId, userId, role]
  );
}

export function actorFor(organizationId: string, userId: string): AuditActor {
  return { organizationId, userId, platformRole: 'user' };
}

/** Dodaje dowód obiektywny bezpośrednio (poza serwisem) — do fixture'ów. */
export async function addEvidence(
  organizationId: string,
  programId: string,
  criterionId: string,
  title = 'Dodatkowy dowód testowy'
): Promise<string> {
  const evidenceId = uid('ev');
  await auditRun(
    `INSERT INTO audit_evidence (id, program_id, organization_id, criterion_id, evidence_kind, title)
     VALUES ($1,$2,$3,$4,'document',$5)`,
    [evidenceId, programId, organizationId, criterionId, title]
  );
  return evidenceId;
}

export async function cleanupFixture(organizationId: string): Promise<void> {
  await auditRun(`DELETE FROM audit_domain_events WHERE organization_id = $1`, [organizationId]);
  await auditRun(`DELETE FROM audit_verifications WHERE organization_id = $1`, [organizationId]);
  await auditRun(`DELETE FROM audit_corrective_actions WHERE organization_id = $1`, [
    organizationId,
  ]);
  await auditRun(`DELETE FROM audit_management_responses WHERE organization_id = $1`, [
    organizationId,
  ]);
  await auditRun(`DELETE FROM audit_program_findings WHERE organization_id = $1`, [organizationId]);
  await auditRun(`DELETE FROM audit_evidence WHERE organization_id = $1`, [organizationId]);
  await auditRun(`DELETE FROM audit_program_criteria WHERE organization_id = $1`, [organizationId]);
  await auditRun(`DELETE FROM audit_program_members WHERE organization_id = $1`, [organizationId]);
  await auditRun(`DELETE FROM audit_programs WHERE organization_id = $1`, [organizationId]);
  await auditRun(`DELETE FROM audit_packs WHERE organization_id = $1`, [organizationId]);
}
