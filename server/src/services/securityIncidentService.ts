/**
 * Security Incident Service
 * Manages security incidents, reporting, and resolution tracking.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';

class SecurityIncidentServiceClass {
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

  async getIncidents(filters: any = {}): Promise<any[]> {
    const { status, severity, incidentType, limit = 10, offset = 0 } = filters;

    let query = `
            SELECT 
                si.*,
                u.id as user_id,
                u.email as user_email,
                u.first_name as user_first_name,
                u.last_name as user_last_name
            FROM security_incidents si
            LEFT JOIN users u ON si.resolved_by = u.id
            WHERE 1=1
        `;
    const params: any[] = [];

    if (status) {
      query += ' AND si.status = ?';
      params.push(status);
    }
    if (severity) {
      query += ' AND si.severity = ?';
      params.push(severity);
    }
    if (incidentType) {
      query += ' AND si.type = ?';
      params.push(incidentType);
    }

    query += ' ORDER BY si.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await this.db.all(query, params);

    return rows.map((row) => ({
      id: row.id,
      incidentType: row.type,
      severity: row.severity,
      status: row.status,
      description: row.description,
      affectedResources: row.metadata_json
        ? JSON.parse(row.metadata_json).affectedResources || []
        : [],
      detectedAt: row.created_at,
      resolvedAt: row.resolved_at,
      resolutionNotes: row.resolution_notes,
      createdAt: row.created_at,
      resolvedBy: row.user_id
        ? {
            id: row.user_id,
            email: row.user_email,
            firstName: row.user_first_name,
            lastName: row.user_last_name,
          }
        : null,
    }));
  }

  async getStats(): Promise<any> {
    const row = await this.db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
                SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_count,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count,
                SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
                SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_count,
                SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_count,
                SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_count
            FROM security_incidents
        `);

    return {
      totalIncidents: row?.total || 0,
      byStatus: {
        open: row?.open_count || 0,
        inProgress: row?.in_progress_count || 0,
        resolved: row?.resolved_count || 0,
        closed: row?.closed_count || 0,
      },
      bySeverity: {
        critical: row?.critical_count || 0,
        high: row?.high_count || 0,
        medium: row?.medium_count || 0,
        low: row?.low_count || 0,
      },
    };
  }

  async getIncidentById(id: string): Promise<any> {
    return await this.db.get('SELECT * FROM security_incidents WHERE id = ?', [id]);
  }

  async createIncident(data: any): Promise<any> {
    const id = this.uuidv4();
    const { title, description, severity, type, metadata = {} } = data;

    await this.db.run(
      'INSERT INTO security_incidents (id, title, description, severity, type, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, title, description, severity, type, 'open', JSON.stringify(metadata)]
    );

    return await this.getIncidentById(id);
  }

  async updateIncident(id: string, updates: any): Promise<boolean> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.severity) {
      fields.push('severity = ?');
      params.push(updates.severity);
    }
    if (updates.status) {
      fields.push('status = ?');
      params.push(updates.status);
    }

    if (fields.length === 0) return true;

    params.push(id);
    const result = await this.db.run(
      `UPDATE security_incidents SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    return (result as any).changes > 0;
  }

  async resolveIncident(id: string, resolvedBy: string, notes: string): Promise<boolean> {
    const result = await this.db.run(
      'UPDATE security_incidents SET status = ?, resolved_by = ?, resolution_notes = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['resolved', resolvedBy, notes, id]
    );
    return (result as any).changes > 0;
  }

  async deleteIncident(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM security_incidents WHERE id = ?', [id]);
    return (result as any).changes > 0;
  }
}

const securityIncidentService = new SecurityIncidentServiceClass();
export default securityIncidentService;
