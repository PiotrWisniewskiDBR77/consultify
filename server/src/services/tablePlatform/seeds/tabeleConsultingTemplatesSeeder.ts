/**
 * Tabele consulting templates seeder (Block A · EPIC-T5 · Sprint 2)
 *
 * Inserts / updates `tp_base_templates` rows that originate from
 * `TABELE_CONSULTING_TEMPLATES`. Idempotency uses
 * `governance_rules ->> 'seed_id'` as the stable key — `tp_base_templates`
 * has no UNIQUE constraint on `name`, and renaming a template should not
 * cause the seeder to insert a duplicate.
 *
 * Behaviour:
 *   * If no row matches the seed_id → INSERT with full payload.
 *   * If a matching row exists → UPDATE name / description / category /
 *     schema_snapshot / version / governance_rules / is_featured /
 *     status / owner_user_id (when transitioning from NULL).
 *   * `approval_history` is NEVER overwritten — it is an append-only ledger
 *     owned by `TemplateLifecycleService`.
 *
 * Returns a tally `{ inserted, updated, skipped }`.
 */

import { getDatabase } from '../../../database/Database.js';
import logger from '../../../utils/Logger.js';
import {
  TABELE_CONSULTING_TEMPLATES,
  type TabeleTemplateSeed,
} from './tabele_consulting_templates.js';

export interface SeedTabeleConsultingTemplatesOptions {
  /** Optional override; defaults to the canonical pack. */
  templates?: TabeleTemplateSeed[];
  /** User id stamped onto created_by + owner_user_id when seeding new rows. */
  systemUserId?: string;
}

export interface SeedTabeleConsultingTemplatesResult {
  inserted: number;
  updated: number;
  skipped: number;
  byStatus: { approved: number; draft: number };
  seedIds: string[];
}

const DEFAULT_SYSTEM_USER_ID = 'system:tabele-template-seeder-2026-05-08';

const SELECT_BY_SEED_ID_SQL = `
  SELECT id, status, owner_user_id
  FROM   tp_base_templates
  WHERE  governance_rules ->> 'seed_id' = $1
  LIMIT  1
`;

const INSERT_SQL = `
  INSERT INTO tp_base_templates (
    name, description, category, schema_snapshot, is_featured,
    created_by, status, version, owner_user_id, governance_rules
  )
  VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10::jsonb)
  RETURNING id
`;

const UPDATE_SQL = `
  UPDATE tp_base_templates
     SET name             = $1,
         description      = $2,
         category         = $3,
         schema_snapshot  = $4::jsonb,
         is_featured      = $5,
         version          = $6,
         governance_rules = $7::jsonb,
         status           = CASE
                              -- Never demote a manually-approved or
                              -- manually-deprecated template back to its
                              -- seed status. Only fill 'draft' or NULL.
                              WHEN tp_base_templates.status IS NULL
                                   OR tp_base_templates.status = 'draft'
                                THEN $8
                              ELSE tp_base_templates.status
                            END,
         owner_user_id    = COALESCE(tp_base_templates.owner_user_id, $9)
   WHERE id = $10
`;

const tabeleConsultingTemplatesSeeder = {
  TEMPLATES: TABELE_CONSULTING_TEMPLATES,

  async seed(
    options: SeedTabeleConsultingTemplatesOptions = {}
  ): Promise<SeedTabeleConsultingTemplatesResult> {
    const templates = options.templates ?? TABELE_CONSULTING_TEMPLATES;
    const systemUserId = options.systemUserId ?? DEFAULT_SYSTEM_USER_ID;

    const result: SeedTabeleConsultingTemplatesResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      byStatus: { approved: 0, draft: 0 },
      seedIds: [],
    };

    const db = getDatabase();

    for (const tpl of templates) {
      result.seedIds.push(tpl.seed_id);
      result.byStatus[tpl.status] += 1;

      const existing = await db.query(SELECT_BY_SEED_ID_SQL, [tpl.seed_id]);
      const existingRow = existing.rows[0] as
        | { id: string; status: string | null; owner_user_id: string | null }
        | undefined;

      const schemaSnapshotJson = JSON.stringify(tpl.schema_snapshot);
      const governanceRulesJson = JSON.stringify(tpl.governance_rules);

      if (!existingRow) {
        try {
          await db.query(INSERT_SQL, [
            tpl.name,
            tpl.description,
            tpl.category,
            schemaSnapshotJson,
            tpl.is_featured,
            systemUserId,
            tpl.status,
            tpl.version,
            systemUserId,
            governanceRulesJson,
          ]);
          result.inserted += 1;
          logger.info('[TabeleSeeder] inserted template', {
            seed_id: tpl.seed_id,
            status: tpl.status,
          });
        } catch (err) {
          logger.error('[TabeleSeeder] insert failed', {
            seed_id: tpl.seed_id,
            error: (err as Error).message,
          });
          throw err;
        }
        continue;
      }

      try {
        await db.query(UPDATE_SQL, [
          tpl.name,
          tpl.description,
          tpl.category,
          schemaSnapshotJson,
          tpl.is_featured,
          tpl.version,
          governanceRulesJson,
          tpl.status,
          systemUserId,
          existingRow.id,
        ]);
        result.updated += 1;
        logger.info('[TabeleSeeder] updated template', {
          seed_id: tpl.seed_id,
          template_id: existingRow.id,
        });
      } catch (err) {
        logger.error('[TabeleSeeder] update failed', {
          seed_id: tpl.seed_id,
          template_id: existingRow.id,
          error: (err as Error).message,
        });
        throw err;
      }
    }

    logger.info('[TabeleSeeder] seed complete', {
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      total: templates.length,
    });

    return result;
  },
};

export type TabeleConsultingTemplatesSeeder = typeof tabeleConsultingTemplatesSeeder;
export default tabeleConsultingTemplatesSeeder;
