import { getDatabase } from '../../../../database/Database.js';
import type { IDatabase } from '../../../../database/IDatabase.js';

export interface UpdateProjectCommand {
    projectId: string;
    updates: Partial<{
        name: string;
        summary: string;
        ownerId: string;
    }>;
}

export class UpdateProjectHandler {
    constructor(private readonly db: IDatabase = getDatabase()) {}

    async execute(command: UpdateProjectCommand) {
        const fields: string[] = [];
        const values: unknown[] = [];

        if (command.updates.name) {
            fields.push('name = ?');
            values.push(command.updates.name);
        }
        if (command.updates.summary) {
            fields.push('summary = ?');
            values.push(command.updates.summary);
        }
        if (command.updates.ownerId) {
            fields.push('owner_id = ?');
            values.push(command.updates.ownerId);
        }

        if (fields.length === 0) {
            return null;
        }

        values.push(new Date().toISOString());
        fields.push('updated_at = ?');

        values.push(command.projectId);

        await this.db.run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values);

        const updated = await this.db.get('SELECT * FROM projects WHERE id = ?', [command.projectId]);

        return updated;
    }
}
