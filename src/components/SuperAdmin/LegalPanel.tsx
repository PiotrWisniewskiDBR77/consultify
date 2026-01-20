/**
 * LegalPanel - placeholder for legal document configuration
 */

import React from 'react';

export const LegalPanel: React.FC = () => {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold text-navy-900 dark:text-white">Legal Documents</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Configure terms, policies, and compliance documents here.
      </p>
    </div>
  );
};

export default LegalPanel;
