/**
 * API Module Index
 * Enterprise SaaS Architecture - Domain-Driven API Modules
 * 
 * This file re-exports all domain-specific API modules for clean imports.
 * Each module handles a specific business domain.
 */

// Base client utilities (shared across all modules)
export * from './baseClient';
export * from './types';

// Domain-specific API modules
export { AuthApi } from './auth.api';
export { UserApi } from './users.api';
export { BillingApi } from './billing.api';
export { NotificationApi } from './notifications.api';
export { TaskApi } from './tasks.api';
export { TeamApi } from './teams.api';
export { InitiativeApi } from './initiatives.api';
export { ProjectApi } from './projects.api';
export { OrganizationApi } from './organizations.api';
export { SettingsApi } from './settings.api';
export { MetricsApi } from './metrics.api';
export { PMOApi } from './pmo.api';
export { AdminApi } from './admin.api';
export { AIApi } from './ai.api';


