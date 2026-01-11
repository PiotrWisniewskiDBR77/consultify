-- ==========================================
-- Settings Module - Demo Data Seed
-- Migration: 230_settings_demo_seed.sql
-- Description: Seeds settings data for demo users (DBR77)
-- ==========================================

-- ==========================================
-- 1. USER PREFERENCES - Regional Settings
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-regional-dbr77-admin', 'user-dbr77-admin', 'regional', 
     '{"timezone": "Europe/Warsaw", "dateFormat": "DD/MM/YYYY", "timeFormat": "24h", "weekStartsOn": "monday", "language": "en", "numberFormat": "eu", "currency": "PLN"}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 2. USER PREFERENCES - Notifications
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-notifications-dbr77-admin', 'user-dbr77-admin', 'notifications',
     '{"emailEnabled": true, "pushEnabled": true, "inAppEnabled": true, "digestFrequency": "daily", "digestTime": "09:00", "quietHoursEnabled": true, "quietHoursStart": "22:00", "quietHoursEnd": "07:00", "mentionsOnly": false, "taskReminders": true, "projectUpdates": true, "teamActivity": true, "aiSuggestions": true}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 3. USER PREFERENCES - Dashboard
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-dashboard-dbr77-admin', 'user-dbr77-admin', 'dashboard',
     '{"defaultView": "overview", "showWelcomeWidget": true, "showTasksWidget": true, "showProjectsWidget": true, "showActivityWidget": true, "showAIInsightsWidget": true, "widgetLayout": "grid", "compactMode": false}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 4. USER PREFERENCES - Work Preferences
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-work-dbr77-admin', 'user-dbr77-admin', 'work',
     '{"workingDays": ["monday", "tuesday", "wednesday", "thursday", "friday"], "workingHoursStart": "08:00", "workingHoursEnd": "17:00", "autoScheduleTasks": true, "focusTimeEnabled": true, "focusTimeStart": "09:00", "focusTimeEnd": "12:00", "meetingBuffer": 15, "defaultTaskDuration": 60}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 5. USER PREFERENCES - Privacy
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-privacy-dbr77-admin', 'user-dbr77-admin', 'privacy',
     '{"profileVisibility": "team", "activityVisibility": "team", "emailVisibility": "organization", "showOnlineStatus": true, "allowDataExport": true, "allowAnalytics": true, "allowAILearning": true}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 6. USER PREFERENCES - AI Instructions
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-ai-instructions-dbr77-admin', 'user-dbr77-admin', 'ai-instructions',
     '{"customInstructions": "I am a transformation consultant focusing on digital transformation and operational excellence. Please provide concise, actionable insights. Use business terminology appropriate for executive presentations. Focus on ROI and measurable outcomes.", "communicationStyle": "professional", "responseLength": "balanced", "focusAreas": ["digital transformation", "operational excellence", "change management", "stakeholder engagement"]}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 7. USER PREFERENCES - AI Model
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-ai-model-dbr77-admin', 'user-dbr77-admin', 'ai-model',
     '{"preferredModel": "gpt-4o", "fallbackModel": "claude-3-sonnet", "autoSelectModel": true, "prioritizeSpeed": false, "prioritizeQuality": true, "maxTokens": 4096}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 8. USER PREFERENCES - AI Parameters
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-ai-parameters-dbr77-admin', 'user-dbr77-admin', 'ai-parameters',
     '{"temperature": 0.7, "topP": 0.9, "frequencyPenalty": 0.3, "presencePenalty": 0.3, "maxTokens": 2048, "streamResponses": true}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 9. USER PREFERENCES - AI Personality
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-ai-personality-dbr77-admin', 'user-dbr77-admin', 'ai-personality',
     '{"tone": "professional", "formality": "formal", "creativity": "balanced", "detailLevel": "comprehensive", "emoji": false, "humor": false}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 10. USER PREFERENCES - AI Autocomplete
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-ai-autocomplete-dbr77-admin', 'user-dbr77-admin', 'ai-autocomplete',
     '{"enabled": true, "triggerDelay": 500, "minCharacters": 3, "showInTasks": true, "showInNotes": true, "showInChat": true, "showInComments": true, "suggestionCount": 3}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 11. USER PREFERENCES - AI Memory
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-ai-memory-dbr77-admin', 'user-dbr77-admin', 'ai-memory',
     '{"enabled": true, "retentionDays": 90, "contextDepth": "deep", "learnFromInteractions": true, "rememberProjects": true, "rememberPreferences": true, "memoryEntries": [{"id": "mem-1", "content": "User prefers executive summaries over detailed reports", "category": "preferences"}, {"id": "mem-2", "content": "Primary focus on digital transformation projects", "category": "context"}, {"id": "mem-3", "content": "Uses ROI and KPIs to measure success", "category": "methodology"}]}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 12. USER PREFERENCES - AI Voice
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-ai-voice-dbr77-admin', 'user-dbr77-admin', 'ai-voice',
     '{"ttsEnabled": false, "ttsVoice": "alloy", "ttsSpeed": 1.0, "sttEnabled": true, "sttLanguage": "en-US", "autoTranscribe": false}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 13. USER PREFERENCES - Appearance
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-appearance-dbr77-admin', 'user-dbr77-admin', 'appearance',
     '{"theme": "system", "accentColor": "#6366f1", "uiDensity": "comfortable", "fontScale": 100, "startPage": "dashboard", "sidebarCollapsed": false, "animations": true, "reducedMotion": false}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 14. USER PREFERENCES - Shortcuts
-- ==========================================
INSERT OR IGNORE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
VALUES 
    ('pref-shortcuts-dbr77-admin', 'user-dbr77-admin', 'shortcuts',
     '{"globalSearch": "Cmd+K", "newTask": "Cmd+N", "quickNote": "Cmd+Shift+N", "aiChat": "Cmd+J", "toggleSidebar": "Cmd+B", "goToDashboard": "Cmd+1", "goToTasks": "Cmd+2", "goToProjects": "Cmd+3"}',
     datetime('now'), datetime('now'));

-- ==========================================
-- 15. EMAIL SIGNATURES
-- ==========================================
INSERT OR IGNORE INTO email_signatures (id, user_id, name, content, is_default, created_at, updated_at)
VALUES 
    ('sig-1-dbr77-admin', 'user-dbr77-admin', 'Professional', 
     '<div style="font-family: Arial, sans-serif; color: #333;"><p style="margin: 0;"><strong>{{name}}</strong></p><p style="margin: 4px 0; color: #666;">{{title}} | DBR77 Consulting</p><p style="margin: 4px 0;"><a href="mailto:{{email}}" style="color: #6366f1;">{{email}}</a> | <a href="tel:{{phone}}" style="color: #6366f1;">{{phone}}</a></p><p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">Digital Transformation & Operational Excellence</p></div>',
     1, datetime('now'), datetime('now')),
    ('sig-2-dbr77-admin', 'user-dbr77-admin', 'Simple',
     '<p>Best regards,<br/>{{name}}<br/>{{email}}</p>',
     0, datetime('now'), datetime('now')),
    ('sig-3-dbr77-admin', 'user-dbr77-admin', 'Formal',
     '<div style="font-family: Georgia, serif;"><p>Sincerely,</p><p><strong>{{name}}</strong><br/>{{title}}<br/>DBR77 Consulting Group</p><hr style="border: none; border-top: 1px solid #ccc; margin: 12px 0;"/><p style="font-size: 11px; color: #666;">This email and any attachments are confidential.</p></div>',
     0, datetime('now'), datetime('now'));

-- ==========================================
-- 16. SETTINGS TEMPLATES
-- ==========================================
INSERT OR IGNORE INTO settings_templates (id, user_id, name, description, icon, type, settings_data, is_active, created_at, updated_at)
VALUES 
    ('tmpl-1-dbr77-admin', 'user-dbr77-admin', 'Focus Mode', 
     'Optimized for deep work - minimal notifications, focus time enabled',
     '🎯', 'custom',
     '{"notifications": {"emailEnabled": false, "pushEnabled": false, "inAppEnabled": true, "mentionsOnly": true}, "work": {"focusTimeEnabled": true, "autoScheduleTasks": true}, "ai": {"autocomplete": {"enabled": true}}}',
     1, datetime('now'), datetime('now')),
    ('tmpl-2-dbr77-admin', 'user-dbr77-admin', 'Presentation Mode',
     'Clean interface for client presentations',
     '📊', 'custom',
     '{"appearance": {"sidebarCollapsed": true, "uiDensity": "spacious"}, "notifications": {"pushEnabled": false, "inAppEnabled": false}}',
     1, datetime('now'), datetime('now'));

-- ==========================================
-- 17. SETTINGS AUDIT LOG (sample entries)
-- ==========================================
INSERT OR IGNORE INTO settings_audit_log (id, user_id, category, setting_key, action, old_value, new_value, created_at)
VALUES 
    ('audit-1-dbr77', 'user-dbr77-admin', 'notifications', 'digestFrequency', 'updated', '"weekly"', '"daily"', datetime('now', '-7 days')),
    ('audit-2-dbr77', 'user-dbr77-admin', 'ai', 'preferredModel', 'updated', '"gpt-4"', '"gpt-4o"', datetime('now', '-5 days')),
    ('audit-3-dbr77', 'user-dbr77-admin', 'appearance', 'theme', 'updated', '"light"', '"system"', datetime('now', '-3 days')),
    ('audit-4-dbr77', 'user-dbr77-admin', 'privacy', 'allowAILearning', 'updated', 'false', 'true', datetime('now', '-2 days')),
    ('audit-5-dbr77', 'user-dbr77-admin', 'work', 'focusTimeEnabled', 'updated', 'false', 'true', datetime('now', '-1 days'));

-- ==========================================
-- 18. DEVELOPER SETTINGS
-- ==========================================
INSERT OR IGNORE INTO developer_settings (id, user_id, developer_mode, api_logging, verbose_errors, show_debug_info, beta_features, created_at, updated_at)
VALUES 
    ('dev-1-dbr77-admin', 'user-dbr77-admin', 0, 0, 0, 0, '[]', datetime('now'), datetime('now'));

-- ==========================================
-- 19. SECURITY EVENTS (login history sample)
-- ==========================================
INSERT OR IGNORE INTO security_events (id, user_id, type, severity, title, description, ip_address, location, device, metadata, created_at)
VALUES 
    ('sec-evt-1-dbr77', 'user-dbr77-admin', 'login', 'info', 'Successful Login', 'User logged in successfully', '192.168.1.100', 'Warsaw, Poland', 'Chrome on macOS', '{"method": "password"}', datetime('now', '-2 hours')),
    ('sec-evt-2-dbr77', 'user-dbr77-admin', 'login', 'info', 'Successful Login', 'User logged in successfully', '10.0.0.50', 'Warsaw, Poland', 'Firefox on Windows', '{"method": "password"}', datetime('now', '-1 days')),
    ('sec-evt-3-dbr77', 'user-dbr77-admin', 'login', 'info', 'Successful Login', 'User logged in successfully', '192.168.1.100', 'Warsaw, Poland', 'Safari on iOS', '{"method": "password"}', datetime('now', '-3 days')),
    ('sec-evt-4-dbr77', 'user-dbr77-admin', 'security', 'warning', 'Password Changed', 'User changed their password', '192.168.1.100', 'Warsaw, Poland', 'Chrome on macOS', '{}', datetime('now', '-7 days')),
    ('sec-evt-5-dbr77', 'user-dbr77-admin', 'mfa', 'info', 'MFA Enabled', 'Two-factor authentication was enabled', '192.168.1.100', 'Warsaw, Poland', 'Chrome on macOS', '{"method": "totp"}', datetime('now', '-14 days'));

-- ==========================================
-- 20. USER SECURITY ALERTS
-- ==========================================
INSERT OR IGNORE INTO user_security_alerts (user_id, email_suspicious_login, email_new_device, email_password_change, email_mfa_change, push_notifications, updated_at)
VALUES 
    ('user-dbr77-admin', 1, 1, 1, 1, 1, datetime('now'));

-- ==========================================
-- 21. TRUSTED DEVICES
-- ==========================================
INSERT OR IGNORE INTO trusted_devices (id, user_id, device_name, device_type, browser, os, location, ip_address, fingerprint, trusted_at, last_used, is_current)
VALUES 
    ('device-1-dbr77', 'user-dbr77-admin', 'MacBook Pro', 'laptop', 'Chrome 120', 'macOS Sonoma', 'Warsaw, Poland', '192.168.1.100', 'fp-abc123', datetime('now', '-30 days'), datetime('now'), 1),
    ('device-2-dbr77', 'user-dbr77-admin', 'iPhone 15 Pro', 'mobile', 'Safari', 'iOS 17', 'Warsaw, Poland', '192.168.1.105', 'fp-def456', datetime('now', '-14 days'), datetime('now', '-1 days'), 0);

-- ==========================================
-- 22. GDPR CONSENTS
-- ==========================================
INSERT OR IGNORE INTO user_gdpr_consents (user_id, analytics, personalization, marketing, third_party_sharing, ai_training, created_at, updated_at)
VALUES 
    ('user-dbr77-admin', 1, 1, 0, 0, 1, datetime('now', '-30 days'), datetime('now'));

-- ==========================================
-- 23. DATA RETENTION
-- ==========================================
INSERT OR IGNORE INTO user_data_retention (user_id, retention_period, auto_delete, updated_at)
VALUES 
    ('user-dbr77-admin', '365', 0, datetime('now'));

-- Done!
