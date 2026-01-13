import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Migration 210_sso_scim.sql', () => {
    const migrationPath = path.resolve(__dirname, '../../../../src/../migrations/210_sso_scim.sql');

    it('contains tables for sso_configs and scim_tokens', () => {
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS sso_configs');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS scim_tokens');
    });
});
