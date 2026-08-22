import React, { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

import { isResultsOwnerReviewModeEnabled } from './resultsOwnerReviewMode';

export function ResultsOwnerReviewEntry({ fallback }: { fallback: ReactNode }) {
  return isResultsOwnerReviewModeEnabled() ? (
    <Navigate to={ROUTES.RESULTS_KPI.ROOT} replace />
  ) : (
    <>{fallback}</>
  );
}
