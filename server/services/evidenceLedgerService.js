/**
 * Evidence Ledger Service
 * 
 * Step 15: Explainability Ledger & Evidence Pack
 * 
 * Core service for managing AI evidence objects, explainability links,
 * and reasoning ledger entries. Ensures every AI artifact is explainable
 * and auditable.
 * 
 * CRITICAL: Reasoning entries are SERVER-GENERATED ONLY. No client input.
 */

// Dependency injection for testing
let deps = {
    db: null,
    uuidv4: null
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps.db) {
        const dbModule = await import('../database.js');
        deps.db = dbModule.default || dbModule;
    }

    if (!deps.uuidv4) {
        const uuidModule = await import('uuid');
        deps.uuidv4 = uuidModule.v4;
    }
}

/**
 * Manually set dependencies (primarily for testing)
 */
function setDependencies(newDeps) {
    deps = { ...deps, ...newDeps };
}

// Evidence types enum
const EVIDENCE_TYPES = {
    METRIC_SNAPSHOT: 'METRIC_SNAPSHOT',
    SIGNAL: 'SIGNAL',
    DOC_REF: 'DOC_REF',
    USER_EVENT: 'USER_EVENT',
    SYSTEM_EVENT: 'SYSTEM_EVENT'
};

// Entity types that can have evidence linked
const ENTITY_TYPES = {
    PROPOSAL: 'proposal',
    DECISION: 'decision',
    EXECUTION: 'execution',
    RUN_STEP: 'run_step',
    PLAYBOOK_RUN: 'playbook_run'
};

// Fields to redact from payloads (PII protection)
const PII_FIELDS = [
    'email', 'phone', 'ssn', 'password', 'token', 'secret',
    'creditCard', 'credit_card', 'cardNumber', 'card_number',
    'firstName', 'first_name', 'lastName', 'last_name',
    'address', 'birthDate', 'birth_date', 'dob'
];

/**
 * Redacts PII fields from a payload object
 * 
 * @param {Object} payload - The payload to redact
 * @param {Object} config - Optional config with additional fields to redact
 * @returns {Object} - Redacted payload
 */
const redactPayload = (payload, config = {}) => {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    const additionalFields = config.additionalFields || [];
    const fieldsToRedact = [...PII_FIELDS, ...additionalFields];

    const redact = (obj) => {
        if (Array.isArray(obj)) {
            return obj.map(item => redact(item));
        }

        if (obj !== null && typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase();
                const shouldRedact = fieldsToRedact.some(field =>
                    lowerKey.includes(field.toLowerCase())
                );

                if (shouldRedact) {
                    result[key] = '[REDACTED]';
                } else if (typeof value === 'object') {
                    result[key] = redact(value);
                } else {
                    result[key] = value;
                }
            }
            return result;
        }

        return obj;
    };

    return redact(payload);
};

/**
 * Creates an evidence object
 * 
 * @param {string} orgId - Organization ID
 * @param {string} type - Evidence type (METRIC_SNAPSHOT, SIGNAL, etc.)
 * @param {string} source - Source of evidence (metricsService, signalEngine, etc.)
 * @param {Object} payload - Evidence payload (will be redacted)
 * @returns {Promise<Object>} - Created evidence object
 */
const createEvidenceObject = async (orgId, type, source, payload) => {
    await initDeps();

    if (!orgId || !type || !source) {
        throw new Error('orgId, type, and source are required');
    }

    if (!Object.values(EVIDENCE_TYPES).includes(type)) {
        throw new Error(`Invalid evidence type: ${type}`);
    }

    const id = deps.uuidv4();
    const redactedPayload = redactPayload(payload);
    const payloadJson = JSON.stringify(redactedPayload);

    await deps.db.run(
        `INSERT INTO ai_evidence_objects (id, org_id, type, source, payload_json)
         VALUES (?, ?, ?, ?, ?)`,
        [id, orgId, type, source, payloadJson]
    );

    return {
        id,
        org_id: orgId,
        type,
        source,
        payload_json: payloadJson,
        created_at: new Date().toISOString()
    };
};

/**
 * Links an evidence object to an entity
 * 
 * @param {string} fromType - Entity type (proposal, decision, execution, run_step)
 * @param {string} fromId - Entity ID
 * @param {string} evidenceId - Evidence object ID
 * @param {number} weight - Importance weight (0-1)
 * @param {string} note - Optional note
 * @returns {Promise<Object>} - Created link
 */
const linkEvidence = async (fromType, fromId, evidenceId, weight = 1.0, note = null) => {
    await initDeps();

    if (!fromType || !fromId || !evidenceId) {
        throw new Error('fromType, fromId, and evidenceId are required');
    }

    if (!Object.values(ENTITY_TYPES).includes(fromType)) {
        throw new Error(`Invalid entity type: ${fromType}`);
    }

    const normalizedWeight = Math.max(0, Math.min(1, weight));
    const id = deps.uuidv4();

    await deps.db.run(
        `INSERT INTO ai_explainability_links (id, from_type, from_id, evidence_id, weight, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, fromType, fromId, evidenceId, normalizedWeight, note]
    );

    return {
        id,
        from_type: fromType,
        from_id: fromId,
        evidence_id: evidenceId,
        weight: normalizedWeight,
        note,
        created_at: new Date().toISOString()
    };
};

/**
 * Records a reasoning entry in the ledger (SERVER-ONLY)
 * 
 * CRITICAL: This function is for internal server use only.
 * Never accept reasoning data from client requests.
 * 
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @param {string} summary - Reasoning summary
 * @param {Array} assumptions - List of assumptions made
 * @param {number} confidence - Confidence score (0-1)
 * @returns {Promise<Object>} - Created reasoning entry
 */
const recordReasoning = async (entityType, entityId, summary, assumptions = [], confidence = 0.5) => {
    await initDeps();

    if (!entityType || !entityId || !summary) {
        throw new Error('entityType, entityId, and summary are required');
    }

    const normalizedConfidence = Math.max(0, Math.min(1, confidence));
    const id = deps.uuidv4();
    const assumptionsJson = JSON.stringify(assumptions);

    await deps.db.run(
        `INSERT INTO ai_reasoning_ledger (id, entity_type, entity_id, reasoning_summary, assumptions_json, confidence)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, entityType, entityId, summary, assumptionsJson, normalizedConfidence]
    );

    return {
        id,
        entity_type: entityType,
        entity_id: entityId,
        reasoning_summary: summary,
        assumptions_json: assumptionsJson,
        confidence: normalizedConfidence,
        created_at: new Date().toISOString()
    };
};

/**
 * Gets the full explanation for an entity
 * 
 * @param {string} orgId - Organization ID (for scoping)
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @returns {Promise<Object>} - Full explanation with reasoning and evidences
 */
const getExplanation = async (orgId, entityType, entityId) => {
    await initDeps();

    if (!orgId || !entityType || !entityId) {
        throw new Error('orgId, entityType, and entityId are required');
    }

    // Get reasoning entries
    const reasoningRows = await deps.db.all(
        `SELECT * FROM ai_reasoning_ledger 
         WHERE entity_type = ? AND entity_id = ?
         ORDER BY created_at DESC`,
        [entityType, entityId]
    );

    // Get linked evidences (with org scoping)
    const evidenceRows = await deps.db.all(
        `SELECT l.*, e.type as evidence_type, e.source, e.payload_json, e.created_at as evidence_created_at
         FROM ai_explainability_links l
         JOIN ai_evidence_objects e ON l.evidence_id = e.id
         WHERE l.from_type = ? AND l.from_id = ? AND e.org_id = ?
         ORDER BY l.weight DESC, l.created_at DESC`,
        [entityType, entityId, orgId]
    );

    // Parse JSON fields
    const reasoning = (reasoningRows || []).map(r => ({
        ...r,
        assumptions: JSON.parse(r.assumptions_json || '[]')
    }));

    const evidences = (evidenceRows || []).map(e => ({
        link_id: e.id,
        evidence_id: e.evidence_id,
        type: e.evidence_type,
        source: e.source,
        weight: e.weight,
        note: e.note,
        payload: JSON.parse(e.payload_json || '{}'),
        created_at: e.evidence_created_at
    }));

    // Compute aggregate confidence from latest reasoning
    const latestReasoning = reasoning[0];
    const aggregateConfidence = latestReasoning?.confidence || 0;

    return {
        entity_type: entityType,
        entity_id: entityId,
        confidence: aggregateConfidence,
        reasoning: reasoning,
        evidences: evidences,
        evidence_count: evidences.length,
        has_explanation: reasoning.length > 0 || evidences.length > 0
    };
};

/**
 * Exports an explanation as a structured pack
 * 
 * @param {string} orgId - Organization ID
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @param {string} format - Export format ('json' or 'pdf')
 * @returns {Promise<Object>} - Exported pack
 */
const exportExplanation = async (orgId, entityType, entityId, format = 'json') => {
    const explanation = await getExplanation(orgId, entityType, entityId);

    const pack = {
        metadata: {
            export_version: '1.0',
            exported_at: new Date().toISOString(),
            format: format,
            entity_type: entityType,
            entity_id: entityId,
            organization_id: orgId
        },
        summary: {
            confidence: explanation.confidence,
            evidence_count: explanation.evidence_count,
            has_explanation: explanation.has_explanation
        },
        reasoning: explanation.reasoning.map(r => ({
            summary: r.reasoning_summary,
            assumptions: r.assumptions,
            confidence: r.confidence,
            recorded_at: r.created_at
        })),
        evidences: explanation.evidences.map(e => ({
            type: e.type,
            source: e.source,
            weight: e.weight,
            note: e.note,
            payload: e.payload,
            created_at: e.created_at
        }))
    };

    if (format === 'pdf') {
        // PDF-ready JSON includes rendering hints
        pack.render_options = {
            title: `AI Decision Pack: ${entityType} ${entityId}`,
            sections: ['summary', 'reasoning', 'evidences'],
            include_timestamps: true,
            include_confidence_chart: explanation.confidence > 0
        };
    }

    return pack;
};

/**
 * Creates evidence and links it to an entity in one operation
 * 
 * Convenience function for common use case.
 */
const createAndLinkEvidence = async (orgId, entityType, entityId, evidenceType, source, payload, weight = 1.0, note = null) => {
    const evidence = await createEvidenceObject(orgId, evidenceType, source, payload);
    const link = await linkEvidence(entityType, entityId, evidence.id, weight, note);

    return {
        evidence,
        link
    };
};

/**
 * Gets all evidence objects for an organization
 */
const getEvidencesByOrg = async (orgId, filters = {}) => {
    await initDeps();

    let sql = `SELECT * FROM ai_evidence_objects WHERE org_id = ?`;
    const params = [orgId];

    if (filters.type) {
        sql += ` AND type = ?`;
        params.push(filters.type);
    }

    if (filters.source) {
        sql += ` AND source = ?`;
        params.push(filters.source);
    }

    sql += ` ORDER BY created_at DESC`;

    if (filters.limit) {
        sql += ` LIMIT ?`;
        params.push(filters.limit);
    }

    const rows = await deps.db.all(sql, params);
    return (rows || []).map(r => ({
        ...r,
        payload: JSON.parse(r.payload_json || '{}')
    }));
};

/**
 * Validates that an entity has at least one evidence object
 */
const hasEvidence = async (entityType, entityId) => {
    await initDeps();

    const row = await deps.db.get(
        `SELECT COUNT(*) as count FROM ai_explainability_links
         WHERE from_type = ? AND from_id = ?`,
        [entityType, entityId]
    );
    return (row?.count || 0) > 0;
};

export default {
    // For testing
    setDependencies,

    // Enums
    EVIDENCE_TYPES,
    ENTITY_TYPES,

    // Core functions
    createEvidenceObject,
    linkEvidence,
    recordReasoning,
    getExplanation,
    exportExplanation,

    // Convenience functions
    createAndLinkEvidence,
    getEvidencesByOrg,
    hasEvidence,

    // Utility
    redactPayload
};
