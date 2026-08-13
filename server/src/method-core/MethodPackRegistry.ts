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
