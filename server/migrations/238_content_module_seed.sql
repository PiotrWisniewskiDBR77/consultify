-- Migration: 238_content_module_seed.sql
-- Content Module Demo Data Seed
-- Created: 2026-01-10
-- Description: Seeds comprehensive demo data for Email Templates and Playbook Templates

-- ==========================================
-- 1. SEED EMAIL TEMPLATES
-- ==========================================

-- Welcome Email Template
INSERT OR IGNORE INTO email_templates (
    id, template_key, name, subject, body_html, body_text, variables,
    status, version, category_id, language_code, usage_count, is_active, is_default,
    created_at, updated_at
) VALUES (
    'tpl_welcome_new',
    'welcome_new_user',
    'Welcome New User',
    'Welcome to {{app_name}}, {{user_name}}!',
    '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to {{app_name}}!</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="color: #334155; font-size: 16px;">Hi {{user_name}},</p>
            <p style="color: #64748b; line-height: 1.6;">Thank you for joining {{app_name}}. We''re excited to have you on board!</p>
            <p style="color: #64748b; line-height: 1.6;">Your account has been created and you can now start exploring all the features available to you.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{login_url}}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Started</a>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">If you have any questions, feel free to reach out to our support team.</p>
        </div>
    </div>',
    'Hi {{user_name}},

Welcome to {{app_name}}! Thank you for joining us.

Your account has been created and you can now start exploring.

Get started: {{login_url}}

If you have any questions, reach out to our support team.',
    '["app_name", "user_name", "login_url"]',
    'PUBLISHED', 1, NULL, 'en', 245, 1, 0,
    datetime('now', '-30 days'), datetime('now', '-5 days')
);

-- Password Reset Template
INSERT OR IGNORE INTO email_templates (
    id, template_key, name, subject, body_html, body_text, variables,
    status, version, category_id, language_code, usage_count, is_active, is_default,
    created_at, updated_at
) VALUES (
    'tpl_password_reset_v2',
    'password_reset_v2',
    'Password Reset Request',
    'Reset your password for {{app_name}}',
    '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e293b; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔐 Password Reset</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
            <p style="color: #334155;">Hi {{user_name}},</p>
            <p style="color: #64748b;">We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{reset_url}}" style="background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">This link expires in {{expires_in}}.</p>
            <p style="color: #94a3b8; font-size: 14px;">If you didn''t request this, please ignore this email.</p>
        </div>
    </div>',
    'Hi {{user_name}},

We received a request to reset your password.

Reset your password: {{reset_url}}

This link expires in {{expires_in}}.

If you didn''t request this, please ignore this email.',
    '["user_name", "reset_url", "expires_in", "app_name"]',
    'PUBLISHED', 2, NULL, 'en', 89, 1, 0,
    datetime('now', '-60 days'), datetime('now', '-2 days')
);

-- Weekly Report Template
INSERT OR IGNORE INTO email_templates (
    id, template_key, name, subject, body_html, body_text, variables,
    status, version, category_id, language_code, usage_count, is_active, is_default,
    created_at, updated_at
) VALUES (
    'tpl_weekly_report',
    'weekly_digest',
    'Weekly Activity Report',
    'Your Weekly Report for {{week_start}} - {{week_end}}',
    '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #10b981; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">📊 Weekly Report</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">{{week_start}} - {{week_end}}</p>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0;">
            <h2 style="color: #334155; margin-top: 0;">Hi {{user_name}},</h2>
            <p style="color: #64748b;">Here''s a summary of your activity this week:</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #64748b;">Tasks Completed</span>
                    <span style="color: #10b981; font-weight: bold;">{{tasks_completed}}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #64748b;">Initiatives Progress</span>
                    <span style="color: #3b82f6; font-weight: bold;">{{initiatives_progress}}%</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #64748b;">AI Interactions</span>
                    <span style="color: #8b5cf6; font-weight: bold;">{{ai_interactions}}</span>
                </div>
            </div>
        </div>
        <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
            <a href="{{dashboard_url}}" style="color: #3b82f6; text-decoration: none; font-weight: 500;">View Full Dashboard →</a>
        </div>
    </div>',
    'Weekly Report for {{week_start}} - {{week_end}}

Hi {{user_name}},

Tasks Completed: {{tasks_completed}}
Initiatives Progress: {{initiatives_progress}}%
AI Interactions: {{ai_interactions}}

View Dashboard: {{dashboard_url}}',
    '["user_name", "week_start", "week_end", "tasks_completed", "initiatives_progress", "ai_interactions", "dashboard_url"]',
    'PUBLISHED', 1, NULL, 'en', 1250, 1, 0,
    datetime('now', '-45 days'), datetime('now', '-1 days')
);

-- Alert Notification Template
INSERT OR IGNORE INTO email_templates (
    id, template_key, name, subject, body_html, body_text, variables,
    status, version, category_id, language_code, usage_count, is_active, is_default,
    created_at, updated_at
) VALUES (
    'tpl_alert_notification',
    'system_alert',
    'System Alert Notification',
    '[{{alert_level}}] {{alert_title}}',
    '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: {{alert_color}}; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ {{alert_title}}</h1>
        </div>
        <div style="background: white; padding: 25px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
            <p style="color: #334155;">{{alert_message}}</p>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <strong style="color: #92400e;">Action Required:</strong>
                <p style="color: #78350f; margin: 5px 0 0 0;">{{action_required}}</p>
            </div>
            <p style="color: #94a3b8; font-size: 13px;">Alert generated at: {{timestamp}}</p>
        </div>
    </div>',
    '[{{alert_level}}] {{alert_title}}

{{alert_message}}

Action Required: {{action_required}}

Timestamp: {{timestamp}}',
    '["alert_level", "alert_title", "alert_message", "alert_color", "action_required", "timestamp"]',
    'PUBLISHED', 1, NULL, 'en', 78, 1, 0,
    datetime('now', '-20 days'), datetime('now', '-3 days')
);

-- Draft Template (for testing)
INSERT OR IGNORE INTO email_templates (
    id, template_key, name, subject, body_html, body_text, variables,
    status, version, category_id, language_code, usage_count, is_active, is_default,
    created_at, updated_at
) VALUES (
    'tpl_draft_promo',
    'promotional_draft',
    'Promotional Campaign (Draft)',
    '🎉 Special Offer Just for You!',
    '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 40px; text-align: center; border-radius: 8px;">
            <h1 style="color: white; margin: 0;">🎉 Special Offer!</h1>
            <p style="color: rgba(255,255,255,0.9); font-size: 18px;">{{offer_description}}</p>
            <a href="{{offer_url}}" style="display: inline-block; background: white; color: #ef4444; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px;">Claim Offer</a>
        </div>
    </div>',
    '🎉 Special Offer: {{offer_description}}

Claim your offer: {{offer_url}}',
    '["offer_description", "offer_url", "expires_at"]',
    'DRAFT', 1, NULL, 'en', 0, 1, 0,
    datetime('now', '-5 days'), datetime('now', '-1 days')
);

-- Invitation Template
INSERT OR IGNORE INTO email_templates (
    id, template_key, name, subject, body_html, body_text, variables,
    status, version, category_id, language_code, usage_count, is_active, is_default,
    created_at, updated_at
) VALUES (
    'tpl_team_invite',
    'team_invitation',
    'Team Invitation',
    '{{inviter_name}} invited you to join {{org_name}}',
    '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6366f1; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">You''re Invited! 🎊</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
            <p style="color: #334155; font-size: 16px;"><strong>{{inviter_name}}</strong> has invited you to join <strong>{{org_name}}</strong> on {{app_name}}.</p>
            <p style="color: #64748b;">Join your team and start collaborating on transformation initiatives.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{invite_url}}" style="background: #6366f1; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
            </div>
            <p style="color: #94a3b8; font-size: 13px;">This invitation expires in 7 days.</p>
        </div>
    </div>',
    '{{inviter_name}} invited you to join {{org_name}} on {{app_name}}.

Accept your invitation: {{invite_url}}

This invitation expires in 7 days.',
    '["inviter_name", "org_name", "app_name", "invite_url"]',
    'PUBLISHED', 1, NULL, 'en', 156, 1, 0,
    datetime('now', '-40 days'), datetime('now', '-7 days')
);

-- ==========================================
-- 2. SEED AI PLAYBOOK TEMPLATES
-- ==========================================

INSERT OR IGNORE INTO ai_playbook_templates (
    id, key, title, description, trigger_signal, template_graph,
    estimated_duration_mins, status, version, usage_count, success_rate,
    created_at, updated_at
) VALUES (
    'tpl_risk_mitigation',
    'risk_mitigation_workflow',
    'Project Risk Mitigation',
    'Automated workflow for identifying and mitigating project risks. Triggers when risk levels exceed threshold.',
    'project_risk_high',
    '{"nodes":[{"id":"trigger","type":"trigger","data":{"label":"Risk Alert Trigger"},"position":{"x":100,"y":100}},{"id":"analyze","type":"action","data":{"label":"Analyze Risk Factors","actionType":"analyze"},"position":{"x":100,"y":200}},{"id":"generate","type":"action","data":{"label":"Generate Mitigation Plan","actionType":"generate"},"position":{"x":100,"y":300}},{"id":"notify","type":"action","data":{"label":"Notify Stakeholders","actionType":"notify"},"position":{"x":100,"y":400}},{"id":"end","type":"end","data":{"label":"Complete"},"position":{"x":100,"y":500}}],"edges":[{"id":"e1","source":"trigger","target":"analyze"},{"id":"e2","source":"analyze","target":"generate"},{"id":"e3","source":"generate","target":"notify"},{"id":"e4","source":"notify","target":"end"}]}',
    45, 'PUBLISHED', 2, 89, 0.92,
    datetime('now', '-60 days'), datetime('now', '-3 days')
);

INSERT OR IGNORE INTO ai_playbook_templates (
    id, key, title, description, trigger_signal, template_graph,
    estimated_duration_mins, status, version, usage_count, success_rate,
    created_at, updated_at
) VALUES (
    'tpl_onboarding_automation',
    'user_onboarding_flow',
    'User Onboarding Automation',
    'Guides new users through the onboarding process with personalized recommendations and setup steps.',
    'user_registered',
    '{"nodes":[{"id":"trigger","type":"trigger","data":{"label":"New User Trigger"},"position":{"x":100,"y":100}},{"id":"profile","type":"action","data":{"label":"Analyze Profile","actionType":"analyze"},"position":{"x":100,"y":200}},{"id":"recommend","type":"action","data":{"label":"Generate Recommendations","actionType":"generate"},"position":{"x":100,"y":300}},{"id":"welcome","type":"action","data":{"label":"Send Welcome Email","actionType":"email"},"position":{"x":100,"y":400}},{"id":"end","type":"end","data":{"label":"Complete"},"position":{"x":100,"y":500}}],"edges":[{"id":"e1","source":"trigger","target":"profile"},{"id":"e2","source":"profile","target":"recommend"},{"id":"e3","source":"recommend","target":"welcome"},{"id":"e4","source":"welcome","target":"end"}]}',
    15, 'PUBLISHED', 1, 234, 0.98,
    datetime('now', '-90 days'), datetime('now', '-10 days')
);

INSERT OR IGNORE INTO ai_playbook_templates (
    id, key, title, description, trigger_signal, template_graph,
    estimated_duration_mins, status, version, usage_count, success_rate,
    created_at, updated_at
) VALUES (
    'tpl_assessment_review',
    'assessment_completion_review',
    'Assessment Completion Review',
    'Reviews completed assessments, generates insights, and creates action items automatically.',
    'assessment_completed',
    '{"nodes":[{"id":"trigger","type":"trigger","data":{"label":"Assessment Complete"},"position":{"x":100,"y":100}},{"id":"analyze","type":"action","data":{"label":"Analyze Results","actionType":"analyze"},"position":{"x":100,"y":200}},{"id":"insights","type":"action","data":{"label":"Generate Insights","actionType":"generate"},"position":{"x":100,"y":300}},{"id":"actions","type":"action","data":{"label":"Create Action Items","actionType":"create_tasks"},"position":{"x":100,"y":400}},{"id":"report","type":"action","data":{"label":"Generate Report","actionType":"report"},"position":{"x":100,"y":500}},{"id":"end","type":"end","data":{"label":"Complete"},"position":{"x":100,"y":600}}],"edges":[{"id":"e1","source":"trigger","target":"analyze"},{"id":"e2","source":"analyze","target":"insights"},{"id":"e3","source":"insights","target":"actions"},{"id":"e4","source":"actions","target":"report"},{"id":"e5","source":"report","target":"end"}]}',
    30, 'PUBLISHED', 1, 156, 0.95,
    datetime('now', '-45 days'), datetime('now', '-5 days')
);

INSERT OR IGNORE INTO ai_playbook_templates (
    id, key, title, description, trigger_signal, template_graph,
    estimated_duration_mins, status, version, usage_count, success_rate,
    created_at, updated_at
) VALUES (
    'tpl_deadline_reminder',
    'deadline_approaching_workflow',
    'Deadline Reminder Workflow',
    'Sends progressive reminders as deadlines approach and escalates if tasks are overdue.',
    'deadline_approaching',
    '{"nodes":[{"id":"trigger","type":"trigger","data":{"label":"Deadline Alert"},"position":{"x":100,"y":100}},{"id":"check","type":"condition","data":{"label":"Check Days Remaining"},"position":{"x":100,"y":200}},{"id":"remind","type":"action","data":{"label":"Send Reminder","actionType":"notify"},"position":{"x":50,"y":300}},{"id":"escalate","type":"action","data":{"label":"Escalate to Manager","actionType":"escalate"},"position":{"x":200,"y":300}},{"id":"end","type":"end","data":{"label":"Complete"},"position":{"x":100,"y":400}}],"edges":[{"id":"e1","source":"trigger","target":"check"},{"id":"e2","source":"check","target":"remind","data":{"condition":"days > 2"}},{"id":"e3","source":"check","target":"escalate","data":{"condition":"days <= 2"}},{"id":"e4","source":"remind","target":"end"},{"id":"e5","source":"escalate","target":"end"}]}',
    10, 'DRAFT', 1, 0, 0,
    datetime('now', '-10 days'), datetime('now', '-2 days')
);

INSERT OR IGNORE INTO ai_playbook_templates (
    id, key, title, description, trigger_signal, template_graph,
    estimated_duration_mins, status, version, usage_count, success_rate,
    created_at, updated_at
) VALUES (
    'tpl_weekly_summary',
    'weekly_summary_generator',
    'Weekly Summary Generator',
    'Automatically compiles and sends weekly progress summaries to stakeholders.',
    'schedule_weekly',
    '{"nodes":[{"id":"trigger","type":"trigger","data":{"label":"Weekly Schedule"},"position":{"x":100,"y":100}},{"id":"collect","type":"action","data":{"label":"Collect Metrics","actionType":"query"},"position":{"x":100,"y":200}},{"id":"analyze","type":"action","data":{"label":"Analyze Progress","actionType":"analyze"},"position":{"x":100,"y":300}},{"id":"generate","type":"action","data":{"label":"Generate Summary","actionType":"generate"},"position":{"x":100,"y":400}},{"id":"send","type":"action","data":{"label":"Send to Stakeholders","actionType":"email"},"position":{"x":100,"y":500}},{"id":"end","type":"end","data":{"label":"Complete"},"position":{"x":100,"y":600}}],"edges":[{"id":"e1","source":"trigger","target":"collect"},{"id":"e2","source":"collect","target":"analyze"},{"id":"e3","source":"analyze","target":"generate"},{"id":"e4","source":"generate","target":"send"},{"id":"e5","source":"send","target":"end"}]}',
    20, 'PUBLISHED', 1, 52, 0.96,
    datetime('now', '-30 days'), datetime('now', '-1 days')
);

-- ==========================================
-- 3. SEED CONTENT CATEGORIES (if not exists)
-- ==========================================

INSERT INTO content_categories (id, name, slug, content_type, color, sort_order, is_active, created_at)
VALUES 
    ('cat_email_onboarding', 'Onboarding', 'onboarding', 'EMAIL', '#10B981', 1::integer, 1::integer, CURRENT_TIMESTAMP),
    ('cat_email_notifications', 'Notifications', 'notifications', 'EMAIL', '#6366F1', 2::integer, 1::integer, CURRENT_TIMESTAMP),
    ('cat_email_reports', 'Reports', 'reports', 'EMAIL', '#F59E0B', 3::integer, 1::integer, CURRENT_TIMESTAMP),
    ('cat_email_security', 'Security', 'security', 'EMAIL', '#EF4444', 4::integer, 1::integer, CURRENT_TIMESTAMP),
    ('cat_email_marketing', 'Marketing', 'marketing', 'EMAIL', '#8B5CF6', 5::integer, 1::integer, CURRENT_TIMESTAMP),
    ('cat_playbook_automation', 'Automation', 'automation', 'PLAYBOOK', '#3B82F6', 1::integer, 1::integer, CURRENT_TIMESTAMP),
    ('cat_playbook_workflow', 'Workflows', 'workflows', 'PLAYBOOK', '#10B981', 2::integer, 1::integer, CURRENT_TIMESTAMP),
    ('cat_playbook_notifications', 'Notifications', 'notifications', 'PLAYBOOK', '#F59E0B', 3::integer, 1::integer, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 4. SEED CONTENT TAGS (if not exists)
-- ==========================================

INSERT INTO content_tags (id, name, slug, content_type, color, usage_count, is_active, created_at)
VALUES
    ('tag_critical', 'Critical', 'critical', 'ALL', '#EF4444', 45::integer, 1::integer, CURRENT_TIMESTAMP),
    ('tag_automated', 'Automated', 'automated', 'ALL', '#3B82F6', 89::integer, 1::integer, CURRENT_TIMESTAMP),
    ('tag_production', 'Production', 'production', 'ALL', '#10B981', 156::integer, 1::integer, CURRENT_TIMESTAMP),
    ('tag_draft', 'Draft', 'draft', 'ALL', '#F59E0B', 23::integer, 1::integer, CURRENT_TIMESTAMP),
    ('tag_transactional', 'Transactional', 'transactional', 'EMAIL', '#8B5CF6', 78::integer, 1::integer, CURRENT_TIMESTAMP),
    ('tag_marketing', 'Marketing', 'marketing', 'EMAIL', '#EC4899', 34::integer, 1::integer, CURRENT_TIMESTAMP),
    ('tag_ai_powered', 'AI-Powered', 'ai-powered', 'PLAYBOOK', '#6366F1', 67::integer, 1::integer, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Log migration completion
SELECT 'Content module seed data inserted successfully' as status;
