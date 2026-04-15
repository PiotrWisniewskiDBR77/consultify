-- Partner-owned payout settings for active partner portal write continuity

ALTER TABLE partner_organizations
  ADD COLUMN IF NOT EXISTS auto_payout_enabled BOOLEAN DEFAULT FALSE;
