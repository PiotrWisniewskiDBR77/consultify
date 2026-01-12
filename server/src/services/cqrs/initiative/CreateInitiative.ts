import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../../database/Database.js';
import { CommandHandler } from '../CommandBus.js';

export class CreateInitiativeCommand {
    constructor(
        public readonly title: string,
        public readonly projectId: string,
        public readonly userId: string,
        public readonly description?: string,
        public readonly startDate?: string,
        public readonly endDate?: string,
        public readonly budget?: number,
    ) {}
}

export class CreateInitiativeHandler implements CommandHandler<CreateInitiativeCommand> {
    async execute(command: CreateInitiativeCommand): Promise<{ id: string }> {
        const db = getDatabase();
        const id = uuidv4();
        const now = new Date().toISOString();

        await db.run(
            `INSERT INTO initiatives (
                id, project_id, title, description, start_date, end_date, budget, 
                owner_id, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
            [
                id,
                command.projectId,
                command.title,
                command.description || null,
                command.startDate || null,
                command.endDate || null,
                command.budget || 0,
                command.userId,
                now,
                now,
            ],
        );

        return { id };
    }
}
