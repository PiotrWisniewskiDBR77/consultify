/**
 * Legal Service
 * Manages legal documents, versions, and user/organization acceptances.
 * Provides audit-friendly acceptance tracking for compliance.
 */

// Dependency injection for testing
let deps = {
    db: null,
    uuidv4: null,
    crypto: null,
    LegalEventLogger: null,
    EVENT_TYPES: null
};

/**
 * Initialize dependencies
 */
async function initDeps() {
    if (!deps.db) {
        const dbModule = await import('../src/database/Database.ts');
    const { getDatabase } = dbModule;
    deps.db = getDatabase();
    }

    if (!deps.uuidv4) {
        const uuidModule = await import('uuid');
        deps.uuidv4 = uuidModule.v4;
    }

    if (!deps.crypto) {
        const cryptoModule = await import('crypto');
        deps.crypto = cryptoModule.default || cryptoModule;
    }

    if (!deps.LegalEventLogger || !deps.EVENT_TYPES) {
        const loggerModule = await import('./legalEventLogger.js');
        deps.LegalEventLogger = loggerModule.LegalEventLogger || loggerModule.default;
        deps.EVENT_TYPES = loggerModule.EVENT_TYPES;
    }
}

// Document types that require individual user acceptance
const USER_REQUIRED_DOC_TYPES = ['TOS', 'PRIVACY', 'COOKIES', 'AUP', 'AI_POLICY'];

// Document types that require org admin acceptance
const ORG_REQUIRED_DOC_TYPES = ['DPA'];

// Valid scope types
const SCOPE_TYPES = ['global', 'region', 'product', 'license_tier'];

export const LegalService = {
    /**
     * Allow dependency injection for testing
     */
    setDependencies: (newDeps) => {
        deps = { ...deps, ...newDeps };
    },

    /**
     * Get all active legal documents (one per type, metadata only)
     */
    getActiveDocuments: async (userContext = null) => {
        await initDeps();

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
            deps.db.all(sql, [now, now], (err, rows) => {
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
     */
    getActiveDocument: async (docType) => {
        await initDeps();

        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, doc_type, version, title, content_md, effective_from, is_active, created_at
                FROM legal_documents
                WHERE doc_type = ? AND is_active = 1
                LIMIT 1
            `;
            deps.db.get(sql, [docType], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    /**
     * Get user's acceptance records
     */
    getUserAcceptances: async (userId, orgId = null) => {
        await initDeps();

        return new Promise((resolve, reject) => {
            let sql = `
                SELECT la.*, ld.title as doc_title
                FROM legal_acceptances la
                LEFT JOIN legal_documents ld ON la.doc_type = ld.doc_type AND la.version = ld.version
                WHERE la.user_id = ?
            `;
            const params = [userId];

            if (orgId) {
                sql += ` AND la.organization_id = ?`;
                params.push(orgId);
            }

            sql += ` ORDER BY la.accepted_at DESC`;

            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get organization's DPA acceptance
     */
    getOrgDPAAcceptance: async (orgId) => {
        await initDeps();

        return new Promise((resolve, reject) => {
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
            deps.db.get(sql, [orgId], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    /**
     * Check if a document is applicable to a user based on scope
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
     */
    isAcceptanceValid: (acceptance, document) => {
        if (!document.reaccept_required_from) return true;

        const acceptedAt = new Date(acceptance.accepted_at);
        const reacceptFrom = new Date(document.reaccept_required_from);

        return acceptedAt >= reacceptFrom;
    },

    /**
     * Check which documents are pending acceptance for a user
     */
    checkPendingAcceptances: async (userId, orgId, userRole, userContext = null) => {
        await initDeps();

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
     */
    acceptDocuments: async ({ userId, orgId, docTypes, scope = 'USER', ip, userAgent, userRole }) => {
        await initDeps();

        // Validate docTypes is an array
        if (!Array.isArray(docTypes)) {
            throw new Error('docTypes must be an array');
        }

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
                    errors.push({ docType, error: 'Document not found' });
                    continue;
                }

                // Create evidence hash
                const evidenceHash = deps.crypto
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

                const acceptanceId = deps.uuidv4();

                await new Promise((resolve, reject) => {
                    const sql = `
                        INSERT INTO legal_acceptances 
                        (id, organization_id, user_id, doc_type, version, accepted_ip, user_agent, acceptance_scope, evidence_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    deps.db.run(sql, [
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
                deps.LegalEventLogger.logAccept(
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
     */
    publishDocument: async ({ docType, version, title, contentMd, effectiveFrom, createdBy, expiresAt, reacceptRequiredFrom, scopeType, scopeValue, changeSummary, previousVersionId }) => {
        await initDeps();

        const docId = deps.uuidv4();

        const result = await new Promise((resolve, reject) => {
            deps.db.serialize(() => {
                // Deactivate any existing active document of this type
                deps.db.run(
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

                deps.db.run(sql, [
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
        deps.LegalEventLogger.logPublish(docId, version, createdBy, { docType, title, scopeType, effectiveFrom });

        return result;
    },

    /**
     * Get all document versions (SuperAdmin)
     */
    getAllDocuments: async () => {
        await initDeps();

        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, doc_type, version, title, effective_from, is_active, created_at, created_by
                FROM legal_documents
                ORDER BY doc_type, created_at DESC
            `;
            deps.db.all(sql, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get acceptance status for all users in an organization
     */
    getOrgAcceptanceStatus: async (orgId) => {
        await initDeps();

        try {
            // Get all users in org
            const users = await new Promise((resolve, reject) => {
                deps.db.all(
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
                deps.db.all(
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
     */
    toggleDocumentActive: async (docId, isActive) => {
        await initDeps();

        return new Promise((resolve, reject) => {
            deps.db.serialize(() => {
                // If activating, first deactivate others of same type
                if (isActive) {
                    deps.db.get('SELECT doc_type FROM legal_documents WHERE id = ?', [docId], (err, doc) => {
                        if (err) return reject(err);
                        if (!doc) return reject(new Error('Document not found'));

                        deps.db.run(
                            'UPDATE legal_documents SET is_active = 0 WHERE doc_type = ? AND id != ?',
                            [doc.doc_type, docId]
                        );

                        deps.db.run(
                            'UPDATE legal_documents SET is_active = 1 WHERE id = ?',
                            [docId],
                            function (err) {
                                if (err) return reject(err);
                                resolve({ id: docId, isActive: true });
                            }
                        );
                    });
                } else {
                    deps.db.run(
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
    },

    /**
     * Check if acceptance is required for a specific document type
     */
    checkAcceptanceRequired: async (userId, docType, orgId = null) => {
        await initDeps();

        try {
            // Get active document
            const doc = await LegalService.getActiveDocument(docType);
            if (!doc) {
                return { required: false, reason: 'No active document found' };
            }

            // Check if user has accepted this version
            const acceptances = await LegalService.getUserAcceptances(userId, orgId);
            const hasAccepted = acceptances.some(
                a => a.doc_type === docType && a.version === doc.version
            );

            return {
                required: !hasAccepted,
                docType,
                version: doc.version,
                currentVersion: doc.version
            };
        } catch (err) {
            console.error('[LegalService] checkAcceptanceRequired error:', err);
            throw err;
        }
    }
};

export default LegalService;

