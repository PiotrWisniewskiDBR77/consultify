import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import * as DbPromise from '../../utils/DbPromise.js';
import { CountRow } from './AccessTypes.js';

export class AccessResourceService {
  private db: IDatabase;

  constructor(dbOrNull?: IDatabase) {
    this.db = dbOrNull || getDatabase();
  }

  setDependencies(deps: { db?: IDatabase }) {
    if (deps.db) {
      this.db = deps.db;
    }
  }

  async countOrgProjects(organizationId: string): Promise<number> {
    const row = await DbPromise.get<CountRow>(
      this.db,
      `SELECT COUNT(*) as count FROM projects WHERE organization_id = ?`,
      [organizationId],
      { fallback: false }
    );
    return row?.count || 0;
  }

  async countOrgInitiatives(organizationId: string): Promise<number> {
    const row = await DbPromise.get<CountRow>(
      this.db,
      `SELECT count(*) as count FROM initiatives WHERE organization_id = ?`,
      [organizationId],
      { fallback: false }
    );
    return row?.count || 0;
  }

  async countOrgUsers(organizationId: string): Promise<number> {
    const row = await DbPromise.get<CountRow>(
      this.db,
      `SELECT COUNT(*) as count FROM users WHERE organization_id = ?`,
      [organizationId],
      { fallback: false }
    );
    return row?.count || 0;
  }
}
