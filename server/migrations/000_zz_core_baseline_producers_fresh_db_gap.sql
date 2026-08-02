-- Migration: 000_zz_core_baseline_producers_fresh_db_gap.sql
-- Purpose: strict-schema repair (2026-08) -- produce, for a genuinely fresh
-- Postgres database, the tables that server/src/database/PostgresDatabase.ts
-- initDb() creates inline (CREATE TABLE IF NOT EXISTS) on every real app boot,
-- but that no migration in the strict (server/scripts/migrate.postgres.ts,
-- without --safe) path ever created. On real app boot these tables already
-- exist by the time later migrations reference them, masking the gap; a bare
-- migrate.postgres.ts run (CI, isolated test containers, fresh dev DBs) has
-- no such bootstrap and previously failed with "relation ... does not exist"
-- (e.g. ai_feedback, approval_assignments, decisions, and other audit tables).
-- Content below is copied verbatim (same columns, FKs, indexes, same relative
-- order) from PostgresDatabase.ts initDb() -- not invented -- so it stays
-- byte-for-byte consistent with what the app itself considers canonical. All
-- statements are already IF NOT EXISTS, so this is a pure no-op on any DB that
-- already has these tables (bootstrapped by initDb() first, or via an
-- equivalent historical migration) -- additive only, never DROPs or resets.
--
-- Filename sorts as 000_zz... -- immediately after 000_z_core_baseline.sql
-- and before every 500+ numbered producer, so FK targets used here
-- (organizations/users/projects/tasks/initiatives/subscription_plans) are
-- guaranteed to already exist, and everything downstream that consumes these
-- 43 tables sees them from the very start of phase 0.

-- ---------------------------------------------------------------------------
-- project_ai_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_ai_settings(
            project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
            ai_role TEXT NOT NULL DEFAULT 'ADVISOR',
            regulatory_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            regulatory_prompt TEXT DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- ---------------------------------------------------------------------------
-- project_users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_users(
                project_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT DEFAULT 'member',
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(project_id, user_id),
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- task_comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_comments(
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- notification_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_settings(
                user_id TEXT PRIMARY KEY,
                settings TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- login_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_history(
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                organization_id TEXT,
                ip_address TEXT,
                user_agent TEXT,
                location TEXT,
                status TEXT DEFAULT 'success',
                failure_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- security_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_settings(
                organization_id TEXT PRIMARY KEY,
                require_2fa INTEGER DEFAULT 0,
                password_min_length INTEGER DEFAULT 8,
                password_require_uppercase INTEGER DEFAULT 1,
                password_require_number INTEGER DEFAULT 1,
                password_require_special INTEGER DEFAULT 0,
                password_expiry_days INTEGER DEFAULT 0,
                session_timeout_minutes INTEGER DEFAULT 30,
                max_sessions_per_user INTEGER DEFAULT 5,
                ip_whitelist TEXT DEFAULT '[]',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_by TEXT,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- user_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions(
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                device_info TEXT,
                ip_address TEXT,
                user_agent TEXT,
                location TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active_at TIMESTAMP,
                expires_at TIMESTAMP,
                is_current INTEGER DEFAULT 0,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- user_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences(
                user_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(user_id, key),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- demo_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demo_sessions(
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                base_org_id TEXT NOT NULL,
                session_org_id TEXT NOT NULL,
                source TEXT DEFAULT 'demo_toggle',
                status TEXT DEFAULT 'active',
                anchor_date TIMESTAMP NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(base_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(session_org_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- demo_session_tenants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demo_session_tenants(
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                tenant_org_id TEXT NOT NULL,
                base_org_id TEXT NOT NULL,
                ttl_expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES demo_sessions(id) ON DELETE CASCADE,
                FOREIGN KEY(tenant_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(base_org_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- user_2fa
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_2fa(
                user_id TEXT PRIMARY KEY,
                is_enabled INTEGER DEFAULT 0,
                enabled_at TIMESTAMP,
                secret TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- verification_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_tokens(
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                expires_at TIMESTAMP,
                used INTEGER DEFAULT 0,
                used_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- mcp_providers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcp_providers(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                config TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log(
                id TEXT PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                actor_type TEXT,
                actor_id TEXT,
                actor_email TEXT,
                actor_name TEXT,
                actor_ip TEXT,
                actor_user_agent TEXT,
                action TEXT,
                action_category TEXT,
                action_description TEXT,
                resource_type TEXT,
                resource_id TEXT,
                resource_name TEXT,
                organization_id TEXT,
                project_id TEXT,
                previous_values TEXT,
                new_values TEXT,
                changed_fields TEXT,
                metadata TEXT,
                request_id TEXT,
                result TEXT,
                error_message TEXT,
                retention_category TEXT,
                -- Compatibility columns used by auditLog.routes.ts
                user_id TEXT,
                action_type TEXT,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
            );

-- ---------------------------------------------------------------------------
-- api_keys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                name TEXT NOT NULL,
                key_prefix TEXT NOT NULL,
                key_hash TEXT NOT NULL,
                permissions TEXT NOT NULL,
                ip_whitelist TEXT,
                rate_limit INTEGER DEFAULT 100,
                expires_at TIMESTAMP,
                last_used_at TIMESTAMP,
                last_used_ip TEXT,
                rotated_from_id TEXT,
                status TEXT DEFAULT 'active',
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(rotated_from_id) REFERENCES api_keys(id) ON DELETE SET NULL
            );

-- ---------------------------------------------------------------------------
-- error_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS error_logs(
                id TEXT PRIMARY KEY,
                message TEXT,
                stack TEXT,
                context TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

-- ---------------------------------------------------------------------------
-- system_health_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_health_history(
                date TEXT PRIMARY KEY,
                avg_response_ms REAL,
                error_rate REAL,
                uptime_pct REAL
            );

-- ---------------------------------------------------------------------------
-- ai_feedback
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_feedback(
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            user_id TEXT,
            context TEXT,
            prompt TEXT,
            response TEXT,
            helpful INTEGER,
            comment TEXT,
            rating INTEGER,
            correction TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );

-- ---------------------------------------------------------------------------
-- custom_prompts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_prompts(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            context TEXT NOT NULL,
            template TEXT NOT NULL,
            variables TEXT,
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        );

-- ---------------------------------------------------------------------------
-- ai_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_logs(
            id TEXT PRIMARY KEY,
            user_id TEXT,
            action TEXT,
            model TEXT,
            input_tokens INTEGER,
            output_tokens INTEGER,
            latency_ms INTEGER,
            topic TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- ---------------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            screenshot TEXT,
            url TEXT,
            status TEXT DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT DEFAULT 'USER',
            token TEXT UNIQUE,
            token_hash TEXT UNIQUE,
            status TEXT DEFAULT 'pending',
            invited_by TEXT,
            expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            accepted_at TIMESTAMP,
            invitation_type TEXT DEFAULT 'ORG',
            project_id TEXT,
            role_to_assign TEXT,
            accepted_by_user_id TEXT,
            metadata TEXT DEFAULT '{}',
            resend_count INTEGER DEFAULT 0,
            last_resent_at TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(invited_by) REFERENCES users(id) ON DELETE SET NULL
        );

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

-- ---------------------------------------------------------------------------
-- access_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_requests(
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            phone TEXT,
            organization_id TEXT,
            organization_name TEXT,
            requested_role TEXT DEFAULT 'USER',
            status TEXT DEFAULT 'pending',
            request_type TEXT DEFAULT 'new_user',
            metadata TEXT,
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_by TEXT,
            reviewed_at TIMESTAMP,
            rejection_reason TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        );

-- ---------------------------------------------------------------------------
-- decisions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decisions (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            initiative_id TEXT,
            task_id TEXT,
            title TEXT NOT NULL,
            type TEXT DEFAULT 'APPROVAL',
            decision_maker_id TEXT,
            created_by TEXT,
            status TEXT DEFAULT 'pending',
            options TEXT DEFAULT '[]',
            criteria TEXT,
            deadline TIMESTAMP,
            escalation_deadline TIMESTAMP,
            selected_option TEXT,
            decision_rationale TEXT,
            decided_at TIMESTAMP,
            source_type TEXT,
            source_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
            FOREIGN KEY(decision_maker_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        );

CREATE INDEX IF NOT EXISTS idx_decisions_org ON decisions(organization_id);
CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_decisions_initiative ON decisions(initiative_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);

-- ---------------------------------------------------------------------------
-- initiative_dependencies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS initiative_dependencies (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            from_initiative_id TEXT NOT NULL,
            to_initiative_id TEXT NOT NULL,
            type TEXT DEFAULT 'FINISH_TO_START',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY(from_initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
            FOREIGN KEY(to_initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
        );

-- ---------------------------------------------------------------------------
-- pmo_audit_trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pmo_audit_trail (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            pmo_domain_id TEXT,
            pmo_phase TEXT,
            object_type TEXT,
            object_id TEXT,
            action TEXT,
            actor_id TEXT,
            iso21500_mapping TEXT,
            pmbok_mapping TEXT,
            prince2_mapping TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- ---------------------------------------------------------------------------
-- usage_records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_records(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT,
            type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            action TEXT,
            metadata TEXT,
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );

-- ---------------------------------------------------------------------------
-- usage_summaries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_summaries(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            tokens_used INTEGER DEFAULT 0,
            tokens_included INTEGER DEFAULT 0,
            tokens_overage INTEGER DEFAULT 0,
            storage_bytes_peak INTEGER DEFAULT 0,
            storage_gb_included REAL DEFAULT 0,
            storage_gb_overage REAL DEFAULT 0,
            overage_amount REAL DEFAULT 0,
            billed INTEGER DEFAULT 0,
            stripe_invoice_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(organization_id, period_start)
        );

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            source TEXT DEFAULT 'stripe',
            stripe_invoice_id TEXT UNIQUE,
            invoice_number TEXT,
            subtotal REAL,
            tax_amount REAL,
            total REAL,
            amount_paid REAL,
            amount_due REAL,
            currency TEXT DEFAULT 'usd',
            status TEXT,
            due_date TIMESTAMP,
            paid_at TIMESTAMP,
            period_start DATE,
            period_end DATE,
            pdf_url TEXT,
            line_items TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );

-- ---------------------------------------------------------------------------
-- plan_features
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plan_features(
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            feature_key TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            limit_value INTEGER,
            FOREIGN KEY(plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
        );

-- ---------------------------------------------------------------------------
-- billing_margins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_margins(
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL UNIQUE,
            display_name TEXT,
            base_cost_per_1k REAL DEFAULT 0,
            margin_percent REAL NOT NULL,
            min_charge REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- ---------------------------------------------------------------------------
-- token_packages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS token_packages(
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            tokens INTEGER NOT NULL,
            price_usd REAL NOT NULL,
            stripe_price_id TEXT,
            bonus_percent INTEGER DEFAULT 0,
            is_popular INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- ---------------------------------------------------------------------------
-- user_token_balance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_token_balance(
            user_id TEXT PRIMARY KEY,
            platform_tokens INTEGER DEFAULT 0,
            platform_tokens_bonus INTEGER DEFAULT 0,
            byok_usage_tokens INTEGER DEFAULT 0,
            local_usage_tokens INTEGER DEFAULT 0,
            lifetime_purchased INTEGER DEFAULT 0,
            lifetime_used INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

-- ---------------------------------------------------------------------------
-- token_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS token_transactions(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            type TEXT NOT NULL,
            source_type TEXT,
            tokens INTEGER NOT NULL,
            cost_usd REAL DEFAULT 0,
            margin_usd REAL DEFAULT 0,
            net_revenue_usd REAL DEFAULT 0,
            stripe_payment_id TEXT,
            package_id TEXT,
            llm_provider TEXT,
            model_used TEXT,
            description TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(package_id) REFERENCES token_packages(id) ON DELETE SET NULL
        );

-- ---------------------------------------------------------------------------
-- user_api_keys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_api_keys(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            provider TEXT NOT NULL,
            display_name TEXT,
            encrypted_key TEXT NOT NULL,
            model_preference TEXT,
            scopes TEXT DEFAULT '[]',
            expires_at TIMESTAMP,
            rate_limit_per_minute INTEGER,
            rate_limit_per_day INTEGER,
            quota_used INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            is_default INTEGER DEFAULT 0,
            usage_count INTEGER DEFAULT 0,
            last_used_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );

-- ---------------------------------------------------------------------------
-- gdpr_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gdpr_requests(
            id VARCHAR(36) PRIMARY KEY,
            organization_id VARCHAR(36) NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            type VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL,
            result_url TEXT,
            processed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON gdpr_requests(user_id);

-- ---------------------------------------------------------------------------
-- user_consents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_consents(
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id),
            organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id),
            consent_type VARCHAR(100) NOT NULL,
            consent_version VARCHAR(50),
            consent_status VARCHAR(50) NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            granted_at TIMESTAMP,
            withdrawn_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, organization_id, consent_type)
        );

CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id);

-- ---------------------------------------------------------------------------
-- ai_ideas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_ideas(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT 'new',
            priority VARCHAR(50) DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- ---------------------------------------------------------------------------
-- ai_observations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_observations(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            content TEXT NOT NULL,
            category VARCHAR(50),
            confidence_score REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- ---------------------------------------------------------------------------
-- approval_assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_assignments(
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            proposal_id TEXT NOT NULL,
            assigned_to_user_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            sla_due_at TIMESTAMP NOT NULL,
            escalated_to_user_id TEXT,
            escalated_at TIMESTAMP,
            escalation_reason TEXT,
            acked_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(escalated_to_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

-- ---------------------------------------------------------------------------
-- mfa_attempts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mfa_attempts(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            attempt_type TEXT NOT NULL CHECK(attempt_type IN('TOTP', 'BACKUP_CODE', 'SMS', 'EMAIL')),
            success INTEGER NOT NULL DEFAULT 0,
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

-- ---------------------------------------------------------------------------
-- trusted_devices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trusted_devices(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_fingerprint TEXT NOT NULL,
            device_name TEXT,
            last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, device_fingerprint)
        );

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);

-- ---------------------------------------------------------------------------
-- scheduled_emails
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_emails(
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            recipients TEXT NOT NULL,
            scheduled_time TIMESTAMP NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING', 'SENT', 'FAILED')),
            sent_at TIMESTAMP,
            error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
