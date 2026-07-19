// @ts-nocheck
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

  private mapRowToThreat(row: any): any {
    if (!row) return row;
    return {
      id: row.id,
      threatType: row.threat_type,
      source: row.source || 'Manual',
      ipAddress:
        row.threat_type === 'ip' || row.threat_type === 'malicious_ip' ? row.indicator : null,
      domain:
        row.threat_type === 'domain' || row.threat_type === 'suspicious_domain'
          ? row.indicator
          : null,
      reputationScore: row.reputation_score ?? 50,
      threatLevel: row.threat_level,
      description: row.description,
      firstSeen: row.first_seen || row.created_at,
      lastSeen: row.last_seen || row.created_at,
      isBlocked: row.is_blocked === 1 || row.is_blocked === true,
      createdAt: row.created_at,
    };
  }

  async getThreats(filters: any = {}): Promise<any[]> {
    const {
      limit = 100,
      offset = 0,
      threatType,
      threatLevel,
      isBlocked,
      ipAddress,
      domain,
    } = filters;
    let sql = 'SELECT * FROM threat_intelligence WHERE 1=1';
    const params: any[] = [];

    if (threatType) {
      sql += ' AND threat_type = ?';
      params.push(threatType);
    }
    if (threatLevel) {
      sql += ' AND threat_level = ?';
      params.push(threatLevel);
    }
    if (isBlocked !== undefined) {
      sql += ' AND is_blocked = ?';
      params.push(isBlocked ? 1 : 0);
    }
    if (ipAddress) {
      sql += ' AND indicator LIKE ?';
      params.push(`%${ipAddress}%`);
    }
    if (domain) {
      sql += ' AND indicator LIKE ?';
      params.push(`%${domain}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await this.db.all(sql, params);
    return rows.map((r: any) => this.mapRowToThreat(r));
  }

  async getStats(): Promise<any> {
    const row = await this.db.get(`
      SELECT
        COUNT(*) as "totalThreats",
        SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as "blockedCount",
        SUM(CASE WHEN threat_level = 'CRITICAL' OR threat_level = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN threat_level = 'HIGH' OR threat_level = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN threat_level = 'MEDIUM' OR threat_level = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN threat_level = 'LOW' OR threat_level = 'low' THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN threat_type = 'ip' OR threat_type = 'malicious_ip' OR indicator LIKE '%.%.%.%' THEN 1 ELSE 0 END) as "ipCount",
        SUM(CASE WHEN (threat_type = 'domain' OR threat_type = 'suspicious_domain') AND indicator NOT LIKE '%.%.%.%' THEN 1 ELSE 0 END) as "domainCount",
        AVG(reputation_score) as "avgReputation"
      FROM threat_intelligence
    `);
    return {
      totalThreats: row?.totalThreats || 0,
      blockedCount: row?.blockedCount || 0,
      byThreatLevel: {
        critical: row?.critical || 0,
        high: row?.high || 0,
        medium: row?.medium || 0,
        low: row?.low || 0,
      },
      ipCount: row?.ipCount || 0,
      domainCount: row?.domainCount || 0,
      avgReputation: row?.avgReputation || 0,
    };
  }

  async getThreatById(id: string): Promise<any> {
    const row = await this.db.get('SELECT * FROM threat_intelligence WHERE id = ?', [id]);
    return this.mapRowToThreat(row);
  }

  async addThreat(data: any): Promise<any> {
    const id = this.uuidv4();
    const indicator = data.indicator || data.ipAddress || data.domain || '';
    const threatType = data.ipAddress
      ? 'ip'
      : data.domain
        ? 'domain'
        : data.threatType || data.type || 'ip';
    const threatLevel = data.threatLevel || data.severity || 'MEDIUM';
    const description = data.description || '';
    const source = data.source || 'Manual';
    const reputationScore = data.reputationScore ?? 50;

    await this.db.run(
      'INSERT INTO threat_intelligence (id, threat_type, indicator, threat_level, description, is_blocked, source, reputation_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, threatType, indicator, threatLevel, description, 0, source, reputationScore]
    );

    return this.mapRowToThreat(
      await this.db.get('SELECT * FROM threat_intelligence WHERE id = ?', [id])
    );
  }

  async updateThreat(id: string, updates: any): Promise<boolean> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.severity || updates.threatLevel) {
      fields.push('threat_level = ?');
      params.push(updates.threatLevel || updates.severity);
    }
    if (updates.description) {
      fields.push('description = ?');
      params.push(updates.description);
    }

    if (fields.length === 0) return true;

    params.push(id);
    const result = await this.db.run(
      `UPDATE threat_intelligence SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    return (result as any).changes > 0;
  }

  async blockThreat(id: string): Promise<boolean> {
    const result = await this.db.run(
      'UPDATE threat_intelligence SET is_blocked = 1, blocked_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    return (result as any).changes > 0;
  }

  async unblockThreat(id: string): Promise<boolean> {
    const result = await this.db.run(
      'UPDATE threat_intelligence SET is_blocked = 0, blocked_at = NULL WHERE id = ?',
      [id]
    );
    return (result as any).changes > 0;
  }

  async deleteThreat(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM threat_intelligence WHERE id = ?', [id]);
    return (result as any).changes > 0;
  }

  async checkIPReputation(ip: string): Promise<any> {
    const threat = await this.db.get(
      "SELECT * FROM threat_intelligence WHERE (threat_type = 'ip' OR threat_type = 'malicious_ip') AND indicator = ?",
      [ip]
    );
    return {
      ip,
      found: !!threat,
      reputationScore: threat ? (threat.reputation_score ?? 10) : 100,
      threatLevel: threat ? threat.threat_level : 'CLEAN',
      isBlocked: threat?.is_blocked === 1,
      description: threat?.description || null,
    };
  }

  async checkDomainReputation(domain: string): Promise<any> {
    const threat = await this.db.get(
      "SELECT * FROM threat_intelligence WHERE (threat_type = 'domain' OR threat_type = 'suspicious_domain') AND indicator = ?",
      [domain]
    );
    return {
      domain,
      found: !!threat,
      reputationScore: threat ? (threat.reputation_score ?? 10) : 100,
      threatLevel: threat ? threat.threat_level : 'CLEAN',
      isBlocked: threat?.is_blocked === 1,
      description: threat?.description || null,
    };
  }

  async getBlockedIPs(): Promise<string[]> {
    const rows = await this.db.all(
      "SELECT indicator FROM threat_intelligence WHERE (threat_type = 'ip' OR threat_type = 'malicious_ip') AND is_blocked = 1"
    );
    return rows.map((r: any) => r.indicator);
  }

  async getBlockedDomains(): Promise<string[]> {
    const rows = await this.db.all(
      "SELECT indicator FROM threat_intelligence WHERE (threat_type = 'domain' OR threat_type = 'suspicious_domain') AND is_blocked = 1"
    );
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
