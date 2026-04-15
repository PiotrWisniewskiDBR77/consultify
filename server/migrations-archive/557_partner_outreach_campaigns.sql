-- Bundle 28 (T098) — Partner Outreach Campaigns (superadmin)

CREATE TABLE IF NOT EXISTS partner_outreach_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  first_name TEXT,
  last_name TEXT,
  country TEXT,
  region TEXT,
  source TEXT,
  lawful_basis TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suppressed', 'bounced')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_outreach_unsubscribes (
  email TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  from_name TEXT,
  from_email TEXT,
  reply_to TEXT,
  sending_window JSONB DEFAULT '{}'::jsonb,
  throttle_policy JSONB DEFAULT '{}'::jsonb,
  segment_query JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_partner_outreach_campaigns_status
  ON partner_outreach_campaigns(status, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_outreach_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES partner_outreach_campaigns(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  template_version_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, step_order)
);

CREATE TABLE IF NOT EXISTS partner_outreach_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES partner_outreach_campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES partner_outreach_leads(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'unsubscribed')),
  current_step INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_outreach_enrollments_next_send
  ON partner_outreach_enrollments(status, next_send_at);

CREATE TABLE IF NOT EXISTS partner_outreach_message_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES partner_outreach_campaigns(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES partner_outreach_steps(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES partner_outreach_enrollments(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES partner_outreach_leads(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  tracking_token TEXT NOT NULL UNIQUE,
  unsubscribe_token TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_outreach_message_instances_campaign_time
  ON partner_outreach_message_instances(campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_outreach_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES partner_outreach_campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES partner_outreach_leads(id) ON DELETE CASCADE,
  message_instance_id UUID REFERENCES partner_outreach_message_instances(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('sent', 'opened', 'clicked', 'unsubscribed', 'bounced')),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_outreach_events_campaign_time
  ON partner_outreach_events(campaign_id, created_at DESC);

