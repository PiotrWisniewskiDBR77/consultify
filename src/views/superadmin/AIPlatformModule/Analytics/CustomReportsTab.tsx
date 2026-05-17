/**
 * CustomReportsTab - Analytics > Custom Reports
 * NEW: Report builder and scheduled reports
 */

import React from 'react';

import SavedReportsView from '../../../superadmin/analytics/SavedReportsView';

export const CustomReportsTab: React.FC = () => {
  // Reuse fully-wired SuperAdmin reports builder (real DB + execute + schedule).
  return <SavedReportsView />;
};

export default CustomReportsTab;
