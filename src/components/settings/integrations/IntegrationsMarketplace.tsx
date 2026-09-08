/**
 * IntegrationsMarketplace — DEPRECATED
 *
 * Superseded by ConnectedAppsSettings which provides the real integration catalog.
 * Kept as a stub so barrel exports don't break.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface IntegrationsMarketplaceProps {
  currentUser?: any;
  onUpdateUser?: (updates: any) => void;
}

export const IntegrationsMarketplace: React.FC<IntegrationsMarketplaceProps> = () => {
  const { t } = useTranslation();
  return (
    <div className="p-8 text-center text-c-text-muted text-sm">
      {t(
        'settings.integrationsMarketplace.deprecated',
        'This view has been replaced by Connected Apps in Settings.'
      )}
    </div>
  );
};

export default IntegrationsMarketplace;
