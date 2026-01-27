/**
 * MyWorkView - Unified My Work module
 * Full page view with ModuleHub pattern (Golden Standard)
 *
 * Features:
 * - ModuleHub navigation with Tasks/Decisions/Notifications tabs
 * - Context-sensitive filters and action buttons
 * - Full-width content area
 *
 * @see docs/wdrozenia/UI_UX_GOLDEN_STANDARD.md
 */

import React from 'react';

import { SplitLayout } from '../components/layout/SplitLayout';
import { MyWorkHub } from '../components/MyWork/MyWorkHub';
import { AppView } from '../types';

interface MyWorkViewProps {
  currentUser?: {
    id: string;
    name?: string;
    email?: string;
  };
  onNavigate?: (view: string) => void;
}

export const MyWorkView: React.FC<MyWorkViewProps> = ({ onNavigate }) => {
  return (
    <div data-testid="mywork-view">
      <SplitLayout title="My Work" currentView={AppView.MY_WORK}>
        <MyWorkHub onNavigate={onNavigate} />
      </SplitLayout>
    </div>
  );
};

export default MyWorkView;
