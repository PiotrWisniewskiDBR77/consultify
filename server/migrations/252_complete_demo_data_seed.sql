-- Migration: 252_complete_demo_data_seed.sql
-- Purpose: Complete demo data for 100% production readiness
-- Date: 2026-01-11
-- Areas: Documents, Signals, Platform Stats

-- ==========================================
-- 1. DEMO DOCUMENTS FOR DOCUMENT LIBRARY
-- ==========================================

-- Ensure documents table has demo data
INSERT INTO documents (id, name, type, size, url, project_id, user_id, organization_id, scope, created_at, updated_at)
SELECT 
    'doc-demo-' || seq,
    CASE seq
        WHEN 1 THEN 'Project Charter.pdf'
        WHEN 2 THEN 'Requirements Specification.docx'
        WHEN 3 THEN 'Technical Architecture.pdf'
        WHEN 4 THEN 'Risk Assessment Matrix.xlsx'
        WHEN 5 THEN 'Sprint Backlog.xlsx'
        WHEN 6 THEN 'User Stories Document.pdf'
        WHEN 7 THEN 'API Documentation.md'
        WHEN 8 THEN 'Database Schema.png'
    END,
    CASE seq
        WHEN 1 THEN 'application/pdf'
        WHEN 2 THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        WHEN 3 THEN 'application/pdf'
        WHEN 4 THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        WHEN 5 THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        WHEN 6 THEN 'application/pdf'
        WHEN 7 THEN 'text/markdown'
        WHEN 8 THEN 'image/png'
    END,
    CASE seq
        WHEN 1 THEN 245760
        WHEN 2 THEN 128512
        WHEN 3 THEN 512000
        WHEN 4 THEN 98304
        WHEN 5 THEN 65536
        WHEN 6 THEN 184320
        WHEN 7 THEN 32768
        WHEN 8 THEN 1048576
    END,
    '/uploads/demo/doc-' || seq || '.pdf',
    (SELECT id FROM projects WHERE name LIKE '%Digital%' OR name LIKE '%Transformation%' LIMIT 1),
    (SELECT id FROM users WHERE email = 'admin@dbr77.com' LIMIT 1),
    (SELECT id FROM organizations WHERE slug = 'dbr77' LIMIT 1),
    'project',
    datetime('now', '-' || (8 - seq) || ' days'),
    datetime('now', '-' || (8 - seq) || ' days')
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8)
WHERE NOT EXISTS (SELECT 1 FROM documents WHERE id LIKE 'doc-demo-%');

-- User personal documents
INSERT INTO documents (id, name, type, size, url, project_id, user_id, organization_id, scope, created_at, updated_at)
SELECT 
    'doc-user-' || seq,
    CASE seq
        WHEN 1 THEN 'My Notes.txt'
        WHEN 2 THEN 'Meeting Notes - Jan 2026.docx'
        WHEN 3 THEN 'Personal Checklist.xlsx'
    END,
    CASE seq
        WHEN 1 THEN 'text/plain'
        WHEN 2 THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        WHEN 3 THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    END,
    CASE seq WHEN 1 THEN 4096 WHEN 2 THEN 32768 WHEN 3 THEN 16384 END,
    '/uploads/user/doc-' || seq || '.txt',
    NULL,
    (SELECT id FROM users WHERE email = 'admin@dbr77.com' LIMIT 1),
    (SELECT id FROM organizations WHERE slug = 'dbr77' LIMIT 1),
    'user',
    datetime('now', '-' || seq || ' days'),
    datetime('now', '-' || seq || ' days')
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3)
WHERE NOT EXISTS (SELECT 1 FROM documents WHERE id LIKE 'doc-user-%');

-- ==========================================
-- 2. DEMO SIGNALS FOR SIGNAL CENTER
-- ==========================================

-- System Alerts
INSERT INTO notifications (id, user_id, title, message, type, priority, is_read, created_at)
SELECT 
    'signal-sys-' || seq,
    (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1),
    CASE seq
        WHEN 1 THEN 'High CPU Usage Alert'
        WHEN 2 THEN 'Database Connection Pool Warning'
        WHEN 3 THEN 'SSL Certificate Expiring Soon'
    END,
    CASE seq
        WHEN 1 THEN 'Server CPU usage exceeded 85% threshold for 15 minutes. Consider scaling resources.'
        WHEN 2 THEN 'Database connection pool utilization at 78%. Monitor for potential bottlenecks.'
        WHEN 3 THEN 'SSL certificate for api.consultinity.com expires in 30 days. Renewal recommended.'
    END,
    'SYSTEM_ALERT',
    CASE seq WHEN 1 THEN 'critical' WHEN 2 THEN 'warning' WHEN 3 THEN 'info' END,
    0,
    datetime('now', '-' || seq || ' hours')
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3)
WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE type = 'SYSTEM_ALERT' AND id LIKE 'signal-sys-%');

-- Client Tickets
INSERT INTO notifications (id, user_id, title, message, type, priority, is_read, created_at)
SELECT 
    'signal-client-' || seq,
    (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1),
    CASE seq
        WHEN 1 THEN 'Support Request: Login Issues'
        WHEN 2 THEN 'Feature Request: Export to PDF'
        WHEN 3 THEN 'Bug Report: Dashboard Loading'
    END,
    CASE seq
        WHEN 1 THEN 'User from TechnoLex SA reports intermittent login failures. Priority: High'
        WHEN 2 THEN 'Multiple users requesting PDF export functionality for reports. Priority: Medium'
        WHEN 3 THEN 'Dashboard widgets taking >5s to load for enterprise accounts. Priority: High'
    END,
    'CLIENT_TICKET',
    CASE seq WHEN 1 THEN 'high' WHEN 2 THEN 'medium' WHEN 3 THEN 'high' END,
    0,
    datetime('now', '-' || (seq * 2) || ' hours')
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3)
WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE type = 'CLIENT_TICKET' AND id LIKE 'signal-client-%');

-- User Feedback
INSERT INTO notifications (id, user_id, title, message, type, priority, is_read, created_at)
SELECT 
    'signal-feedback-' || seq,
    (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1),
    CASE seq
        WHEN 1 THEN 'NPS Score: 9 - Excellent Product'
        WHEN 2 THEN 'Feature Suggestion: Dark Mode'
        WHEN 3 THEN 'Usability Feedback: Navigation'
    END,
    CASE seq
        WHEN 1 THEN 'User rated 9/10: "Great tool for transformation management. Very intuitive interface."'
        WHEN 2 THEN 'User suggests adding dark mode option for better eye comfort during long sessions.'
        WHEN 3 THEN 'User feedback: "Would appreciate breadcrumb navigation for deeper module pages."'
    END,
    'USER_FEEDBACK',
    'normal',
    0,
    datetime('now', '-' || (seq * 3) || ' hours')
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3)
WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE type = 'USER_FEEDBACK' AND id LIKE 'signal-feedback-%');

-- ==========================================
-- 3. ENSURE DBR77 ORGANIZATION HAS USERS
-- ==========================================

-- Update user counts for organizations
UPDATE organizations 
SET user_count = (SELECT COUNT(*) FROM users WHERE organization_id = organizations.id)
WHERE user_count IS NULL OR user_count = 0;

-- Ensure at least the demo org has proper counts
UPDATE organizations
SET 
    user_count = COALESCE(user_count, 3),
    status = 'active',
    plan = 'enterprise'
WHERE slug = 'dbr77';

-- ==========================================
-- 4. PLATFORM STATS ENHANCEMENT
-- ==========================================

-- Ensure login_history has demo entries
INSERT INTO login_history (id, user_id, ip_address, user_agent, status, created_at)
SELECT 
    'login-demo-' || seq,
    (SELECT id FROM users WHERE email = 'admin@dbr77.com' LIMIT 1),
    '192.168.1.' || (100 + seq),
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'success',
    datetime('now', '-' || seq || ' hours')
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5)
WHERE NOT EXISTS (SELECT 1 FROM login_history WHERE id LIKE 'login-demo-%');

-- Ensure activity_logs has demo entries
INSERT INTO activity_logs (id, user_id, organization_id, action, resource_type, resource_id, details, ip_address, created_at)
SELECT 
    'activity-demo-' || seq,
    (SELECT id FROM users WHERE email = 'admin@dbr77.com' LIMIT 1),
    (SELECT id FROM organizations WHERE slug = 'dbr77' LIMIT 1),
    CASE seq
        WHEN 1 THEN 'user.login'
        WHEN 2 THEN 'project.view'
        WHEN 3 THEN 'assessment.create'
        WHEN 4 THEN 'initiative.update'
        WHEN 5 THEN 'report.generate'
        WHEN 6 THEN 'settings.update'
        WHEN 7 THEN 'document.upload'
        WHEN 8 THEN 'ai.chat'
    END,
    CASE seq
        WHEN 1 THEN 'user'
        WHEN 2 THEN 'project'
        WHEN 3 THEN 'assessment'
        WHEN 4 THEN 'initiative'
        WHEN 5 THEN 'report'
        WHEN 6 THEN 'settings'
        WHEN 7 THEN 'document'
        WHEN 8 THEN 'ai_session'
    END,
    'resource-' || seq,
    '{"source": "demo_seed", "module": "superadmin"}',
    '192.168.1.100',
    datetime('now', '-' || (seq * 30) || ' minutes')
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8)
WHERE NOT EXISTS (SELECT 1 FROM activity_logs WHERE id LIKE 'activity-demo-%');

-- ==========================================
-- 5. AI USAGE LOGS FOR METRICS
-- ==========================================

INSERT INTO ai_usage_logs (id, user_id, organization_id, provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, action_type, created_at)
SELECT 
    'ai-usage-demo-' || seq,
    (SELECT id FROM users WHERE email = 'admin@dbr77.com' LIMIT 1),
    (SELECT id FROM organizations WHERE slug = 'dbr77' LIMIT 1),
    CASE (seq % 3) WHEN 0 THEN 'openai' WHEN 1 THEN 'anthropic' ELSE 'google' END,
    CASE (seq % 3) WHEN 0 THEN 'gpt-4' WHEN 1 THEN 'claude-3' ELSE 'gemini-pro' END,
    (seq * 100) + 50,
    (seq * 50) + 25,
    (seq * 150) + 75,
    ((seq * 150) + 75) * 0.00002,
    CASE (seq % 4) WHEN 0 THEN 'chat' WHEN 1 THEN 'analysis' WHEN 2 THEN 'generation' ELSE 'summary' END,
    datetime('now', '-' || seq || ' hours')
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10)
WHERE NOT EXISTS (SELECT 1 FROM ai_usage_logs WHERE id LIKE 'ai-usage-demo-%');

-- ==========================================
-- 6. CONVERSION EVENTS FOR METRICS
-- ==========================================

INSERT INTO conversion_events (id, organization_id, event_type, value, metadata, created_at)
SELECT 
    'conv-demo-' || seq,
    (SELECT id FROM organizations WHERE slug = 'dbr77' LIMIT 1),
    CASE (seq % 5)
        WHEN 0 THEN 'trial_started'
        WHEN 1 THEN 'feature_used'
        WHEN 2 THEN 'upgrade_viewed'
        WHEN 3 THEN 'plan_changed'
        ELSE 'payment_completed'
    END,
    CASE (seq % 5)
        WHEN 3 THEN 299.00
        WHEN 4 THEN 599.00
        ELSE 0
    END,
    '{"source": "demo", "campaign": "organic"}',
    datetime('now', '-' || seq || ' days')
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7)
WHERE NOT EXISTS (SELECT 1 FROM conversion_events WHERE id LIKE 'conv-demo-%');

-- ==========================================
-- 7. HELP PROGRESS FOR ANALYTICS
-- ==========================================

INSERT INTO help_progress (id, user_id, playbook_key, step_index, total_steps, started_at, completion_percentage)
SELECT 
    'help-prog-' || seq,
    (SELECT id FROM users WHERE email = 'admin@dbr77.com' LIMIT 1),
    CASE seq
        WHEN 1 THEN 'getting-started'
        WHEN 2 THEN 'first-assessment'
        WHEN 3 THEN 'create-initiative'
        WHEN 4 THEN 'generate-report'
        WHEN 5 THEN 'ai-assistant-intro'
    END,
    CASE seq WHEN 1 THEN 5 WHEN 2 THEN 3 WHEN 3 THEN 2 WHEN 4 THEN 4 WHEN 5 THEN 1 END,
    CASE seq WHEN 1 THEN 5 WHEN 2 THEN 5 WHEN 3 THEN 4 WHEN 4 THEN 6 WHEN 5 THEN 3 END,
    datetime('now', '-' || (seq * 2) || ' days'),
    CASE seq WHEN 1 THEN 100 WHEN 2 THEN 60 WHEN 3 THEN 50 WHEN 4 THEN 67 WHEN 5 THEN 33 END
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5)
WHERE NOT EXISTS (SELECT 1 FROM help_progress WHERE id LIKE 'help-prog-%');

-- ==========================================
-- 8. CHURN WARNINGS FOR METRICS
-- ==========================================

INSERT INTO churn_warnings (id, organization_id, warning_type, severity, message, detected_at, resolved_at)
SELECT 
    'churn-warn-' || seq,
    (SELECT id FROM organizations ORDER BY RANDOM() LIMIT 1),
    CASE seq
        WHEN 1 THEN 'low_engagement'
        WHEN 2 THEN 'payment_failed'
        WHEN 3 THEN 'feature_unused'
    END,
    CASE seq WHEN 1 THEN 'medium' WHEN 2 THEN 'high' WHEN 3 THEN 'low' END,
    CASE seq
        WHEN 1 THEN 'User engagement dropped 40% in last 30 days'
        WHEN 2 THEN 'Payment method declined - retry scheduled'
        WHEN 3 THEN 'Key features unused for 2 weeks'
    END,
    datetime('now', '-' || (seq * 3) || ' days'),
    CASE WHEN seq = 2 THEN datetime('now', '-1 day') ELSE NULL END
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3)
WHERE NOT EXISTS (SELECT 1 FROM churn_warnings WHERE id LIKE 'churn-warn-%');

-- ==========================================
-- 9. FEEDBACK ENTRIES
-- ==========================================

INSERT INTO feedback (id, user_id, organization_id, type, category, title, content, status, created_at)
SELECT 
    'feedback-demo-' || seq,
    (SELECT id FROM users WHERE email = 'admin@dbr77.com' LIMIT 1),
    (SELECT id FROM organizations WHERE slug = 'dbr77' LIMIT 1),
    CASE (seq % 3) WHEN 0 THEN 'BUG' WHEN 1 THEN 'IDEA' ELSE 'PULSE' END,
    CASE (seq % 4) WHEN 0 THEN 'usability' WHEN 1 THEN 'performance' WHEN 2 THEN 'feature' ELSE 'other' END,
    CASE seq
        WHEN 1 THEN 'Dark mode request'
        WHEN 2 THEN 'Export to Excel feature'
        WHEN 3 THEN 'Dashboard loading speed'
        WHEN 4 THEN 'Mobile responsiveness'
        WHEN 5 THEN 'Great AI assistant!'
    END,
    CASE seq
        WHEN 1 THEN 'Would love to have a dark mode option for extended work sessions.'
        WHEN 2 THEN 'Please add ability to export reports directly to Excel format.'
        WHEN 3 THEN 'Dashboard takes a bit long to load with many widgets.'
        WHEN 4 THEN 'Some pages dont render well on tablet devices.'
        WHEN 5 THEN 'The AI assistant is incredibly helpful for generating reports!'
    END,
    CASE (seq % 3) WHEN 0 THEN 'new' WHEN 1 THEN 'in_progress' ELSE 'resolved' END,
    datetime('now', '-' || seq || ' days')
FROM (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5)
WHERE NOT EXISTS (SELECT 1 FROM feedback WHERE id LIKE 'feedback-demo-%');

-- ==========================================
-- DONE: Complete demo data seeded
-- ==========================================
