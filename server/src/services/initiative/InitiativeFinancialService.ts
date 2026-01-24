import { getDatabase } from '../../database/Database.js';
import { IDatabase } from '../../database/IDatabase.js';

export class InitiativeFinancialService {
  private deps: {
    db: IDatabase;
  };

  constructor(deps?: { db: IDatabase }) {
    this.deps = deps || {
      db: getDatabase(),
    };
  }

  setDependencies(deps: { db: IDatabase }) {
    this.deps = deps;
  }

  async updateFinancials(
    initiativeId: string,
    capex: number,
    opex: number,
    expectedRoi: number
  ): Promise<boolean> {
    const query = `
            UPDATE initiatives 
            SET cost_capex = ?, cost_opex = ?, expected_roi = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`;

    const result = (await this.deps.db.run(query, [capex, opex, expectedRoi, initiativeId])) as any;
    return result.changes > 0;
  }

  async getFinancialStats(
    organizationId: string
  ): Promise<{ totalCapex: number; totalOpex: number; avgRoi: number }> {
    const row = await this.deps.db.get<any>(
      `SELECT 
                SUM(cost_capex) as total_capex, 
                SUM(cost_opex) as total_opex,
                AVG(expected_roi) as avg_roi
             FROM initiatives 
             WHERE organization_id = ?`,
      [organizationId]
    );

    return {
      totalCapex: row?.total_capex || 0,
      totalOpex: row?.total_opex || 0,
      avgRoi: row?.avg_roi || 0,
    };
  }
}
