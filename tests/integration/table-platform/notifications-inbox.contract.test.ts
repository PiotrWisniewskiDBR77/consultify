/**
 * tp-notifications-inbox — Watch + @mention notifications actually reach the
 * recipient's inbox, not just the audit log.
 *
 * PROBLEM (before this change): RecordWatchService.notifyWatchers() wrote a
 * row into tp_audit_events (metadata.notified_user = watcher's id) whenever a
 * watched record changed — but nothing ever read it back per-user. Same for
 * RecordCommentService.addComment(): `mentions` were persisted on
 * tp_record_comments but never turned into a notification for the mentioned
 * user. Both were write-only.
 *
 * Anti-false-green: a wierny (Postgres-compatible) in-memory pool backs the
 * REAL RecordWatchService / RecordCommentService / NotificationInboxService
 * code — no service internals are mocked, only the DB driver + RealtimeService
 * (socket.io) + AuditService side effects. If a future change reverts to
 * "write but never expose notified_user_id" or drops the inbox filter, these
 * tests fail because the inbox endpoint's *own* SQL contract
 * (`WHERE notified_user_id = $1`) stops returning the row.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Wierny in-memory Postgres-compatible pool --------------------------
interface WatchRow {
  id: string;
  record_id: string;
  table_id: string;
  user_id: string;
  created_at: string;
}

interface AuditEventRow {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  before_data: unknown;
  after_data: unknown;
  metadata: Record<string, unknown>;
  notified_user_id: string | null;
  read_at: string | null;
  created_at: string;
}

interface CommentRow {
  id: string;
  record_id: string;
  table_id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  parent_id: string | null;
  mentions: string[];
  created_at: string;
  updated_at: string;
}

let watches: WatchRow[] = [];
let auditEvents: AuditEventRow[] = [];
let comments: CommentRow[] = [];
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

const ORG_ID = 'org-1';
const TABLE_ID = 'tbl-1';
const BASE_ID = 'base-1';

// Org membership fixture used by RecordCommentService's mention resolver.
const ORG_MEMBERS = [
  { id: 'user-a', email: 'a@co.test', first_name: 'Alice', last_name: 'Anderson' },
  { id: 'user-b', email: 'b@co.test', first_name: 'Bob', last_name: 'Brown' },
  { id: 'user-c', email: 'c@co.test', first_name: 'Carol', last_name: 'Carter' },
];

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const fakePool = {
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    // --- tp_record_watches --------------------------------------------
    if (s.startsWith('INSERT INTO tp_record_watches')) {
      const [recordId, tableId, userId] = params as [string, string, string];
      const existing = watches.find((w) => w.record_id === recordId && w.user_id === userId);
      if (existing) return { rows: [], rowCount: 0 };
      const row: WatchRow = {
        id: nextId('watch'),
        record_id: recordId,
        table_id: tableId,
        user_id: userId,
        created_at: new Date().toISOString(),
      };
      watches.push(row);
      return { rows: [clone(row)], rowCount: 1 };
    }
    if (s.startsWith('SELECT * FROM tp_record_watches WHERE record_id = $1 AND user_id = $2')) {
      const [recordId, userId] = params as [string, string];
      const row = watches.find((w) => w.record_id === recordId && w.user_id === userId);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }
    if (s.startsWith('SELECT 1 FROM tp_record_watches WHERE record_id = $1 AND user_id = $2')) {
      const [recordId, userId] = params as [string, string];
      const row = watches.find((w) => w.record_id === recordId && w.user_id === userId);
      return { rows: row ? [{ '?column?': 1 }] : [], rowCount: row ? 1 : 0 };
    }
    if (s.startsWith('SELECT * FROM tp_record_watches WHERE record_id = $1 ORDER BY')) {
      const recordId = params[0] as string;
      const rows = watches.filter((w) => w.record_id === recordId);
      return { rows: rows.map(clone), rowCount: rows.length };
    }

    // --- @mention delivery (RecordCommentService) — check this BEFORE the
    // generic watch-notification branch below: both share the same leading
    // column-list prefix ("INSERT INTO tp_audit_events (event_type, ...")
    // but the mention insert hardcodes the event_type literal in the VALUES
    // clause and takes 4 params instead of 6.
    if (
      s.startsWith(
        `INSERT INTO tp_audit_events (event_type, entity_type, entity_id, actor_id, metadata, notified_user_id) VALUES ('mention', 'record', $1, $2, $3, $4)`
      )
    ) {
      const [entityId, actorId, metadataJson, notifiedUserId] = params as [
        string,
        string,
        string,
        string,
      ];
      const row: AuditEventRow = {
        id: nextId('audit'),
        event_type: 'mention',
        entity_type: 'record',
        entity_id: entityId,
        actor_id: actorId,
        before_data: null,
        after_data: null,
        metadata: JSON.parse(metadataJson),
        notified_user_id: notifiedUserId,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      auditEvents.push(row);
      return { rows: [{ id: row.id, created_at: row.created_at }], rowCount: 1 };
    }

    // --- tp_audit_events (watch notifications) -------------------------
    if (
      s.startsWith(
        'INSERT INTO tp_audit_events (event_type, entity_type, entity_id, actor_id, metadata, notified_user_id)'
      )
    ) {
      const [eventType, entityType, entityId, actorId, metadataJson, notifiedUserId] = params as [
        string,
        string,
        string,
        string | null,
        string,
        string,
      ];
      const row: AuditEventRow = {
        id: nextId('audit'),
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        actor_id: actorId,
        before_data: null,
        after_data: null,
        metadata: JSON.parse(metadataJson),
        notified_user_id: notifiedUserId,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      auditEvents.push(row);
      return { rows: [{ id: row.id, created_at: row.created_at }], rowCount: 1 };
    }

    // --- tableId -> organizationId chain (mention resolver + realtime org-gate)
    if (s.startsWith('SELECT b.organization_id AS org_id')) {
      const tableId = params[0] as string;
      if (tableId !== TABLE_ID) return { rows: [], rowCount: 0 };
      return { rows: [{ org_id: ORG_ID }], rowCount: 1 };
    }

    // --- organization_members JOIN users (mention resolver) -------------
    if (s.startsWith('SELECT u.id, u.email, u.first_name, u.last_name')) {
      const orgId = params[0] as string;
      if (orgId !== ORG_ID) return { rows: [], rowCount: 0 };
      return { rows: ORG_MEMBERS.map(clone), rowCount: ORG_MEMBERS.length };
    }

    // --- NotificationInboxService reads ---------------------------------
    if (s.startsWith('SELECT id, event_type, entity_type, entity_id, actor_id, metadata, read_at, created_at')) {
      const userId = params[0] as string;
      const unreadOnly = s.includes('AND read_at IS NULL');
      let rows = auditEvents.filter((e) => e.notified_user_id === userId);
      if (unreadOnly) rows = rows.filter((e) => e.read_at === null);
      rows = rows.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const limit = params[1] as number;
      const offset = params[2] as number;
      const page = rows.slice(offset, offset + limit);
      return { rows: page.map(clone), rowCount: page.length };
    }
    if (s.startsWith('SELECT COUNT(*) AS total FROM tp_audit_events WHERE notified_user_id = $1')) {
      const userId = params[0] as string;
      const unreadOnly = s.includes('AND read_at IS NULL');
      let rows = auditEvents.filter((e) => e.notified_user_id === userId);
      if (unreadOnly) rows = rows.filter((e) => e.read_at === null);
      return { rows: [{ total: String(rows.length) }], rowCount: 1 };
    }
    if (s.startsWith('SELECT COUNT(*) AS unread FROM tp_audit_events WHERE notified_user_id = $1')) {
      const userId = params[0] as string;
      const rows = auditEvents.filter((e) => e.notified_user_id === userId && e.read_at === null);
      return { rows: [{ unread: String(rows.length) }], rowCount: 1 };
    }
    if (s.startsWith('UPDATE tp_audit_events') && s.includes('SET read_at = NOW()') && s.includes('RETURNING id')) {
      const [id, userId] = params as [string, string];
      const row = auditEvents.find(
        (e) => e.id === id && e.notified_user_id === userId && e.read_at === null
      );
      if (!row) return { rows: [], rowCount: 0 };
      row.read_at = new Date().toISOString();
      return { rows: [{ id: row.id }], rowCount: 1 };
    }
    if (s.startsWith('SELECT id FROM tp_audit_events WHERE id = $1 AND notified_user_id = $2')) {
      const [id, userId] = params as [string, string];
      const row = auditEvents.find((e) => e.id === id && e.notified_user_id === userId);
      return { rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0 };
    }

    // --- tp_record_comments ----------------------------------------------
    if (s.startsWith('INSERT INTO tp_record_comments')) {
      const [recordId, tableId, authorId, authorName, content, parentId, mentionsJson] =
        params as [string, string, string, string | null, string, string | null, string];
      const row: CommentRow = {
        id: nextId('comment'),
        record_id: recordId,
        table_id: tableId,
        author_id: authorId,
        author_name: authorName,
        content,
        parent_id: parentId,
        mentions: JSON.parse(mentionsJson),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      comments.push(row);
      return { rows: [clone(row)], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in fakePool: ${s}`);
  }),
};

const mockNotifyUser = vi.fn();

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => fakePool,
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/RealtimeService.js', () => ({
  tablePlatformRealtime: {
    notifyUser: (...args: unknown[]) => mockNotifyUser(...args),
  },
}));

import recordCommentService from '../../../server/src/services/tablePlatform/RecordCommentService.js';
import recordWatchService from '../../../server/src/services/tablePlatform/RecordWatchService.js';
import notificationInboxService from '../../../server/src/services/tablePlatform/NotificationInboxService.js';

const RECORD_ID = 'rec-1';

describe('tp-notifications-inbox — watch notifications reach the inbox', () => {
  beforeEach(() => {
    watches = [];
    auditEvents = [];
    comments = [];
    seq = 0;
    fakePool.query.mockClear();
    mockNotifyUser.mockClear();
  });

  it('user A watches a record; user B updates it → A gets a notification AND the inbox endpoint returns it', async () => {
    // User A watches the record.
    await recordWatchService.watchRecord(RECORD_ID, TABLE_ID, 'user-a');
    expect(await recordWatchService.isWatching(RECORD_ID, 'user-a')).toBe(true);

    // Before this feature: this write happened but nothing consumed it. Prove
    // the write happens (unchanged behavior)...
    await recordWatchService.notifyWatchers(RECORD_ID, {
      action: 'update',
      recordId: RECORD_ID,
      tableId: TABLE_ID,
      actorId: 'user-b',
      changes: { status: 'Done' },
    });

    const written = auditEvents.filter((e) => e.entity_id === RECORD_ID && e.event_type === 'watch_update');
    expect(written).toHaveLength(1);
    expect(written[0].notified_user_id).toBe('user-a'); // recipient is now first-class, not buried in metadata only

    // ...AND (the actual fix) the inbox endpoint's own read path returns it
    // for user A. This is the assertion that fails on the pre-fix code: there
    // was no notified_user_id column and no NotificationInboxService at all.
    const inbox = await notificationInboxService.listForUser('user-a');
    expect(inbox.total).toBe(1);
    expect(inbox.unread).toBe(1);
    expect(inbox.notifications).toHaveLength(1);
    expect(inbox.notifications[0].eventType).toBe('watch_update');
    expect(inbox.notifications[0].entityId).toBe(RECORD_ID);
    expect(inbox.notifications[0].read).toBe(false);

    // The actor (user-b) must NOT see their own change as a notification.
    const actorInbox = await notificationInboxService.listForUser('user-b');
    expect(actorInbox.total).toBe(0);

    // Realtime push happened too (fail-soft addition, not just the DB write).
    expect(mockNotifyUser).toHaveBeenCalledWith(
      'user-a',
      expect.objectContaining({ eventType: 'watch_update', entityId: RECORD_ID })
    );
  });

  it('mark-as-read flips unread count and is scoped to the owning user', async () => {
    await recordWatchService.watchRecord(RECORD_ID, TABLE_ID, 'user-a');
    await recordWatchService.notifyWatchers(RECORD_ID, {
      action: 'delete',
      recordId: RECORD_ID,
      tableId: TABLE_ID,
      actorId: 'user-b',
    });

    const before = await notificationInboxService.listForUser('user-a');
    const notifId = before.notifications[0].id;

    // A different user cannot mark someone else's notification read.
    const wrongUserOk = await notificationInboxService.markAsRead(notifId, 'user-c');
    expect(wrongUserOk).toBe(false);

    const ok = await notificationInboxService.markAsRead(notifId, 'user-a');
    expect(ok).toBe(true);

    const after = await notificationInboxService.listForUser('user-a');
    expect(after.unread).toBe(0);
    expect(after.notifications[0].read).toBe(true);
  });
});

describe('tp-notifications-inbox — @mention delivery reaches the inbox', () => {
  beforeEach(() => {
    watches = [];
    auditEvents = [];
    comments = [];
    seq = 0;
    fakePool.query.mockClear();
    mockNotifyUser.mockClear();
  });

  it('comment @mentions user C → C gets a notification in their inbox', async () => {
    const comment = await recordCommentService.addComment(
      RECORD_ID,
      TABLE_ID,
      'user-a',
      'Alice Anderson',
      'Hey @Carol Carter please check this row',
      undefined,
      ['Carol Carter'] // FE currently sends the display-name fragment, not a raw id
    );

    expect(comment.mentions).toEqual(['Carol Carter']);

    // Before this feature: mentions were persisted on the comment row and
    // nothing else happened — no notification, no inbox entry. This is the
    // assertion that fails pre-fix.
    const inbox = await notificationInboxService.listForUser('user-c');
    expect(inbox.total).toBe(1);
    expect(inbox.notifications[0].eventType).toBe('mention');
    expect(inbox.notifications[0].entityId).toBe(RECORD_ID);
    expect((inbox.notifications[0].metadata as any).comment_id).toBe(comment.id);

    expect(mockNotifyUser).toHaveBeenCalledWith(
      'user-c',
      expect.objectContaining({ eventType: 'mention', entityId: RECORD_ID })
    );
  });

  it('mentioning yourself does not create a self-notification', async () => {
    await recordCommentService.addComment(
      RECORD_ID,
      TABLE_ID,
      'user-a',
      'Alice Anderson',
      'Note to self @Alice Anderson',
      undefined,
      ['Alice Anderson']
    );

    const inbox = await notificationInboxService.listForUser('user-a');
    expect(inbox.total).toBe(0);
  });

  it('an unresolvable mention token is dropped silently (no crash, no orphan notification)', async () => {
    const comment = await recordCommentService.addComment(
      RECORD_ID,
      TABLE_ID,
      'user-a',
      'Alice Anderson',
      'Hey @nobody-such-user',
      undefined,
      ['nobody-such-user']
    );
    expect(comment.id).toBeTruthy();
    expect(auditEvents.filter((e) => e.event_type === 'mention')).toHaveLength(0);
  });
});
