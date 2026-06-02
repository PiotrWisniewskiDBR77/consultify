-- FLOW-MOBILE-001: Mobile & PWA
-- Migration: 265_mobile_pwa.sql

-- ==========================================
-- MOBILE DEVICES
-- ==========================================

CREATE TABLE IF NOT EXISTS mobile_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    
    -- Device identification
    device_uuid TEXT, -- Unique device identifier
    device_type TEXT NOT NULL, -- 'ios', 'android', 'web', 'pwa'
    device_name TEXT,
    device_model TEXT,
    device_manufacturer TEXT,
    
    -- OS info
    os_name TEXT,
    os_version TEXT,
    
    -- App info
    app_version TEXT,
    app_build TEXT,
    pwa_installed INTEGER DEFAULT 0,
    
    -- Push notifications
    push_token TEXT,
    push_provider TEXT, -- 'fcm', 'apns', 'web_push', 'expo'
    push_enabled INTEGER DEFAULT 1,
    push_token_updated_at TIMESTAMP,
    
    -- Location (optional)
    last_known_location TEXT, -- JSON: {lat, lng, accuracy}
    location_permission TEXT DEFAULT 'denied', -- 'granted', 'denied', 'prompt'
    
    -- Security
    biometric_enabled INTEGER DEFAULT 0,
    biometric_type TEXT, -- 'face_id', 'touch_id', 'fingerprint'
    pin_enabled INTEGER DEFAULT 0,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    is_trusted INTEGER DEFAULT 0, -- Admin marked as trusted
    last_active_at TIMESTAMP,
    
    -- Audit
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    registered_ip TEXT,
    deactivated_at TIMESTAMP,
    deactivation_reason TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mobile_devices_user ON mobile_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_org ON mobile_devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_token ON mobile_devices(push_token);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_active ON mobile_devices(user_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mobile_devices_uuid ON mobile_devices(device_uuid);

-- ==========================================
-- MOBILE PREFERENCES
-- ==========================================

CREATE TABLE IF NOT EXISTS mobile_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- UI preferences
    theme TEXT DEFAULT 'system', -- 'light', 'dark', 'system'
    compact_mode INTEGER DEFAULT 0,
    font_size TEXT DEFAULT 'medium', -- 'small', 'medium', 'large'
    reduce_motion INTEGER DEFAULT 0,
    haptic_feedback INTEGER DEFAULT 1,
    
    -- Navigation
    bottom_nav_items TEXT DEFAULT '["home","tasks","chat","profile","more"]',
    default_screen TEXT DEFAULT 'mywork',
    quick_actions TEXT DEFAULT '["new_task","scan","voice"]',
    
    -- Notifications
    push_enabled INTEGER DEFAULT 1,
    push_task_reminders INTEGER DEFAULT 1,
    push_task_due INTEGER DEFAULT 1,
    push_decisions INTEGER DEFAULT 1,
    push_mentions INTEGER DEFAULT 1,
    push_ai_suggestions INTEGER DEFAULT 0,
    push_system_updates INTEGER DEFAULT 1,
    
    -- Quiet hours
    quiet_hours_enabled INTEGER DEFAULT 0,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '07:00',
    quiet_hours_days TEXT DEFAULT '[0,1,2,3,4,5,6]', -- JSON array of weekdays
    
    -- Offline & sync
    offline_mode_enabled INTEGER DEFAULT 0,
    offline_data_limit_mb INTEGER DEFAULT 100,
    auto_sync_wifi_only INTEGER DEFAULT 1,
    sync_frequency_minutes INTEGER DEFAULT 15,
    
    -- Camera & media
    photo_quality TEXT DEFAULT 'high', -- 'low', 'medium', 'high'
    auto_upload_photos INTEGER DEFAULT 1,
    
    -- Accessibility
    screen_reader_hints INTEGER DEFAULT 1,
    high_contrast INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mobile_prefs_user ON mobile_preferences(user_id);

-- ==========================================
-- OFFLINE SYNC QUEUE
-- ==========================================

CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    
    -- Action
    action_type TEXT NOT NULL, -- 'create', 'update', 'delete'
    entity_type TEXT NOT NULL, -- 'task', 'decision', 'assessment_response', 'note'
    entity_id TEXT,
    
    -- Data
    payload TEXT NOT NULL, -- JSON: the data to sync
    
    -- Status
    status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'synced', 'failed', 'conflict'
    
    -- Conflict resolution
    conflict_data TEXT, -- JSON: server version if conflict
    resolution TEXT, -- 'client_wins', 'server_wins', 'merged', 'manual'
    
    -- Timestamps
    created_offline_at TIMESTAMP NOT NULL, -- When created on device
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP,
    
    -- Retry
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (device_id) REFERENCES mobile_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON offline_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_device ON offline_sync_queue(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON offline_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON offline_sync_queue(user_id, status) WHERE status = 'pending';

-- ==========================================
-- PUSH NOTIFICATION LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS push_notification_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id TEXT,
    
    -- Notification content
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data TEXT, -- JSON: additional data
    
    -- Delivery
    provider TEXT, -- 'fcm', 'apns', 'web_push'
    provider_message_id TEXT,
    
    -- Status
    status TEXT DEFAULT 'sent', -- 'queued', 'sent', 'delivered', 'failed', 'clicked'
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    clicked_at TIMESTAMP,
    
    -- Error
    error_code TEXT,
    error_message TEXT,
    
    -- Source
    triggered_by TEXT, -- What caused this notification
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_push_log_user ON push_notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_push_log_device ON push_notification_log(device_id);
CREATE INDEX IF NOT EXISTS idx_push_log_sent ON push_notification_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_push_log_type ON push_notification_log(notification_type);
