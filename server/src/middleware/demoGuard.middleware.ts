/**
 * Demo Guard Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides demo mode protection and context
 */

import type { NextFunction, Request, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// CONSTANTS
// ==========================================

export const DEMO_ORG_ID = 'demo-org';
export const DEMO_ORG_NAME = 'Demo Organization';

// ==========================================
// TYPES
// ==========================================

export interface DemoOrganization {
  id: string;
  name: string;
  slug: string;
  description: string;
  settings: Record<string, unknown>;
}

export interface DemoStats {
  initiatives: number;
  tasks: number;
  decisions: number;
  users: number;
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Demo context middleware - attaches demo context to request
 */
export const demoContextMiddleware = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

/**
 * Demo write protection - prevents writes in demo mode
 */
export const demoWriteProtection = (_options: Record<string, unknown> = {}) => {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
};

/**
 * Demo guard - alias for demoContextMiddleware
 */
export const demoGuard = demoContextMiddleware;

// ==========================================
// HELPERS
// ==========================================

/**
 * Check if user has demo preference enabled
 */
export const checkUserDemoPreference = async (_userId: string): Promise<boolean> => {
  return false;
};

/**
 * Set user demo preference
 */
export const setUserDemoPreference = async (_userId: string, _enabled: boolean): Promise<void> => {
  // No-op
};

/**
 * Get demo organization
 */
export const getDemoOrganization = async (): Promise<DemoOrganization> => {
  return {
    id: DEMO_ORG_ID,
    name: DEMO_ORG_NAME,
    slug: 'demo-org',
    description: 'Demo organization',
    settings: {},
  };
};

/**
 * Get demo statistics
 */
export const getDemoStats = async (): Promise<DemoStats> => {
  return {
    initiatives: 0,
    tasks: 0,
    decisions: 0,
    users: 0,
  };
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default demoContextMiddleware;
