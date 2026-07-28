/**
 * agentFolderService + agentPlannerService — filtrowanie planów agenta po
 * folderze (AGT-FOLDERS, 2026-07-28). Dwie warstwy testowane razem, bo
 * odpowiadają za JEDNO pytanie: „które foldery i które plany widzi ten
 * user" — wzór in-memory fake DbPromise 1:1
 * `agentPlannerService.scheduleAndWait.test.ts` (osobny `vi.hoisted` store,
 * żeby nie dzielić mutowalnego stanu z innymi plikami testowymi).
 *
 * 1) `agentFolderService.getFolders` — reguła widoczności 3 poziomów
 *    (user/project/organization), kopia kształtu WHERE z Vault
 *    (`KnowledgeService.getFolders`) — private folder innego usera nigdy nie
 *    wycieka, project folder tylko dla członków, organization dla wszystkich.
 * 2) `agentPlannerService.setFolder` + `listPlans` — plan niesie `folderId`
 *    po przeniesieniu, więc filtr KLIENCKI w `AgentHubShell.tsx`
 *    (`plan.folderId === activeFolderId`, wzór `VaultDocumentsView.tsx`
 *    `matchesFolder`) ma na czym pracować.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FolderRow {
  id: string;
  organization_id: string;
  scope: string;
  project_id: string | null;
  owner_id: string;
  name: string;
  description: string | null;
  color: string | null;
  parent_folder_id: string | null;
  created_at: string;
  updated_at: string;
}

interface PlanRow {
  id: string;
  organization_id: string;
  conversation_id: string | null;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  total_steps: number;
  completed_steps: number;
  current_step_index: number;
  plan_json: string;
  result_summary: string | null;
  error_message: string | null;
  is_background: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

const db = vi.hoisted(() => ({
  folders: new Map<string, FolderRow>(),
  plans: new Map<string, PlanRow>(),
}));

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

/** Filtruje `agent_folders` reprodukując DOKŁADNIE gałęzie WHERE zbudowane przez
 * `agentFolderService.getFolders` (patrz komentarz w tym pliku) — dopasowanie
 * po fragmentach SQL, bo zapytanie zmienia kształt per gałąź. */
function filterFolders(sql: string, params: unknown[]): FolderRow[] {
  const rows = [...db.folders.values()];
  const orgId = params[0] as string;
  let out = rows.filter((r) => r.organization_id === orgId);

  // ★ Kolejność ma znaczenie: gałąź domyślna (OR-combined) TEŻ zawiera
  // substringi "scope = 'user'" i "owner_id = ?" (wewnątrz nawiasu), więc
  // musi być sprawdzona PRZED wąskim `scope='user'` — inaczej ten wąski
  // warunek fałszywie łapie też zapytanie domyślne.
  if (sql.includes("(scope = 'user' AND owner_id = ?) OR scope = 'organization' OR")) {
    const ownerId = params[1] as string;
    const memberIds = params.slice(2) as string[];
    out = out.filter(
      (r) =>
        (r.scope === 'user' && r.owner_id === ownerId) ||
        r.scope === 'organization' ||
        (r.scope === 'project' && memberIds.includes(r.project_id || ''))
    );
  } else if (sql.includes("scope = 'user'") && sql.includes('owner_id = ?')) {
    const ownerId = params[1] as string | null;
    out = out.filter((r) => r.scope === 'user' && r.owner_id === ownerId);
  } else if (sql.includes("scope = 'project'") && sql.includes('1 = 0')) {
    out = [];
  } else if (sql.includes("scope = 'project'") && sql.includes('project_id = ?')) {
    const projectId = params[1] as string;
    out = out.filter((r) => r.scope === 'project' && r.project_id === projectId);
  } else if (sql.includes("scope = 'project'") && sql.includes('project_id IN')) {
    const memberIds = params.slice(1) as string[];
    out = out.filter((r) => r.scope === 'project' && memberIds.includes(r.project_id || ''));
  } else if (sql.includes("AND scope = 'organization'")) {
    out = out.filter((r) => r.scope === 'organization');
  } else if (sql.includes("scope != 'user'")) {
    out = out.filter((r) => r.scope !== 'user');
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: unknown[] = []) => {
    const s = normalize(sql);

    if (s.startsWith('INSERT INTO agent_folders')) {
      const [id, organization_id, scope, project_id, owner_id, name, description, color, parent_folder_id] =
        params as [string, string, string, string | null, string, string, string | null, string | null, string | null];
      const now = new Date().toISOString();
      db.folders.set(id, {
        id,
        organization_id,
        scope,
        project_id,
        owner_id,
        name,
        description,
        color,
        parent_folder_id,
        created_at: now,
        updated_at: now,
      });
      return { changes: 1 };
    }

    if (s.startsWith('DELETE FROM agent_folders')) {
      const [id, orgId, ownerId] = params as [string, string, string];
      const row = db.folders.get(id);
      if (row && row.organization_id === orgId && row.owner_id === ownerId) {
        db.folders.delete(id);
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (s.startsWith('INSERT INTO ai_agent_plans')) {
      const [id, organization_id, conversation_id, user_id, title, description, total_steps, plan_json, is_background, scheduled_at] =
        params as [
          string,
          string,
          string | null,
          string,
          string,
          string | null,
          number,
          string,
          number,
          string | null,
        ];
      db.plans.set(id, {
        id,
        organization_id,
        conversation_id,
        user_id,
        title,
        description,
        status: 'planning',
        total_steps,
        completed_steps: 0,
        current_step_index: 0,
        plan_json,
        result_summary: null,
        error_message: null,
        is_background,
        scheduled_at,
        started_at: null,
        completed_at: null,
        folder_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }

    if (s.startsWith('INSERT INTO ai_agent_plan_steps')) {
      return { changes: 1 };
    }

    if (s.startsWith('UPDATE ai_agent_plans SET folder_id = ?')) {
      const [folderId, planId, orgId] = params as [string | null, string, string];
      const plan = db.plans.get(planId);
      if (plan && plan.organization_id === orgId) {
        plan.folder_id = folderId;
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    throw new Error(`Unmocked SQL (run) in agentFolderService.filtering test: ${s}`);
  },

  get: async (sql: string, params: unknown[] = []) => {
    const s = normalize(sql);
    if (s.startsWith('SELECT * FROM ai_agent_plans WHERE id = ?')) {
      return db.plans.get(params[0] as string) || undefined;
    }
    throw new Error(`Unmocked SQL (get) in agentFolderService.filtering test: ${s}`);
  },

  all: async (sql: string, params: unknown[] = []) => {
    const s = normalize(sql);

    if (s.startsWith('SELECT * FROM agent_folders WHERE')) {
      return filterFolders(s, params);
    }

    if (s.startsWith('SELECT * FROM ai_agent_plan_steps WHERE plan_id = ?')) {
      return [];
    }

    if (s.startsWith('SELECT * FROM ai_agent_plans WHERE organization_id = ?')) {
      const orgId = params[0] as string;
      const userId = s.includes('AND user_id = ?') ? (params[1] as string) : null;
      return [...db.plans.values()]
        .filter((p) => p.organization_id === orgId && (!userId || p.user_id === userId))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }

    throw new Error(`Unmocked SQL (all) in agentFolderService.filtering test: ${s}`);
  },
}));

const { agentFolderService } = await import('../../../server/src/services/ai/agentFolderService.js');
const { agentPlannerService } = await import(
  '../../../server/src/services/ai/agentPlannerService.js'
);

describe('agentFolderService.getFolders — 3 poziomy widoczności (2026-07-28)', () => {
  beforeEach(() => {
    db.folders.clear();
    db.plans.clear();
  });

  it('widok domyślny: własny prywatny + wszystkie organizacyjne + projektowe dla projektów-członka', async () => {
    await agentFolderService.createFolder('org-1', 'user-a', {
      name: 'Mój prywatny',
      scope: 'user',
    });
    await agentFolderService.createFolder('org-1', 'user-b', {
      name: 'Cudzy prywatny',
      scope: 'user',
    });
    await agentFolderService.createFolder('org-1', 'user-b', {
      name: 'Firmowy',
      scope: 'organization',
    });
    await agentFolderService.createFolder('org-1', 'user-b', {
      name: 'Projekt Alpha (jestem)',
      scope: 'project',
      projectId: 'proj-1',
    });
    await agentFolderService.createFolder('org-1', 'user-b', {
      name: 'Projekt Beta (nie jestem)',
      scope: 'project',
      projectId: 'proj-2',
    });

    const visible = await agentFolderService.getFolders('org-1', 'user-a', {
      memberProjectIds: ['proj-1'],
    });

    expect(visible.map((f) => f.name).sort()).toEqual(
      ['Firmowy', 'Mój prywatny', 'Projekt Alpha (jestem)'].sort()
    );
    // ★ Nigdy nie wycieka cudzy prywatny folder ani projekt, którego user nie jest członkiem.
    expect(visible.some((f) => f.name === 'Cudzy prywatny')).toBe(false);
    expect(visible.some((f) => f.name === 'Projekt Beta (nie jestem)')).toBe(false);
  });

  it('scope=user zawęża do WŁASNYCH prywatnych folderów, nie cudzych', async () => {
    await agentFolderService.createFolder('org-1', 'user-a', { name: 'A prywatny', scope: 'user' });
    await agentFolderService.createFolder('org-1', 'user-b', { name: 'B prywatny', scope: 'user' });

    const visible = await agentFolderService.getFolders('org-1', 'user-a', { scope: 'user' });
    expect(visible.map((f) => f.name)).toEqual(['A prywatny']);
  });

  it('scope=organization zwraca foldery organizacyjne niezależnie od twórcy', async () => {
    await agentFolderService.createFolder('org-1', 'user-a', { name: 'Org 1', scope: 'organization' });
    await agentFolderService.createFolder('org-1', 'user-b', { name: 'Org 2', scope: 'organization' });
    await agentFolderService.createFolder('org-1', 'user-a', { name: 'Prywatny', scope: 'user' });

    const visible = await agentFolderService.getFolders('org-1', 'user-a', { scope: 'organization' });
    expect(visible.map((f) => f.name).sort()).toEqual(['Org 1', 'Org 2']);
  });

  it('scope=project bez memberProjectIds (nie-członek) nie zwraca żadnego folderu', async () => {
    await agentFolderService.createFolder('org-1', 'user-b', {
      name: 'Projekt X',
      scope: 'project',
      projectId: 'proj-x',
    });

    const visible = await agentFolderService.getFolders('org-1', 'user-a', {
      scope: 'project',
      memberProjectIds: [],
    });
    expect(visible).toEqual([]);
  });
});

describe('agentPlannerService.setFolder + listPlans — filtrowanie planów po folderze', () => {
  beforeEach(() => {
    db.folders.clear();
    db.plans.clear();
  });

  it('plan startuje bez folderu; setFolder go przypina; listPlans zwraca folderId do filtra klienckiego', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-a',
      title: 'Proces do foldera',
      steps: [{ toolName: 'search_web', toolInput: {} }],
    });
    expect(plan.folderId).toBeFalsy();

    const folder = await agentFolderService.createFolder('org-1', 'user-a', {
      name: 'Klient X',
      scope: 'user',
    });

    const { updated } = await agentPlannerService.setFolder(plan.id, 'org-1', folder.id);
    expect(updated).toBe(true);

    const [listed] = await agentPlannerService.listPlans('org-1', 'user-a');
    expect(listed.folderId).toBe(folder.id);

    // "Bez folderu" (folderId: null) odpina — wzór kebab "Przenieś do folderu".
    await agentPlannerService.setFolder(plan.id, 'org-1', null);
    const [unpinned] = await agentPlannerService.listPlans('org-1', 'user-a');
    expect(unpinned.folderId).toBeFalsy();
  });

  it('setFolder nie przenosi planu innej organizacji (org-scoped guard)', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-a',
      title: 'Plan org-1',
      steps: [{ toolName: 'search_web', toolInput: {} }],
    });

    const { updated } = await agentPlannerService.setFolder(plan.id, 'org-2', 'some-folder');
    expect(updated).toBe(false);

    const [listed] = await agentPlannerService.listPlans('org-1', 'user-a');
    expect(listed.folderId).toBeFalsy();
  });
});
