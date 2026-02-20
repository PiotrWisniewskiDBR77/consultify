import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { ROUTES } from './routeConfig';

/**
 * Redirects /licensed-tools and /licensed-tools/* to /assessment and /assessment/*
 * T025: Alias for Licensed Tools module (canonical route stays /assessment)
 */
export const LicensedToolsRedirect: React.FC = () => {
  const { pathname } = useLocation();
  const target =
    pathname === '/licensed-tools'
      ? ROUTES.ASSESSMENT.ROOT
      : `${ROUTES.ASSESSMENT.ROOT}${pathname.slice('/licensed-tools'.length)}`;
  return <Navigate to={target} replace />;
};
