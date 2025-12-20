/**
 * Legal Service
 * Manages legal documents, versions, and user/organization acceptances.
 * Provides audit-friendly acceptance tracking for compliance.
 * 
 * Enterprise+ Extensions:
 * - Lifecycle control (effective_from, expires_at, reaccept_required_from)
 * - Scope applicability (global, region, product, license_tier)
 * - Immutable audit logging via LegalEventLogger
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { LegalEventLogger, EVENT_TYPES } = require('./legalEventLogger');

// Document types that require individual user acceptance
const USER_REQUIRED_DOC_TYPES = ['TOS', 'PRIVACY', 'COOKIES', 'AUP', 'AI_POLICY'];

// Document types that require org admin acceptance
const ORG_REQUIRED_DOC_TYPES = ['DPA'];

// Valid scope types
const SCOPE_TYPES = ['global', 'region', 'product', 'license_tier'];

const LegalService = {
    /**
     * Get all active legal documents (one per type, metadata only)
     * Respects lifecycle: only returns docs where effective_from <= now AND (expires_at IS NULL OR expires_at > now)
     * @param {Object} userContext - Optional user context for scope filtering
     * @returns {Promise<Array>} Active documents
     */
    getActiveDocuments: (userContext = null) => {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            const sql = `
                SELECT id, doc_type, version, title, effective_from, is_active,
                       scope_type, scope_value, expires_at, reaccept_required_from
                FROM legal_documents
                WHERE is_active = 1
                  AND effective_from <= ?
                  AND (expires_at IS NULL OR expires_at > ?)
                ORDER BY doc_type
            `;
            db.all(sql, [now, now], (err, rows) => {
                if (err) return reject(err);

                // Apply scope filtering if user context provided
                let filtered = rows || [];
                if (userContext) {
                    filtered = filtered.filter(doc =>
                        LegalService.isDocumentApplicable(doc, userContext)
                    );
                }

                resolve(filtered);
            });
        });
    },

    /**
     * Get active document by type (with full content)
     * @param {string} docType - Document type (TOS, PRIVACY, etc.)
     * @returns {Promise<Object|null>} Document or null
     */
    getActiveDocument: (docType) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, doc_type, version, title, content_md, effective_from, is_active, created_at
                FROM legal_documents
                WHERE doc_type = ? AND is_active = 1
                LIMIT 1
            `;
            db.get(sql, [docType], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    /**
     * Get user's acceptance records
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID (optional)
     * @returns {Promise<Array>} Acceptance records
     */
    getUserAcceptances: (userId, orgId = null) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT la.*, ld.title as doc_title
                FROM legal_acceptances la
                LEFT JOIN legal_documents ld ON la.doc_type = ld.doc_type AND la.version = ld.version
                WHERE la.user_id = ?
                ORDER BY la.accepted_at DESC
            `;
            db.all(sql, [userId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get organization's DPA acceptance
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object|null>} DPA acceptance or null
     */
    getOrgDPAAcceptance: (orgId) => {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            const sql = `
                SELECT la.*, ld.version as current_version, ld.reaccept_required_from
                FROM legal_acceptances la
                INNER JOIN legal_documents ld ON la.doc_type = ld.doc_type AND ld.is_active = 1
                WHERE la.organization_id = ? 
                  AND la.doc_type = 'DPA' 
                  AND la.acceptance_scope = 'ORG_ADMIN'
                  AND la.version = ld.version
                  AND (ld.reaccept_required_from IS NULL OR la.accepted_at >= ld.reaccept_required_from)
                LIMIT 1
            `;
            db.get(sql, [orgId], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    /**
     * Check if a document is applicable to a user based on scope
     * @param {Object} doc - Document with scope_type and scope_value
     * @param {Object} userContext - User context (region, products, tier)
     * @returns {boolean} True if document applies
     */
    isDocumentApplicable: (doc, userContext) => {
        // Global scope applies to everyone
        if (!doc.scope_type || doc.scope_type === 'global') {
            return true;
        }

        if (!userContext) return true; // No context = assume applicable

        switch (doc.scope_type) {
            case 'region':
                // Check if user's region matches
                return !doc.scope_value ||
                    !userContext.region ||
                    doc.scope_value === userContext.region ||
                    (typeof doc.scope_value === 'string' &&
                        doc.scope_value.split(',').includes(userContext.region));

            case 'product':
                // Check if user uses the product
                return !doc.scope_value ||
                    !userContext.products ||
                    userContext.products.includes(doc.scope_value);

            case 'license_tier':
                // Check if user's tier matches
                return !doc.scope_value ||
                    !userContext.tier ||
                    doc.scope_value === userContext.tier;

            default:
                return true;
        }
    },

    /**
     * Check if an acceptance is still valid
     * @param {Object} acceptance - Acceptance record
     * @param {Object} document - Document with reaccept_required_from
     * @returns {boolean} True if acceptance is valid
     */
    isAcceptanceValid: (acceptance, document) => {
        if (!document.reaccept_required_from) return true;

        const acceptedAt = new Date(acceptance.accepted_at);
        const reacceptFrom = new Date(document.reaccept_required_from);

        return acceptedAt >= reacceptFrom;
    },

    /**
     * Check which documents are pending acceptance for a user
     * Respects lifecycle and scope rules
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID (optional)
     * @param {string} userRole - User's role (for DPA check)
     * @param {Object} userContext - Optional scope context
     * @returns {Promise<Object>} Pending documents info
     */
    checkPendingAcceptances: async (userId, orgId, userRole, userContext = null) => {
        try {
            // Get all active documents (lifecycle and scope filtered)
            const activeDocs = await LegalService.getActiveDocuments(userContext);

            // Get user's current acceptances
            const userAcceptances = await LegalService.getUserAcceptances(userId, orgId);

            // Map acceptances by doc_type+version for quick lookup
            const acceptedMap = {};
            userAcceptances.forEach(a => {
                acceptedMap[`${a.doc_type}:${a.version}`] = a;
            });

            // Determine which user-required docs are pending
            // Check both version match AND re-acceptance requirement
            const pendingUserDocs = activeDocs.filter(doc => {
                if (!USER_REQUIRED_DOC_TYPES.includes(doc.doc_type)) return false;

                const acceptance = acceptedMap[`${doc.doc_type}:${doc.version}`];
                if (!acceptance) return true; // Not accepted at all

                // Check re-acceptance requirement
                if (doc.reaccept_required_from) {
                    return !LegalService.isAcceptanceValid(acceptance, doc);
                }

                return false;
            });

            // Check DPA status for organization
            let dpaPending = false;
            let dpaDoc = null;
            const isOrgAdmin = ['ADMIN', 'OWNER'].includes(userRole);

            if (orgId) {
                dpaDoc = activeDocs.find(d => d.doc_type === 'DPA');
                if (dpaDoc) {
                    const orgDPA = await LegalService.getOrgDPAAcceptance(orgId);
                    dpaPending = !orgDPA;
                }
            }

            return {
                required: pendingUserDocs,
                dpaPending,
                dpaDoc,
                isOrgAdmin,
                hasAnyPending: pendingUserDocs.length > 0 || (isOrgAdmin && dpaPending)
            };
        } catch (err) {
            console.error('[LegalService] checkPendingAcceptances error:', err);
            throw err;
        }
    },

    /**
     * Record document acceptance(s)
     * @param {Object} params - Acceptance parameters
     * @param {string} params.userId - User ID
     * @param {string} params.orgId - Organization ID (optional)
     * @param {Array<string>} params.docTypes - Document types to accept
     * @param {string} params.scope - 'USER' or 'ORG_ADMIN'
     * @param {string} params.ip - Client IP address
     * @param {string} params.userAgent - Client user agent
     * @param {string} params.userRole - User's role (for ORG_ADMIN validation)
     * @returns {Promise<Object>} Result with created acceptances
     */
    acceptDocuments: async ({ userId, orgId, docTypes, scope = 'USER', ip, userAgent, userRole }) => {
        // Validate ORG_ADMIN scope
        if (scope === 'ORG_ADMIN') {
            if (!['ADMIN', 'OWNER'].includes(userRole)) {
                throw new Error('Only organization admins can accept documents with ORG_ADMIN scope');
            }
            if (!orgId) {
                throw new Error('Organization ID required for ORG_ADMIN scope');
            }
        }

        const created = [];
        const errors = [];

        for (const docType of docTypes) {
            try {
                // Get active document for this type
                const doc = await LegalService.getActiveDocument(docType);
                if (!doc) {
                    errors.push({ docType, error: 'No active document found' });
                    continue;
                }

                // Create evidence hash
                const evidenceHash = crypto
                    .createHash('sha256')
                    .update(`${doc.id}:${doc.version}:${userId}:${Date.now()}`)
                    .digest('hex');

                const evidence = {
                    documentId: doc.id,
                    documentHash: evidenceHash,
                    acceptedVersion: doc.version,
                    effectiveFrom: doc.effective_from,
                    timestamp: new Date().toISOString(),
                    ipAddress: ip,
                    userAgent: userAgent
                };

                const acceptanceId = uuidv4();

                await new Promise((resolve, reject) => {
                    const sql = `
                        INSERT INTO legal_acceptances 
                        (id, organization_id, user_id, doc_type, version, accepted_ip, user_agent, acceptance_scope, evidence_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    db.run(sql, [
                        acceptanceId,
                        scope === 'ORG_ADMIN' ? orgId : (orgId || null),
                        userId,
                        docType,
                        doc.version,
                        ip || null,
                        userAgent || null,
                        scope,
                        JSON.stringify(evidence)
                    ], function (err) {
                        if (err) return reject(err);
                        resolve(this.changes);
                    });
                });

                created.push({
                    id: acceptanceId,
                    docType,
                    version: doc.version,
                    scope
                });

                // Log acceptance event
                LegalEventLogger.logAccept(
                    doc.id,
                    doc.version,
                    userId,
                    orgId,
                    userId,
                    { scope, ip, docType }
                );

            } catch (err) {
                errors.push({ docType, error: err.message });
            }
        }

        return { created, errors };
    },

    /**
     * Publish a new document version (SuperAdmin only)
     * Extended with lifecycle and scope parameters
     * @param {Object} params - Document parameters
     * @returns {Promise<Object>} Created document
     */
    publishDocument: async ({ docType, version, title, contentMd, effectiveFrom, createdBy, expiresAt, reacceptRequiredFrom, scopeType, scopeValue, changeSummary, previousVersionId }) => {
        const docId = uuidv4();

        const result = await new Promise((resolve, reject) => {
            db.serialize(() => {
                // Deactivate any existing active document of this type
                db.run(
                    `UPDATE legal_documents SET is_active = 0 WHERE doc_type = ? AND is_active = 1`,
                    [docType],
                    (err) => {
                        if (err) {
                            console.error('[LegalService] Deactivate error:', err);
                        }
                    }
                );

                // Insert new document as active with lifecycle/scope
                const sql = `
                    INSERT INTO legal_documents 
                    (id, doc_type, version, title, content_md, effective_from, created_by, is_active,
                     expires_at, reaccept_required_from, scope_type, scope_value, change_summary, previous_version_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
                `;

                db.run(sql, [
                    docId,
                    docType,
                    version,
                    title,
                    contentMd,
                    effectiveFrom,
                    createdBy,
                    expiresAt || null,
                    reacceptRequiredFrom || null,
                    scopeType || 'global',
                    scopeValue || null,
                    changeSummary || null,
                    previousVersionId || null
                ], function (err) {
                    if (err) return reject(err);
                    resolve({
                        id: docId,
                        docType,
                        version,
                        title,
                        effectiveFrom,
                        isActive: true,
                        scopeType: scopeType || 'global'
                    });
                });
            });
        });

        // Log publish event
        LegalEventLogger.logPublish(docId, version, createdBy, { docType, title, scopeType, effectiveFrom });

        return result;
    },

    /**
     * Get all document versions (SuperAdmin)
     * @returns {Promise<Array>} All documents
     */
    getAllDocuments: () => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, doc_type, version, title, effective_from, is_active, created_at, created_by
                FROM legal_documents
                ORDER BY doc_type, created_at DESC
            `;
            db.all(sql, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get acceptance status for all users in an organization
     * @param {string} orgId - Organization ID
     * @returns {Promise<Array>} User acceptance matrix
     */
    getOrgAcceptanceStatus: async (orgId) => {
        try {
            // Get all users in org
            const users = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, email, first_name, last_name, role FROM users WHERE organization_id = ?`,
                    [orgId],
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    }
                );
            });

            // Get active documents
            const activeDocs = await LegalService.getActiveDocuments();

            // Get all acceptances for org users
            const userIds = users.map(u => u.id);
            if (userIds.length === 0) return [];

            const placeholders = userIds.map(() => '?').join(',');
            const acceptances = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT user_id, doc_type, version FROM legal_acceptances WHERE user_id IN (${placeholders})`,
                    userIds,
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    }
                );
            });

            // Build acceptance map
            const acceptanceMap = {};
            acceptances.forEach(a => {
                const key = `${a.user_id}:${a.doc_type}`;
                acceptanceMap[key] = a.version;
            });

            // Build user status matrix
            return users.map(user => {
                const status = {};
                activeDocs.forEach(doc => {
                    const acceptedVersion = acceptanceMap[`${user.id}:${doc.doc_type}`];
                    status[doc.doc_type] = {
                        accepted: acceptedVersion === doc.version,
                        acceptedVersion,
                        currentVersion: doc.version
                    };
                });

                return {
                    userId: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    acceptanceStatus: status
                };
            });
        } catch (err) {
            console.error('[LegalService] getOrgAcceptanceStatus error:', err);
            throw err;
        }
    },

    /**
     * Toggle document active status (SuperAdmin)
     * @param {string} docId - Document ID
     * @param {boolean} isActive - New active state
     * @returns {Promise<Object>} Result
     */
    toggleDocumentActive: async (docId, isActive) => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // If activating, first deactivate others of same type
                if (isActive) {
                    db.get('SELECT doc_type FROM legal_documents WHERE id = ?', [docId], (err, doc) => {
                        if (err) return reject(err);
                        if (!doc) return reject(new Error('Document not found'));

                        db.run(
                            'UPDATE legal_documents SET is_active = 0 WHERE doc_type = ? AND id != ?',
                            [doc.doc_type, docId]
                        );

                        db.run(
                            'UPDATE legal_documents SET is_active = 1 WHERE id = ?',
                            [docId],
                            function (err) {
                                if (err) return reject(err);
                                resolve({ id: docId, isActive: true });
                            }
                        );
                    });
                } else {
                    db.run(
                        'UPDATE legal_documents SET is_active = 0 WHERE id = ?',
                        [docId],
                        function (err) {
                            if (err) return reject(err);
                            resolve({ id: docId, isActive: false });
                        }
                    );
                }
            });
        });
    }
};

module.exports = LegalService;
