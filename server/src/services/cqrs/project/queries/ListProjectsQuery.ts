import type { IDatabase } from '../../../database/IDatabase.js';
import { getDatabase } from '../../../database/Database.js';

export interface ListProjectsQuery {
    organizationId: string;
}

export class ListProjectsHandler {
    constructor(private readonly db: IDatabase = getDatabase()) {}

    async execute(query: ListProjectsQuery) {
        const rows = await this.db.all(
            'SELECT * FROM projects WHERE organization_id = ? ORDER BY created_at DESC',
            [query.organizationId]
        );
        return rows;
    }
}
