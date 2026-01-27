/**
 * ImplementationView - Implementation Module (Module 4: Wdrożenie)
 *
 * The heart of PMO - comprehensive view for managing executing initiatives.
 * Uses the unified ExecutionHub component with ModuleHub pattern (Golden Standard).
 *
 * Features:
 * - Executive Dashboard with Portfolio Health Score
 * - 5 View modes: Table, Grid, Kanban, Timeline, Calendar
 * - RAID Log management
 * - Decisions tracking
 * - AI-powered insights
 * - Drag & Drop task management
 *
 * @see docs/wdrozenia/UI_UX_GOLDEN_STANDARD.md
 */

import React from 'react';

import { ExecutionHub } from '../components/Execution/ExecutionHub';
import { SplitLayout } from '../components/layout/SplitLayout';
import { AppView } from '../types';

export const ImplementationView: React.FC = () => {
  return (
    <SplitLayout title="Implementation Center" currentView={AppView.IMPLEMENTATION}>
      <ExecutionHub />
    </SplitLayout>
  );
};

export default ImplementationView;
