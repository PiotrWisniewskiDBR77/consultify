/**
 * PostgreSQL Schema Migration
 * 
 * Run this script to migrate from SQLite to PostgreSQL:
 * DATABASE_URL=postgres://... node server/scripts/migrate-to-postgres.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
    console.error('ERROR: DATABASE_URL must be a PostgreSQL connection string');
    process.exit(1);
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const schema = `
-- ================================================
-- CONSULTIFY PostgreSQL Schema
-- Generated from SQLite schema
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    industry TEXT DEFAULT 'General',
    active_llm_provider_id UUID,
    discount_percent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT,
    status TEXT DEFAULT 'active',
    avatar_url TEXT,
    token_limit INTEGER DEFAULT 100000,
    token_used INTEGER DEFAULT 0,
    token_reset_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    data JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    lead_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(team_id, user_id)
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    initiative_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date TIMESTAMP,
    estimated_hours REAL,
    checklist JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    task_type TEXT DEFAULT 'execution',
    step_phase TEXT DEFAULT 'design',
    why TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Initiatives
CREATE TABLE IF NOT EXISTS initiatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    axis TEXT,
    area TEXT,
    summary TEXT,
    hypothesis TEXT,
    status TEXT DEFAULT 'step3',
    current_stage TEXT,
    business_value TEXT,
    competencies_required JSONB,
    cost_capex REAL,
    cost_opex REAL,
    expected_roi REAL,
    social_impact TEXT,
    start_date TIMESTAMP,
    pilot_end_date TIMESTAMP,
    end_date TIMESTAMP,
    owner_business_id UUID REFERENCES users(id) ON DELETE SET NULL,
    owner_execution_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sponsor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    market_context TEXT,
    problem_statement TEXT,
    deliverables JSONB DEFAULT '[]',
    success_criteria JSONB DEFAULT '[]',
    scope_in JSONB DEFAULT '[]',
    scope_out JSONB DEFAULT '[]',
    key_risks JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LLM Providers
CREATE TABLE IF NOT EXISTS llm_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    provider TEXT,
    api_key TEXT,
    endpoint TEXT,
    model_id TEXT,
    cost_per_1k REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    visibility TEXT DEFAULT 'admin'
);

-- Revoked Tokens (JWT Blacklist)
CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT DEFAULT 'logout'
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    price_monthly REAL NOT NULL,
    token_limit INTEGER,
    storage_limit_gb REAL,
    token_overage_rate REAL,
    storage_overage_rate REAL,
    stripe_price_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization Billing
CREATE TABLE IF NOT EXISTS organization_billing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_plan_id UUID REFERENCES subscription_plans(id),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    billing_email TEXT,
    billing_address TEXT,
    payment_method_last4 TEXT,
    payment_method_brand TEXT,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_initiatives_org ON initiatives(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);
`;

async function migrate() {
    console.log('🚀 Starting PostgreSQL migration...');

    try {
        await pool.query(schema);
        console.log('✅ Schema created successfully!');

        console.log('\n📋 Next steps:');
        console.log('1. Update .env.production with DATABASE_URL');
        console.log('2. Migrate data from SQLite using a data export script');
        console.log('3. Restart the application');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
