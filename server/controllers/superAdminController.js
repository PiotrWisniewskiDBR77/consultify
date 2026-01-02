const { AppError, asyncHandler: catchAsync } = require('../utils/errorHandler');

// Default Dependencies
const deps = {
    db: require('../database'),
    ActivityService: require('../services/activityService'),
    BillingService: require('../services/billingService'),
    UsageService: require('../services/usageService'),
    RealtimeService: require('../services/realtimeService'),
    StorageService: require('../services/storageService'),
    LegalService: require('../services/legalService'),
    LegalEventLogger: require('../services/legalEventLogger').LegalEventLogger,
    AttributionService: require('../services/attributionService'),
    jwt: require('jsonwebtoken'),
    bcrypt: require('bcryptjs'),
    config: require('../config'),
    uuid: require('uuid')
};

/**
 * Inject mock dependencies for testing
 */
const setDependencies = (newDeps) => {
    Object.assign(deps, newDeps);
};

/**
 * GET All Organizations
 */
const getOrganizations = catchAsync(async (req, res, next) => {
    const sql = `
        SELECT 
            o.id, o.name, o.plan, o.status, 
            COALESCE(o.trial_started_at, o.created_at) as created_at, 
            0 as discount_percent,
            COUNT(u.id) as user_count
        FROM organizations o
        LEFT JOIN users u ON o.id = u.organization_id
        GROUP BY o.id, o.name, o.plan, o.status, o.trial_started_at, o.created_at
        ORDER BY o.name ASC
    `;

    deps.db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('[SuperAdmin] Organizations query error:', err);
            return next(new AppError('Failed to fetch organizations', 500));
        }
        res.json(rows || []);
    });
});

/**
 * GET Recent Activities
 */
const getActivities = catchAsync(async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 50;
    const activities = await deps.ActivityService.getRecent(limit);
    res.json(activities);
});

/**
 * GET Dashboard Stats
 */
const getDashboardStats = catchAsync(async (req, res, next) => {
    const [activityStats, aiStats] = await Promise.all([
        deps.ActivityService.getStats().catch(err => {
            console.error('[SuperAdmin] Activity Stats Error:', err);
            return { total: 0, last_hour: 0, last_24h: 0, last_7d: 0 };
        }),
        new Promise((resolve) => {
            deps.db.get(`
                SELECT 
                    COUNT(*) as total_ai_calls,
                    SUM(input_tokens + output_tokens) as total_tokens,
                    COUNT(DISTINCT user_id) as active_users
                FROM ai_logs 
                WHERE created_at > datetime('now', '-7 days')
            `, [], (err, row) => resolve(row || {}));
        })
    ]);

    const counts = await new Promise((resolve) => {
        deps.db.get(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM organizations) as total_orgs,
                (SELECT COUNT(*) FROM users WHERE last_login > datetime('now', '-7 days')) as active_users_7d
        `, [], (err, row) => resolve(row || {}));
    });

    res.json({
        activity: activityStats,
        ai: aiStats,
        counts,
        live: deps.RealtimeService.getGlobalStats()
    });
});

/**
 * UPDATE Organization
 */
const updateOrganization = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { plan, status, discount_percent } = req.body;

    const validPlans = ['free', 'pro', 'enterprise'];
    const validStatuses = ['active', 'blocked', 'trial'];

    if (plan && !validPlans.includes(plan)) return next(new AppError('Invalid plan', 400));
    if (status && !validStatuses.includes(status)) return next(new AppError('Invalid status', 400));
    if (discount_percent !== undefined && (discount_percent < 0 || discount_percent > 100)) {
        return next(new AppError('Invalid discount percent', 400));
    }

    const sql = `UPDATE organizations SET plan = COALESCE(?, plan), status = COALESCE(?, status), discount_percent = COALESCE(?, discount_percent) WHERE id = ?`;

    deps.db.run(sql, [plan, status, discount_percent, id], function (err) {
        if (err) return next(new AppError(err.message, 500));
        if (this.changes === 0) return next(new AppError('Organization not found', 404));

        deps.ActivityService.log({
            organizationId: id,
            userId: req.user?.id,
            action: 'updated',
            entityType: 'organization',
            entityId: id,
            newValue: { plan, status, discount_percent }
        });

        res.json({ message: 'Organization updated' });
    });
});

const deleteOrganization = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (id === 'org-dbr77-system') return next(new AppError('Cannot delete System Organization', 403));

    deps.db.serialize(() => {
        deps.db.run(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?)`, [id]);
        deps.db.run(`DELETE FROM project_users WHERE project_id IN (SELECT id FROM projects WHERE organization_id = ?)`, [id]);
        deps.db.run('DELETE FROM projects WHERE organization_id = ?', [id]);
        deps.db.run('DELETE FROM users WHERE organization_id = ?', [id]);
        deps.db.run('DELETE FROM organizations WHERE id = ?', [id], function (err) {
            if (err) return next(new AppError(err.message, 500));

            deps.ActivityService.log({
                userId: req.user?.id,
                action: 'deleted',
                entityType: 'organization',
                entityId: id
            });

            res.json({ message: 'Organization and its users, projects, and data deleted' });
        });
    });
});

/**
 * GET Organization Billing Details
 */
const getOrgBilling = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const [billing, usage, invoices] = await Promise.all([
        deps.BillingService.getOrganizationBilling(id),
        deps.UsageService.getCurrentUsage(id),
        deps.BillingService.getInvoices(id)
    ]);

    res.json({
        billing: billing || { status: 'no_subscription' },
        usage: usage || {},
        invoices: invoices || []
    });
});

/**
 * GET All Users
 */
const getUsers = catchAsync(async (req, res, next) => {
    const sql = `
        SELECT
            u.id, u.organization_id, u.email, u.first_name, u.last_name,
            u.role, u.status, u.last_login, u.created_at,
            o.name as organization_name
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        ORDER BY u.created_at DESC
    `;

    deps.db.all(sql, [], (err, rows) => {
        if (err) return next(new AppError(err.message, 500));

        const users = rows.map(u => ({
            id: u.id,
            organizationId: u.organization_id,
            organizationName: u.organization_name,
            firstName: u.first_name,
            lastName: u.last_name,
            email: u.email,
            role: u.role,
            status: u.status,
            lastLogin: u.last_login,
            createdAt: u.created_at
        }));
        res.json(users);
    });
});

/**
 * UPDATE User
 */
const updateUser = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { organizationId, role, status } = req.body;

    const sql = `UPDATE users SET organization_id = COALESCE(?, organization_id), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ? `;

    deps.db.run(sql, [organizationId, role, status, id], function (err) {
        if (err) return next(new AppError(err.message, 500));
        if (this.changes === 0) return next(new AppError('User not found', 404));

        deps.ActivityService.log({
            userId: req.user?.id,
            action: 'updated',
            entityType: 'user',
            entityId: id,
            newValue: { organizationId, role, status }
        });

        res.json({ message: 'User updated successfully' });
    });
});

/**
 * CREATE Super Admin User
 */
const createUser = catchAsync(async (req, res, next) => {
    const { firstName, lastName, email, password } = req.body;

    if (!email || !password) return next(new AppError('Email and password are required', 400));

    const hashedPassword = deps.bcrypt.hashSync(password, 8);
    const id = deps.uuid.v4();
    const systemOrgId = 'org-dbr77-system';

    const sql = `INSERT INTO users(id, organization_id, email, password, first_name, last_name, role, status, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

    deps.db.run(sql, [id, systemOrgId, email, hashedPassword, firstName, lastName, 'SUPERADMIN', 'active'], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return next(new AppError('Email already exists', 400));
            }
            return next(new AppError(err.message, 500));
        }

        deps.ActivityService.log({
            userId: req.user?.id,
            action: 'created',
            entityType: 'user',
            entityId: id,
            newValue: { email, role: 'SUPERADMIN' }
        });

        res.json({ id, email, firstName, lastName, role: 'SUPERADMIN', status: 'active' });
    });
});

/**
 * INVITE USER
 */
const inviteUser = catchAsync(async (req, res, next) => {
    const { email, role, organizationId } = req.body;

    if (!email || !organizationId) return next(new AppError('Email and Organization are required', 400));

    deps.db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return next(new AppError('Database error', 500));
        if (user) return next(new AppError('User already exists', 400));

        const token = deps.uuid.v4();
        const inviteId = deps.uuid.v4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const sql = `INSERT INTO invitations(id, organization_id, email, role, token, status, invited_by, expires_at) VALUES(?, ?, ?, ?, ?, 'pending', ?, ?)`;

        deps.db.run(sql, [inviteId, organizationId, email, role || 'USER', token, req.user.id, expiresAt], function (err) {
            if (err) return next(new AppError(err.message, 500));

            const inviteLink = `${req.protocol}://${req.get('host')}/register?token=${token}`;

            deps.ActivityService.log({
                userId: req.user.id,
                action: 'invited',
                entityType: 'user',
                entityName: email,
                details: { organizationId, role }
            });

            res.json({ message: 'Invitation created', inviteLink, token });
        });
    });
});

/**
 * RESET PASSWORD LINK
 */
const resetUserPassword = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    deps.db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        if (err) return next(new AppError(err.message, 500));
        if (!user) return next(new AppError('User not found', 404));

        const token = deps.uuid.v4();
        const resetId = deps.uuid.v4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const sql = `INSERT INTO password_resets(id, user_id, token, expires_at) VALUES(?, ?, ?, ?)`;

        deps.db.run(sql, [resetId, id, token, expiresAt], function (err) {
            if (err) return next(new AppError(err.message, 500));

            const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;

            deps.ActivityService.log({
                userId: req.user.id,
                action: 'password_reset_generated',
                entityType: 'user',
                entityId: id,
                entityName: user.email
            });

            res.json({ message: 'Reset link generated', resetLink, token });
        });
    });
});

/**
 * GET Access Requests
 */
const getAccessRequests = catchAsync(async (req, res, next) => {
    deps.db.all(`SELECT * FROM access_requests ORDER BY requested_at DESC`, [], (err, rows) => {
        if (err) return next(new AppError(err.message, 500));
        res.json(rows);
    });
});

/**
 * APPROVE Access Request
 */
const approveAccessRequest = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    deps.db.get(`SELECT * FROM access_requests WHERE id = ? `, [id], (err, request) => {
        if (err || !request) return next(new AppError('Request not found', 404));

        deps.db.run(`UPDATE organizations SET status = 'active' WHERE id = ? `, [request.organization_id], (err) => {
            if (err) return next(new AppError('Failed to activate organization', 500));

            deps.db.run(`UPDATE access_requests SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? `,
                [req.user.id, id],
                (err) => {
                    if (err) console.error("Error updating request status", err);
                    res.json({ message: 'Access approved successfully' });
                });
        });
    });
});

/**
 * REJECT Access Request
 */
const rejectAccessRequest = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { reason } = req.body;

    deps.db.get(`SELECT * FROM access_requests WHERE id = ? `, [id], (err, request) => {
        if (err || !request) return next(new AppError('Request not found', 404));

        deps.db.run(`UPDATE organizations SET status = 'blocked' WHERE id = ? `, [request.organization_id], (err) => {
            deps.db.run(`UPDATE access_requests SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? `,
                [reason, req.user.id, id],
                (err) => {
                    if (err) return next(new AppError(err.message, 500));
                    res.json({ message: 'Access rejected' });
                });
        });
    });
});

/**
 * GET Access Codes
 */
const getAccessCodes = catchAsync(async (req, res, next) => {
    deps.db.all(`SELECT * FROM access_codes ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return next(new AppError(err.message, 500));
        res.json(rows);
    });
});

/**
 * CREATE Access Code
 */
const createAccessCode = catchAsync(async (req, res, next) => {
    const { code, role, maxUses, expiresAt } = req.body;
    const newCode = code || deps.uuid.v4().substring(0, 8).toUpperCase();
    const orgId = req.user.organizationId;

    deps.db.run(`INSERT INTO access_codes(id, organization_id, code, created_by, role, max_uses, expires_at) VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [deps.uuid.v4(), orgId, newCode, req.user.id, role || 'USER', maxUses || 100, expiresAt],
        function (err) {
            if (err) return next(new AppError(err.message, 500));
            res.json({ message: 'Access code created', code: newCode });
        }
    );
});

/**
 * IMPERSONATE USER
 */
const impersonateUser = catchAsync(async (req, res, next) => {
    const { userId } = req.body;
    if (!userId) return next(new AppError('User ID is required', 400));

    deps.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return next(new AppError(err.message, 500));
        if (!user) return next(new AppError('User not found', 404));

        deps.db.get('SELECT * FROM organizations WHERE id = ?', [user.organization_id], (err, org) => {
            if (err) return next(new AppError('Server error', 500));

            const jti = deps.uuid.v4();
            const token = deps.jwt.sign({
                id: user.id,
                email: user.email,
                role: user.role,
                organizationId: user.organization_id,
                impersonator_id: req.user.id,
                jti: jti
            }, deps.config.JWT_SECRET, { expiresIn: '1h' });

            const safeUser = {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                status: user.status,
                organizationId: user.organization_id,
                companyName: org ? org.name : 'Unknown',
                impersonatorId: req.user.id
            };

            deps.ActivityService.log({
                userId: req.user.id,
                action: 'impersonate_start',
                entityType: 'user',
                entityId: user.id,
                entityName: user.email,
                details: { target_organization: user.organization_id }
            });

            res.json({ user: safeUser, token });
        });
    });
});

/**
 * DATABASE EXPLORER - TABLES
 */
const getDatabaseTables = catchAsync(async (req, res, next) => {
    const isPg = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
    const query = isPg
        ? "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE 'pg_%' AND table_name NOT LIKE '_%'"
        : "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    deps.db.all(query, [], (err, rows) => {
        if (err) return next(new AppError(err.message, 500));
        res.json(rows.map(r => r.name));
    });
});

/**
 * DATABASE EXPLORER - ROWS
 */
const getDatabaseRows = catchAsync(async (req, res, next) => {
    const { tableName } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) return next(new AppError('Invalid table name', 400));

    const isPg = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
    const orderBy = isPg ? 'ORDER BY ctid DESC' : 'ORDER BY rowid DESC';
    deps.db.all(`SELECT * FROM ${tableName} ${orderBy} LIMIT 100`, [], (err, rows) => {
        if (err) return next(new AppError(err.message, 500));
        res.json(rows);
    });
});

/**
 * STORAGE STATS
 */
const getStorageUsage = catchAsync(async (req, res, next) => {
    const stats = await deps.StorageService.getGlobalUsage();
    const orgs = await new Promise((resolve) => {
        deps.db.all('SELECT id, name FROM organizations', [], (err, rows) => resolve(rows || []));
    });

    const enrichedBreakdown = stats.breakdown.map(item => {
        const org = orgs.find(o => o.id === item.name);
        return {
            ...item,
            displayName: org ? org.name : (item.name === 'global' ? 'Global System' : item.name)
        };
    });

    res.json({ ...stats, breakdown: enrichedBreakdown });
});

/**
 * STORAGE LIST FILES
 */
const getStorageFiles = catchAsync(async (req, res, next) => {
    const { orgId } = req.params;
    const files = await deps.StorageService.listFiles(orgId);
    res.json(files);
});

/**
 * STORAGE DELETE FILE
 */
const deleteStorageFile = catchAsync(async (req, res, next) => {
    const { orgId, path } = req.body;
    if (!orgId || !path) return next(new AppError('Missing params', 400));

    const success = await deps.StorageService.deleteFile(orgId, path);
    if (success) res.json({ success: true });
    else next(new AppError('File not found', 404));
});

/**
 * LEGAL DASHBOARD
 */
const getAllLegalDocs = catchAsync(async (req, res, next) => {
    const documents = await deps.LegalService.getAllDocuments();
    res.json(documents);
});

/**
 * LEGAL PUBLISH
 */
const publishLegalDoc = catchAsync(async (req, res, next) => {
    const {
        docType, version, title, contentMd, effectiveFrom,
        expiresAt, reacceptRequiredFrom, scopeType, scopeValue, changeSummary, previousVersionId
    } = req.body;

    if (!docType || !version || !title || !contentMd || !effectiveFrom) {
        return next(new AppError('Required fields: docType, version, title, contentMd, effectiveFrom', 400));
    }

    const validTypes = ['TOS', 'PRIVACY', 'COOKIES', 'AUP', 'AI_POLICY', 'DPA'];
    if (!validTypes.includes(docType.toUpperCase())) {
        return next(new AppError(`Invalid docType. Must be one of: ${validTypes.join(', ')}`, 400));
    }

    const document = await deps.LegalService.publishDocument({
        docType: docType.toUpperCase(),
        version,
        title,
        contentMd,
        effectiveFrom,
        createdBy: req.user.id,
        expiresAt,
        reacceptRequiredFrom,
        scopeType: scopeType || 'global',
        scopeValue,
        changeSummary,
        previousVersionId
    });

    deps.ActivityService.log({
        userId: req.user.id,
        action: 'legal_document_published',
        entityType: 'legal_document',
        entityId: document.id,
        entityName: `${docType} v${version}`,
        newValue: { docType, version, effectiveFrom, scopeType, expiresAt, reacceptRequiredFrom }
    });

    res.json(document);
});

/**
 * LEGAL TOGGLE ACTIVE
 */
const toggleLegalDocActive = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') return next(new AppError('isActive must be a boolean', 400));

    const result = await deps.LegalService.toggleDocumentActive(id, isActive);

    deps.ActivityService.log({
        userId: req.user.id,
        action: isActive ? 'legal_document_activated' : 'legal_document_deactivated',
        entityType: 'legal_document',
        entityId: id
    });

    res.json(result);
});

/**
 * GET LEGAL DOC BY ID
 */
const getLegalDocById = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const document = await deps.LegalService.getDocumentById(id);
    if (!document) return next(new AppError('Document not found', 404));
    res.json(document);
});

/**
 * LEGAL EVENTS
 */
const getLegalEvents = catchAsync(async (req, res, next) => {
    const { organizationId, userId, documentId, eventTypes, dateFrom, dateTo, limit } = req.query;

    const events = await deps.LegalEventLogger.getEvents({
        organizationId,
        userId,
        documentId,
        eventTypes: eventTypes ? eventTypes.split(',') : null,
        dateFrom,
        dateTo,
        limit: limit ? parseInt(limit, 10) : 1000
    });

    const parsedEvents = events.map(e => ({
        ...e,
        metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata
    }));

    res.json({
        count: parsedEvents.length,
        events: parsedEvents
    });
});

/**
 * LEGAL EVENT STATS
 */
const getLegalEventStats = catchAsync(async (req, res, next) => {
    const { organizationId, days } = req.query;
    const stats = await deps.LegalEventLogger.getEventStats(
        organizationId || null,
        days ? parseInt(days, 10) : 30
    );

    res.json({
        period: `${days || 30} days`,
        stats
    });
});

/**
 * ATTRIBUTION BY ORG
 */
const getOrgAttribution = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const attribution = await deps.AttributionService.getOrganizationAttribution(id);
    const firstAttribution = await deps.AttributionService.getFirstAttribution(id);

    res.json({
        organizationId: id,
        firstAttribution,
        allEvents: attribution,
        totalEvents: attribution.length
    });
});

/**
 * EXPORT ATTRIBUTION
 */
const exportAttribution = catchAsync(async (req, res, next) => {
    const { startDate, endDate, partnerCode, sourceType } = req.query;

    const data = await deps.AttributionService.exportAttribution({
        startDate,
        endDate,
        partnerCode,
        sourceType
    });

    res.json({
        count: data.length,
        filters: { startDate, endDate, partnerCode, sourceType },
        data
    });
});

/**
 * PARTNER SUMMARY
 */
const getPartnerSummary = catchAsync(async (req, res, next) => {
    const { startDate, endDate } = req.query;
    const summary = await deps.AttributionService.getPartnerSummary(startDate, endDate);

    res.json({
        period: { startDate: startDate || 'all-time', endDate: endDate || 'now' },
        partners: summary
    });
});

/**
 * GET Usage Stats by Organization
 */
const getUsageByOrganization = catchAsync(async (req, res, next) => {
    const isPg = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
    
    // Join ai_logs through users table since ai_logs doesn't have organization_id
    const query = isPg ? `
        SELECT 
            o.id,
            o.name,
            o.plan,
            COUNT(DISTINCT u.id) as user_count,
            COALESCE(SUM(a.input_tokens + a.output_tokens), 0) as tokens_used,
            COUNT(a.id) as ai_calls,
            MAX(a.created_at) as last_ai_activity
        FROM organizations o
        LEFT JOIN users u ON u.organization_id = o.id
        LEFT JOIN ai_logs a ON a.user_id = u.id AND a.created_at > NOW() - INTERVAL '30 days'
        GROUP BY o.id, o.name, o.plan
        ORDER BY tokens_used DESC
    ` : `
        SELECT 
            o.id,
            o.name,
            o.plan,
            COUNT(DISTINCT u.id) as user_count,
            COALESCE(SUM(a.input_tokens + a.output_tokens), 0) as tokens_used,
            COUNT(a.id) as ai_calls,
            MAX(a.created_at) as last_ai_activity
        FROM organizations o
        LEFT JOIN users u ON u.organization_id = o.id
        LEFT JOIN ai_logs a ON a.user_id = u.id AND a.created_at > datetime('now', '-30 days')
        GROUP BY o.id, o.name, o.plan
        ORDER BY tokens_used DESC
    `;

    deps.db.all(query, [], (err, rows) => {
        if (err) return next(new AppError('Failed to fetch usage data', 500));
        res.json(rows || []);
    });
});

/**
 * GET Invoices
 */
const getInvoices = catchAsync(async (req, res, next) => {
    const { period = '30d' } = req.query;
    const isPg = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
    
    // Try to get invoices from Stripe cache or token_transactions as proxy
    const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
    
    const dateCondition = isPg 
        ? `created_at > NOW() - INTERVAL '${periodDays} days'`
        : `created_at > datetime('now', '-${periodDays} days')`;

    const query = `
        SELECT 
            t.id,
            'INV-' || SUBSTR(t.id, 1, 8) as invoice_number,
            t.organization_id,
            o.name as organization_name,
            CASE 
                WHEN t.type = 'purchase' THEN 'paid'
                WHEN t.type = 'refund' THEN 'refunded'
                ELSE 'pending'
            END as status,
            ABS(t.amount_usd) as amount,
            'USD' as currency,
            0 as tax,
            ABS(t.amount_usd) as total,
            t.created_at as due_date,
            t.created_at as paid_at,
            t.created_at,
            t.description
        FROM token_transactions t
        LEFT JOIN organizations o ON o.id = t.organization_id
        WHERE t.type IN ('purchase', 'refund') AND ${dateCondition}
        ORDER BY t.created_at DESC
        LIMIT 100
    `;

    deps.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Invoice query error:', err);
            // Return empty array on error
            return res.json({ invoices: [], total: 0 });
        }
        res.json({ 
            invoices: rows || [], 
            total: (rows || []).length 
        });
    });
});

/**
 * GET Invoice Stats
 */
const getInvoiceStats = catchAsync(async (req, res, next) => {
    const isPg = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
    
    const query = isPg ? `
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount_usd ELSE 0 END), 0) as total_revenue,
            COUNT(CASE WHEN type = 'purchase' THEN 1 END) as paid_invoices,
            0 as pending_invoices,
            0 as overdue_invoices,
            0 as overdue_amount,
            0 as monthly_growth
        FROM token_transactions
        WHERE created_at > NOW() - INTERVAL '30 days'
    ` : `
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount_usd ELSE 0 END), 0) as total_revenue,
            COUNT(CASE WHEN type = 'purchase' THEN 1 END) as paid_invoices,
            0 as pending_invoices,
            0 as overdue_invoices,
            0 as overdue_amount,
            0 as monthly_growth
        FROM token_transactions
        WHERE created_at > datetime('now', '-30 days')
    `;

    deps.db.get(query, [], (err, row) => {
        if (err) {
            console.error('Invoice stats error:', err);
            return res.json({
                totalRevenue: 0,
                paidInvoices: 0,
                pendingInvoices: 0,
                overdueInvoices: 0,
                overdueAmount: 0,
                monthlyGrowth: 0
            });
        }
        res.json({
            totalRevenue: row?.total_revenue || 0,
            paidInvoices: row?.paid_invoices || 0,
            pendingInvoices: row?.pending_invoices || 0,
            overdueInvoices: row?.overdue_invoices || 0,
            overdueAmount: row?.overdue_amount || 0,
            monthlyGrowth: row?.monthly_growth || 0
        });
    });
});

/**
 * GET System Health
 */
const getSystemHealth = catchAsync(async (req, res, next) => {
    const startTime = Date.now();
    const isPg = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
    
    // Test database connectivity and get basic stats
    const dbCheck = await new Promise((resolve) => {
        deps.db.get('SELECT 1 as test', [], (err) => {
            const responseTime = Date.now() - startTime;
            resolve({
                status: err ? 'error' : 'healthy',
                responseTime,
                type: isPg ? 'PostgreSQL' : 'SQLite'
            });
        });
    });

    // Get uptime (process uptime as proxy)
    const uptimeSeconds = process.uptime();
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeDays = Math.floor(uptimeHours / 24);

    // Check AI service (just return status based on config)
    const aiServiceStatus = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY 
        ? 'online' 
        : 'no_keys';

    res.json({
        api: {
            status: 'healthy',
            responseTime: Date.now() - startTime,
            version: process.env.APP_VERSION || '2.5.0'
        },
        database: dbCheck,
        ai: {
            status: aiServiceStatus,
            providers: {
                openai: !!process.env.OPENAI_API_KEY,
                anthropic: !!process.env.ANTHROPIC_API_KEY,
                groq: !!process.env.GROQ_API_KEY
            }
        },
        system: {
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'development',
            uptime: {
                seconds: Math.floor(uptimeSeconds),
                formatted: uptimeDays > 0 
                    ? `${uptimeDays}d ${uptimeHours % 24}h` 
                    : `${uptimeHours}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`
            },
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            }
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = {
    setDependencies,
    getOrganizations,
    getActivities,
    getDashboardStats,
    updateOrganization,
    deleteOrganization,
    getOrgBilling,
    getUsers,
    updateUser,
    createUser,
    inviteUser,
    resetUserPassword,
    getAccessRequests,
    approveAccessRequest,
    rejectAccessRequest,
    getAccessCodes,
    createAccessCode,
    impersonateUser,
    getDatabaseTables,
    getDatabaseRows,
    getStorageUsage,
    getStorageFiles,
    deleteStorageFile,
    getAllLegalDocs,
    publishLegalDoc,
    toggleLegalDocActive,
    getLegalDocById,
    getLegalEvents,
    getLegalEventStats,
    getOrgAttribution,
    exportAttribution,
    getPartnerSummary,
    getUsageByOrganization,
    getInvoices,
    getInvoiceStats,
    getSystemHealth
};
