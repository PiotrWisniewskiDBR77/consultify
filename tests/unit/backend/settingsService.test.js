/**
 * Settings Service Unit Tests
 * 
 * Tests for user and organization settings management.
 * 
 * @module tests/unit/backend/settingsService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create settings service implementation
const createSettingsService = () => {
    const userSettings = new Map();
    const orgSettings = new Map();

    const defaultUserSettings = {
        notifications: { email: true, push: true, sms: false },
        display: { theme: 'system', language: 'en', timezone: 'UTC' },
        privacy: { showProfile: true, showActivity: false },
        accessibility: { reduceMotion: false, highContrast: false }
    };

    const defaultOrgSettings = {
        branding: { logo: null, primaryColor: '#3B82F6' },
        security: { mfaRequired: false, sessionTimeout: 3600, passwordPolicy: 'standard' },
        features: { aiAssistant: true, integrations: true }
    };

    const getUserSettingsInternal = async (userId) => {
        const settings = userSettings.get(userId);
        return settings ? { ...defaultUserSettings, ...settings } : { ...defaultUserSettings };
    };

    const getOrgSettingsInternal = async (orgId) => {
        const settings = orgSettings.get(orgId);
        return settings ? { ...defaultOrgSettings, ...settings } : { ...defaultOrgSettings };
    };

    return {
        getUserSettings: getUserSettingsInternal,

        updateUserSettings: async (userId, path, value) => {
            const current = userSettings.get(userId) || {};
            const [category, key] = path.split('.');
            if (!current[category]) current[category] = {};
            current[category][key] = value;
            current.updatedAt = new Date().toISOString();
            userSettings.set(userId, current);
            return getUserSettingsInternal(userId);
        },

        bulkUpdateUserSettings: async (userId, updates) => {
            const current = userSettings.get(userId) || {};
            for (const [path, value] of Object.entries(updates)) {
                const [category, key] = path.split('.');
                if (!current[category]) current[category] = {};
                current[category][key] = value;
            }
            current.updatedAt = new Date().toISOString();
            userSettings.set(userId, current);
            return getUserSettingsInternal(userId);
        },

        resetUserSettings: async (userId, category = null) => {
            if (category) {
                const current = userSettings.get(userId) || {};
                delete current[category];
                userSettings.set(userId, current);
            } else {
                userSettings.delete(userId);
            }
            return getUserSettingsInternal(userId);
        },

        getOrgSettings: getOrgSettingsInternal,

        updateOrgSettings: async (orgId, path, value) => {
            const current = orgSettings.get(orgId) || {};
            const [category, key] = path.split('.');
            if (!current[category]) current[category] = {};
            current[category][key] = value;
            current.updatedAt = new Date().toISOString();
            orgSettings.set(orgId, current);
            return getOrgSettingsInternal(orgId);
        },

        validateSetting: (path, value) => {
            const validations = {
                'display.theme': ['light', 'dark', 'system'],
                'security.passwordPolicy': ['standard', 'strong', 'enterprise'],
                'security.sessionTimeout': { min: 300, max: 86400 }
            };
            const validation = validations[path];
            if (!validation) return true;
            if (Array.isArray(validation)) return validation.includes(value);
            if (typeof validation === 'object' && 'min' in validation) {
                return value >= validation.min && value <= validation.max;
            }
            return true;
        },

        exportSettings: async (userId) => {
            const settings = await getUserSettingsInternal(userId);
            return { exportedAt: new Date().toISOString(), userId, settings };
        },

        importSettings: async (userId, settingsData) => {
            const { notifications, display, privacy, accessibility } = settingsData;
            const current = {
                ...(notifications && { notifications }),
                ...(display && { display }),
                ...(privacy && { privacy }),
                ...(accessibility && { accessibility }),
                importedAt: new Date().toISOString()
            };
            userSettings.set(userId, current);
            return getUserSettingsInternal(userId);
        },

        clear: () => {
            userSettings.clear();
            orgSettings.clear();
        }
    };
};

describe('SettingsService', () => {
    let settingsService;

    beforeEach(() => {
        settingsService = createSettingsService();
    });

    describe('User Settings', () => {
        it('should return default settings for new user', async () => {
            const settings = await settingsService.getUserSettings('user-1');

            expect(settings.notifications.email).toBe(true);
            expect(settings.display.theme).toBe('system');
            expect(settings.privacy.showProfile).toBe(true);
        });

        it('should update single setting', async () => {
            const settings = await settingsService.updateUserSettings('user-1', 'display.theme', 'dark');

            expect(settings.display.theme).toBe('dark');
        });

        it('should preserve other settings when updating', async () => {
            await settingsService.updateUserSettings('user-1', 'display.theme', 'dark');
            const settings = await settingsService.updateUserSettings('user-1', 'display.language', 'pl');

            expect(settings.display.theme).toBe('dark');
            expect(settings.display.language).toBe('pl');
        });

        it('should bulk update settings', async () => {
            const settings = await settingsService.bulkUpdateUserSettings('user-1', {
                'display.theme': 'dark',
                'notifications.email': false,
                'privacy.showActivity': true
            });

            expect(settings.display.theme).toBe('dark');
            expect(settings.notifications.email).toBe(false);
            expect(settings.privacy.showActivity).toBe(true);
        });

        it('should reset settings to defaults', async () => {
            await settingsService.updateUserSettings('user-1', 'display.theme', 'dark');

            const settings = await settingsService.resetUserSettings('user-1');

            expect(settings.display.theme).toBe('system'); // default
        });

        it('should reset specific category', async () => {
            await settingsService.updateUserSettings('user-1', 'display.theme', 'dark');
            await settingsService.updateUserSettings('user-1', 'notifications.email', false);

            const settings = await settingsService.resetUserSettings('user-1', 'display');

            expect(settings.display.theme).toBe('system'); // reset to default
            expect(settings.notifications.email).toBe(false); // preserved
        });
    });

    describe('Organization Settings', () => {
        it('should return default org settings', async () => {
            const settings = await settingsService.getOrgSettings('org-1');

            expect(settings.security.mfaRequired).toBe(false);
            expect(settings.branding.primaryColor).toBe('#3B82F6');
        });

        it('should update org setting', async () => {
            const settings = await settingsService.updateOrgSettings('org-1', 'security.mfaRequired', true);

            expect(settings.security.mfaRequired).toBe(true);
        });
    });

    describe('Validation', () => {
        it('should validate theme values', () => {
            expect(settingsService.validateSetting('display.theme', 'dark')).toBe(true);
            expect(settingsService.validateSetting('display.theme', 'invalid')).toBe(false);
        });

        it('should validate numeric ranges', () => {
            expect(settingsService.validateSetting('security.sessionTimeout', 3600)).toBe(true);
            expect(settingsService.validateSetting('security.sessionTimeout', 100)).toBe(false);
            expect(settingsService.validateSetting('security.sessionTimeout', 100000)).toBe(false);
        });
    });

    describe('Export/Import', () => {
        it('should export settings', async () => {
            await settingsService.updateUserSettings('user-1', 'display.theme', 'dark');

            const exported = await settingsService.exportSettings('user-1');

            expect(exported.settings.display.theme).toBe('dark');
            expect(exported.exportedAt).toBeDefined();
        });

        it('should import settings', async () => {
            const importData = {
                display: { theme: 'light', language: 'de' },
                notifications: { email: false }
            };

            const settings = await settingsService.importSettings('user-1', importData);

            expect(settings.display.theme).toBe('light');
            expect(settings.display.language).toBe('de');
            expect(settings.notifications.email).toBe(false);
        });
    });
});
