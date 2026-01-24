/**
 * FullExecutionView
 *
 * Legacy wrapper - redirects to new ExecutionHub
 * This ensures consistent UI regardless of which route/component is used
 */

import React from 'react';

import { ExecutionHub } from '../components/Execution/ExecutionHub';

export const FullExecutionView: React.FC = () => {
  return <ExecutionHub />;
};

export default FullExecutionView;
