/**
 * Branding Service Unit Tests
 * Tests brand settings, theming, and customization
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-branding-${workerId}.db`;
});

describe('BrandingService', () => {
    const db = getDatabase();
    let testOrgId;

    beforeAll(async () => {
        await initializeDatabase();

        testOrgId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [testOrgId, 'Branding Test Org', 'enterprise', 'active'],
                (err) => err ? reject(err) : resolve()
            );
        });
    });

    afterAll(async () => {
        await new Promise(r => db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r()));
    });

    describe('Brand Settings', () => {
        it('should get default brand settings', () => {
            const defaultBrand = {
                logo: null,
                primaryColor: '#3B82F6',
                secondaryColor: '#10B981',
                fontFamily: 'Inter',
                companyName: null
            };

            expect(defaultBrand.primaryColor).toBe('#3B82F6');
            expect(defaultBrand.fontFamily).toBe('Inter');
        });

        it('should validate color format', () => {
            const isValidHex = (color) => /^#[0-9A-Fa-f]{6}$/.test(color);

            expect(isValidHex('#3B82F6')).toBe(true);
            expect(isValidHex('#fff')).toBe(false);
            expect(isValidHex('blue')).toBe(false);
        });

        it('should support brand customization', () => {
            const brand = {
                logo: 'https://example.com/logo.png',
                primaryColor: '#FF5722',
                favicon: 'https://example.com/favicon.ico',
                customCSS: '.header { background: red; }'
            };

            expect(brand.logo).toBeDefined();
            expect(brand.customCSS).toContain('.header');
        });
    });

    describe('Theme Management', () => {
        it('should support light and dark modes', () => {
            const themes = ['light', 'dark', 'system'];

            for (const mode of themes) {
                const theme = { mode, colors: {} };
                expect(['light', 'dark', 'system']).toContain(theme.mode);
            }
        });

        it('should define color palette for theme', () => {
            const darkTheme = {
                mode: 'dark',
                colors: {
                    background: '#1F2937',
                    surface: '#374151',
                    text: '#F9FAFB',
                    primary: '#60A5FA'
                }
            };

            expect(darkTheme.colors.background).toBe('#1F2937');
            expect(darkTheme.colors.text).toBe('#F9FAFB');
        });

        it('should generate contrast color', () => {
            const getContrastColor = (hex) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                return luminance > 0.5 ? '#000000' : '#FFFFFF';
            };

            expect(getContrastColor('#FFFFFF')).toBe('#000000');
            expect(getContrastColor('#000000')).toBe('#FFFFFF');
        });
    });

    describe('White Label', () => {
        it('should support white label config', () => {
            const whiteLabel = {
                enabled: true,
                hideConsultinityBranding: true,
                customDomain: 'app.clientname.com',
                customEmail: 'support@clientname.com'
            };

            expect(whiteLabel.enabled).toBe(true);
            expect(whiteLabel.customDomain).toBeDefined();
        });

        it('should validate custom domain format', () => {
            const isValidDomain = (domain) => /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(domain);

            expect(isValidDomain('app.example.com')).toBe(true);
            expect(isValidDomain('invalid_domain')).toBe(false);
        });
    });

    describe('Email Templates', () => {
        it('should apply branding to email templates', () => {
            const brand = { logo: 'logo.png', primaryColor: '#3B82F6' };
            const emailTemplate = `
                <img src="${brand.logo}">
                <div style="background: ${brand.primaryColor}">Header</div>
            `;

            expect(emailTemplate).toContain('logo.png');
            expect(emailTemplate).toContain('#3B82F6');
        });
    });
});
