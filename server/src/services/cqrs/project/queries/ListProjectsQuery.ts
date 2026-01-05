import { getDatabase } from '../../../../database/Database.js';
import type { IDatabase } from '../../../../database/IDatabase.js';

export class ListProjectsQuery {
    constructor(public readonly organizationId: string) {}
}

export class ListProjectsHandler {
    constructor(private readonly db: IDatabase = getDatabase()) {}

    async execute(query: ListProjectsQuery) {
        const rows = await this.db.all('SELECT * FROM projects WHERE organization_id = ? ORDER BY created_at DESC', [
            query.organizationId,
        ]);
        return rows;
    }
}
