import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

class OrgMemberSyncServiceImpl {
  /**
   * Sync organization members to a base's tp_base_members table.
   * New org members get 'viewer' role by default.
   * Does NOT remove existing base members who left the org (preserves explicit role assignments).
   */
  async syncOrgMembersToBase(
    baseId: string,
    orgId: string
  ): Promise<{ added: number; skipped: number }> {
    const db = getDatabase();
    let added = 0;
    let skipped = 0;

    try {
      let orgMembers: Array<{ user_id: string }> = [];

      try {
        const result = await db.query(
          'SELECT user_id FROM organization_members WHERE organization_id = $1',
          [orgId]
        );
        orgMembers = result.rows as Array<{ user_id: string }>;
      } catch {
        try {
          const result = await db.query(
            'SELECT id as user_id FROM users WHERE organization_id = $1',
            [orgId]
          );
          orgMembers = result.rows as Array<{ user_id: string }>;
        } catch {
          logger.warn('[OrgMemberSync] Could not find org members', { orgId });
          return { added: 0, skipped: 0 };
        }
      }

      const existing = await db.query('SELECT user_id FROM tp_base_members WHERE base_id = $1', [
        baseId,
      ]);
      const existingUserIds = new Set(
        (existing.rows as Array<{ user_id: string }>).map((r) => r.user_id)
      );

      for (const member of orgMembers) {
        if (existingUserIds.has(member.user_id)) {
          skipped++;
          continue;
        }
        try {
          await db.query(
            `INSERT INTO tp_base_members (base_id, user_id, role)
             VALUES ($1, $2, 'viewer')
             ON CONFLICT (base_id, user_id) DO NOTHING`,
            [baseId, member.user_id]
          );
          added++;
        } catch (e) {
          logger.warn('[OrgMemberSync] Failed to add member', {
            baseId,
            userId: member.user_id,
            error: (e as Error).message,
          });
        }
      }

      logger.info('[OrgMemberSync] Sync complete', { baseId, orgId, added, skipped });
    } catch (e) {
      logger.error('[OrgMemberSync] Sync failed', { baseId, orgId, error: (e as Error).message });
    }

    return { added, skipped };
  }

  /**
   * Sync all bases in an organization.
   */
  async syncAllBasesInOrg(orgId: string): Promise<void> {
    const db = getDatabase();
    const bases = await db.query('SELECT id FROM tp_bases WHERE organization_id = $1', [orgId]);
    for (const base of bases.rows as Array<{ id: string }>) {
      await this.syncOrgMembersToBase(base.id, orgId);
    }
  }
}

const OrgMemberSyncService = new OrgMemberSyncServiceImpl();
export default OrgMemberSyncService;
