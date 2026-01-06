/**
 * Threat Intelligence Service
 * Manages threat tracking, IP/domain reputation, and blocking.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';

class ThreatIntelligenceServiceClass {
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

    async getThreats(filters: any = {}): Promise<any[]> {
        const { limit = 10, offset = 0 } = filters;
        return await this.db.all('SELECT * FROM threat_intelligence ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
    }

    async getStats(): Promise<any> {
        return await this.db.get(`
            SELECT 
                COUNT(*) as total_threats,
                SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_severity_count,
                SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blocked_count
            FROM threat_intelligence
        `);
    }

    async getThreatById(id: string): Promise<any> {
        return await this.db.get('SELECT * FROM threat_intelligence WHERE id = ?', [id]);
    }

    async addThreat(data: any): Promise<any> {
        const id = this.uuidv4();
        const { type, indicator, severity, description } = data;

        await this.db.run(
            'INSERT INTO threat_intelligence (id, type, indicator, severity, description, is_blocked) VALUES (?, ?, ?, ?, ?, ?)',
            [id, type, indicator, severity, description, 0]
        );

        return await this.getThreatById(id);
    }

    async updateThreat(id: string, updates: any): Promise<boolean> {
        const fields: string[] = [];
        const params: any[] = [];

        if (updates.severity) {
            fields.push('severity = ?');
            params.push(updates.severity);
        }
        if (updates.description) {
            fields.push('description = ?');
            params.push(updates.description);
        }

        if (fields.length === 0) return true;

        params.push(id);
        const result = await this.db.run(`UPDATE threat_intelligence SET ${fields.join(', ')} WHERE id = ?`, params);
        return (result as any).changes > 0;
    }

    async blockThreat(id: string): Promise<boolean> {
        const result = await this.db.run('UPDATE threat_intelligence SET is_blocked = 1 WHERE id = ?', [id]);
        return (result as any).changes > 0;
    }

    async unblockThreat(id: string): Promise<boolean> {
        const result = await this.db.run('UPDATE threat_intelligence SET is_blocked = 0 WHERE id = ?', [id]);
        return (result as any).changes > 0;
    }

    async deleteThreat(id: string): Promise<boolean> {
        const result = await this.db.run('DELETE FROM threat_intelligence WHERE id = ?', [id]);
        return (result as any).changes > 0;
    }

    async checkIPReputation(ip: string): Promise<any> {
        const threat = await this.db.get('SELECT * FROM threat_intelligence WHERE type = "ip" AND indicator = ?', [ip]);
        return { ip, score: threat ? (threat.severity === 'high' ? 90 : 50) : 0, isBlocked: threat?.is_blocked === 1 };
    }

    async checkDomainReputation(domain: string): Promise<any> {
        const threat = await this.db.get('SELECT * FROM threat_intelligence WHERE type = "domain" AND indicator = ?', [domain]);
        return { domain, score: threat ? (threat.severity === 'high' ? 90 : 50) : 0, isBlocked: threat?.is_blocked === 1 };
    }

    async getBlockedIPs(): Promise<string[]> {
        const rows = await this.db.all('SELECT indicator FROM threat_intelligence WHERE type = "ip" AND is_blocked = 1');
        return rows.map((r: any) => r.indicator);
    }

    async getBlockedDomains(): Promise<string[]> {
        const rows = await this.db.all('SELECT indicator FROM threat_intelligence WHERE type = "domain" AND is_blocked = 1');
        return rows.map((r: any) => r.indicator);
    }

    async bulkImport(threats: any[]): Promise<any> {
        let imported = 0;
        for (const threat of threats) {
            await this.addThreat(threat);
            imported++;
        }
        return { imported };
    }
}

const threatIntelligenceService = new ThreatIntelligenceServiceClass();
export default threatIntelligenceService;

