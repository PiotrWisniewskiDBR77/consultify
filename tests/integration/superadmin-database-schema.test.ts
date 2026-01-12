/**
 * @vitest-environment node
 * 
 * SuperAdmin Database Schema Verification Test
 * Verifies all required database tables exist with correct schema for SuperAdmin
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Read the main database schema file
const sqliteActiveDbPath = path.resolve(__dirname, '../../server/database.sqlite.active.js');
const schemaContent = existsSync(sqliteActiveDbPath) ? readFileSync(sqliteActiveDbPath, 'utf-8') : '';

describe('SuperAdmin Database Schema Verification', () => {
    
    describe('Core Tables', () => {
        it('organizations table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS organizations');
        });

        it('users table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS users');
        });

        it('projects table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS projects');
        });
    });

    describe('Token & Billing Tables', () => {
        it('token_transactions table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS token_transactions');
        });

        it('token_ledger table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS token_ledger');
        });

        it('subscription_plans table should exist (in billing setup)', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS subscription_plans');
        });
    });

    describe('Organization & Members Tables', () => {
        it('organization_members table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS organization_members');
        });

        it('organization_context table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS organization_context');
        });
    });

    describe('Access Control Tables', () => {
        it('access_requests table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS access_requests');
        });

        it('access_codes table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS access_codes');
        });

        it('invitations table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS invitations');
        });
    });

    describe('Feedback Tables', () => {
        it('feedback table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS feedback');
        });
    });

    describe('Legal Tables', () => {
        it('legal_documents table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS legal_documents');
        });

        it('legal_events table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS legal_events');
        });

        it('legal_acceptances table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS legal_acceptances');
        });
    });

    describe('AI/LLM Tables', () => {
        it('ai_logs table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS ai_logs');
        });

        it('llm_providers table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS llm_providers');
        });

        it('ai_audit_logs table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS ai_audit_logs');
        });

        it('ai_usage_log table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS ai_usage_log');
        });
    });

    describe('Session & Auth Tables', () => {
        it('refresh_tokens table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS refresh_tokens');
        });

        it('revoked_tokens table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS revoked_tokens');
        });

        it('password_resets table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS password_resets');
        });
    });

    describe('Audit Tables', () => {
        it('audit_events table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS audit_events');
        });

        it('pmo_audit_trail table should exist', () => {
            expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS pmo_audit_trail');
        });
    });
});

describe('Foreign Key Relationships', () => {
    it('users should reference organizations (organization_id)', () => {
        expect(schemaContent).toContain('organization_id TEXT');
        expect(schemaContent).toContain('FOREIGN KEY(organization_id) REFERENCES organizations(id)');
    });

    it('token_transactions should reference organizations', () => {
        expect(schemaContent).toContain('FOREIGN KEY(organization_id) REFERENCES organizations(id)');
    });
});

describe('Schema File Verification', () => {
    it('database.sqlite.active.js should exist', () => {
        expect(existsSync(sqliteActiveDbPath)).toBe(true);
    });

    it('database.js should exist as wrapper', () => {
        const dbPath = path.resolve(__dirname, '../../server/database.js');
        expect(existsSync(dbPath)).toBe(true);
    });

    it('database.postgres.js should exist as alternative', () => {
        const pgPath = path.resolve(__dirname, '../../server/database.postgres.js');
        expect(existsSync(pgPath)).toBe(true);
    });
});

describe('Controller-Database Mapping', () => {
    // Read superAdminController to verify database operations
    const controllerPath = path.resolve(__dirname, '../../server/controllers/superAdminController.js');
    const controllerContent = existsSync(controllerPath) ? readFileSync(controllerPath, 'utf-8') : '';

    it('controller should exist', () => {
        expect(existsSync(controllerPath)).toBe(true);
    });

    it('controller should query organizations table', () => {
        expect(controllerContent).toContain('organizations');
    });

    it('controller should query users table', () => {
        expect(controllerContent).toContain('users');
    });

    it('controller should have access request handlers', () => {
        expect(controllerContent).toContain('getAccessRequests');
        expect(controllerContent).toContain('approveAccessRequest');
    });

    it('controller should have access code handlers', () => {
        expect(controllerContent).toContain('getAccessCodes');
        expect(controllerContent).toContain('createAccessCode');
    });

    it('controller should have legal document handlers', () => {
        expect(controllerContent).toContain('getAllLegalDocs');
        expect(controllerContent).toContain('publishLegalDoc');
    });
});
