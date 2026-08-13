#!/usr/bin/env node
/**
 * Case Workspace — seed syntetycznej sesji w JEDNORAZOWEJ, LOKALNEJ bazie.
 *
 * ZAKRES: wyłącznie kontener `case-workspace-test-pg` (127.0.0.1:55432).
 * Skrypt ODMAWIA startu, jeśli DATABASE_URL nie wskazuje hosta lokalnego —
 * to twarda bariera przed zapisem do bazy demo/staging (dane demo = twarz
 * produktu; zapis danych testowych tam jest zabroniony przez właściciela).
 *
 * Zakłada komplet wymagany przez REALNY łańcuch autoryzacji /api/v8/*:
 *   verifyToken -> requireV8OrgContext -> v8OrgGate -> requireOrgMemberForActor
 *
 *   1. organizations                (org, do której należy JWT)
 *   2. users                        (hasło = bcrypt, e-mail MAŁYMI literami —
 *                                    AuthController.login normalizuje wejście
 *                                    przez toLowerCase() przed SELECT-em)
 *   3. organization_members         (status ACTIVE — requireOrgMember czyta
 *                                    dokładnie tę tabelę i odrzuca każdy inny
 *                                    status; rola OWNER przechodzi requireOrgRole)
 *   4. projects                     (FK dla case_core.project_id)
 *   5. v8.v8_feature_flags          (v8OrgGate; przy ZERZE wierszy poza
 *                                    produkcją działa fallback, ale polegamy
 *                                    na jawnych wierszach, nie na fallbacku)
 *
 * Zapis jest idempotentny (ON CONFLICT DO UPDATE/NOTHING) — można puszczać
 * wielokrotnie.
 */

import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[seed] BLOCKED: brak DATABASE_URL.');
  process.exit(1);
}

// --- Bariera: tylko lokalny kontener jednorazowy -------------------------
{
  const host = new URL(DATABASE_URL).hostname;
  const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);
  if (!LOCAL_HOSTS.has(host)) {
    console.error(
      `[seed] BLOCKED: DATABASE_URL wskazuje host "${host}", a nie lokalny kontener.\n` +
        '[seed] Ten skrypt NIGDY nie zapisuje do bazy demo/staging.'
    );
    process.exit(1);
  }
}

// --- Tożsamość syntetyczna (stałe ID => idempotencja i kopiowalność) ------
export const SEED = {
  organizationId: 'cw-local-org',
  organizationName: 'Case Workspace Local Org',
  projectId: 'cw-local-project',
  projectName: 'Case Workspace Local Project',
  userId: 'cw-local-user',
  // AuthController.login robi email.trim().toLowerCase() przed SELECT-em,
  // więc w bazie e-mail MUSI być zapisany małymi literami.
  email: 'cw.local@local.test',
  password: 'CaseWorkspaceLocal!2026',
  role: 'ADMIN',
  orgRole: 'OWNER',
};

// Moduły V8 włączane jawnie. v8OrgGate woła isV8Enabled(orgId) BEZ modułu,
// czyli wystarczy jeden wiersz enabled=1, ale włączamy komplet rdzenia,
// żeby ekrany zależne od innych modułów też nie wpadały w 404.
const V8_MODULES = [
  'case_workspace',
  'core',
  'my_work',
  'execution',
  'initiatives',
  'results',
  'assessment',
  'outputs',
];

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Organizacja
    await client.query(
      `INSERT INTO organizations (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [SEED.organizationId, SEED.organizationName]
    );

    // 2. Użytkownik z realnym hashem bcrypt (ta sama biblioteka, której
    //    używa AuthController: bcryptjs).
    const passwordHash = await bcrypt.hash(SEED.password, 10);
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         email           = EXCLUDED.email,
         password        = EXCLUDED.password,
         role            = EXCLUDED.role,
         status          = 'active'`,
      [
        SEED.userId,
        SEED.organizationId,
        SEED.email,
        passwordHash,
        'Case',
        'Workspace',
        SEED.role,
      ]
    );

    // 3. Członkostwo ACTIVE — bez tego requireOrgMember zamyka cały łańcuch.
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       ON CONFLICT (organization_id, user_id) DO UPDATE SET
         role   = EXCLUDED.role,
         status = 'ACTIVE'`,
      [`cw-local-member-${SEED.organizationId}`, SEED.organizationId, SEED.userId, SEED.orgRole]
    );

    // 4. Projekt (FK dla case_core.project_id)
    await client.query(
      `INSERT INTO projects (id, organization_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [SEED.projectId, SEED.organizationId, SEED.projectName]
    );

    // 5. Flagi V8 — jawne wiersze, żeby v8OrgGate przechodził na FAKCIE,
    //    a nie na nieprodukcyjnym fallbacku „brak wierszy = przepuść".
    for (const moduleName of V8_MODULES) {
      await client.query(
        `INSERT INTO v8.v8_feature_flags (flag_id, organization_id, module, enabled, updated_by)
         VALUES ($1, $2, $3, 1, $4)
         ON CONFLICT (organization_id, module) DO UPDATE SET enabled = 1`,
        [randomUUID(), SEED.organizationId, moduleName, SEED.userId]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  // --- Weryfikacja odczytem (nie ufamy samemu INSERT-owi) ----------------
  const verification = await client.query(
    `SELECT
       (SELECT count(*) FROM organizations        WHERE id = $1)                      AS orgs,
       (SELECT count(*) FROM users                WHERE id = $2)                      AS users,
       (SELECT count(*) FROM organization_members WHERE user_id = $2
                                                    AND organization_id = $1
                                                    AND status = 'ACTIVE')            AS active_members,
       (SELECT count(*) FROM projects             WHERE id = $3)                      AS projects,
       (SELECT count(*) FROM v8.v8_feature_flags  WHERE organization_id = $1
                                                    AND enabled = 1)                  AS enabled_flags`,
    [SEED.organizationId, SEED.userId, SEED.projectId]
  );

  await client.end();

  const row = verification.rows[0];
  console.log('[seed] Stan po zapisie (odczytany z bazy):');
  console.table(row);

  const ok =
    Number(row.orgs) === 1 &&
    Number(row.users) === 1 &&
    Number(row.active_members) === 1 &&
    Number(row.projects) === 1 &&
    Number(row.enabled_flags) > 0;

  if (!ok) {
    console.error('[seed] BLOCKED: weryfikacja odczytem nie potwierdziła kompletu.');
    process.exit(1);
  }

  console.log('');
  console.log('[seed] OK. Poświadczenia do logowania:');
  console.log(`[seed]   email:    ${SEED.email}`);
  console.log(`[seed]   password: ${SEED.password}`);
  console.log(`[seed]   orgId:    ${SEED.organizationId}`);
  console.log(`[seed]   projectId:${SEED.projectId}`);
}

main().catch((error) => {
  console.error('[seed] BLOCKED — seed nie przeszedł:');
  console.error(error);
  process.exit(1);
});
