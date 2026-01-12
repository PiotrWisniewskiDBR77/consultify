# AI Settings 3-Tier System

## Overview

The AI Settings System provides a hierarchical configuration structure for managing AI behavior across three levels:

1. **SuperAdmin Level** - Platform-wide global settings
2. **Admin/Organization Level** - Per-organization configuration
3. **User Level** - Personal preferences

Settings cascade from SuperAdmin → Organization → User, with each level able to constrain or override settings from higher levels.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPERADMIN LEVEL                         │
│  • Provider Management (default, fallback chain)            │
│  • Global Limits (tokens, rate limits)                      │
│  • Security (PII detection, encryption, data residency)     │
└──────────────────────────┬──────────────────────────────────┘
                           │ constrains
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 ORGANIZATION LEVEL                          │
│  • Policy Level (ADVISORY → AUTOPILOT)                      │
│  • AI Roles (ADVISOR, PMO_MANAGER, EXECUTOR, EDUCATOR)      │
│  • Enabled Models (subset of SuperAdmin providers)          │
│  • Limits & Budget (calls/day, tokens/month, USD)           │
│  • Feature Toggles (artifacts, thinking, focus modes)       │
│  • Default Proactivity Mode                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ constrains
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     USER LEVEL                              │
│  • Response Style (concise, balanced, detailed)             │
│  • Writing Tone (professional, casual, technical)           │
│  • Proactivity Mode (REACTIVE, BALANCED, PROACTIVE)         │
│  • Model Parameters (temperature, tokens, penalties)        │
│  • Privacy Settings (PII redaction, data retention)         │
│  • Personal API Keys (BYOK)                                 │
└─────────────────────────────────────────────────────────────┘
```

## Proactivity Modes

The system introduces three AI proactivity modes that control how actively the AI assists users:

### REACTIVE
- AI waits silently until explicitly asked
- No auto-suggestions, nudges, or hints
- Perfect for experienced users who prefer full control
- **Behaviors**: All disabled

### BALANCED (Default)
- AI provides suggestions when helpful
- Shows contextual hints and nudges
- Waits for user to initiate major interactions
- **Behaviors**: Auto-suggest ✓, Nudges ✓, Hints ✓, Initiate ✗

### PROACTIVE
- AI actively monitors work and offers assistance
- Can proactively start conversations about issues
- Continuous recommendations and alerts
- **Behaviors**: All enabled

## Database Schema

### Tables

```sql
-- SuperAdmin AI Settings (singleton)
CREATE TABLE superadmin_ai_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    default_provider TEXT,
    fallback_chain TEXT,           -- JSON array
    circuit_breaker_config TEXT,   -- JSON
    global_token_limit INTEGER,
    global_rate_limit TEXT,        -- JSON
    max_context_window_size INTEGER,
    max_tokens_per_request INTEGER,
    pii_detection_sensitivity TEXT,
    require_encryption INTEGER,
    data_residency TEXT,
    updated_at DATETIME,
    updated_by TEXT
);

-- Organization AI Settings
CREATE TABLE organization_ai_settings (
    organization_id TEXT PRIMARY KEY,
    policy_level TEXT,
    max_policy_level TEXT,
    default_proactivity_mode TEXT,
    active_roles TEXT,              -- JSON array
    default_role TEXT,
    enabled_model_ids TEXT,         -- JSON array
    max_ai_calls_per_day INTEGER,
    max_tokens_per_month INTEGER,
    monthly_budget_usd REAL,
    hard_limit_usd REAL,
    freeze_on_limit INTEGER,
    web_search_enabled INTEGER,
    artifacts_enabled INTEGER,
    thinking_steps_enabled INTEGER,
    focus_modes_enabled INTEGER,
    voice_enabled INTEGER,
    audit_all_requests INTEGER,
    audit_policy_changes INTEGER,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- User AI Settings
CREATE TABLE user_ai_settings (
    user_id TEXT PRIMARY KEY,
    response_style TEXT,
    writing_tone TEXT,
    preferred_language TEXT,
    code_explanations INTEGER,
    show_sources INTEGER,
    proactivity_mode TEXT,
    model_temperature REAL,
    max_tokens INTEGER,
    top_p REAL,
    frequency_penalty REAL,
    presence_penalty REAL,
    system_instructions TEXT,
    visible_model_ids TEXT,         -- JSON array
    preferred_model_id TEXT,
    enable_pii_redaction INTEGER,
    data_retention_policy TEXT,
    share_usage_analytics INTEGER,
    context_retention TEXT,
    auto_suggestions INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Audit Log
CREATE TABLE ai_settings_audit (
    id TEXT PRIMARY KEY,
    timestamp DATETIME,
    level TEXT,
    actor_id TEXT,
    actor_role TEXT,
    target_id TEXT,
    setting_key TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT
);
```

## API Reference

### SuperAdmin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai-settings/superadmin` | Get global settings |
| PUT | `/api/ai-settings/superadmin` | Update global settings |

### Organization Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai-settings/org/:orgId` | Get organization settings |
| PUT | `/api/ai-settings/org/:orgId` | Update organization settings |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai-settings/user` | Get current user's settings |
| PUT | `/api/ai-settings/user` | Update current user's settings |

### Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai-settings/effective` | Get merged effective settings |
| GET | `/api/ai-settings/available-models` | Get models available to user |
| GET | `/api/ai-settings/proactivity` | Get current proactivity settings |
| GET | `/api/ai-settings/proactivity/modes` | Get all proactivity modes |
| GET | `/api/ai-settings/audit` | Get settings audit log |

## Backend Services

### AISettingsService

Main service for CRUD operations on settings.

```javascript
const AISettingsService = require('./services/aiSettingsService');

// Get effective settings for runtime
const settings = await AISettingsService.getEffectiveSettings(userId, orgId);

// Update user settings
await AISettingsService.updateUserSettings(userId, { proactivityMode: 'REACTIVE' });

// Log audit entry
await AISettingsService.logAudit({
    level: 'admin',
    actorId: 'admin-1',
    targetId: 'org-1',
    settingKey: 'policyLevel',
    oldValue: 'ADVISORY',
    newValue: 'ASSISTED'
});
```

### AIProactivityEngine

Controls proactivity behaviors and provides prompt modifiers.

```javascript
const AIProactivityEngine = require('./services/aiProactivityEngine');

// Get behavior flags for mode
const behaviors = AIProactivityEngine.getBehaviors('BALANCED');
// { autoSuggest: true, nudges: true, contextualHints: true, initiateConversation: false }

// Get prompt modifier for AI
const prompt = AIProactivityEngine.getProactivityPromptModifier('PROACTIVE');
```

## Frontend Integration

### React Hook

```typescript
import { useAISettings, useProactivityMode } from '../hooks/useAISettings';

// Full settings hook
const { effectiveSettings, proactivityMode, setProactivityMode, loading } = useAISettings();

// Simplified proactivity hook
const { mode, behaviors, canAutoSuggest, canShowNudges } = useProactivityMode();
```

### Components

```tsx
import { 
    ProactivitySelector, 
    SettingsCard, 
    SettingsToggle, 
    SettingsSlider 
} from '../components/AISettings';

<ProactivitySelector
    value={mode}
    onChange={setMode}
    maxAllowed="PROACTIVE"
    showBehaviors={true}
/>
```

## Settings Inheritance

When getting effective settings, the system merges settings as follows:

1. **Load all three levels** (SuperAdmin, Org, User)
2. **Apply constraints**:
   - User's `maxTokens` capped by SuperAdmin's `maxTokensPerRequest`
   - User's `proactivityMode` capped by Org's `defaultProactivityMode`
   - User's `visibleModelIds` filtered to Org's `enabledModelIds`
3. **Merge remaining settings** from user preferences
4. **Apply feature flags** from organization level

## Security Considerations

1. **Access Control**
   - SuperAdmin endpoints require `superadmin` role
   - Org endpoints require `admin` role for that organization
   - User endpoints accessible to authenticated users

2. **Audit Logging**
   - All SuperAdmin and Admin changes are logged
   - Audit entries include actor, target, old/new values, IP, user agent

3. **Data Validation**
   - All settings validated against allowed values
   - Proactivity mode validated against org limits

## Migration Guide

To add the AI Settings tables, run:

```bash
sqlite3 consultify.db < server/migrations/090_ai_settings_system.sql
```

Or for PostgreSQL:

```bash
psql -d consultify -f server/migrations/090_ai_settings_system.sql
```

## New Features (Jan 2026)

### User Tier Management

The system now supports user tiers for model access control:

- **BUDGET** - Access to budget-friendly models (GPT-4o-mini, DeepSeek)
- **STANDARD** - Access to standard + budget models (GPT-4o, Claude 3.5 Sonnet)
- **PREMIUM** - Full access including reasoning models (o1-mini, o1-preview, Claude 3 Opus)
- **REASONING** - Deep thought capability (o1-preview)

```javascript
// Assign tier to user
await AISettingsService.assignUserTier(orgId, userId, 'PREMIUM');

// Get all user tiers in org
const userTiers = await AISettingsService.getOrgUserTiers(orgId);
```

### Cost Tracking

Track AI usage costs per user and per organization:

```javascript
// User's personal cost history
const costs = await AISettingsService.getUserCostHistory(userId, '30d');
// Returns: { totalCost, totalRequests, totalTokens, byTier: [...] }

// Organization cost attribution
const orgCosts = await AISettingsService.getOrgCostAttribution(orgId, '7d');
// Returns: { totalCost, attribution: [{ entityType, entityName, cost, percentage }] }
```

### Compliance Reports

Generate compliance reports for various standards:

```javascript
// Generate ISO 21500 report
const report = await AISettingsService.generateComplianceReport(orgId, 'ISO21500', 'json');

// Supported standards: ISO21500, PMBOK7, PRINCE2, GDPR, SOC2
// Supported formats: json, csv, pdf
```

### Budget Alerts

Configure budget alerts at organization level:
- Warning at 70%
- Critical at 85%
- Emergency at 95%

### Custom Instructions

Organization-wide custom instructions and tone guidelines:
- Tone & Style presets (professional, friendly, technical, concise)
- Custom system instructions applied to all AI interactions
- Restricted topics configuration

## API Endpoints (New)

### User Cost Tracking
```
GET /api/ai-settings/user/costs?period=30d
```

### User Tier Management
```
GET /api/ai-settings/org/:orgId/users/tiers
PUT /api/ai-settings/org/:orgId/users/:userId/tier
```

### Cost Attribution
```
GET /api/ai-settings/org/:orgId/costs?period=7d
```

### Compliance Reports
```
GET /api/ai-settings/compliance/export/:format?standard=ISO21500
POST /api/ai-settings/compliance/generate
```

## Testing

Run the tests:

```bash
# Unit tests
npm run test tests/unit/backend/aiSettingsService.test.js
npm run test tests/unit/backend/aiProactivityEngine.test.js

# Component tests
npm run test tests/components/AISettings/ProactivitySelector.test.tsx

# Integration tests
npm run test tests/integration/ai-settings-api.test.js

# Full AI coverage
npm test -- --coverage --testPathPattern="ai"
```

