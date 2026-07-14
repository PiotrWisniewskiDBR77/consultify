/**
 * Change Champions Service (M14/F6 — 6.6)
 *
 * Champions / change-agent network — Kotter's "guiding coalition".
 * Maintains a per-initiative network of change agents and surfaces
 * coalition-coverage signals that feed governance (a coalition that is
 * too thin, or an initiative with no champion at all, is a change-risk gap).
 *
 * All persistence is org-scoped. node-pg snake_case columns.
 */
import { randomUUID } from 'node:crypto';

import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ── Types ──────────────────────────────────────────────────────

export interface ChangeChampion {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  userId: string | null;
  role: string;
  influence: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddChampionInput {
  initiativeId?: string | null;
  userId?: string | null;
  role?: string;
  influence?: string | null;
  status?: string;
}

export interface CoalitionCoverage {
  coveragePct: number;
  adequate: boolean;
}

// Kotter: a guiding coalition of roughly 15% of the affected population is the
// rule-of-thumb threshold for sustainable change adoption.
const KOTTER_COVERAGE_TARGET = 0.15;

// ── Row mapping ────────────────────────────────────────────────

interface ChampionRow {
  id: string;
  organization_id: string;
  initiative_id: string | null;
  user_id: string | null;
  role: string;
  influence: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ChampionRow): ChangeChampion {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id ?? null,
    userId: row.user_id ?? null,
    role: row.role,
    influence: row.influence ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Persistence (org-scoped) ───────────────────────────────────

/**
 * List champions for an org, optionally filtered to a single initiative.
 */
export async function listChampions(
  organizationId: string,
  initiativeId?: string | null
): Promise<ChangeChampion[]> {
  const rows = initiativeId
    ? await dbAll<ChampionRow>(
        `SELECT * FROM change_champions
          WHERE organization_id = ? AND initiative_id = ?
          ORDER BY created_at ASC`,
        [organizationId, initiativeId]
      )
    : await dbAll<ChampionRow>(
        `SELECT * FROM change_champions
          WHERE organization_id = ?
          ORDER BY created_at ASC`,
        [organizationId]
      );
  return rows.map(mapRow);
}

/**
 * Add a champion to the coalition. Returns the generated id.
 */
export async function addChampion(organizationId: string, data: AddChampionInput): Promise<string> {
  const id = randomUUID();
  await dbRun(
    `INSERT INTO change_champions
       (id, organization_id, initiative_id, user_id, role, influence, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      data.initiativeId ?? null,
      data.userId ?? null,
      data.role ?? 'champion',
      data.influence ?? null,
      data.status ?? 'active',
    ]
  );
  logger.info?.('[changeChampions] added champion', {
    organizationId,
    id,
    initiativeId: data.initiativeId ?? null,
  });
  return id;
}

/**
 * Remove a champion. Org-scoped so one org can never delete another's row.
 */
export async function removeChampion(organizationId: string, id: string): Promise<void> {
  await dbRun(`DELETE FROM change_champions WHERE id = ? AND organization_id = ?`, [
    id,
    organizationId,
  ]);
}

// ── Pure analytics (no DB) ─────────────────────────────────────

/**
 * Coalition coverage vs Kotter's ~15% target.
 *
 * @param championCount      number of active champions in the coalition
 * @param affectedPopulation total people affected by the change
 * @returns coveragePct (0–100, rounded to 1 dp) and whether it meets the target
 */
export function coalitionCoverage(
  championCount: number,
  affectedPopulation: number
): CoalitionCoverage {
  if (!Number.isFinite(affectedPopulation) || affectedPopulation <= 0) {
    return { coveragePct: 0, adequate: false };
  }
  const safeCount = Number.isFinite(championCount) && championCount > 0 ? championCount : 0;
  const ratio = safeCount / affectedPopulation;
  const coveragePct = Math.round(ratio * 1000) / 10;
  return {
    coveragePct,
    adequate: ratio >= KOTTER_COVERAGE_TARGET,
  };
}

/**
 * Detect initiatives with no champion (a guiding-coalition governance gap).
 *
 * @returns ids of initiatives whose championCount is 0 (or non-positive)
 */
export function detectNoChampion(
  initiatives: Array<{ id: string; championCount: number }>
): string[] {
  if (!Array.isArray(initiatives)) return [];
  return initiatives
    .filter((i) => !i || !Number.isFinite(i.championCount) || i.championCount <= 0)
    .map((i) => i.id);
}

export default {
  listChampions,
  addChampion,
  removeChampion,
  coalitionCoverage,
  detectNoChampion,
};
