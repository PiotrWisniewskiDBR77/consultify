import type { IDatabase } from '../../../database/IDatabase.js';
import { getDatabase } from '../../../database/Database.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateProjectCommand {
    name: string;
    organizationId: string;
    ownerId: string;
    summary?: string | null;
}

export class CreateProjectHandler {
    constructor(private readonly db: IDatabase = getDatabase()) {}

    async execute(command: CreateProjectCommand) {
        const id = `proj-${uuidv4()}`;
        const now = new Date().toISOString();

        await this.db.run(
            `INSERT INTO projects (id, name, organization_id, owner_id, summary, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, command.name, command.organizationId, command.ownerId, command.summary || '', now, now]
        );

        return {
            id,
            name: command.name,
            organizationId: command.organizationId,
            ownerId: command.ownerId,
            summary: command.summary || '',
            createdAt: now
        };
    }
}
