import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { buildCanonicalRedirectTarget } from '@/routes/canonicalRedirect';
import { ROUTES } from '@/routes/routeConfig';

export const KpiOkrView: React.FC = () => {
  const location = useLocation();
  return <Navigate to={buildCanonicalRedirectTarget(ROUTES.RESULTS, location)} replace />;
};
