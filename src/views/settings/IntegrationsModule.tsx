/**
 * IntegrationsModule — DEPRECATED
 *
 * This module is not mounted in any route. The real integration surfaces are:
 * - User:  ConnectedAppsSettings  (/settings/connected-apps)
 * - Admin: UnifiedSyncHub         (/admin/integrations)
 *
 * Kept as a minimal stub so existing imports (if any) do not break.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { User } from '../../types';

interface IntegrationsModuleProps {
  initialTab?: string;
  currentUser: User;
}

export const IntegrationsModule: React.FC<IntegrationsModuleProps> = () => {
  const { t } = useTranslation();
  return (
    <div className="p-8 text-center text-c-text-muted">
      <p className="text-sm">
        {t(
          'settings.integrations.deprecated',
          'This view has been consolidated. Please use Connected Apps in Settings or the Integration Hub in Admin.'
        )}
      </p>
    </div>
  );
};

export default IntegrationsModule;
