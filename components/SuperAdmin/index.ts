/**
 * SuperAdmin Components Index
 *
 * Central export for all Super Admin module components.
 */

// Core components
export type { Tab } from './TabLayout';
export { TabLayout } from './TabLayout';

// Placeholder panels (to be expanded)
export { EmailTemplatesPanel } from './EmailTemplatesPanel';
export { FeatureFlagsPanel } from './FeatureFlagsPanel';
export { IntegrationsPanel } from './IntegrationsPanel';
export { LegalPanel } from './LegalPanel';
export { UsageStatsPanel } from './UsageStatsPanel';

// Existing SuperAdmin components
export { SuperAdminSignalCenter } from './SuperAdminSignalCenter';

// AI Settings
export { SuperAdminAISettings } from './SuperAdminAISettings';

// LLM Tier Management
export { ModelTierAssignments } from './ModelTierAssignments';

// Security Management
export * from './security';

// Billing Management
export * from './billing';

// Integrations & Webhooks
export * from './integrations';

// Data Management
export * from './data';

// Email Configuration
export { EmailConfigurationPanel } from './EmailConfigurationPanel';
