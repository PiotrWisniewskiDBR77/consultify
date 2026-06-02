-- Migration: User Onboarding Status Tracking
-- Purpose: Track enterprise onboarding flow completion (Terms → Pricing → Payment)
-- Created: 2026-01-11

-- Create user_onboarding_status table
CREATE TABLE IF NOT EXISTS user_onboarding_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Terms & Privacy
    terms_accepted BOOLEAN DEFAULT FALSE,
    terms_accepted_at TIMESTAMP,
    terms_version VARCHAR(50), -- Track which version was accepted
    privacy_accepted BOOLEAN DEFAULT FALSE,
    privacy_accepted_at TIMESTAMP,
    privacy_version VARCHAR(50),
    
    -- Pricing
    pricing_tier VARCHAR(50), -- 'starter', 'professional', 'enterprise'
    pricing_tier_selected_at TIMESTAMP,
    
    -- Payment
    payment_setup BOOLEAN DEFAULT FALSE,
    payment_setup_at TIMESTAMP,
    stripe_setup_intent_id VARCHAR(255),
    
    -- Completion
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure one record per user
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_status_user_id ON user_onboarding_status(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status_completed ON user_onboarding_status(completed);

-- Add onboarding_completed column to users table (for quick checks)
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Create index on users.onboarding_completed
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed ON users(onboarding_completed);

-- Comments for documentation
COMMENT ON TABLE user_onboarding_status IS 'Tracks enterprise onboarding flow progress for new users';
COMMENT ON COLUMN user_onboarding_status.terms_version IS 'Version of T&C accepted (e.g., "v1.0", "2026-01-11")';
COMMENT ON COLUMN user_onboarding_status.pricing_tier IS 'Selected pricing tier: starter, professional, or enterprise';
COMMENT ON COLUMN user_onboarding_status.stripe_setup_intent_id IS 'Stripe SetupIntent ID for payment method collection';
