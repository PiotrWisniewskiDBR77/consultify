import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase, RunResult } from '../../database/IDatabase.js';

export interface Favorite {
    id: string;
    userId: string;
    contentId: string;
    contentType: string;
    notes?: string | null;
    folderName: string;
    createdAt: string;
}

export interface AddFavoriteOptions {
    notes?: string | null;
    folderName?: string;
}

export interface GetUserFavoritesOptions {
    contentType?: string | null;
    folderName?: string | null;
}

export interface FavoriteServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

export class FavoriteService {
    private deps: FavoriteServiceDependencies;

    constructor(deps?: Partial<FavoriteServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4,
        };
    }

    async addFavorite(
        userId: string,
        contentId: string,
        contentType: string,
        options: AddFavoriteOptions = {},
    ): Promise<Favorite> {
        const { notes = null, folderName = 'Default' } = options;
        const id = `fav-${this.deps.uuidv4()}`;
        const now = new Date().toISOString();

        await this.deps.db.run(
            `INSERT OR IGNORE INTO content_favorites (id, user_id, content_id, content_type, notes, folder_name, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, userId, contentId, contentType, notes, folderName, now],
        );

        // Fetch to ensure correctness or return constructed? Original constructed.
        return {
            id,
            userId,
            contentId,
            contentType,
            notes,
            folderName,
            createdAt: now,
        };
    }

    async removeFavorite(userId: string, contentId: string, contentType: string): Promise<boolean> {
        const result = (await this.deps.db.run(
            'DELETE FROM content_favorites WHERE user_id = ? AND content_id = ? AND content_type = ?',
            [userId, contentId, contentType],
        )) as RunResult;

        return result.changes > 0;
    }

    async getUserFavorites(userId: string, options: GetUserFavoritesOptions = {}): Promise<Favorite[]> {
        const { contentType = null, folderName = null } = options;
        const conditions: string[] = ['user_id = ?'];
        const params: unknown[] = [userId];

        if (contentType) {
            conditions.push('content_type = ?');
            params.push(contentType);
        }

        if (folderName) {
            conditions.push('folder_name = ?');
            params.push(folderName);
        }

        const rows = (await this.deps.db.all<{
            id: string;
            user_id: string;
            content_id: string;
            content_type: string;
            notes?: string | null;
            folder_name: string;
            created_at: string;
        }>(
            `SELECT * FROM content_favorites WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
            params,
        )) as Array<{
            id: string;
            user_id: string;
            content_id: string;
            content_type: string;
            notes?: string | null;
            folder_name: string;
            created_at: string;
        }>;

        return (rows || []).map((row) => ({
            id: row.id,
            userId: row.user_id,
            contentId: row.content_id,
            contentType: row.content_type,
            notes: row.notes,
            folderName: row.folder_name,
            createdAt: row.created_at,
        }));
    }

    async isFavorited(userId: string, contentId: string, contentType: string): Promise<boolean> {
        const row = (await this.deps.db.get<{ '1': number }>(
            'SELECT 1 FROM content_favorites WHERE user_id = ? AND content_id = ? AND content_type = ?',
            [userId, contentId, contentType],
        )) as { '1': number } | null;

        return !!row;
    }
}
