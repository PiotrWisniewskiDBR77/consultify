import React from 'react';
import { Navigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

/**
 * The bare Results route is a canonical entry point, not a feature-profile
 * switch. The retired ResultsHub must never reappear when an owner-review
 * query parameter or local-storage flag is absent.
 */
export function ResultsOwnerReviewEntry() {
  return <Navigate to={ROUTES.RESULTS_KPI.ROOT} replace />;
}
