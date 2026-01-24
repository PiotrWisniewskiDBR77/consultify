/**
 * HealthMonitoringTab - Operations > Health Monitoring
 * Wrapper for LLMHealthPanel
 */

import React from 'react';

import { LLMHealthPanel } from '../../../../components/Admin/LLMHealthPanel';

export const HealthMonitoringTab: React.FC = () => {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <LLMHealthPanel />
    </div>
  );
};

export default HealthMonitoringTab;
