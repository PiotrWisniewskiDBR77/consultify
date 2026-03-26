/**
 * V8 Admin API
 * Domain module for V8 admin endpoints: flags, health, metrics.
 */

import { v8Get, v8Put } from './client';

export const V8AdminApi = {
  getFlags: () => v8Get<Record<string, boolean>>('/admin/flags'),

  getAllFlags: () => v8Get('/admin/flags/all'),

  setFlag: (module: string, enabled: boolean) =>
    v8Put(`/admin/flags/${module}`, { enabled }),

  getHealth: () => v8Get('/admin/health'),

  getMetrics: () => v8Get('/admin/metrics'),

  getShadowStats: () => v8Get('/admin/shadow/stats'),

  getShadowComparisons: (limit = 25) => v8Get('/admin/shadow/comparisons', { limit: String(limit) }),

  getShadowPromotionReadiness: () => v8Get('/admin/shadow/promotion-readiness'),
};
