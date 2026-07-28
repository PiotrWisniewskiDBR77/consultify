/**
 * Agent Folder Service — foldery dla planów agenta ("Moje procesy" w Run
 * agent hubie). Analogiczny system jak Vault (`KnowledgeService`
 * `getFolders`/`createFolder`/`updateFolder`/`deleteFolder`,
 * server/migrations/20260728_vault_folders.sql) — WZÓR SKOPIOWANY 1:1, patrz
 * `server/migrations/20260728_agent_folders.sql` dla uzasadnienia.
 *
 * 3 poziomy (decyzja właściciela 2026-07-28): 'user' (prywatny, tylko
 * twórca), 'project' (widoczny dla członków wskazanego projektu),
 * 'organization' (cała organizacja). Folder NIE niesie własnego pola
 * "poziom" — `scope`/`project_id` są nadawane RAZ przy tworzeniu.
 *
 * ★ Widoczność PLANÓW samych (`agentPlannerService.listPlans`) się NIE
 * zmienia — nadal tylko organizationId (+ opcjonalnie userId dla "mine").
 * Ta usługa odpowiada WYŁĄCZNIE za widoczność FOLDERÓW (który folder user
 * widzi w selektorze/filtrze); filtrowanie listy planów PO folderze
 * (`plan.folderId === activeFolderId`) dzieje się już po stronie klienta na
 * planach, które user i tak widzi z `listPlans` — dokładnie wzór
 * `VaultDocumentsView.tsx` (`matchesFolder`, filtr lokalny nad `documents`).
 */
import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import type { VaultDocumentScope } from '../KnowledgeService.js';

export type AgentFolderScope = VaultDocumentScope;

export interface AgentFolderAccess {
  scope?: AgentFolderScope | null;
  projectId?: string | null;
  memberProjectIds?: string[];
}

export interface AgentFolderRow {
  id: string;
  organization_id: string;
  scope: AgentFolderScope;
  project_id: string | null;
  owner_id: string;
  name: string;
  description: string | null;
  color: string | null;
  parent_folder_id: string | null;
  created_at: string;
  updated_at: string;
}

class AgentFolderService {
  /**
   * Lista folderów widocznych dla `userId`. Bez `access.scope` (widok
   * domyślny — jedyny, który dziś woła frontend, bo Run agent NIE ma
   * osobnych pod-widoków per poziom jak Vault ma sejfy): prywatne WŁASNE +
   * wszystkie organizacyjne + projektowe dla projektów, w których user jest
   * członkiem. Kopia kształtu WHERE z `KnowledgeService.getFolders` —
   * ta sama reguła, inna tabela/domena (patrz nagłówek pliku).
   */
  async getFolders(
    orgId: string,
    userId?: string,
    access?: AgentFolderAccess
  ): Promise<AgentFolderRow[]> {
    const where: string[] = [`organization_id = ?`];
    const params: unknown[] = [orgId];

    const requestedScope = access?.scope || null;
    const projectId = access?.projectId || null;
    const memberIds = (access?.memberProjectIds || []).filter(Boolean);

    if (requestedScope === 'user') {
      where.push(`scope = 'user'`);
      where.push(`owner_id = ?`);
      params.push(userId || null);
    } else if (requestedScope === 'project') {
      where.push(`scope = 'project'`);
      if (projectId) {
        where.push(`project_id = ?`);
        params.push(projectId);
      } else if (memberIds.length > 0) {
        where.push(`project_id IN (${memberIds.map(() => '?').join(',')})`);
        params.push(...memberIds);
      } else {
        where.push(`1 = 0`);
      }
    } else if (requestedScope === 'organization') {
      where.push(`scope = 'organization'`);
    } else if (userId) {
      const projectClause =
        memberIds.length > 0
          ? `(scope = 'project' AND project_id IN (${memberIds.map(() => '?').join(',')}))`
          : `1 = 0`;
      where.push(
        `((scope = 'user' AND owner_id = ?) OR scope = 'organization' OR ${projectClause})`
      );
      params.push(userId);
      if (memberIds.length > 0) params.push(...memberIds);
    } else {
      where.push(`scope != 'user'`);
    }

    const rows = (await dbAll(
      `SELECT * FROM agent_folders WHERE ${where.join(' AND ')} ORDER BY lower(name) ASC LIMIT 500`,
      params
    )) as AgentFolderRow[];
    return rows || [];
  }

  async getFolderById(orgId: string, folderId: string): Promise<AgentFolderRow | null> {
    const row = (await dbGet(`SELECT * FROM agent_folders WHERE id = ? AND organization_id = ?`, [
      folderId,
      orgId,
    ])) as AgentFolderRow | undefined;
    return row || null;
  }

  async createFolder(
    orgId: string,
    ownerId: string,
    input: {
      name: string;
      description?: string | null;
      color?: string | null;
      parentFolderId?: string | null;
      scope: AgentFolderScope;
      projectId?: string | null;
    }
  ): Promise<AgentFolderRow> {
    const id = randomUUID();
    const scope = input.scope;
    const projectId = scope === 'project' ? input.projectId || null : null;
    const name = String(input.name || '').trim();
    await dbRun(
      `INSERT INTO agent_folders
         (id, organization_id, scope, project_id, owner_id, name, description, color, parent_folder_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        scope,
        projectId,
        ownerId,
        name,
        input.description ?? null,
        input.color ?? null,
        input.parentFolderId ?? null,
      ]
    );
    const now = new Date().toISOString();
    return {
      id,
      organization_id: orgId,
      scope,
      project_id: projectId,
      owner_id: ownerId,
      name,
      description: input.description ?? null,
      color: input.color ?? null,
      parent_folder_id: input.parentFolderId ?? null,
      created_at: now,
      updated_at: now,
    };
  }

  /** Rename/re-describe — TYLKO twórca folderu (wzór `KnowledgeService.updateFolder`). */
  async updateFolder(
    orgId: string,
    ownerId: string,
    folderId: string,
    updates: {
      name?: string;
      description?: string | null;
      color?: string | null;
      parentFolderId?: string | null;
    }
  ): Promise<{ updated: boolean }> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (typeof updates.name === 'string' && updates.name.trim()) {
      sets.push('name = ?');
      params.push(updates.name.trim());
    }
    if (updates.description !== undefined) {
      sets.push('description = ?');
      params.push(updates.description ?? null);
    }
    if (updates.color !== undefined) {
      sets.push('color = ?');
      params.push(updates.color ?? null);
    }
    if (updates.parentFolderId !== undefined) {
      sets.push('parent_folder_id = ?');
      params.push(updates.parentFolderId ?? null);
    }
    if (!sets.length) return { updated: false };
    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(folderId, orgId, ownerId);
    const result = await dbRun(
      `UPDATE agent_folders SET ${sets.join(', ')}
       WHERE id = ? AND organization_id = ? AND owner_id = ?`,
      params
    );
    return { updated: Boolean((result as { changes?: number })?.changes) };
  }

  /** Usuwa folder (TYLKO twórca) — odpina jego plany (folder_id = NULL), nie usuwa ich. */
  async deleteFolder(
    orgId: string,
    ownerId: string,
    folderId: string
  ): Promise<{ deleted: boolean }> {
    await dbRun(
      `UPDATE ai_agent_plans SET folder_id = NULL, updated_at = datetime('now')
       WHERE folder_id = ? AND organization_id = ?`,
      [folderId, orgId]
    );
    const result = await dbRun(
      `DELETE FROM agent_folders WHERE id = ? AND organization_id = ? AND owner_id = ?`,
      [folderId, orgId, ownerId]
    );
    return { deleted: Boolean((result as { changes?: number })?.changes) };
  }
}

export const agentFolderService = new AgentFolderService();
export default agentFolderService;
