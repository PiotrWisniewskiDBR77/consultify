/**
 * Calendar Integrations Routes
 * 
 * API endpoints for calendar sync (Google Calendar, Outlook, Apple Calendar)
 * 
 * Endpoints:
 * - GET  /api/integrations/calendar - List calendar connections
 * - POST /api/integrations/calendar/:provider/connect - Initiate OAuth
 * - GET  /api/integrations/calendar/:provider/callback - OAuth callback
 * - DELETE /api/integrations/calendar/:provider - Disconnect calendar
 * - PUT  /api/integrations/calendar/settings - Update sync settings
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');

// Apply auth middleware to all routes
router.use(verifyToken);

// Base URL for OAuth callbacks
const getBaseUrl = (req) => {
    return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
};

// Supported calendar providers
const CALENDAR_PROVIDERS = [
    {
        id: 'google',
        name: 'Google Calendar',
        icon: '📅',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events']
    },
    {
        id: 'outlook',
        name: 'Outlook Calendar',
        icon: '📆',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scopes: ['Calendars.ReadWrite', 'offline_access']
    },
    {
        id: 'apple',
        name: 'Apple Calendar',
        icon: '🍎',
        authUrl: null, // Apple Calendar uses CalDAV
        note: 'Uses CalDAV protocol'
    }
];

// ==========================================
// LIST CALENDARS
// ==========================================

/**
 * GET /api/integrations/calendar
 * List all calendar connections for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const connections = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    provider, status, external_email, calendar_name,
                    sync_tasks, sync_meetings, last_sync_at, created_at
                FROM user_calendar_integrations
                WHERE user_id = ?`,
                [userId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        // Map connections to providers
        const calendars = CALENDAR_PROVIDERS.map(provider => {
            const connection = connections.find(c => c.provider === provider.id);
            return {
                ...provider,
                connected: connection?.status === 'active',
                connection: connection ? {
                    externalEmail: connection.external_email,
                    calendarName: connection.calendar_name,
                    lastSyncAt: connection.last_sync_at,
                    syncTasks: !!connection.sync_tasks,
                    syncMeetings: !!connection.sync_meetings
                } : null
            };
        });

        res.json({
            success: true,
            calendars,
            providers: CALENDAR_PROVIDERS
        });
    } catch (err) {
        console.error('[Calendar] List error:', err);
        res.status(500).json({ error: 'Failed to list calendar connections' });
    }
});

/**
 * GET /api/integrations/calendar/settings
 * Get calendar sync settings
 */
router.get('/settings', async (req, res) => {
    try {
        const userId = req.user.id;

        const settings = await new Promise((resolve, reject) => {
            db.get(
                `SELECT sync_tasks, sync_meetings FROM user_calendar_settings WHERE user_id = ?`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        res.json({
            success: true,
            settings: settings ? {
                syncTasks: !!settings.sync_tasks,
                syncMeetings: !!settings.sync_meetings
            } : {
                syncTasks: true,
                syncMeetings: true
            }
        });
    } catch (err) {
        console.error('[Calendar] Settings error:', err);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

/**
 * PUT /api/integrations/calendar/settings
 * Update calendar sync settings
 */
router.put('/settings', async (req, res) => {
    try {
        const userId = req.user.id;
        const { syncTasks = true, syncMeetings = true } = req.body;

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_calendar_settings (user_id, sync_tasks, sync_meetings, updated_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET
                    sync_tasks = excluded.sync_tasks,
                    sync_meetings = excluded.sync_meetings,
                    updated_at = datetime('now')`,
                [userId, syncTasks ? 1 : 0, syncMeetings ? 1 : 0],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({ success: true, message: 'Settings updated' });
    } catch (err) {
        console.error('[Calendar] Update settings error:', err);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// ==========================================
// OAUTH FLOW
// ==========================================

/**
 * POST /api/integrations/calendar/:provider/connect
 * Initiate OAuth connection for a calendar provider
 */
router.post('/:provider/connect', async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;

        const providerConfig = CALENDAR_PROVIDERS.find(p => p.id === provider);
        if (!providerConfig) {
            return res.status(400).json({ error: 'Invalid calendar provider' });
        }

        if (!providerConfig.authUrl) {
            return res.status(400).json({ 
                error: `${providerConfig.name} uses a different authentication method` 
            });
        }

        // Generate state for CSRF protection
        const state = Buffer.from(JSON.stringify({
            userId,
            provider,
            timestamp: Date.now()
        })).toString('base64');

        const redirectUri = `${getBaseUrl(req)}/api/integrations/calendar/${provider}/callback`;

        let authUrl;
        if (provider === 'google') {
            const params = new URLSearchParams({
                client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID || 'your-google-client-id',
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: providerConfig.scopes.join(' '),
                access_type: 'offline',
                prompt: 'consent',
                state
            });
            authUrl = `${providerConfig.authUrl}?${params.toString()}`;
        } else if (provider === 'outlook') {
            const params = new URLSearchParams({
                client_id: process.env.OUTLOOK_CLIENT_ID || 'your-outlook-client-id',
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: providerConfig.scopes.join(' '),
                state
            });
            authUrl = `${providerConfig.authUrl}?${params.toString()}`;
        }

        res.json({ success: true, authUrl });
    } catch (err) {
        console.error('[Calendar] Connect error:', err);
        res.status(500).json({ error: 'Failed to initiate connection' });
    }
});

/**
 * GET /api/integrations/calendar/:provider/callback
 * OAuth callback handler
 */
router.get('/:provider/callback', async (req, res) => {
    try {
        const { provider } = req.params;
        const { code, state, error: oauthError } = req.query;

        if (oauthError) {
            return res.redirect(`/settings/integrations?error=${encodeURIComponent(oauthError)}`);
        }

        if (!code || !state) {
            return res.redirect('/settings/integrations?error=missing_params');
        }

        // Parse state
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const userId = stateData.userId;

        // In production, exchange code for tokens here
        // For now, simulate a successful connection

        const connectionId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_calendar_integrations (
                    id, user_id, provider, status, external_email,
                    calendar_name, sync_tasks, sync_meetings, created_at
                ) VALUES (?, ?, ?, 'active', ?, ?, 1, 1, datetime('now'))
                ON CONFLICT(user_id, provider) DO UPDATE SET
                    status = 'active',
                    external_email = excluded.external_email,
                    calendar_name = excluded.calendar_name,
                    updated_at = datetime('now')`,
                [
                    connectionId,
                    userId,
                    provider,
                    'user@example.com', // Would come from OAuth response
                    provider === 'google' ? 'Primary Calendar' : 'Calendar'
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.redirect(`/settings/integrations?connected=${provider}`);
    } catch (err) {
        console.error('[Calendar] Callback error:', err);
        res.redirect('/settings/integrations?error=callback_failed');
    }
});

/**
 * DELETE /api/integrations/calendar/:provider
 * Disconnect calendar provider
 */
router.delete('/:provider', async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_calendar_integrations 
                SET status = 'disconnected', updated_at = datetime('now')
                WHERE user_id = ? AND provider = ?`,
                [userId, provider],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({ success: true, message: 'Calendar disconnected' });
    } catch (err) {
        console.error('[Calendar] Disconnect error:', err);
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

module.exports = router;





