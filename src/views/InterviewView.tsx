/**
 * InterviewView - Interview Module (Discovery Interview)
 *
 * Full page view for the Interview module.
 * Uses the unified InterviewHub component with ModuleHub pattern (Golden Standard).
 *
 * Features:
 * - ModuleHub navigation with Interview/Sessions tabs
 * - Table and Grid views for session history
 * - Status filters (Active, Completed)
 * - Search functionality
 * - New Session button
 *
 * @see docs/wdrozenia/UI_UX_GOLDEN_STANDARD.md
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { InterviewHub } from '@/components/Interview/InterviewHub';
import { SplitLayout } from '@/components/layout/SplitLayout';
import { AppView } from '@/types';

export const InterviewView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <SplitLayout
      title={t('interview.title', 'Discovery Interview')}
      currentView={AppView.DISCOVERY_CONSULTANT}
    >
      <InterviewHub />
    </SplitLayout>
  );
};

export default InterviewView;
