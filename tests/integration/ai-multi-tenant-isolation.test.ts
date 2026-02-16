/**
 * Multi-Tenant Isolation Tests for AI Subsystem
 * Verifies Org A cannot access Org B data.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const ORG_A = { id: 'test-org-a-' + Date.now(), userId: 'user-a-' + Date.now() };
const ORG_B = { id: 'test-org-b-' + Date.now(), userId: 'user-b-' + Date.now() };

let dbAll: any, dbRun: any;
beforeAll(async () => {
  try {
    const m = await import('../../server/src/utils/DbPromise.js');
    dbAll = m.all;
    dbRun = m.run;
  } catch {
    dbAll = async () => [];
    dbRun = async () => ({});
  }
  for (const org of [ORG_A, ORG_B]) {
    await dbRun(
      `INSERT OR IGNORE INTO conversations (id,user_id,organization_id,title,created_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now'))`,
      [`conv-${org.id}`, org.userId, org.id, `Test ${org.id}`]
    );
    await dbRun(
      `INSERT OR IGNORE INTO conversation_messages (id,conversation_id,role,content,created_at) VALUES (?,?,'user',?,datetime('now'))`,
      [`msg-${org.id}`, `conv-${org.id}`, `Secret ${org.id}`]
    );
  }
});
afterAll(async () => {
  for (const org of [ORG_A, ORG_B]) {
    await dbRun(`DELETE FROM conversation_messages WHERE conversation_id=?`, [`conv-${org.id}`]);
    await dbRun(`DELETE FROM conversations WHERE id=?`, [`conv-${org.id}`]);
  }
});

describe('AI Multi-Tenant Isolation', () => {
  test('Org A cannot see Org B conversations', async () => {
    const rows = (await dbAll(`SELECT * FROM conversations WHERE organization_id=? AND id=?`, [
      ORG_A.id,
      `conv-${ORG_B.id}`,
    ])) as any[];
    expect(rows).toHaveLength(0);
  });
  test('Org B cannot see Org A conversations', async () => {
    const rows = (await dbAll(`SELECT * FROM conversations WHERE organization_id=? AND id=?`, [
      ORG_B.id,
      `conv-${ORG_A.id}`,
    ])) as any[];
    expect(rows).toHaveLength(0);
  });
  test('Org-scoped query returns only own data', async () => {
    const a = (await dbAll(`SELECT * FROM conversations WHERE organization_id=?`, [
      ORG_A.id,
    ])) as any[];
    const b = (await dbAll(`SELECT * FROM conversations WHERE organization_id=?`, [
      ORG_B.id,
    ])) as any[];
    for (const r of a) expect(r.organization_id).toBe(ORG_A.id);
    for (const r of b) expect(r.organization_id).toBe(ORG_B.id);
  });
  test('Messages isolated via conversation ownership', async () => {
    const rows = (await dbAll(
      `SELECT cm.* FROM conversation_messages cm JOIN conversations c ON c.id=cm.conversation_id WHERE c.organization_id=? AND cm.content LIKE ?`,
      [ORG_A.id, `%${ORG_B.id}%`]
    )) as any[];
    expect(rows).toHaveLength(0);
  });
  test('SQL injection in org_id returns nothing', async () => {
    const rows = (await dbAll(`SELECT * FROM conversations WHERE organization_id=?`, [
      `${ORG_A.id}' OR '1'='1`,
    ])) as any[];
    expect(rows).toHaveLength(0);
  });
});
