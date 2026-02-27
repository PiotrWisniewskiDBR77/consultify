import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

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

  React.useEffect(() => {
    trackFunnelEvent('route_redirected', {
      from: pathname,
      to: target,
      reason: 'licensed_tools_alias',
    });
  }, [pathname, target]);

  return <Navigate to={target} replace />;
};
