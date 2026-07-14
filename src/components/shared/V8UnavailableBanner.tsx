import { AlertTriangle } from 'lucide-react';
import React from 'react';

import { useV8 } from '@/providers/V8Provider';

interface V8UnavailableBannerProps {
  moduleName?: string;
  children: React.ReactNode;
}

/**
 * Wraps a module that depends on V8 APIs. When V8 is globally disabled
 * (ENABLE_V8_GLOBAL=false on the server), shows a clear "module unavailable"
 * banner instead of empty content or silent 404s.
 *
 * Usage: wrap the module's root element — banner is transparent when V8 is on.
 */
export const V8UnavailableBanner: React.FC<V8UnavailableBannerProps> = ({
  moduleName,
  children,
}) => {
  const { isV8Enabled, isLoading } = useV8();

  if (!isLoading && !isV8Enabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center space-y-3">
        <AlertTriangle size={32} className="text-amber-400 dark:text-amber-500" />
        <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
          {moduleName ? `${moduleName} is unavailable` : 'Module unavailable'}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          This module requires server-side V8 features to be enabled. Contact your administrator to
          activate this module.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
