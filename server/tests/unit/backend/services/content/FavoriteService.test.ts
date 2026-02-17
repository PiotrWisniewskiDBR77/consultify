import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TestDatabaseFactory } from '../../../../../../tests/utils/TestDatabaseFactory.js';
import type { IDatabase } from '../../../../../src/database/IDatabase.js';
import { FavoriteService } from '../../../../../src/services/content/FavoriteService.js';

describe('FavoriteService', () => {
  let service: FavoriteService;
  let db: any;

  beforeEach(async () => {
    const testDb = await TestDatabaseFactory.create();

    // Initialize schema
    await testDb.exec(`
            CREATE TABLE IF NOT EXISTS content_favorites (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                content_id TEXT,
                content_type TEXT,
                notes TEXT,
                folder_name TEXT,
                created_at TEXT,
                UNIQUE(user_id, content_id, content_type)
            );
        `);

    db = {
      ...testDb,
      run: testDb.runAsync.bind(testDb),
      get: testDb.getAsync.bind(testDb),
      all: testDb.allAsync.bind(testDb),
      exec: (sql: string, cb?: any) => testDb.exec(sql, cb),
      close: () => testDb.close(),
    };

    service = new FavoriteService({ db: db as IDatabase });
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  describe('addFavorite', () => {
    it('should add a favorite', async () => {
      const fav = await service.addFavorite('u1', 'c1', 'DOC');
      expect(fav.id).toMatch(/^fav-/);
      expect(fav.userId).toBe('u1');
      expect(fav.contentId).toBe('c1');
      expect(fav.folderName).toBe('Default');

      const isFav = await service.isFavorited('u1', 'c1', 'DOC');
      expect(isFav).toBe(true);
    });

    it('should ignore duplicate adds (idempotent via IGNORE)', async () => {
      // BUT implementation uses random ID.
      // DB has UNIQUE constraint? Yes, UNIQUE(user_id, content_id, content_type) assumed (copied from common sense or DDL check).
      // content_favorites usually has unique constraint.
      // If I execute addFavorite twice, second one might fail or insert if ID is different?
      // "INSERT OR IGNORE" in SQL.
      // So it ignores.

      await service.addFavorite('u1', 'c1', 'DOC');
      const fav2 = await service.addFavorite('u1', 'c1', 'DOC');
      // If ignored, it returns object with NEW ID?
      // Wait, logic says:
      // const id = newId(); ... INSERT OR IGNORE ... return { id, ... }
      // If ignored, row is NOT inserted.
      // But function returns the object with NEW ID.
      // This is slightly misleading if it wasn't actually persisted.
      // But acceptable for "ensure favorited".
      // The check is "isFavorited" becomes true.

      const list = await service.getUserFavorites('u1');
      expect(list).toHaveLength(1); // Should be 1 because of unique constraint ignoring second insert
    });
  });

  describe('removeFavorite', () => {
    it('should remove favorite', async () => {
      await service.addFavorite('u1', 'c1', 'DOC');
      const removed = await service.removeFavorite('u1', 'c1', 'DOC');
      expect(removed).toBe(true);

      const isFav = await service.isFavorited('u1', 'c1', 'DOC');
      expect(isFav).toBe(false);
    });
  });

  describe('getUserFavorites', () => {
    it('should list and filter favorites', async () => {
      await service.addFavorite('u1', 'c1', 'DOC', { folderName: 'Work' });
      await service.addFavorite('u1', 'c2', 'IMG', { folderName: 'Work' });
      await service.addFavorite('u1', 'c3', 'DOC', { folderName: 'Personal' });

      const all = await service.getUserFavorites('u1');
      expect(all).toHaveLength(3);

      const docs = await service.getUserFavorites('u1', { contentType: 'DOC' });
      expect(docs).toHaveLength(2);

      const work = await service.getUserFavorites('u1', { folderName: 'Work' });
      expect(work).toHaveLength(2);
    });
  });
});
