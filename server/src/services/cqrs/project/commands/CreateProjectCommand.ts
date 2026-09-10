import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../../../database/Database.js';
import type { IDatabase } from '../../../../database/IDatabase.js';
import { ensureProjectOwnerMembership } from '../../../projectOwnerMembershipService.js';

export class CreateProjectCommand {
  constructor(
    public readonly name: string,
    public readonly organizationId: string,
    public readonly ownerId: string,
    public readonly summary?: string | null
  ) {}
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

    // Ta sama ksiegowosc czlonkostwa co w `ProjectController.createProject`:
    // bez niej projekt zalozony z Discovery ma zero czlonkow i blokuje
    // tworzenie inicjatywy (pomiar 10.09, `projectOwnerMembershipService.ts`).
    await ensureProjectOwnerMembership(id, command.ownerId);

    return {
      id,
      name: command.name,
      organizationId: command.organizationId,
      ownerId: command.ownerId,
      summary: command.summary || '',
      createdAt: now,
    };
  }
}
