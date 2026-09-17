/**
 * Showcase Date-Roll nightly job (SR-1, Wpis 31 §4.2).
 *
 * Thin scheduler wrapper around `rollShowcaseDates`. Gated by the runtime flag
 * ENABLE_SHOWCASE_DATE_ROLL (default OFF) and driven by SHOWCASE_ORG_IDS (a
 * comma-separated list of organization IDs — never names). When the flag is off,
 * or the org list is empty, the tick does nothing and logs a single line.
 */

import cron from 'node-cron';

import logger from '../../utils/Logger.js';
import {
  rollShowcaseDates,
  type RollShowcaseDatesInput,
  type ShowcaseRollResult,
} from './showcaseDateRollService.js';

/** Nightly at 03:15 UTC (distinct from the 02:30/02:45/03:00 bundle). */
const DEFAULT_CRON = '15 3 * * *';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/** ENABLE_SHOWCASE_DATE_ROLL is OFF unless explicitly set to a truthy value. */
export function isShowcaseDateRollEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return TRUTHY.has(String(env.ENABLE_SHOWCASE_DATE_ROLL ?? '').trim().toLowerCase());
}

/** Parse SHOWCASE_ORG_IDS (comma-separated IDs) into a clean, de-duped list. */
export function parseShowcaseOrgIds(raw: string | undefined): string[] {
  if (!raw) return [];
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Array.from(new Set(ids));
}

export interface ShowcaseRollTickOutcome {
  enabled: boolean;
  orgIds: number;
  rolled?: ShowcaseRollResult;
  skipped?: 'flag_off' | 'no_orgs';
}

export interface ShowcaseRollTickDeps {
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  roll?: (input: RollShowcaseDatesInput) => Promise<ShowcaseRollResult>;
}

/** One nightly tick. Pure orchestration — all DB work is in rollShowcaseDates. */
export async function runShowcaseDateRollTick(
  deps: ShowcaseRollTickDeps = {}
): Promise<ShowcaseRollTickOutcome> {
  const env = deps.env ?? process.env;

  if (!isShowcaseDateRollEnabled(env)) {
    logger.info('[ShowcaseRoll] disabled (ENABLE_SHOWCASE_DATE_ROLL is not truthy) — skipping');
    return { enabled: false, orgIds: 0, skipped: 'flag_off' };
  }

  const orgIds = parseShowcaseOrgIds(env.SHOWCASE_ORG_IDS);
  if (orgIds.length === 0) {
    logger.info('[ShowcaseRoll] enabled but SHOWCASE_ORG_IDS is empty — nothing to do');
    return { enabled: true, orgIds: 0, skipped: 'no_orgs' };
  }

  const roll = deps.roll ?? rollShowcaseDates;
  const today = (deps.now ?? (() => new Date()))();
  const rolled = await roll({ today, orgIds });
  logger.info(`[ShowcaseRoll] nightly roll complete for ${orgIds.length} org(s)`, { rolled });
  return { enabled: true, orgIds: orgIds.length, rolled };
}

/**
 * Registers the nightly cron. Exported (with an injectable `schedule`) so the
 * registration path and the tested path are the same function.
 */
export function registerShowcaseDateRollJob(
  schedule: typeof cron.schedule = cron.schedule
): ReturnType<typeof cron.schedule> {
  const expression = process.env.SHOWCASE_DATE_ROLL_CRON || DEFAULT_CRON;
  return schedule(
    expression,
    () => {
      runShowcaseDateRollTick().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('[ShowcaseRoll] nightly tick failed', { error: message });
      });
    },
    { timezone: 'UTC' }
  );
}

export default {
  runShowcaseDateRollTick,
  registerShowcaseDateRollJob,
  isShowcaseDateRollEnabled,
  parseShowcaseOrgIds,
};
