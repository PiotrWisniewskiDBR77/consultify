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
        const { limit = 10, offset = 0 } = filters;
        return await this.db.all('SELECT * FROM security_incidents ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
    }

    async getStats(): Promise<any> {
        return await this.db.get(`
            SELECT 
                COUNT(*) as total_incidents,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
                SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count
            FROM security_incidents
        `);
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
        const result = await this.db.run(`UPDATE security_incidents SET ${fields.join(', ')} WHERE id = ?`, params);
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

