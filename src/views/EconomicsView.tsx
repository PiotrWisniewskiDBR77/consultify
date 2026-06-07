/**
 * Economics View (Enterprise Edition)
 *
 * Legacy wrapper - renders FinanceHub
 * This ensures consistent UI regardless of which route/component is used
 *
 * Features:
 * - Analysis Catalog with grid/table view
 * - Evaluation Tool for scoring
 * - Results visualization with radar charts
 * - Comparison view
 * - Version history
 * - PDF/Excel export
 * - AI recommendations
 */

import React from 'react';

import { FinanceHub } from '../components/Economics/FinanceHub';

export const EconomicsView: React.FC = () => {
  return <FinanceHub />;
};

export default EconomicsView;
