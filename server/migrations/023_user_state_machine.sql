-- Migration: User State Machine (Canonical Documentation v1.0 Compliance)
-- Adds user_journey_state and current_phase columns per 01_USER_STATE_MACHINE.md

-- User Journey State (7 states per documentation)
-- ANON, DEMO_SESSION, TRIAL_TRUSTED, ORG_CREATOR, ORG_MEMBER, TEAM_COLLAB, ECOSYSTEM_NODE
ALTER TABLE users ADD COLUMN user_journey_state TEXT DEFAULT 'ANON';

-- Current Phase (A-G per 00_SYSTEM_CONTRACT.md)
ALTER TABLE users ADD COLUMN current_phase TEXT DEFAULT 'A';

-- Timestamp for state changes (for audit)
ALTER TABLE users ADD COLUMN journey_state_changed_at TEXT;

-- Timestamp for phase changes (for audit)
ALTER TABLE users ADD COLUMN phase_changed_at TEXT;

-- Indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_journey_state ON users(user_journey_state);
CREATE INDEX IF NOT EXISTS idx_users_current_phase ON users(current_phase);

-- Migration logic: Map existing user_status to new journey_state
-- ACTIVE without org → ANON
-- TRIAL_ENTRY → TRIAL_TRUSTED (Phase C)
-- TRIAL_ORG → ORG_MEMBER (Phase E)
-- Users with organizations → ORG_MEMBER

UPDATE users 
SET user_journey_state = CASE
    WHEN user_status = 'TRIAL_ENTRY' THEN 'TRIAL_TRUSTED'
    WHEN user_status = 'TRIAL_ORG' THEN 'ORG_MEMBER'
    WHEN EXISTS (SELECT 1 FROM organization_members WHERE organization_members.user_id = users.id) THEN 'ORG_MEMBER'
    ELSE 'ANON'
END,
current_phase = CASE
    WHEN user_status = 'TRIAL_ENTRY' THEN 'C'
    WHEN user_status = 'TRIAL_ORG' THEN 'E'
    WHEN EXISTS (SELECT 1 FROM organization_members WHERE organization_members.user_id = users.id) THEN 'E'
    ELSE 'A'
END,
journey_state_changed_at = datetime('now'),
phase_changed_at = datetime('now')
WHERE user_journey_state IS NULL OR user_journey_state = 'ANON';
