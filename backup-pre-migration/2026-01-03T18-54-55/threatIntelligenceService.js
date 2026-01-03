/**
 * Threat Intelligence Service
 * Manages threat intelligence data including IP reputation and domain blocking
 */

const { v4: uuidv4 } = require('uuid');

// Dependency injection for testing
const deps = {
    db: require('../database')
};

/**
 * Set dependencies for testing
 */
const setDependencies = (newDeps) => {
    Object.assign(deps, newDeps);
};

/**
 * Threat levels
 */
const THREAT_LEVELS = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

/**
 * Threat types
 */
const THREAT_TYPES = {
    MALICIOUS_IP: 'malicious_ip',
    SPAM_SOURCE: 'spam_source',
    BOTNET: 'botnet',
    PHISHING: 'phishing',
    MALWARE: 'malware',
    BRUTE_FORCE: 'brute_force',
    TOR_EXIT_NODE: 'tor_exit_node',
    VPN_PROXY: 'vpn_proxy',
    COMPROMISED_HOST: 'compromised_host',
    SUSPICIOUS_DOMAIN: 'suspicious_domain',
    OTHER: 'other'
};

/**
 * Add a new threat to the database
 */
const addThreat = async ({ threatType, source, ipAddress, domain, reputationScore = 0, threatLevel, description }) => {
    const id = uuidv4();
    
    const sql = `
        INSERT INTO threat_intelligence (
            id, threat_type, source, ip_address, domain, reputation_score,
            threat_level, description, first_seen, last_seen, is_blocked, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0, datetime('now'))
    `;
    
    await deps.db.run(sql, [
        id,
        threatType,
        source,
        ipAddress,
        domain,
        reputationScore,
        threatLevel || THREAT_LEVELS.MEDIUM,
        description
    ]);
    
    return {
        id,
        threatType,
        source,
        ipAddress,
        domain,
        reputationScore,
        threatLevel: threatLevel || THREAT_LEVELS.MEDIUM,
        description,
        isBlocked: false,
        createdAt: new Date().toISOString()
    };
};

/**
 * Get threat by ID
 */
const getThreatById = async (id) => {
    const sql = `SELECT * FROM threat_intelligence WHERE id = ?`;
    const threat = await deps.db.get(sql, [id]);
    
    if (!threat) return null;
    
    return {
        id: threat.id,
        threatType: threat.threat_type,
        source: threat.source,
        ipAddress: threat.ip_address,
        domain: threat.domain,
        reputationScore: threat.reputation_score,
        threatLevel: threat.threat_level,
        description: threat.description,
        firstSeen: threat.first_seen,
        lastSeen: threat.last_seen,
        isBlocked: threat.is_blocked === 1,
        createdAt: threat.created_at
    };
};

/**
 * Get all threats with filters
 */
const getThreats = async ({ threatType, threatLevel, isBlocked, ipAddress, domain, limit = 100, offset = 0 } = {}) => {
    let sql = `SELECT * FROM threat_intelligence WHERE 1=1`;
    const params = [];
    
    if (threatType) {
        sql += ` AND threat_type = ?`;
        params.push(threatType);
    }
    if (threatLevel) {
        sql += ` AND threat_level = ?`;
        params.push(threatLevel);
    }
    if (isBlocked !== undefined) {
        sql += ` AND is_blocked = ?`;
        params.push(isBlocked ? 1 : 0);
    }
    if (ipAddress) {
        sql += ` AND ip_address LIKE ?`;
        params.push(`%${ipAddress}%`);
    }
    if (domain) {
        sql += ` AND domain LIKE ?`;
        params.push(`%${domain}%`);
    }
    
    sql += ` ORDER BY last_seen DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const threats = await deps.db.all(sql, params);
    
    return threats.map(threat => ({
        id: threat.id,
        threatType: threat.threat_type,
        source: threat.source,
        ipAddress: threat.ip_address,
        domain: threat.domain,
        reputationScore: threat.reputation_score,
        threatLevel: threat.threat_level,
        description: threat.description,
        firstSeen: threat.first_seen,
        lastSeen: threat.last_seen,
        isBlocked: threat.is_blocked === 1,
        createdAt: threat.created_at
    }));
};

/**
 * Check IP address reputation
 */
const checkIPReputation = async (ipAddress) => {
    const sql = `
        SELECT * FROM threat_intelligence 
        WHERE ip_address = ? 
        ORDER BY reputation_score DESC, last_seen DESC
        LIMIT 1
    `;
    const threat = await deps.db.get(sql, [ipAddress]);
    
    if (!threat) {
        return {
            found: false,
            ipAddress,
            reputationScore: 100, // Clean by default
            threatLevel: 'CLEAN',
            isBlocked: false
        };
    }
    
    return {
        found: true,
        ipAddress,
        threatType: threat.threat_type,
        reputationScore: threat.reputation_score,
        threatLevel: threat.threat_level,
        isBlocked: threat.is_blocked === 1,
        description: threat.description,
        firstSeen: threat.first_seen,
        lastSeen: threat.last_seen
    };
};

/**
 * Check domain reputation
 */
const checkDomainReputation = async (domain) => {
    const sql = `
        SELECT * FROM threat_intelligence 
        WHERE domain = ? 
        ORDER BY reputation_score DESC, last_seen DESC
        LIMIT 1
    `;
    const threat = await deps.db.get(sql, [domain]);
    
    if (!threat) {
        return {
            found: false,
            domain,
            reputationScore: 100,
            threatLevel: 'CLEAN',
            isBlocked: false
        };
    }
    
    return {
        found: true,
        domain,
        threatType: threat.threat_type,
        reputationScore: threat.reputation_score,
        threatLevel: threat.threat_level,
        isBlocked: threat.is_blocked === 1,
        description: threat.description,
        firstSeen: threat.first_seen,
        lastSeen: threat.last_seen
    };
};

/**
 * Block a threat (IP or domain)
 */
const blockThreat = async (id) => {
    const sql = `UPDATE threat_intelligence SET is_blocked = 1, last_seen = datetime('now') WHERE id = ?`;
    const result = await deps.db.run(sql, [id]);
    return result.changes > 0;
};

/**
 * Unblock a threat
 */
const unblockThreat = async (id) => {
    const sql = `UPDATE threat_intelligence SET is_blocked = 0, last_seen = datetime('now') WHERE id = ?`;
    const result = await deps.db.run(sql, [id]);
    return result.changes > 0;
};

/**
 * Update threat details
 */
const updateThreat = async (id, updates) => {
    const allowedFields = ['threat_type', 'source', 'reputation_score', 'threat_level', 'description'];
    const setClauses = [];
    const params = [];
    
    const fieldMapping = {
        threatType: 'threat_type',
        source: 'source',
        reputationScore: 'reputation_score',
        threatLevel: 'threat_level',
        description: 'description'
    };
    
    for (const [key, value] of Object.entries(updates)) {
        const dbField = fieldMapping[key];
        if (dbField && allowedFields.includes(dbField) && value !== undefined) {
            setClauses.push(`${dbField} = ?`);
            params.push(value);
        }
    }
    
    if (setClauses.length === 0) return false;
    
    setClauses.push(`last_seen = datetime('now')`);
    params.push(id);
    
    const sql = `UPDATE threat_intelligence SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = await deps.db.run(sql, params);
    return result.changes > 0;
};

/**
 * Delete a threat
 */
const deleteThreat = async (id) => {
    const sql = `DELETE FROM threat_intelligence WHERE id = ?`;
    const result = await deps.db.run(sql, [id]);
    return result.changes > 0;
};

/**
 * Get threat statistics
 */
const getStats = async () => {
    const sql = `
        SELECT 
            COUNT(*) as total_threats,
            SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blocked_count,
            SUM(CASE WHEN threat_level = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
            SUM(CASE WHEN threat_level = 'HIGH' THEN 1 ELSE 0 END) as high_count,
            SUM(CASE WHEN threat_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_count,
            SUM(CASE WHEN threat_level = 'LOW' THEN 1 ELSE 0 END) as low_count,
            SUM(CASE WHEN ip_address IS NOT NULL AND ip_address != '' THEN 1 ELSE 0 END) as ip_count,
            SUM(CASE WHEN domain IS NOT NULL AND domain != '' THEN 1 ELSE 0 END) as domain_count,
            AVG(reputation_score) as avg_reputation
        FROM threat_intelligence
    `;
    
    const stats = await deps.db.get(sql);
    
    return {
        totalThreats: stats?.total_threats || 0,
        blockedCount: stats?.blocked_count || 0,
        byThreatLevel: {
            critical: stats?.critical_count || 0,
            high: stats?.high_count || 0,
            medium: stats?.medium_count || 0,
            low: stats?.low_count || 0
        },
        ipCount: stats?.ip_count || 0,
        domainCount: stats?.domain_count || 0,
        avgReputation: Math.round(stats?.avg_reputation || 0)
    };
};

/**
 * Bulk import threats
 */
const bulkImport = async (threats) => {
    let imported = 0;
    let failed = 0;
    
    for (const threat of threats) {
        try {
            await addThreat(threat);
            imported++;
        } catch (error) {
            console.error(`Failed to import threat: ${JSON.stringify(threat)}`, error);
            failed++;
        }
    }
    
    return { imported, failed, total: threats.length };
};

/**
 * Get threats by time range
 */
const getThreatsByTimeRange = async (startDate, endDate) => {
    const sql = `
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as count,
            threat_level
        FROM threat_intelligence
        WHERE created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at), threat_level
        ORDER BY date ASC
    `;
    
    return deps.db.all(sql, [startDate, endDate]);
};

/**
 * Get blocked IPs list
 */
const getBlockedIPs = async () => {
    const sql = `
        SELECT ip_address, threat_level, reputation_score, description
        FROM threat_intelligence 
        WHERE is_blocked = 1 AND ip_address IS NOT NULL AND ip_address != ''
        ORDER BY reputation_score DESC
    `;
    
    const results = await deps.db.all(sql);
    return results.map(r => ({
        ipAddress: r.ip_address,
        threatLevel: r.threat_level,
        reputationScore: r.reputation_score,
        description: r.description
    }));
};

/**
 * Get blocked domains list
 */
const getBlockedDomains = async () => {
    const sql = `
        SELECT domain, threat_level, reputation_score, description
        FROM threat_intelligence 
        WHERE is_blocked = 1 AND domain IS NOT NULL AND domain != ''
        ORDER BY reputation_score DESC
    `;
    
    const results = await deps.db.all(sql);
    return results.map(r => ({
        domain: r.domain,
        threatLevel: r.threat_level,
        reputationScore: r.reputation_score,
        description: r.description
    }));
};

module.exports = {
    setDependencies,
    addThreat,
    getThreatById,
    getThreats,
    checkIPReputation,
    checkDomainReputation,
    blockThreat,
    unblockThreat,
    updateThreat,
    deleteThreat,
    getStats,
    bulkImport,
    getThreatsByTimeRange,
    getBlockedIPs,
    getBlockedDomains,
    THREAT_LEVELS,
    THREAT_TYPES
};





