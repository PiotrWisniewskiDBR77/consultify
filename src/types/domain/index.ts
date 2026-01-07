/**
 * Domain Types Index
 * Re-exports all domain-related types
 */

export * from './ai';
export * from './billing';
export * from './pmo';
export * from './project';
export * from './user';

// Re-export InitiativeStatus from core for backward compatibility
export { InitiativeStatus } from '../core';
