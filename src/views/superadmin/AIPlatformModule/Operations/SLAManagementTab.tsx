/**
 * SLAManagementTab - Operations > SLA Management
 * Wrapper for SLADashboard
 */

import React from 'react';

import { SLADashboard } from '../../components/SLADashboard';

export const SLAManagementTab: React.FC = () => {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <SLADashboard />
    </div>
  );
};

export default SLAManagementTab;
