-- Demo Feedback Data for Enterprise SaaS Feedback System
-- Run: sqlite3 server/consultinity.db < server/seed/feedback_demo_data.sql

-- Clear existing demo data
DELETE FROM feedback_analysis WHERE feedback_id LIKE 'demo-%';
DELETE FROM system_feedback WHERE id LIKE 'demo-%';
DELETE FROM feedback_pulse WHERE id LIKE 'demo-%';
DELETE FROM feature_votes WHERE feature_id LIKE 'demo-%';
DELETE FROM feature_requests WHERE id LIKE 'demo-%';
DELETE FROM feedback_trending_topics;

-- ==================== SYSTEM FEEDBACK ====================

-- BUG: Critical - PDF Export Crash
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, severity, status, priority, metadata, created_at)
VALUES ('demo-fb-001', 'demo-user-1', 'jan.kowalski@acme.pl', 'Jan Kowalski', 'BUG',
        'Application crashes when exporting large assessment reports (>50 pages) to PDF. The browser freezes and eventually shows "Page Unresponsive" error. This is blocking our quarterly review process.',
        'CRITICAL', 'IN_PROGRESS', 'critical',
        '{"context":"/reports/export","browser":"Chrome 120","screenSize":"1920x1080"}',
        datetime('now', '-2 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-001', 'demo-fb-001', 'negative', -0.8, '["stability","performance"]', '["crashes","export","reports","freezes"]', 'critical', 95,
        '["Create urgent bug ticket","Investigate memory leak","Notify affected users"]',
        'Critical bug: PDF export crashes on large reports, blocking quarterly reviews.', datetime('now', '-2 days'));

-- BUG: High - SSO Login Issues
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, severity, status, priority, metadata, created_at)
VALUES ('demo-fb-002', 'demo-user-2', 'anna.nowak@techcorp.com', 'Anna Nowak', 'BUG',
        'Login fails intermittently with SSO. About 20% of login attempts result in "Session expired" error even with fresh credentials. Users have to try 2-3 times to get in.',
        'HIGH', 'NEW', 'high',
        '{"context":"/login","browser":"Firefox 121","screenSize":"1440x900"}',
        datetime('now', '-1 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-002', 'demo-fb-002', 'negative', -0.7, '["authentication","stability"]', '["login","fails","SSO","session","expired"]', 'high', 78,
        '["Check SSO token validation","Review session handling","Add retry logic"]',
        'SSO login failing 20% of time with session expired errors.', datetime('now', '-1 days'));

-- BUG: Medium - Safari Charts
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, severity, status, priority, metadata, created_at)
VALUES ('demo-fb-003', 'demo-user-3', 'piotr.wisniewski@enterprise.io', 'Piotr Wiśniewski', 'BUG',
        'Dashboard charts not loading on Safari 17. Shows blank space where charts should be. Works fine on Chrome and Firefox.',
        'MEDIUM', 'PENDING', 'medium',
        '{"context":"/dashboard","browser":"Safari 17","screenSize":"2560x1440"}',
        datetime('now', '-5 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-003', 'demo-fb-003', 'negative', -0.5, '["ui","compatibility"]', '["charts","Safari","loading","blank"]', 'medium', 55,
        '["Test WebGL compatibility","Add Safari fallback","Update chart library"]',
        'Dashboard charts blank on Safari 17, works on other browsers.', datetime('now', '-5 days'));

-- BUG: Low - Notification Count
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, severity, status, priority, metadata, created_at)
VALUES ('demo-fb-004', 'demo-user-4', 'maria.zielinska@startup.pl', 'Maria Zielińska', 'BUG',
        'Notification bell shows wrong count. It says 5 unread but when I click there are only 2 notifications.',
        'LOW', 'NEW', 'low',
        '{"context":"/notifications","browser":"Chrome 120","screenSize":"1920x1080"}',
        datetime('now', '-3 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-004', 'demo-fb-004', 'negative', -0.3, '["ui","bug"]', '["notification","count","wrong","unread"]', 'low', 35,
        '["Fix notification counter sync","Add cache invalidation"]',
        'Notification badge count incorrect.', datetime('now', '-3 days'));

-- BUG: Medium - AI Localization
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, severity, status, priority, metadata, admin_response, responded_at, created_at)
VALUES ('demo-fb-005', 'demo-user-5', 'tomasz.kaczmarek@consulting.com', 'Tomasz Kaczmarek', 'BUG',
        'AI suggestions sometimes appear in English even when the app is set to Polish language. Inconsistent localization.',
        'MEDIUM', 'REVIEWED', 'medium',
        '{"context":"/ai-chat","browser":"Edge 120","screenSize":"1920x1080"}',
        'Thank you for reporting! We are working on improving AI response localization. Fix planned for v2.5.',
        datetime('now', '-1 days'),
        datetime('now', '-7 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-005', 'demo-fb-005', 'negative', -0.4, '["localization","ai"]', '["AI","English","Polish","localization"]', 'medium', 50,
        '["Add language detection to AI","Implement response translation"]',
        'AI responses not respecting language settings.', datetime('now', '-7 days'));

-- IDEA: Mobile App (High Impact)
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, rating, severity, status, priority, metadata, admin_response, responded_at, created_at)
VALUES ('demo-fb-006', 'demo-user-1', 'jan.kowalski@acme.pl', 'Jan Kowalski', 'IDEA',
        'Would love to have a mobile app! I often need to check assessment status or approve initiatives when away from my desk. Even a simple read-only app would be incredibly useful.',
        5, 'NORMAL', 'REVIEWED', 'high',
        '{"context":"/dashboard","browser":"Chrome 120","screenSize":"1920x1080"}',
        'Great idea! Mobile app is on our roadmap for Q3 2026. We will start with iOS and Android apps with core features.',
        datetime('now', '-3 days'),
        datetime('now', '-14 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-006', 'demo-fb-006', 'positive', 0.7, '["mobile","feature"]', '["mobile","app","assessment","approve"]', 'high', 70,
        '["Add to roadmap","Evaluate React Native vs Flutter","Define MVP scope"]',
        'Request for mobile app to check status and approve on the go.', datetime('now', '-14 days'));

-- IDEA: Teams Integration
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, rating, severity, status, priority, metadata, admin_notes, created_at)
VALUES ('demo-fb-007', 'demo-user-2', 'anna.nowak@techcorp.com', 'Anna Nowak', 'IDEA',
        'Integration with Microsoft Teams would be amazing. We could get notifications about initiative updates directly in our team channels. Many enterprise tools have this already.',
        5, 'NORMAL', 'IN_PROGRESS', 'high',
        '{"context":"/settings/integrations","browser":"Edge 120","screenSize":"1920x1080"}',
        'Teams integration in development. Beta expected in 6 weeks.',
        datetime('now', '-21 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-007', 'demo-fb-007', 'positive', 0.8, '["integration","feature"]', '["Teams","integration","notifications","channels"]', 'high', 75,
        '["Evaluate MS Graph API","Design notification schema","Plan beta rollout"]',
        'Request for Microsoft Teams integration for notifications.', datetime('now', '-21 days'));

-- IDEA: Keyboard Shortcuts
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, rating, severity, status, priority, metadata, created_at)
VALUES ('demo-fb-008', 'demo-user-3', 'piotr.wisniewski@enterprise.io', 'Piotr Wiśniewski', 'IDEA',
        'Add keyboard shortcuts for power users. Things like Ctrl+N for new initiative, Ctrl+S to save, Ctrl+/ for search. Would speed up daily work significantly.',
        4, 'NORMAL', 'NEW', 'medium',
        '{"context":"/","browser":"Chrome 120","screenSize":"2560x1440"}',
        datetime('now', '-10 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-008', 'demo-fb-008', 'positive', 0.5, '["usability","feature"]', '["keyboard","shortcuts","Ctrl","save","search"]', 'medium', 55,
        '["Define shortcut list","Implement hotkey handler","Add cheat sheet modal"]',
        'Request for keyboard shortcuts for power users.', datetime('now', '-10 days'));

-- IDEA: Dark Mode
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, rating, severity, status, priority, metadata, admin_notes, created_at)
VALUES ('demo-fb-009', 'demo-user-4', 'maria.zielinska@startup.pl', 'Maria Zielińska', 'IDEA',
        'Dark mode please! Working late hours and the bright interface is harsh on the eyes. Many modern apps have this as standard.',
        5, 'NORMAL', 'IN_PROGRESS', 'medium',
        '{"context":"/settings","browser":"Firefox 121","screenSize":"1920x1080"}',
        'Dark mode in final testing. Release expected next month.',
        datetime('now', '-28 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-009', 'demo-fb-009', 'positive', 0.6, '["ui","feature"]', '["dark","mode","interface","eyes"]', 'medium', 60,
        '["Complete dark theme CSS","Test all components","Add toggle in settings"]',
        'Request for dark mode to reduce eye strain.', datetime('now', '-28 days'));

-- IDEA: Custom Dashboard
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, rating, severity, status, priority, metadata, created_at)
VALUES ('demo-fb-010', 'demo-user-5', 'tomasz.kaczmarek@consulting.com', 'Tomasz Kaczmarek', 'IDEA',
        'Custom dashboard widgets would be great. I want to see my KPIs at a glance without navigating to different modules. Let users drag and arrange their own dashboard.',
        4, 'NORMAL', 'PENDING', 'medium',
        '{"context":"/dashboard","browser":"Chrome 120","screenSize":"1920x1080"}',
        datetime('now', '-18 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-010', 'demo-fb-010', 'positive', 0.5, '["ui","feature"]', '["dashboard","widgets","KPIs","drag","arrange"]', 'medium', 55,
        '["Design widget system","Implement drag-and-drop","Create widget library"]',
        'Request for customizable dashboard with drag-drop widgets.', datetime('now', '-18 days'));

-- IDEA: Praise
INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, rating, severity, status, priority, metadata, admin_response, responded_at, created_at)
VALUES ('demo-fb-011', 'demo-user-1', 'jan.kowalski@acme.pl', 'Jan Kowalski', 'IDEA',
        'Just wanted to say the new assessment wizard is fantastic! It reduced our assessment time from 3 days to just 4 hours. The AI suggestions are spot-on. Great work team!',
        5, 'NORMAL', 'REVIEWED', 'low',
        '{"context":"/assessment","browser":"Chrome 120","screenSize":"1920x1080"}',
        'Thank you so much for the kind words! We are thrilled the new wizard is helping your team. Feel free to share any other feedback!',
        datetime('now', '-1 days'),
        datetime('now', '-5 days'));

INSERT INTO feedback_analysis (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, suggested_actions_json, ai_summary, analyzed_at)
VALUES ('demo-fa-011', 'demo-fb-011', 'positive', 0.95, '["praise","assessment"]', '["fantastic","wizard","assessment","AI","suggestions"]', 'low', 20,
        '["Consider for testimonial","Share with team","Document success metrics"]',
        'Praise: Assessment wizard reduced time from 3 days to 4 hours.', datetime('now', '-5 days'));


-- ==================== PULSE FEEDBACK ====================

INSERT INTO feedback_pulse (id, user_id, rating, context, comment, created_at)
VALUES 
    ('demo-pulse-001', 'demo-user-1', 5, '/dashboard', NULL, datetime('now')),
    ('demo-pulse-002', 'demo-user-2', 4, '/assessment', NULL, datetime('now')),
    ('demo-pulse-003', 'demo-user-3', 5, '/ai-chat', 'AI is really helpful!', datetime('now', '-1 days')),
    ('demo-pulse-004', 'demo-user-4', 2, '/reports/export', 'PDF export is slow', datetime('now', '-1 days')),
    ('demo-pulse-005', 'demo-user-5', 3, '/roadmap', 'Charts could be more responsive', datetime('now', '-1 days')),
    ('demo-pulse-006', 'demo-user-1', 5, '/economics', 'Great ROI calculator!', datetime('now', '-2 days')),
    ('demo-pulse-007', 'demo-user-2', 1, '/login', 'SSO keeps failing, very frustrating', datetime('now', '-2 days')),
    ('demo-pulse-008', 'demo-user-3', 4, '/initiatives', NULL, datetime('now', '-2 days')),
    ('demo-pulse-009', 'demo-user-4', 5, '/dashboard', NULL, datetime('now', '-3 days')),
    ('demo-pulse-010', 'demo-user-5', 4, '/assessment', NULL, datetime('now', '-3 days')),
    ('demo-pulse-011', 'demo-user-1', 5, '/ai-chat', 'Love the suggestions!', datetime('now', '-3 days')),
    ('demo-pulse-012', 'demo-user-2', 3, '/settings', NULL, datetime('now', '-4 days')),
    ('demo-pulse-013', 'demo-user-3', 4, '/roadmap', NULL, datetime('now', '-4 days')),
    ('demo-pulse-014', 'demo-user-4', 5, '/initiatives', NULL, datetime('now', '-5 days')),
    ('demo-pulse-015', 'demo-user-5', 2, '/documents', 'Upload limit too low', datetime('now', '-5 days')),
    ('demo-pulse-016', 'demo-user-1', 4, '/dashboard', NULL, datetime('now', '-6 days')),
    ('demo-pulse-017', 'demo-user-2', 5, '/assessment', NULL, datetime('now', '-6 days')),
    ('demo-pulse-018', 'demo-user-3', 3, '/reports', 'Needs more chart types', datetime('now', '-7 days')),
    ('demo-pulse-019', 'demo-user-4', 5, '/ai-chat', NULL, datetime('now', '-7 days')),
    ('demo-pulse-020', 'demo-user-5', 4, '/dashboard', NULL, datetime('now', '-7 days'));


-- ==================== FEATURE REQUESTS ====================

INSERT INTO feature_requests (id, user_id, user_email, category, feature_name, description, impact, status, votes_count, target_release, admin_notes, created_at)
VALUES 
    ('demo-fr-001', 'demo-user-1', 'jan.kowalski@acme.pl', 'missing', 'Mobile Application',
     'Native mobile apps for iOS and Android to access key features on the go. Should include dashboard view, initiative status, notifications, and basic AI chat capabilities.',
     'high', 'PLANNED', 47, 'Q3 2026', 'High priority. Design phase complete, development starting Q2.', datetime('now', '-45 days')),
     
    ('demo-fr-002', 'demo-user-2', 'anna.nowak@techcorp.com', 'integration', 'Microsoft Teams Integration',
     'Bi-directional integration with MS Teams: notifications in channels, ability to create initiatives from Teams, and embedded dashboard widgets.',
     'high', 'IN_PROGRESS', 38, 'Q2 2026', 'Beta available for testing. Full release in 4 weeks.', datetime('now', '-60 days')),
     
    ('demo-fr-003', 'demo-user-3', 'piotr.wisniewski@enterprise.io', 'improvement', 'Dark Mode',
     'System-wide dark theme option. Should respect OS preference and include manual toggle. All charts and graphs should adapt to dark theme.',
     'medium', 'IN_PROGRESS', 52, 'February 2026', 'In final QA. Release imminent.', datetime('now', '-90 days')),
     
    ('demo-fr-004', 'demo-user-4', 'maria.zielinska@startup.pl', 'missing', 'Keyboard Shortcuts',
     'Global keyboard shortcuts for common actions: navigation, creating items, saving, searching. Include a shortcut cheat sheet accessible via Ctrl+?',
     'medium', 'PLANNED', 29, 'Q2 2026', NULL, datetime('now', '-30 days')),
     
    ('demo-fr-005', 'demo-user-5', 'tomasz.kaczmarek@consulting.com', 'improvement', 'Customizable Dashboard',
     'Drag-and-drop dashboard builder. Users should be able to add/remove widgets, resize them, and save multiple dashboard layouts for different use cases.',
     'high', 'REVIEWING', 41, NULL, 'Evaluating technical approach. Complex but high value.', datetime('now', '-55 days')),
     
    ('demo-fr-006', 'demo-user-1', 'jan.kowalski@acme.pl', 'missing', 'Bulk Actions for Initiatives',
     'Multi-select initiatives and perform bulk operations: change status, assign owner, update phase, add tags, or delete. Essential for portfolio management.',
     'high', 'PLANNED', 34, 'Q1 2026', NULL, datetime('now', '-25 days')),
     
    ('demo-fr-007', 'demo-user-2', 'anna.nowak@techcorp.com', 'integration', 'Slack Integration',
     'Slack app with notifications, slash commands to check status, and ability to create quick notes/updates directly from Slack.',
     'medium', 'REVIEWING', 25, NULL, NULL, datetime('now', '-40 days')),
     
    ('demo-fr-008', 'demo-user-3', 'piotr.wisniewski@enterprise.io', 'missing', 'PowerPoint Export',
     'Export reports and dashboards directly to .pptx format with editable charts. Include multiple template options for different presentation styles.',
     'medium', 'NEW', 31, NULL, NULL, datetime('now', '-15 days')),
     
    ('demo-fr-009', 'demo-user-4', 'maria.zielinska@startup.pl', 'improvement', 'Advanced Filtering & Search',
     'Global search across all modules with filters, saved searches, and search history. Include boolean operators and field-specific searches.',
     'medium', 'PLANNED', 27, 'Q2 2026', NULL, datetime('now', '-35 days')),
     
    ('demo-fr-010', 'demo-user-5', 'tomasz.kaczmarek@consulting.com', 'usability', 'Onboarding Wizard',
     'Interactive onboarding for new users with step-by-step tutorials, sample data option, and contextual help throughout the first week.',
     'medium', 'COMPLETED', 19, NULL, 'Shipped in v2.4. Great user feedback!', datetime('now', '-120 days')),
     
    ('demo-fr-011', 'demo-user-1', 'jan.kowalski@acme.pl', 'missing', 'API Webhooks',
     'Outbound webhooks for key events (initiative created, status changed, assessment completed). Include webhook management UI and retry logic.',
     'high', 'COMPLETED', 22, NULL, 'Available since v2.3. Documentation at docs.consultinity.io/webhooks', datetime('now', '-150 days')),
     
    ('demo-fr-012', 'demo-user-2', 'anna.nowak@techcorp.com', 'improvement', 'AI Memory & Personalization',
     'AI should remember user preferences, company context, and past conversations. Build a knowledge graph of user interactions for personalized suggestions.',
     'high', 'COMPLETED', 36, NULL, 'Shipped! AI now maintains context across sessions.', datetime('now', '-100 days'));


-- ==================== FEATURE VOTES ====================

-- Add votes for top features
INSERT INTO feature_votes (id, feature_id, user_id, created_at)
SELECT 
    'demo-vote-' || feature_requests.id || '-' || users.id,
    feature_requests.id,
    users.id,
    datetime('now', '-' || abs(random() % 30) || ' days')
FROM feature_requests, (
    SELECT 'demo-user-1' as id UNION SELECT 'demo-user-2' UNION SELECT 'demo-user-3' UNION SELECT 'demo-user-4' UNION SELECT 'demo-user-5'
) as users
WHERE feature_requests.id LIKE 'demo-%'
LIMIT 30;


-- ==================== TRENDING TOPICS ====================

INSERT INTO feedback_trending_topics (id, topic, topic_count, sentiment, trend, period, calculated_at)
VALUES 
    ('demo-trend-001', 'mobile', 12, 'positive', 'rising', '7d', datetime('now')),
    ('demo-trend-002', 'integration', 9, 'positive', 'rising', '7d', datetime('now')),
    ('demo-trend-003', 'performance', 7, 'negative', 'stable', '7d', datetime('now')),
    ('demo-trend-004', 'dark mode', 6, 'positive', 'falling', '7d', datetime('now')),
    ('demo-trend-005', 'export', 5, 'neutral', 'stable', '7d', datetime('now')),
    ('demo-trend-006', 'AI', 8, 'positive', 'rising', '7d', datetime('now')),
    ('demo-trend-007', 'SSO', 4, 'negative', 'rising', '7d', datetime('now'));


-- Done!
SELECT '✅ Demo feedback data seeded successfully!' as status;
SELECT COUNT(*) || ' system feedback items' as count FROM system_feedback WHERE id LIKE 'demo-%';
SELECT COUNT(*) || ' pulse ratings' as count FROM feedback_pulse WHERE id LIKE 'demo-%';
SELECT COUNT(*) || ' feature requests' as count FROM feature_requests WHERE id LIKE 'demo-%';
SELECT COUNT(*) || ' trending topics' as count FROM feedback_trending_topics;
