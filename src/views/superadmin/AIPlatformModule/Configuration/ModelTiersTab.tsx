/**
 * ModelTiersTab - Configuration > Model Tiers
 * Wrapper for ModelTierAssignments
 */

import React from 'react';

import { ModelTierAssignments } from '../../../../components/SuperAdmin/ModelTierAssignments';

export const ModelTiersTab: React.FC = () => {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <ModelTierAssignments />
    </div>
  );
};

export default ModelTiersTab;
