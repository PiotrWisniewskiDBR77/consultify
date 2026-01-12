import { getDatabase } from '../../../../database/Database.js';
import type { IDatabase } from '../../../../database/IDatabase.js';

export interface DeleteProjectCommand {
    projectId: string;
}

export class DeleteProjectHandler {
    constructor(private readonly db: IDatabase = getDatabase()) {}

    async execute(command: DeleteProjectCommand) {
        await this.db.run('DELETE FROM projects WHERE id = ?', [command.projectId]);
        return { deleted: true, id: command.projectId };
    }
}
