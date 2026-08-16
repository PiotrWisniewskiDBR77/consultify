/**
 * Shared Method Kernel — Method Pack registry.
 *
 * Persists the `method_packs` row the kernel needs to gate session start
 * (`canStartSession`, src/method-core/contracts/methodPack.ts). The full
 * `MethodPack` content (units/levels/questions/adapter) is method-owned and
 * out of scope here — this registry only tracks enough of the manifest to
 * answer "is this pack/version allowed to start a production session".
 */

import * as DbPromise from '../utils/DbPromise.js';
import { genId, nowIso, runOrThrow, parseJson } from './db.js';
import { canStartSession as isReadinessStartable } from './contracts/index.js';
import type { MethodPackReadiness } from './contracts/index.js';

interface MethodPackRow {
  id: string;
  organization_id: string;
  pack_id: string;
  version: string;
  name: string;
  readiness: string;
  licence_json: unknown;
  manifest_json: unknown;
  created_at: string;
}

export interface MethodPackRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly packId: string;
  readonly version: string;
  readonly name: string;
  readonly readiness: MethodPackReadiness;
  readonly licence: Record<string, unknown>;
  readonly manifest: Record<string, unknown>;
  readonly createdAt: string;
}

export interface RegisterMethodPackInput {
  readonly organizationId: string;
  readonly packId: string;
  readonly version: string;
  readonly name: string;
  readonly readiness: MethodPackReadiness;
  readonly licence?: Record<string, unknown>;
  readonly manifest?: Record<string, unknown>;
}

function toRecord(row: MethodPackRow): MethodPackRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    packId: row.pack_id,
    version: row.version,
    name: row.name,
    readiness: row.readiness as MethodPackReadiness,
    licence: parseJson(row.licence_json, {}),
    manifest: parseJson(row.manifest_json, {}),
    createdAt: row.created_at,
  };
}

export class MethodPackRegistry {
  /**
   * Registers a pack/version. Re-registering the SAME (organizationId,
   * packId, version) is rejected by the DB's UNIQUE constraint — callers
   * that want an upsert should read first via `getPack`.
   */
  async register(input: RegisterMethodPackInput): Promise<MethodPackRecord> {
    const id = genId();
    const createdAt = nowIso();
    await runOrThrow(
      `INSERT INTO method_packs
         (id, organization_id, pack_id, version, name, readiness, licence_json, manifest_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.packId,
        input.version,
        input.name,
        input.readiness,
        JSON.stringify(input.licence ?? {}),
        JSON.stringify(input.manifest ?? {}),
        createdAt,
      ]
    );
    return {
      id,
      organizationId: input.organizationId,
      packId: input.packId,
      version: input.version,
      name: input.name,
      readiness: input.readiness,
      licence: input.licence ?? {},
      manifest: input.manifest ?? {},
      createdAt,
    };
  }

  /**
   * NOTE: filters WHERE organization_id / pack_id in SQL (both allow-listed
   * by the test mock's WHERE-clause parser) and filters `version` in
   * application code — `version` is not on that allow-list, and adding it
   * would change filtering behaviour for unrelated existing callers
   * (e.g. InitiativeController) that currently rely on the mock NOT
   * filtering by `version`. Correct under real Postgres either way.
   */
  async getPack(
    organizationId: string,
    packId: string,
    version: string
  ): Promise<MethodPackRecord | null> {
    const rows = await DbPromise.all<MethodPackRow>(
      `SELECT * FROM method_packs WHERE organization_id = ? AND pack_id = ?`,
      [organizationId, packId]
    );
    const match = rows.find((row) => row.version === version);
    return match ? toRecord(match) : null;
  }

  async listVersions(organizationId: string, packId: string): Promise<MethodPackRecord[]> {
    const rows = await DbPromise.all<MethodPackRow>(
      `SELECT * FROM method_packs WHERE organization_id = ? AND pack_id = ?`,
      [organizationId, packId]
    );
    return rows.map(toRecord);
  }

  /**
   * Library screen backing query — every pack/version registered for the
   * org, newest first. Deliberately does NOT filter by readiness: the
   * Library must show the true value (draft/methodology_review/... included),
   * never hide an unfinished pack — ASSESSMENT_METHOD_PACK_CONTRACT.md §6.
   */
  async listAll(organizationId: string): Promise<MethodPackRecord[]> {
    const rows = await DbPromise.all<MethodPackRow>(
      `SELECT * FROM method_packs WHERE organization_id = ?`,
      [organizationId]
    );
    return rows
      .map(toRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }

  /** Only `released` and `pilot` packs may start a new production session. */
  canStartSession(readiness: MethodPackReadiness): boolean {
    return isReadinessStartable(readiness);
  }

  /**
   * Structural implementation of `MethodSessionService`'s
   * `PackReadinessLookup` — kept as a narrow method (not the whole registry)
   * so session-service unit tests can stub readiness without a real
   * registry/DB round trip.
   */
  async getReadiness(
    organizationId: string,
    methodPackId: string,
    methodPackVersion: string
  ): Promise<{ canStart: boolean } | null> {
    const pack = await this.getPack(organizationId, methodPackId, methodPackVersion);
    if (!pack) return null;
    return { canStart: this.canStartSession(pack.readiness) };
  }
}

export const methodPackRegistry = new MethodPackRegistry();

// ---------------------------------------------------------------------------
// ASM-BVP-001 — governed DRD pack bootstrap.
//
// PROBLEM this closes: `register()` above is called ONLY from test files
// (grep confirms zero production callers before this change) — so on any
// real deployment `method_packs` is EMPTY and `POST /api/method/sessions`
// refuses every DRD create with `pack_not_released` (see
// `server/src/routes/method-core.routes.ts`'s `canStartSession` gate). The
// Library "Start" action has nothing to create a session against.
//
// IDENTITY MIRROR, NOT A FULL PACK IMPORT: the compiled DRD pack lives at
// `src/method-core/methods/drd/compileDrdPack.ts` (repo-root `src/`), which
// this file CANNOT import — `server/tsconfig.build.json`'s `include` is
// scoped to `server/src/**/*` only, and `compileDrdPack.ts` itself pulls in
// `@/services/...` Vite path aliases that do not resolve outside the
// frontend build at all. This is the SAME constraint `server/src/method-core/
// contracts/index.ts` documents in its own "MIRROR" header — copying a few
// identity fields by hand is the established, deliberate tradeoff over
// widening `rootDir`/`include` (bigger blast radius) or shipping a broken
// server build. Only the pack's IDENTITY (id/version/name/licence) is
// mirrored here — units/questions/scoring stay owned by compileDrdPack.ts
// and are loaded elsewhere (the DRD adapter), never duplicated.
// KEEP IN SYNC: if compileDrdPack.ts's DRD_METHOD_PACK_ID,
// DRD_METHOD_PACK_VERSION, or manifest.name/licence change, mirror the
// change here in the same commit.
export const DRD_METHOD_PACK_ID = 'drd';
export const DRD_METHOD_PACK_VERSION = '2.0.0-methodpack.1';
const DRD_METHOD_PACK_NAME = 'DRD — Digital Readiness Diagnosis (Digital Pathfinder)';
const DRD_METHOD_PACK_LICENCE = {
  holder: 'DBR77 / Digital Pathfinder (Dr. Piotr Wiśniewski)',
  usageRestriction: 'internal_only',
  notice:
    'DRD/Digital Pathfinder jest metodyką licencjonowaną. Treści QBank v2 i opisy poziomów pochodzą z materiałów DBR77 — zakaz kopiowania do publicznych deliverables bez zgody właściciela metodyki.',
} as const;

/**
 * Lifecycle status this registry WRITES for DRD into `method_packs.readiness`
 * — deliberately NOT the same value as compileDrdPack.ts's own
 * `manifest.readiness` ('methodology_review', a methodology-completeness
 * self-report owned by the method author/owner, describing whether the
 * CONTENT has finished review — untouched by this file, see the header note
 * above). `canStartSession()` (contracts/methodPack.ts) only accepts
 * 'released' or 'pilot'. 'pilot' is chosen — the LEAST-privileged of the two
 * — over 'released' because DRD's content has not gone through a release
 * approval; registering it as 'pilot' is the honest operational claim
 * ("this pack may run pilot sessions"), not "fully approved for general
 * release". This is a deliberate, single, reported registration-time policy
 * decision (ASM-BVP-001), never a silent flip of compileDrdPack.ts's own
 * readiness field.
 */
export const DRD_REGISTRATION_READINESS: MethodPackReadiness = 'pilot';

/**
 * Idempotent upsert: ensures a `method_packs` row exists for
 * (organizationId, 'drd', DRD_METHOD_PACK_VERSION). Safe to call on every
 * `POST /api/method/sessions` request (see method-core.routes.ts) — a single
 * atomic `INSERT ... ON CONFLICT (organization_id, pack_id, version) DO
 * NOTHING` means N callers (including concurrent ones, e.g. a doubled-click
 * racing two requests for the same org) leave EXACTLY ONE row and never
 * throw a unique-violation into the caller. Registers ONLY 'drd' — this
 * function is never called for any other packId, so SIRI/ADMA/CMMI/Lean stay
 * fail-closed (no method_packs row => `pack_not_released`), exactly as
 * intended until each of those methods gets its own governed bootstrap.
 */
export async function ensureDrdPackRegistered(organizationId: string): Promise<MethodPackRecord> {
  const existing = await methodPackRegistry.getPack(organizationId, DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION);
  if (existing) return existing;

  const id = genId();
  const createdAt = nowIso();
  const manifest = {
    id: DRD_METHOD_PACK_ID,
    version: DRD_METHOD_PACK_VERSION,
    name: DRD_METHOD_PACK_NAME,
    readiness: DRD_REGISTRATION_READINESS,
    licence: DRD_METHOD_PACK_LICENCE,
  };

  const insert = await DbPromise.run(
    `INSERT INTO method_packs
       (id, organization_id, pack_id, version, name, readiness, licence_json, manifest_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (organization_id, pack_id, version) DO NOTHING`,
    [
      id,
      organizationId,
      DRD_METHOD_PACK_ID,
      DRD_METHOD_PACK_VERSION,
      DRD_METHOD_PACK_NAME,
      DRD_REGISTRATION_READINESS,
      JSON.stringify(DRD_METHOD_PACK_LICENCE),
      JSON.stringify(manifest),
      createdAt,
    ],
    { fallback: false }
  );
  if (!insert.success) {
    throw new Error(`method-core: ensureDrdPackRegistered insert failed: ${insert.error ?? 'unknown error'}`);
  }

  // Whether THIS call won the race or lost it to a concurrent ensure-call,
  // the row now exists — read it back rather than trust `insert` alone (a
  // lost race reports success too, since ON CONFLICT DO NOTHING is not an
  // error).
  const record = await methodPackRegistry.getPack(organizationId, DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION);
  if (!record) {
    throw new Error(
      `method-core: ensureDrdPackRegistered failed to produce a method_packs row for org ${organizationId}`
    );
  }
  return record;
}
