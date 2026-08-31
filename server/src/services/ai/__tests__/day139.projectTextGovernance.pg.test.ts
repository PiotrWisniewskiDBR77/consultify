import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.DB_TYPE = process.env.DAY139_EFFECTIVE_DB_TYPE || process.env.DB_TYPE;

let dbGet: typeof import('../../../utils/DbPromise.js').get;
let dbRun: typeof import('../../../utils/DbPromise.js').run;

vi.mock('../../aiContextBuilder.js', () => ({
  AIContextBuilder: {
    buildContext: vi.fn(async () => ({})),
  },
}));

const ids = {
  user: 'day139-user',
  organization: 'day139-org',
  project: 'day139-project',
  chatProject: 'day139-chat-project',
  conversation: 'day139-conversation',
  document: 'day139-confidential-document',
  knowledge: 'day139-project-text',
};
const secret = 'DAY139_CONFIDENTIAL_PROJECT_TEXT_MUST_NOT_ENTER_PROMPT';
const projectBrief = 'DAY139_NON_CONFIDENTIAL_PROJECT_BRIEF_REACHABILITY_PROOF';

describe('Day 139 R2 — project text governance on real PostgreSQL', { retry: 0 }, () => {
  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    ({ get: dbGet, run: dbRun } = await import('../../../utils/DbPromise.js'));

    const identity = (await dbGet(
      `SELECT current_database() AS database, inet_server_port() AS port`
    )) as { database: string; port: number };
    expect(process.env.DATABASE_URL).toMatch(
      /^postgresql:\/\/[^/]+@(127\.0\.0\.1|localhost):\d+\/[^/]+$/
    );
    expect(identity.database.length).toBeGreaterThan(0);
    expect(identity.port).toBeGreaterThan(0);

    await dbRun(
      `INSERT INTO organizations (id, name)
       VALUES (?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [ids.organization, 'Day 139 organization']
    );
    await dbRun(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [ids.user, ids.organization, 'day139@example.invalid', 'Day', '139', 'ADMIN']
    );
    await dbRun(
      `INSERT INTO projects (id, organization_id, name)
       VALUES (?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [ids.project, ids.organization, 'Day 139 governance project']
    );
    await dbRun(
      `INSERT INTO chat_projects (id, user_id, organization_id, name, custom_instructions)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET custom_instructions = EXCLUDED.custom_instructions`,
      [ids.chatProject, ids.user, ids.organization, 'Day 139 chat project', projectBrief]
    );
    await dbRun(
      `INSERT INTO conversations (id, user_id, organization_id, project_id, chat_project_id, title)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [
        ids.conversation,
        ids.user,
        ids.organization,
        ids.project,
        ids.chatProject,
        'Day 139 conversation',
      ]
    );
    await dbRun(
      `INSERT INTO knowledge_docs
         (id, filename, organization_id, project_id, owner_id, scope, status,
          ai_visibility, sensitivity)
       VALUES (?, ?, ?, ?, ?, 'project', 'ready', 'allowed', 'confidential')
       ON CONFLICT (id) DO UPDATE SET
         ai_visibility = EXCLUDED.ai_visibility,
         sensitivity = EXCLUDED.sensitivity`,
      [ids.document, 'day139-confidential.txt', ids.organization, ids.project, ids.user]
    );
    await dbRun(
      `INSERT INTO project_knowledge
         (id, project_id, kind, title, content, doc_id, added_by, added_at)
       VALUES (?, ?, 'text', ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, doc_id = EXCLUDED.doc_id`,
      [ids.knowledge, ids.chatProject, 'Confidential Day 139 text', secret, ids.document, ids.user]
    );
  });

  afterAll(async () => {
    await dbRun('DELETE FROM project_knowledge WHERE id = ?', [ids.knowledge]);
    await dbRun('DELETE FROM conversations WHERE id = ?', [ids.conversation]);
    await dbRun('DELETE FROM chat_projects WHERE id = ?', [ids.chatProject]);
    await dbRun('DELETE FROM knowledge_docs WHERE id = ?', [ids.document]);
    await dbRun('DELETE FROM projects WHERE id = ?', [ids.project]);
    await dbRun('DELETE FROM users WHERE id = ?', [ids.user]);
    await dbRun('DELETE FROM organizations WHERE id = ?', [ids.organization]);
  });

  it('excludes a project text whose governance parent is confidential', async () => {
    const stored = (await dbGet(
      `SELECT k.id, k.doc_id, d.ai_visibility, d.sensitivity
       FROM project_knowledge k
       JOIN knowledge_docs d ON d.id = k.doc_id
       WHERE k.id = ?`,
      [ids.knowledge]
    )) as {
      id: string;
      doc_id: string;
      ai_visibility: string;
      sensitivity: string;
    };
    expect(stored).toEqual({
      id: ids.knowledge,
      doc_id: ids.document,
      ai_visibility: 'allowed',
      sensitivity: 'confidential',
    });

    const { aiPipeline } = await import('../AIPipeline.js');
    const result = await (aiPipeline as any).buildContext({
      userId: ids.user,
      organizationId: ids.organization,
      projectId: ids.project,
      context: { conversationId: ids.conversation },
      options: {},
    });

    expect(result.context.customInstructions || '').toContain(projectBrief);
    expect(result.context.customInstructions || '').not.toContain(secret);
  });
});
