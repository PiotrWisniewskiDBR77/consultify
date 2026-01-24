/**
 * FullInitiativesView
 *
 * Legacy wrapper - redirects to new InitiativesHub
 * This ensures consistent UI regardless of which route/component is used
 */

import React from 'react';

import { InitiativesHub } from '../components/Initiatives/InitiativesHub';

export const FullInitiativesView: React.FC = () => {
  return <InitiativesHub />;
};

export default FullInitiativesView;
