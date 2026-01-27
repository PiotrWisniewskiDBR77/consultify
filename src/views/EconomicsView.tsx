/**
 * Economics View (Enterprise Edition)
 *
 * Legacy wrapper - redirects to new EconomicsHub
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

import { EconomicsHub } from '../components/Economics/EconomicsHub';

export const EconomicsView: React.FC = () => {
  return <EconomicsHub />;
};

export default EconomicsView;
