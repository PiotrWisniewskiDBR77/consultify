/**
 * Dashboard Builder Service
 * Manages custom admin dashboards with widgets
 */

// Dependency injection for testing
const deps = {
    _db: null,
    _uuidv4: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../database.js');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
}

/**
 * Set dependencies for testing
 */
const setDependencies = (newDeps) => {
    if (newDeps.db) deps.db = newDeps.db;
    if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
};

/**
 * Widget types
 */
const WIDGET_TYPES = {
    METRIC_CARD: 'metric_card',
    LINE_CHART: 'line_chart',
    BAR_CHART: 'bar_chart',
    PIE_CHART: 'pie_chart',
    TABLE: 'table',
    LIST: 'list',
    TEXT: 'text',
    GAUGE: 'gauge',
    HEATMAP: 'heatmap',
    FUNNEL: 'funnel'
};

/**
 * Data sources for widgets
 */
const DATA_SOURCES = {
    USERS: 'users',
    ORGANIZATIONS: 'organizations',
    BILLING: 'billing',
    AI_USAGE: 'ai_usage',
    ACTIVITY: 'activity',
    SECURITY: 'security',
    SUPPORT_TICKETS: 'support_tickets',
    CUSTOM_QUERY: 'custom_query'
};

// ================================
// DASHBOARDS
// ================================

/**
 * Create a new dashboard
 */
const createDashboard = async ({ name, description, layout = {}, widgets = [], isShared = false, createdBy }) => {
    await initDeps();
    const id = deps.uuidv4();
    
    const sql = `
        INSERT INTO admin_dashboards (
            id, name, description, layout_json, widgets_json, is_shared, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;
    
    await deps.db.run(sql, [
        id,
        name,
        description,
        JSON.stringify(layout),
        JSON.stringify(widgets),
        isShared ? 1 : 0,
        createdBy
    ]);
    
    return {
        id,
        name,
        description,
        layout,
        widgets,
        isShared,
        createdBy,
        createdAt: new Date().toISOString()
    };
};

/**
 * Get dashboard by ID
 */
const getDashboardById = async (id) => {
    await initDeps();
    const sql = `
        SELECT d.*, u.email as created_by_email, u.first_name, u.last_name
        FROM admin_dashboards d
        LEFT JOIN users u ON d.created_by = u.id
        WHERE d.id = ?
    `;
    const dashboard = await deps.db.get(sql, [id]);
    
    if (!dashboard) return null;
    
    return {
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        layout: JSON.parse(dashboard.layout_json || '{}'),
        widgets: JSON.parse(dashboard.widgets_json || '[]'),
        isShared: dashboard.is_shared === 1,
        createdBy: dashboard.created_by,
        createdByEmail: dashboard.created_by_email,
        createdByName: `${dashboard.first_name || ''} ${dashboard.last_name || ''}`.trim(),
        createdAt: dashboard.created_at,
        updatedAt: dashboard.updated_at
    };
};

/**
 * Get all dashboards
 */
const getDashboards = async ({ createdBy, isShared, limit = 100, offset = 0 } = {}) => {
    await initDeps();
    let sql = `
        SELECT d.*, u.email as created_by_email, u.first_name, u.last_name
        FROM admin_dashboards d
        LEFT JOIN users u ON d.created_by = u.id
        WHERE 1=1
    `;
    const params = [];
    
    if (createdBy) {
        sql += ` AND (d.created_by = ? OR d.is_shared = 1)`;
        params.push(createdBy);
    }
    if (isShared !== undefined) {
        sql += ` AND d.is_shared = ?`;
        params.push(isShared ? 1 : 0);
    }
    
    sql += ` ORDER BY d.updated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const dashboards = await deps.db.all(sql, params);
    
    return dashboards.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        layout: JSON.parse(d.layout_json || '{}'),
        widgets: JSON.parse(d.widgets_json || '[]'),
        isShared: d.is_shared === 1,
        createdBy: d.created_by,
        createdByEmail: d.created_by_email,
        createdByName: `${d.first_name || ''} ${d.last_name || ''}`.trim(),
        createdAt: d.created_at,
        updatedAt: d.updated_at
    }));
};

/**
 * Update a dashboard
 */
const updateDashboard = async (id, updates) => {
    await initDeps();
    const allowedFields = ['name', 'description', 'layout_json', 'widgets_json', 'is_shared'];
    const setClauses = [];
    const params = [];
    
    const fieldMapping = {
        name: 'name',
        description: 'description',
        layout: 'layout_json',
        widgets: 'widgets_json',
        isShared: 'is_shared'
    };
    
    for (const [key, value] of Object.entries(updates)) {
        const dbField = fieldMapping[key];
        if (dbField && allowedFields.includes(dbField) && value !== undefined) {
            if (key === 'layout' || key === 'widgets') {
                setClauses.push(`${dbField} = ?`);
                params.push(JSON.stringify(value));
            } else if (key === 'isShared') {
                setClauses.push(`${dbField} = ?`);
                params.push(value ? 1 : 0);
            } else {
                setClauses.push(`${dbField} = ?`);
                params.push(value);
            }
        }
    }
    
    if (setClauses.length === 0) return false;
    
    setClauses.push(`updated_at = datetime('now')`);
    params.push(id);
    
    const sql = `UPDATE admin_dashboards SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = await deps.db.run(sql, params);
    return result.changes > 0;
};

/**
 * Delete a dashboard
 */
const deleteDashboard = async (id) => {
    await initDeps();
    const sql = `DELETE FROM admin_dashboards WHERE id = ?`;
    const result = await deps.db.run(sql, [id]);
    return result.changes > 0;
};

/**
 * Share/unshare a dashboard
 */
const toggleShare = async (id, isShared) => {
    await initDeps();
    const sql = `UPDATE admin_dashboards SET is_shared = ?, updated_at = datetime('now') WHERE id = ?`;
    const result = await deps.db.run(sql, [isShared ? 1 : 0, id]);
    return result.changes > 0;
};

/**
 * Clone a dashboard
 */
const cloneDashboard = async (id, newName, createdBy) => {
    const original = await getDashboardById(id);
    if (!original) return null;
    
    return createDashboard({
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        layout: original.layout,
        widgets: original.widgets,
        isShared: false,
        createdBy
    });
};

// ================================
// WIDGETS
// ================================

/**
 * Add widget to dashboard
 */
const addWidget = async (dashboardId, widget) => {
    await initDeps();
    const dashboard = await getDashboardById(dashboardId);
    if (!dashboard) return null;
    
    const newWidget = {
        id: deps.uuidv4(),
        ...widget,
        createdAt: new Date().toISOString()
    };
    
    const widgets = [...dashboard.widgets, newWidget];
    await updateDashboard(dashboardId, { widgets });
    
    return newWidget;
};

/**
 * Update widget in dashboard
 */
const updateWidget = async (dashboardId, widgetId, updates) => {
    const dashboard = await getDashboardById(dashboardId);
    if (!dashboard) return false;
    
    const widgets = dashboard.widgets.map(w =>
        w.id === widgetId ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
    );
    
    return updateDashboard(dashboardId, { widgets });
};

/**
 * Remove widget from dashboard
 */
const removeWidget = async (dashboardId, widgetId) => {
    const dashboard = await getDashboardById(dashboardId);
    if (!dashboard) return false;
    
    const widgets = dashboard.widgets.filter(w => w.id !== widgetId);
    return updateDashboard(dashboardId, { widgets });
};

/**
 * Reorder widgets in dashboard
 */
const reorderWidgets = async (dashboardId, widgetOrder) => {
    const dashboard = await getDashboardById(dashboardId);
    if (!dashboard) return false;
    
    const widgetMap = new Map(dashboard.widgets.map(w => [w.id, w]));
    const reorderedWidgets = widgetOrder
        .filter(id => widgetMap.has(id))
        .map(id => widgetMap.get(id));
    
    return updateDashboard(dashboardId, { widgets: reorderedWidgets });
};

// ================================
// WIDGET DATA FETCHING
// ================================

/**
 * Get data for a widget
 */
const getWidgetData = async (widget) => {
    await initDeps();
    const { dataSource, config = {} } = widget;
    
    switch (dataSource) {
        case DATA_SOURCES.USERS:
            return getUsersWidgetData(config);
        case DATA_SOURCES.ORGANIZATIONS:
            return getOrganizationsWidgetData(config);
        case DATA_SOURCES.BILLING:
            return getBillingWidgetData(config);
        case DATA_SOURCES.AI_USAGE:
            return getAIUsageWidgetData(config);
        case DATA_SOURCES.ACTIVITY:
            return getActivityWidgetData(config);
        case DATA_SOURCES.SECURITY:
            return getSecurityWidgetData(config);
        case DATA_SOURCES.SUPPORT_TICKETS:
            return getSupportTicketsWidgetData(config);
        case DATA_SOURCES.CUSTOM_QUERY:
            return getCustomQueryData(config);
        default:
            return { error: 'Unknown data source' };
    }
};

const getUsersWidgetData = async (config) => {
    await initDeps();
    const sql = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN created_at >= date('now', '-30 days') THEN 1 ELSE 0 END) as new_last_30_days,
            SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
            SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as users
        FROM users
    `;
    return deps.db.get(sql);
};

const getOrganizationsWidgetData = async (config) => {
    await initDeps();
    const sql = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN created_at >= date('now', '-30 days') THEN 1 ELSE 0 END) as new_last_30_days
        FROM organizations
    `;
    return deps.db.get(sql);
};

const getBillingWidgetData = async (config) => {
    await initDeps();
    const sql = `
        SELECT 
            COUNT(*) as total_invoices,
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
            SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as total_overdue
        FROM invoices
    `;
    return deps.db.get(sql);
};

const getAIUsageWidgetData = async (config) => {
    await initDeps();
    const sql = `
        SELECT 
            COUNT(*) as total_requests,
            SUM(tokens_used) as total_tokens,
            AVG(tokens_used) as avg_tokens_per_request,
            COUNT(DISTINCT user_id) as unique_users
        FROM ai_logs
        WHERE created_at >= date('now', '-30 days')
    `;
    return deps.db.get(sql);
};

const getActivityWidgetData = async (config) => {
    await initDeps();
    const sql = `
        SELECT 
            COUNT(*) as total_activities,
            COUNT(DISTINCT user_id) as unique_users,
            action_type,
            COUNT(*) as count
        FROM activity_logs
        WHERE created_at >= date('now', '-7 days')
        GROUP BY action_type
        ORDER BY count DESC
        LIMIT 10
    `;
    return deps.db.all(sql);
};

const getSecurityWidgetData = async (config) => {
    await initDeps();
    const sql = `
        SELECT 
            COUNT(*) as total_incidents,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_incidents,
            SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
            SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high
        FROM security_incidents
    `;
    return deps.db.get(sql);
};

const getSupportTicketsWidgetData = async (config) => {
    await initDeps();
    const sql = `
        SELECT 
            COUNT(*) as total_tickets,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent
        FROM support_tickets
    `;
    return deps.db.get(sql);
};

const getCustomQueryData = async (config) => {
    await initDeps();
    // For safety, only allow SELECT statements
    if (!config.query || !config.query.trim().toLowerCase().startsWith('select')) {
        return { error: 'Only SELECT queries are allowed' };
    }
    
    try {
        return await deps.db.all(config.query, config.params || []);
    } catch (error) {
        return { error: error.message };
    }
};

/**
 * Get dashboard statistics
 */
const getStats = async () => {
    await initDeps();
    const sql = `
        SELECT 
            COUNT(*) as total_dashboards,
            SUM(CASE WHEN is_shared = 1 THEN 1 ELSE 0 END) as shared_dashboards,
            COUNT(DISTINCT created_by) as unique_creators
        FROM admin_dashboards
    `;
    
    const stats = await deps.db.get(sql);
    
    return {
        totalDashboards: stats?.total_dashboards || 0,
        sharedDashboards: stats?.shared_dashboards || 0,
        uniqueCreators: stats?.unique_creators || 0
    };
};

export {
setDependencies,
    // Dashboards
    createDashboard,
    getDashboardById,
    getDashboards,
    updateDashboard,
    deleteDashboard,
    toggleShare,
    cloneDashboard,
    // Widgets
    addWidget,
    updateWidget,
    removeWidget,
    reorderWidgets,
    getWidgetData,
    // Stats
    getStats,
    // Constants
    WIDGET_TYPES,
    DATA_SOURCES
};

export default {
    setDependencies,
    // Dashboards
    createDashboard,
    getDashboardById,
    getDashboards,
    updateDashboard,
    deleteDashboard,
    toggleShare,
    cloneDashboard,
    // Widgets
    addWidget,
    updateWidget,
    removeWidget,
    reorderWidgets,
    getWidgetData,
    // Stats
    getStats,
    // Constants
    WIDGET_TYPES,
    DATA_SOURCES
};




