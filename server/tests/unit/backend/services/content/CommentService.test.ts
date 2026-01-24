import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TestDatabaseFactory } from '../../../../../../tests/utils/TestDatabaseFactory.js';
import type { IDatabase } from '../../../../../src/database/IDatabase.js';
import { CommentService } from '../../../../../src/services/content/CommentService.js';

describe('CommentService', () => {
  let service: CommentService;
  let db: any;

  beforeEach(async () => {
    const testDb = await TestDatabaseFactory.create();

    // Initialize schema
    await testDb.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                avatar_url TEXT
            );

            CREATE TABLE IF NOT EXISTS content_comments (
                id TEXT PRIMARY KEY,
                content_id TEXT NOT NULL,
                content_type TEXT NOT NULL,
                user_id TEXT NOT NULL,
                comment_text TEXT NOT NULL,
                parent_comment_id TEXT,
                thread_id TEXT, 
                position_ref TEXT,
                is_resolved INTEGER DEFAULT 0,
                resolved_by TEXT,
                resolved_at TEXT,
                mentioned_user_ids TEXT DEFAULT '[]',
                is_edited INTEGER DEFAULT 0,
                edited_at TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_comment_id) REFERENCES content_comments(id) ON DELETE CASCADE
            );
            
            -- Seed user
            INSERT INTO users (id, first_name, last_name, avatar_url) VALUES ('user-1', 'John', 'Doe', 'http://avatar.com/john');
            INSERT INTO users (id, first_name, last_name, avatar_url) VALUES ('user-2', 'Jane', 'Smith', 'http://avatar.com/jane');
        `);

    db = {
      ...testDb,
      run: testDb.runAsync.bind(testDb),
      get: testDb.getAsync.bind(testDb),
      all: testDb.allAsync.bind(testDb),
      exec: (sql: string, cb?: any) => testDb.exec(sql, cb),
      close: () => testDb.close(),
    };

    service = new CommentService({ db: db as IDatabase });
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  describe('createComment', () => {
    it('should create a comment successfully', async () => {
      const data = {
        contentId: 'playbook-1',
        contentType: 'PLAYBOOK',
        userId: 'user-1',
        commentText: 'Great playbook!',
      };

      const comment = await service.createComment(data);

      expect(comment.id).toMatch(/^cmt-/);
      expect(comment.contentId).toBe(data.contentId);
      expect(comment.userId).toBe(data.userId);
      expect(comment.commentText).toBe(data.commentText);
      expect(comment.isResolved).toBe(false);
      expect(comment.threadId).toBe(comment.id); // Root comment threadId is self
      expect(comment.user).toBeDefined();
      expect(comment.user?.firstName).toBe('John');
      expect(comment.user?.avatar).toBe('http://avatar.com/john');
    });

    it('should create a reply correctly', async () => {
      const parent = await service.createComment({
        contentId: 'playbook-1',
        contentType: 'PLAYBOOK',
        userId: 'user-1',
        commentText: 'Root',
      });

      const reply = await service.createComment({
        contentId: 'playbook-1',
        contentType: 'PLAYBOOK',
        userId: 'user-2',
        commentText: 'Reply',
        parentCommentId: parent.id,
      });

      expect(reply.parentCommentId).toBe(parent.id);
      expect(reply.threadId).toBe(parent.id); // Inherits threadId
    });
  });

  describe('getContentComments', () => {
    it('should return threaded comments', async () => {
      const root = await service.createComment({
        contentId: 'playbook-1',
        contentType: 'PLAYBOOK',
        userId: 'user-1',
        commentText: 'Root',
      });

      await service.createComment({
        contentId: 'playbook-1',
        contentType: 'PLAYBOOK',
        userId: 'user-2',
        commentText: 'Reply 1',
        parentCommentId: root.id,
      });

      const comments = await service.getContentComments('playbook-1', 'PLAYBOOK');
      expect(comments).toHaveLength(1); // One root
      expect(comments[0].id).toBe(root.id);
      expect(comments[0].replies).toHaveLength(1);
      expect(comments[0].replies![0].commentText).toBe('Reply 1');
    });

    it('should filter resolved comments via options', async () => {
      const comment = await service.createComment({
        contentId: 'playbook-1',
        contentType: 'PLAYBOOK',
        userId: 'user-1',
        commentText: 'Resolved',
      });
      await service.resolveComment(comment.id, 'user-1');

      const all = await service.getContentComments('playbook-1', 'PLAYBOOK', {
        includeResolved: true,
      });
      expect(all).toHaveLength(1);

      const unresolved = await service.getContentComments('playbook-1', 'PLAYBOOK', {
        includeResolved: false,
      });
      expect(unresolved).toHaveLength(0);
    });
  });

  describe('updateComment', () => {
    it('should update text and set edited flag', async () => {
      const comment = await service.createComment({
        contentId: 'p1',
        contentType: 'P',
        userId: 'user-1',
        commentText: 'Original',
      });

      const updated = await service.updateComment(comment.id, 'Updated text', 'user-1');
      expect(updated.commentText).toBe('Updated text');
      expect(updated.isEdited).toBe(true);
      expect(updated.editedAt).toBeDefined();
    });

    it('should fail if user is not author', async () => {
      const comment = await service.createComment({
        contentId: 'p1',
        contentType: 'P',
        userId: 'user-1',
        commentText: 'Original',
      });

      await expect(service.updateComment(comment.id, 'Hack', 'user-2')).rejects.toThrow(
        'Can only edit your own comments'
      );
    });
  });

  describe('deleteComment', () => {
    it('should delete comment and cascades (if supported by sqlite config)', async () => {
      // Note: SQLite FK cascade requires PRAGMA foreign_keys = ON;
      // TestDatabaseFactory might not enable it by default.
      // But we can check explicit deletion of the item itself.

      const comment = await service.createComment({
        contentId: 'p1',
        contentType: 'P',
        userId: 'user-1',
        commentText: 'To Delete',
      });

      const result = await service.deleteComment(comment.id);
      expect(result).toBe(true);

      const fetched = await service.getCommentById(comment.id);
      expect(fetched).toBeNull();
    });
  });
});
