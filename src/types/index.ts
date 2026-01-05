/**
 * Types Index
 * Master export file for all TypeScript types
 *
 * Enterprise SaaS Architecture - Consultify
 */

// Core Enums and UI-specific types (Explicitly selected to avoid collisions)
export {
    AppView,
    SCMSPhase,
    SessionMode,
    AuthStep,
    UserRole,
    UserRole as LegacyUserRole,
    ProjectRole as LegacyProjectRole,
    AccountType as LegacyAccountType,
    PROJECT_ROLES,
    ACCOUNT_TYPES
} from './core';

export type { FullSession } from './core';

// API Types (Categorized)
export * from './api/requests';
export * from './api/responses';

// Domain Types (Categorized)
export * from './domain/ai';
export * from './domain/billing';
export * from './domain/pmo';
export * from './domain/project';
export * from './domain/user';

// UI Types
export * from './ui/index';

// Specialized types
export * from './AIContract';
export * from './myWork';
export * from './workspace';
