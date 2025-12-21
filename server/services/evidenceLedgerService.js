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

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Dependency injection container (for deterministic unit tests)
const deps = {
    db,
    uuidv4
};

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
const createEvidenceObject = (orgId, type, source, payload) => {
    return new Promise((resolve, reject) => {
        if (!orgId || !type || !source) {
            return reject(new Error('orgId, type, and source are required'));
        }

        if (!Object.values(EVIDENCE_TYPES).includes(type)) {
            return reject(new Error(`Invalid evidence type: ${type}`));
        }

        const id = deps.uuidv4();
        const redactedPayload = redactPayload(payload);
        const payloadJson = JSON.stringify(redactedPayload);

        deps.db.run(
            `INSERT INTO ai_evidence_objects (id, org_id, type, source, payload_json)
             VALUES (?, ?, ?, ?, ?)`,
            [id, orgId, type, source, payloadJson],
            function (err) {
                if (err) {
                    console.error('[EvidenceLedger] createEvidenceObject error:', err);
                    return reject(err);
                }
                resolve({
                    id,
                    org_id: orgId,
                    type,
                    source,
                    payload_json: payloadJson,
                    created_at: new Date().toISOString()
                });
            }
        );
    });
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
const linkEvidence = (fromType, fromId, evidenceId, weight = 1.0, note = null) => {
    return new Promise((resolve, reject) => {
        if (!fromType || !fromId || !evidenceId) {
            return reject(new Error('fromType, fromId, and evidenceId are required'));
        }

        if (!Object.values(ENTITY_TYPES).includes(fromType)) {
            return reject(new Error(`Invalid entity type: ${fromType}`));
        }

        const normalizedWeight = Math.max(0, Math.min(1, weight));
        const id = deps.uuidv4();

        deps.db.run(
            `INSERT INTO ai_explainability_links (id, from_type, from_id, evidence_id, weight, note)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, fromType, fromId, evidenceId, normalizedWeight, note],
            function (err) {
                if (err) {
                    console.error('[EvidenceLedger] linkEvidence error:', err);
                    return reject(err);
                }
                resolve({
                    id,
                    from_type: fromType,
                    from_id: fromId,
                    evidence_id: evidenceId,
                    weight: normalizedWeight,
                    note,
                    created_at: new Date().toISOString()
                });
            }
        );
    });
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
const recordReasoning = (entityType, entityId, summary, assumptions = [], confidence = 0.5) => {
    return new Promise((resolve, reject) => {
        if (!entityType || !entityId || !summary) {
            return reject(new Error('entityType, entityId, and summary are required'));
        }

        const normalizedConfidence = Math.max(0, Math.min(1, confidence));
        const id = deps.uuidv4();
        const assumptionsJson = JSON.stringify(assumptions);

        deps.db.run(
            `INSERT INTO ai_reasoning_ledger (id, entity_type, entity_id, reasoning_summary, assumptions_json, confidence)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, entityType, entityId, summary, assumptionsJson, normalizedConfidence],
            function (err) {
                if (err) {
                    console.error('[EvidenceLedger] recordReasoning error:', err);
                    return reject(err);
                }
                resolve({
                    id,
                    entity_type: entityType,
                    entity_id: entityId,
                    reasoning_summary: summary,
                    assumptions_json: assumptionsJson,
                    confidence: normalizedConfidence,
                    created_at: new Date().toISOString()
                });
            }
        );
    });
};

/**
 * Gets the full explanation for an entity
 * 
 * @param {string} orgId - Organization ID (for scoping)
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @returns {Promise<Object>} - Full explanation with reasoning and evidences
 */
const getExplanation = (orgId, entityType, entityId) => {
    return new Promise((resolve, reject) => {
        if (!orgId || !entityType || !entityId) {
            return reject(new Error('orgId, entityType, and entityId are required'));
        }

        // Get reasoning entries
        db.all(
            `SELECT * FROM ai_reasoning_ledger 
             WHERE entity_type = ? AND entity_id = ?
             ORDER BY created_at DESC`,
            [entityType, entityId],
            (err, reasoningRows) => {
                if (err) {
                    console.error('[EvidenceLedger] getExplanation reasoning error:', err);
                    return reject(err);
                }

                // Get linked evidences (with org scoping)
                db.all(
                    `SELECT l.*, e.type as evidence_type, e.source, e.payload_json, e.created_at as evidence_created_at
                     FROM ai_explainability_links l
                     JOIN ai_evidence_objects e ON l.evidence_id = e.id
                     WHERE l.from_type = ? AND l.from_id = ? AND e.org_id = ?
                     ORDER BY l.weight DESC, l.created_at DESC`,
                    [entityType, entityId, orgId],
                    (err, evidenceRows) => {
                        if (err) {
                            console.error('[EvidenceLedger] getExplanation evidence error:', err);
                            return reject(err);
                        }

                        // Parse JSON fields
                        const reasoning = reasoningRows.map(r => ({
                            ...r,
                            assumptions: JSON.parse(r.assumptions_json || '[]')
                        }));

                        const evidences = evidenceRows.map(e => ({
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

                        resolve({
                            entity_type: entityType,
                            entity_id: entityId,
                            confidence: aggregateConfidence,
                            reasoning: reasoning,
                            evidences: evidences,
                            evidence_count: evidences.length,
                            has_explanation: reasoning.length > 0 || evidences.length > 0
                        });
                    }
                );
            }
        );
    });
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
 * 
 * @param {string} orgId - Organization ID
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @param {string} evidenceType - Evidence type
 * @param {string} source - Source
 * @param {Object} payload - Payload
 * @param {number} weight - Weight
 * @param {string} note - Note
 * @returns {Promise<Object>} - Created evidence with link
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
 * 
 * @param {string} orgId - Organization ID
 * @param {Object} filters - Optional filters (type, source, limit)
 * @returns {Promise<Array>} - Evidence objects
 */
const getEvidencesByOrg = (orgId, filters = {}) => {
    return new Promise((resolve, reject) => {
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

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('[EvidenceLedger] getEvidencesByOrg error:', err);
                return reject(err);
            }
            resolve(rows.map(r => ({
                ...r,
                payload: JSON.parse(r.payload_json || '{}')
            })));
        });
    });
};

/**
 * Validates that an entity has at least one evidence object
 * 
 * Required by Step 15.5: "Każda propozycja musi mieć min. 1 evidence object"
 * 
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @returns {Promise<boolean>} - True if entity has evidence
 */
const hasEvidence = (entityType, entityId) => {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT COUNT(*) as count FROM ai_explainability_links
             WHERE from_type = ? AND from_id = ?`,
            [entityType, entityId],
            (err, row) => {
                if (err) {
                    console.error('[EvidenceLedger] hasEvidence error:', err);
                    return reject(err);
                }
                resolve(row.count > 0);
            }
        );
    });
};

module.exports = {
    // For testing
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
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
