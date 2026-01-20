/**
 * Full Reports View
 * Main entry point for Management Reports module
 *
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 */

import React from 'react';

import { SplitLayout } from '../components/layout/SplitLayout';
import { ReportsHub } from '../components/Reports/Management/ReportsHub';

export const FullReportsView: React.FC = () => {
  return (
    <SplitLayout title="Management Reports">
      <ReportsHub />
    </SplitLayout>
  );
};
