/**
 * User Preferences Service
 * 
 * Manages user-specific settings and preferences.
 */

const db = require('../database');

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

// Default preferences
const DEFAULTS = {
    timezone: 'UTC',
    locale: 'en',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
    firstDayOfWeek: 1,
    accessibility: {
        reduceMotion: false,
        highContrast: false,
        fontSize: 'medium', // small, medium, large
        screenReader: false,
    },
    notifications: {
        email: {
            enabled: true,
            taskAssigned: true,
            mentions: true,
            weeklyDigest: true,
            aiAlerts: true,
        },
        inApp: {
            enabled: true,
            sound: false,
        },
    },
    ui: {
        theme: 'system', // light, dark, system
        sidebarCollapsed: false,
        compactMode: false,
        showWelcomeGuide: true,
    },
};

const UserPreferencesService = {
    /**
     * Get all preferences for user
     * @param {string} userId 
     */
    async getPreferences(userId) {
        const user = await dbGet(
            `SELECT timezone, locale, date_format, time_format, first_day_of_week,
                    accessibility_settings, notification_preferences, ui_preferences
             FROM users WHERE id = ?`,
            [userId]
        );

        if (!user) {
            return DEFAULTS;
        }

        return {
            timezone: user.timezone || DEFAULTS.timezone,
            locale: user.locale || DEFAULTS.locale,
            dateFormat: user.date_format || DEFAULTS.dateFormat,
            timeFormat: user.time_format || DEFAULTS.timeFormat,
            firstDayOfWeek: user.first_day_of_week ?? DEFAULTS.firstDayOfWeek,
            accessibility: {
                ...DEFAULTS.accessibility,
                ...JSON.parse(user.accessibility_settings || '{}'),
            },
            notifications: {
                ...DEFAULTS.notifications,
                ...JSON.parse(user.notification_preferences || '{}'),
            },
            ui: {
                ...DEFAULTS.ui,
                ...JSON.parse(user.ui_preferences || '{}'),
            },
        };
    },

    /**
     * Update preferences
     * @param {string} userId 
     * @param {Object} updates 
     */
    async updatePreferences(userId, updates) {
        const fields = [];
        const params = [];

        if (updates.timezone !== undefined) {
            fields.push('timezone = ?');
            params.push(updates.timezone);
        }
        if (updates.locale !== undefined) {
            fields.push('locale = ?');
            params.push(updates.locale);
        }
        if (updates.dateFormat !== undefined) {
            fields.push('date_format = ?');
            params.push(updates.dateFormat);
        }
        if (updates.timeFormat !== undefined) {
            fields.push('time_format = ?');
            params.push(updates.timeFormat);
        }
        if (updates.firstDayOfWeek !== undefined) {
            fields.push('first_day_of_week = ?');
            params.push(updates.firstDayOfWeek);
        }

        // JSON fields - merge with existing
        if (updates.accessibility !== undefined) {
            const current = await this.getPreferences(userId);
            const merged = { ...current.accessibility, ...updates.accessibility };
            fields.push('accessibility_settings = ?');
            params.push(JSON.stringify(merged));
        }
        if (updates.notifications !== undefined) {
            const current = await this.getPreferences(userId);
            const merged = { ...current.notifications, ...updates.notifications };
            fields.push('notification_preferences = ?');
            params.push(JSON.stringify(merged));
        }
        if (updates.ui !== undefined) {
            const current = await this.getPreferences(userId);
            const merged = { ...current.ui, ...updates.ui };
            fields.push('ui_preferences = ?');
            params.push(JSON.stringify(merged));
        }

        if (fields.length === 0) {
            return { success: true, message: 'No changes' };
        }

        params.push(userId);

        await dbRun(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            params
        );

        return { success: true };
    },

    /**
     * Get timezone options
     */
    getTimezoneOptions() {
        return [
            { value: 'UTC', label: 'UTC' },
            { value: 'Europe/London', label: 'London (GMT)' },
            { value: 'Europe/Paris', label: 'Paris (CET)' },
            { value: 'Europe/Warsaw', label: 'Warsaw (CET)' },
            { value: 'Europe/Berlin', label: 'Berlin (CET)' },
            { value: 'America/New_York', label: 'New York (EST)' },
            { value: 'America/Chicago', label: 'Chicago (CST)' },
            { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
            { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
            { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
            { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
        ];
    },

    /**
     * Get locale options
     */
    getLocaleOptions() {
        return [
            { value: 'en', label: 'English' },
            { value: 'pl', label: 'Polski' },
            { value: 'de', label: 'Deutsch' },
            { value: 'fr', label: 'Français' },
            { value: 'es', label: 'Español' },
        ];
    },

    /**
     * Format date according to user preferences
     * @param {string|Date} date 
     * @param {string} userId 
     */
    async formatDate(date, userId) {
        const prefs = await this.getPreferences(userId);
        const d = new Date(date);

        // Simple formatting based on format preference
        const formats = {
            'YYYY-MM-DD': () => d.toISOString().split('T')[0],
            'DD/MM/YYYY': () => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
            'MM/DD/YYYY': () => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`,
            'DD.MM.YYYY': () => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`,
        };

        return (formats[prefs.dateFormat] || formats['YYYY-MM-DD'])();
    },

    /**
     * Format time according to user preferences
     * @param {string|Date} time 
     * @param {string} userId 
     */
    async formatTime(time, userId) {
        const prefs = await this.getPreferences(userId);
        const d = new Date(time);

        if (prefs.timeFormat === '12h') {
            const hours = d.getHours();
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const hour12 = hours % 12 || 12;
            return `${hour12}:${minutes} ${ampm}`;
        } else {
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
    },
};

module.exports = UserPreferencesService;
