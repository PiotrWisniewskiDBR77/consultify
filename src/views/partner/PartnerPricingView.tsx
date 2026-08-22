import React from 'react';
import { Navigate } from 'react-router-dom';

import { ROUTES } from '../../routes/routeConfig';

/**
 * PAR-OWN-001: draft pricing/tier configuration is not a publishable offer.
 * Keep old bookmarks safe by sending them to the canonical program overview.
 */
export const PartnerPricingView: React.FC = () => (
  <Navigate replace to={`${ROUTES.BECOME_PARTNER}#commercial-framework`} />
);

export default PartnerPricingView;
