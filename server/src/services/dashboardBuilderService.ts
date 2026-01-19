// @ts-nocheck
/**
 * Dashboard Builder Service
 * Manages custom dashboards, widgets, and sharing.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';

interface Dashboard {
  id: string;
  userId: string;
  name: string;
  layoutType: string;
  widgets: any[];
  isShared: boolean;
  createdAt?: string;
  updatedAt?: string;
}

class DashboardBuilderServiceClass {
  private db: IDatabase;
  private uuidv4: typeof uuidv4;
  private logger: any;

  constructor(deps?: { db?: IDatabase; uuidv4?: typeof uuidv4; logger?: any }) {
    this.db = deps?.db || getDatabase();
    this.uuidv4 = deps?.uuidv4 || uuidv4;
    this.logger = deps?.logger || _logger;
  }

  setDependencies(deps: { db?: IDatabase; uuidv4?: typeof uuidv4; logger?: any }) {
    if (deps.db) this.db = deps.db;
    if (deps.uuidv4) this.uuidv4 = deps.uuidv4;
    if (deps.logger) this.logger = deps.logger;
  }

  async getDashboards(userId: string): Promise<any[]> {
    return await this.db.all('SELECT * FROM custom_dashboards WHERE user_id = ?', [userId]);
  }

  async getDashboardById(id: string): Promise<any> {
    const dashboard = await this.db.get('SELECT * FROM custom_dashboards WHERE id = ?', [id]);
    if (dashboard && typeof dashboard.widgets === 'string') {
      try {
        dashboard.widgets = JSON.parse(dashboard.widgets);
      } catch (e) {
        dashboard.widgets = [];
      }
    }
    return dashboard;
  }

  async createDashboard(data: any): Promise<any> {
    if (!data.name) throw new Error('Dashboard name is required');

    const id = this.uuidv4();
    const userId = data.userId;
    const name = data.name;
    const layoutType = data.layoutType || 'grid';
    const widgets = JSON.stringify(data.widgets || []);

    await this.db.run(
      'INSERT INTO custom_dashboards (id, user_id, name, layout_type, widgets, is_shared) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, name, layoutType, widgets, 0]
    );

    return await this.getDashboardById(id);
  }

  async updateDashboard(id: string, updates: any): Promise<any> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.name) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.layoutType) {
      fields.push('layout_type = ?');
      params.push(updates.layoutType);
    }
    if (updates.widgets) {
      fields.push('widgets = ?');
      params.push(JSON.stringify(updates.widgets));
    }

    if (fields.length === 0) return await this.getDashboardById(id);

    params.push(id);
    await this.db.run(`UPDATE custom_dashboards SET ${fields.join(', ')} WHERE id = ?`, params);

    return await this.getDashboardById(id);
  }

  async deleteDashboard(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM custom_dashboards WHERE id = ?', [id]);
    return (result as any).changes > 0;
  }

  async toggleShare(id: string, isShared: boolean): Promise<void> {
    await this.db.run('UPDATE custom_dashboards SET is_shared = ? WHERE id = ?', [
      isShared ? 1 : 0,
      id,
    ]);
  }

  async getWidgetData(dashboardId: string): Promise<any[]> {
    // Minimal implementation
    return await this.db.all('SELECT * FROM dashboard_widget_data WHERE dashboard_id = ?', [
      dashboardId,
    ]);
  }

  async getStats(): Promise<any> {
    return { totalDashboards: 0 };
  }
}

const dashboardBuilderService = new DashboardBuilderServiceClass();
export default dashboardBuilderService;
