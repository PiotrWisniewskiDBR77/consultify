/**
 * ExperimentsTab - Development > Experiments
 * Wrapper for ABTestingDashboard
 */

import React from 'react';

import { ABTestingDashboard } from '../../components/ABTestingDashboard';

export const ExperimentsTab: React.FC = () => {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <ABTestingDashboard />
    </div>
  );
};

export default ExperimentsTab;
