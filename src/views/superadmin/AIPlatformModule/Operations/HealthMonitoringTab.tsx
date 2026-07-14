/**
 * HealthMonitoringTab - Operations > Health Monitoring
 * Wrapper for LLMHealthPanel
 */

import React from 'react';

import { LLMHealthPanel } from '../../components/LLMHealthPanel';
import { V8AdminDiagnosticsPanel } from '../../components/V8AdminDiagnosticsPanel';

export const HealthMonitoringTab: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto p-6">
      <LLMHealthPanel />
      <div className="mt-6">
        <V8AdminDiagnosticsPanel />
      </div>
    </div>
  );
};

export default HealthMonitoringTab;
