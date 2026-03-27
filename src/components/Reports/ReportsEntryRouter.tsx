/**
 * ReportsEntryRouter (V3-A04 / V3-J01)
 * Deprecated shim: historical reports entry now redirects to the canonical
 * outputs library documents lane.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

export const ReportsEntryRouter: React.FC = () => {
  const navigate = useNavigate();
  const canonicalTarget = `${ROUTES.PRESENTATIONS}?tab=documents`;

  const handleBuilder = React.useCallback(() => {
    trackFunnelEvent('reports_entry_redirected', { entry: 'builder', target: canonicalTarget });
    navigate(canonicalTarget, { replace: true });
  }, [canonicalTarget, navigate]);

  const handleManagement = React.useCallback(() => {
    trackFunnelEvent('reports_entry_redirected', { entry: 'management', target: canonicalTarget });
    navigate(canonicalTarget, { replace: true });
  }, [canonicalTarget, navigate]);

  React.useEffect(() => {
    handleBuilder();
  }, [handleBuilder]);

  return null;
};
