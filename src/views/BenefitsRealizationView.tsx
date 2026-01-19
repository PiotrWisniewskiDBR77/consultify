/**
 * BenefitsRealizationView
 *
 * Legacy wrapper - redirects to new BenefitsHub
 * This ensures consistent UI regardless of which route/component is used
 */

import React from 'react';

import { BenefitsHub } from '../components/Benefits/BenefitsHub';

export const BenefitsRealizationView: React.FC = () => {
  return <BenefitsHub />;
};

export default BenefitsRealizationView;
