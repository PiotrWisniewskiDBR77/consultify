/**
 * Portfolio View
 *
 * DEPRECATED: This view now redirects to InitiativesHub.
 * The new unified ModuleHub pattern is used across all transformation modules.
 */

import React from 'react';

import { InitiativesHub } from '../components/Initiatives/InitiativesHub';

export const PortfolioView: React.FC = () => {
  return <InitiativesHub />;
};

export default PortfolioView;
