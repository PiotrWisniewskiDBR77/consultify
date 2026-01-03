/**
 * Subscription Analytics Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles MRR tracking, churn analysis, LTV calculations, and cohort analysis
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const subscriptionAnalyticsServiceJS = require('../../services/subscriptionAnalyticsService.js');

// Re-export all functions
export const setDependencies = subscriptionAnalyticsServiceJS.setDependencies;
export const getCurrentMRR = subscriptionAnalyticsServiceJS.getCurrentMRR;
export const getMRRHistory = subscriptionAnalyticsServiceJS.getMRRHistory;
export const calculateChurnRate = subscriptionAnalyticsServiceJS.calculateChurnRate;
export const getChurnAnalysis = subscriptionAnalyticsServiceJS.getChurnAnalysis;
export const calculateLTV = subscriptionAnalyticsServiceJS.calculateLTV;
export const getCohortAnalysis = subscriptionAnalyticsServiceJS.getCohortAnalysis;
export const getRevenueForecast = subscriptionAnalyticsServiceJS.getRevenueForecast;
export const getSubscriptionHealth = subscriptionAnalyticsServiceJS.getSubscriptionHealth;

// Default export for backward compatibility
const subscriptionAnalyticsService = subscriptionAnalyticsServiceJS.default || subscriptionAnalyticsServiceJS;

export default subscriptionAnalyticsService;

