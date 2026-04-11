/**
 * IntegrationsMarketplace — DEPRECATED
 *
 * Superseded by ConnectedAppsSettings which provides the real integration catalog.
 * Kept as a stub so barrel exports don't break.
 */

import React from 'react';

interface IntegrationsMarketplaceProps {
  currentUser?: any;
  onUpdateUser?: (updates: any) => void;
}

export const IntegrationsMarketplace: React.FC<IntegrationsMarketplaceProps> = () => (
  <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
    This view has been replaced by Connected Apps in Settings.
  </div>
);

export default IntegrationsMarketplace;
