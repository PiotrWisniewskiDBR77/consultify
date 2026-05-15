/**
 * White-label Extended Service Tests
 * FLOW-WHITELABEL-001: White-label Customization
 *
 * Tests for branding, custom domains, themes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('WhiteLabelExtendedService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT)`);

        // White-label Assets
        db.run(`
                    CREATE TABLE IF NOT EXISTS white_label_assets (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        asset_type TEXT NOT NULL,
                        asset_url TEXT NOT NULL,
                        file_size INTEGER,
                        mime_type TEXT,
                        uploaded_by TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Domain Verifications
        db.run(`
                    CREATE TABLE IF NOT EXISTS domain_verifications (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        domain TEXT NOT NULL UNIQUE,
                        verification_method TEXT DEFAULT 'dns_txt',
                        verification_token TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        verified_at TIMESTAMP,
                        expires_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Email Sender Verifications
        db.run(`
                    CREATE TABLE IF NOT EXISTS email_sender_verifications (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        email_address TEXT NOT NULL UNIQUE,
                        sender_name TEXT,
                        status TEXT DEFAULT 'pending',
                        verified_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // White-label Themes
        db.run(`
                    CREATE TABLE IF NOT EXISTS white_label_themes (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL UNIQUE,
                        display_name TEXT NOT NULL,
                        color_primary TEXT NOT NULL,
                        color_secondary TEXT NOT NULL,
                        color_accent TEXT,
                        color_background TEXT,
                        color_surface TEXT,
                        color_text TEXT,
                        font_family TEXT,
                        is_system_theme INTEGER DEFAULT 0,
                        is_active INTEGER DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Seed data
        db.run(`INSERT INTO organizations (id, name) VALUES ('org-1', 'Test Org')`, (err) =>
          err ? reject(err) : resolve()
        );
      });
    });
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM white_label_assets');
        db.run('DELETE FROM domain_verifications');
        db.run('DELETE FROM email_sender_verifications');
        db.run('DELETE FROM white_label_themes', () => resolve());
      });
    });
  });

  // ==========================================
  // ASSETS
  // ==========================================

  describe('White-label Assets', () => {
    it('should upload logo asset', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO white_label_assets (id, organization_id, asset_type, asset_url, file_size, mime_type, uploaded_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          [
            'asset-1',
            'org-1',
            'logo_light',
            'https://cdn.example.com/logo-light.png',
            45000,
            'image/png',
            'admin-1',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const asset = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM white_label_assets WHERE id = ?', ['asset-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(asset).toBeDefined();
      expect(asset.asset_type).toBe('logo_light');
      expect(asset.mime_type).toBe('image/png');
    });

    it('should store multiple asset types', async () => {
      const assetTypes = ['logo_light', 'logo_dark', 'favicon', 'login_background', 'email_header'];

      for (let i = 0; i < assetTypes.length; i++) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO white_label_assets (id, organization_id, asset_type, asset_url) VALUES (?, ?, ?, ?)`,
            [`asset-${i}`, 'org-1', assetTypes[i], `https://cdn.example.com/${assetTypes[i]}.png`],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      const assets = await new Promise<any[]>((resolve, reject) => {
        db.all(
          'SELECT * FROM white_label_assets WHERE organization_id = ?',
          ['org-1'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(assets).toHaveLength(5);
    });
  });

  // ==========================================
  // DOMAIN VERIFICATION
  // ==========================================

  describe('Domain Verification', () => {
    it('should create domain verification request', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO domain_verifications (id, organization_id, domain, verification_token)
                    VALUES (?, ?, ?, ?)
                `,
          ['dv-1', 'org-1', 'app.example.com', 'consultinity-verify-abc123'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const verification = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM domain_verifications WHERE id = ?', ['dv-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(verification).toBeDefined();
      expect(verification.domain).toBe('app.example.com');
      expect(verification.status).toBe('pending');
      expect(verification.verification_token).toBe('consultinity-verify-abc123');
    });

    it('should verify domain', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO domain_verifications (id, organization_id, domain, verification_token) VALUES (?, ?, ?, ?)`,
          ['dv-2', 'org-1', 'custom.example.com', 'token-xyz'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE domain_verifications SET status = 'verified', verified_at = ? WHERE id = ?`,
          [new Date().toISOString(), 'dv-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const verification = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM domain_verifications WHERE id = ?', ['dv-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(verification.status).toBe('verified');
      expect(verification.verified_at).not.toBeNull();
    });

    it('should enforce unique domains', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO domain_verifications (id, organization_id, domain, verification_token) VALUES (?, ?, ?, ?)`,
          ['dv-3', 'org-1', 'unique.example.com', 'token-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const result = await new Promise<boolean>((resolve) => {
        db.run(
          `INSERT INTO domain_verifications (id, organization_id, domain, verification_token) VALUES (?, ?, ?, ?)`,
          ['dv-4', 'org-1', 'unique.example.com', 'token-2'],
          (err) => {
            resolve(!!err);
          }
        );
      });

      expect(result).toBe(true);
    });
  });

  // ==========================================
  // EMAIL SENDER VERIFICATION
  // ==========================================

  describe('Email Sender Verification', () => {
    it('should create email sender verification', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO email_sender_verifications (id, organization_id, email_address, sender_name)
                    VALUES (?, ?, ?, ?)
                `,
          ['esv-1', 'org-1', 'no-reply@example.com', 'Example Corp'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const verification = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM email_sender_verifications WHERE id = ?', ['esv-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(verification).toBeDefined();
      expect(verification.email_address).toBe('no-reply@example.com');
      expect(verification.sender_name).toBe('Example Corp');
    });

    it('should verify email sender', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO email_sender_verifications (id, organization_id, email_address) VALUES (?, ?, ?)`,
          ['esv-2', 'org-1', 'notifications@example.com'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE email_sender_verifications SET status = 'verified', verified_at = ? WHERE id = ?`,
          [new Date().toISOString(), 'esv-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const verification = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM email_sender_verifications WHERE id = ?', ['esv-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(verification.status).toBe('verified');
    });
  });

  // ==========================================
  // THEMES
  // ==========================================

  describe('White-label Themes', () => {
    it('should create custom theme', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO white_label_themes (id, name, display_name, color_primary, color_secondary, font_family)
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
          ['theme-1', 'corporate_blue', 'Corporate Blue', '#1E40AF', '#3B82F6', 'Inter'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const theme = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM white_label_themes WHERE id = ?', ['theme-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(theme).toBeDefined();
      expect(theme.color_primary).toBe('#1E40AF');
      expect(theme.font_family).toBe('Inter');
    });

    it('should seed system themes', async () => {
      const systemThemes = [
        { name: 'default', display: 'Default', primary: '#3B82F6', secondary: '#10B981' },
        { name: 'dark', display: 'Dark Mode', primary: '#6366F1', secondary: '#8B5CF6' },
        { name: 'corporate', display: 'Corporate', primary: '#1E3A8A', secondary: '#1E40AF' },
        { name: 'modern', display: 'Modern', primary: '#EC4899', secondary: '#F43F5E' },
        { name: 'minimal', display: 'Minimal', primary: '#374151', secondary: '#6B7280' },
      ];

      for (const theme of systemThemes) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO white_label_themes (id, name, display_name, color_primary, color_secondary, is_system_theme) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              `theme-sys-${theme.name}`,
              theme.name,
              theme.display,
              theme.primary,
              theme.secondary,
              1,
            ],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      const themes = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM white_label_themes WHERE is_system_theme = 1', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(themes).toHaveLength(5);
    });

    it('should enforce unique theme names', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO white_label_themes (id, name, display_name, color_primary, color_secondary) VALUES (?, ?, ?, ?, ?)`,
          ['theme-u1', 'unique_theme', 'Unique', '#000', '#FFF'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const result = await new Promise<boolean>((resolve) => {
        db.run(
          `INSERT INTO white_label_themes (id, name, display_name, color_primary, color_secondary) VALUES (?, ?, ?, ?, ?)`,
          ['theme-u2', 'unique_theme', 'Unique 2', '#111', '#EEE'],
          (err) => {
            resolve(!!err);
          }
        );
      });

      expect(result).toBe(true);
    });
  });
});
