import { getDatabase } from '../../../../database/Database.js';
import type { IDatabase } from '../../../../database/IDatabase.js';

export class GetProjectQuery {
  constructor(public readonly projectId: string) {}
}

export class GetProjectHandler {
  constructor(private readonly db: IDatabase = getDatabase()) {}

  async execute(query: GetProjectQuery) {
    const project = await this.db.get('SELECT * FROM projects WHERE id = ?', [query.projectId]);
    return project;
  }
}
