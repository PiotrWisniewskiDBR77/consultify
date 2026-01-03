# Changelog

All notable changes to Consultify will be documented in this file.

## [2.8.0] - 2025-01-XX

### Fixed - Removed All Mock Data from Production Code

#### Admin Screens
- **AdminAnalyticsView**: Removed `generateMockUsageData()` and `generateMockFailureData()` functions, now uses real API data only
- **AdminMetricsDashboardView**: Removed hardcoded `percent={75}` mock, now calculates from real data
- **AdminBillingManagement**: Removed fallback mock data, proper error handling with empty states
- **SpendingAlertsView**: Removed `mockUsage` calculations, now fetches real usage data from API
- **PaymentMethodsView**: Removed mock Stripe payment method ID generation, uses real Stripe integration
- **UserGroupsView**: Removed mock data fallbacks, proper error handling
- **OwnershipManagementView**: Removed mock data, proper error handling
- **AuditLogView**: Removed mock data, uses real audit API endpoint

#### SuperAdmin Screens
- **AIIntelligenceView**: Removed `generateMockTrends()` function, uses real API data only

#### Settings Screens
- **APIAccessSettings**: Removed mock data fallback, proper error handling
- **ActiveSessionsSettings**: Removed mock data fallback, proper error handling
- **LoginHistorySettings**: Removed mock data fallback, proper error handling

#### Test Data
- **New Seed Script**: Created `server/scripts/seedEnglishTestData.js` with comprehensive English test data
  - 5 test organizations with different subscription tiers
  - 30 test users with English names
  - 15-20 test projects
  - Billing data (invoices, payment methods)
  - API keys, webhooks, audit logs
  - Notifications, login history
  - AI usage data
  - All data in English language for manual testing

#### Improvements
- All screens now show proper empty states instead of mock data
- Better error handling throughout
- Consistent API error messages
- Loading states properly implemented

## [2.7.0] - 2025-01-02

### Added - Unified AI Chat System

A seamless chat experience across full-screen and split-screen modes, similar to OpenAI Canvas or Google AI Studio.

#### New Components
- **UnifiedChatPanel** - Dual-mode chat component supporting both full-screen and split-screen
- **WorkspaceContext** - Type system for tracking what user is viewing in workspace
- **Enhanced SplitLayout** - Now integrates UnifiedChatPanel by default

#### Store Extensions
- `useConversationStore` extended with:
  - `displayMode` - Manages full/split/collapsed chat modes
  - `workspaceContext` - Tracks workspace panel content
  - `expandToFullScreen()` / `collapseToSplit()` actions
  - Mode persistence across sessions

- `useAppStore` extended with:
  - `navigateWithChatContext()` - Navigate while preserving chat
  - `returnToFullChat()` - Return to full-screen chat
  - `previousView` tracking for back navigation

#### Sidebar Navigation
- Smart navigation that preserves active conversation
- Clicking menu items while in conversation switches to split mode
- AI Chat button switches between modes intelligently

#### AI Context Awareness
- AIContext now includes `workspaceContext` and `chatDisplayMode`
- AI receives information about what user is currently viewing
- Contextual placeholders in input based on workspace type

#### Features
- Seamless transition between full-screen and split-screen modes
- Conversation history preserved across mode changes
- All input features available in split mode (files, tools, voice)
- FocusModeSelector with compact mode for split view
- Mobile-responsive with FAB for chat access

#### Documentation
- Full technical documentation in `docs/UNIFIED_AI_CHAT_SYSTEM.md`
- Architecture diagrams
- Migration guide from legacy ChatPanel
- Usage examples

#### Tests
- Unit tests for store extensions
- Component tests for UnifiedChatPanel
- E2E tests for navigation flows

### Files Changed
- `store/useConversationStore.ts`
- `store/useAppStore.ts`
- `components/SplitLayout.tsx`
- `components/Sidebar.tsx`
- `contexts/AIContext.tsx`

### Files Added
- `components/AIChat/UnifiedChatPanel.tsx`
- `types/workspace.ts`
- `tests/store/useConversationStore.displayMode.test.ts`
- `tests/components/AIChat/UnifiedChatPanel.test.tsx`
- `e2e/unified-chat.spec.ts`
- `docs/UNIFIED_AI_CHAT_SYSTEM.md`

---

## [2.6.0] - 2025-01-02

### Added - System Module Enterprise Implementation

#### Database
- Added `audit_logs` table with comprehensive audit logging
- Added `feature_flags` and `feature_flag_history` tables
- Added `webhook_deliveries` table for delivery tracking
- Added `integrations` and `integration_sync_logs` tables
- Added `system_metrics` table for metrics collection
- Added `security_events` table for security monitoring
- Added `compliance_records` table for compliance tracking
- Added `system_config` table for configuration management
- Added `api_keys` table for API key management
- Added `backup_records` table for backup tracking
- Extended `webhooks` table with retry_policy, headers, payload_template columns
- Migrated existing `activity_logs` to `audit_logs` table

#### Backend Services
- **auditLogService** - Comprehensive audit logging with compliance support
- **featureFlagService** - Full CRUD and targeting rules support
- **webhookService** - Extended with delivery management
- **integrationService** - Third-party integration management
- **securityService** - Security event tracking and threat detection
- **complianceService** - Compliance framework management
- **systemConfigService** - System configuration management
- **metricsService** - Metrics collection and aggregation
- Enhanced **systemHealthService** with detailed metrics

#### API Routes
- `/api/audit-logs` - Audit log management endpoints
- `/api/feature-flags` - Feature flag CRUD endpoints
- `/api/webhooks` - Extended webhook management
- `/api/integrations` - Integration management endpoints
- `/api/security` - Security and compliance endpoints
- `/api/system-config` - Configuration management endpoints
- `/api/system-health` - Enhanced health monitoring endpoints
- `/api/api-keys` - API key management endpoints
- `/api/backups` - Backup management endpoints

#### Frontend Components
- **SystemHealthView** - Enhanced health monitoring
- **AuditLogViewer** - Full audit log browsing and export
- **FeatureFlagsPanel** - Complete feature flag management
- **IntegrationsPanel** - Integration and webhook management
- **SecurityPanel** - Security events and compliance
- **ConfigurationPanel** - System configuration management
- **AnalyticsPanel** - System analytics dashboard
- **BackupPanel** - Backup and recovery management
- **ApiManagementPanel** - API key management

#### Features
- Comprehensive audit logging with risk levels and compliance tags
- Feature flags with targeting rules and A/B testing support
- Webhook management with delivery tracking and retry logic
- Integration hub with sync monitoring
- Security event tracking and resolution workflow
- Compliance framework support (GDPR, SOC2, ISO27001, HIPAA, PCI_DSS)
- System configuration management with environment support
- Real-time system metrics and analytics
- Backup and recovery management
- API key management with usage tracking

#### Documentation
- Architecture documentation
- API documentation
- Database schema documentation
- User guide
- Administrator guide
- Migration guide

#### Tests
- Unit tests for services
- Component tests
- Integration tests for API endpoints
- E2E tests for user flows

### Changed
- Enhanced System Module with 9 tabs (was 4)
- Extended audit logging capabilities
- Improved feature flag management
- Enhanced webhook delivery tracking

### Security
- All System Module endpoints require SUPERADMIN role
- Audit logs are immutable (append-only)
- API keys hashed before storage
- Webhook secrets encrypted
- Compliance evidence tracking

## [2.5.0] - Previous Version
- Initial System Module with basic health monitoring

