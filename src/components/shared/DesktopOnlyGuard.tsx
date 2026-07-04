import { Monitor } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsMobile } from '../../hooks/useDeviceType';

interface DesktopOnlyGuardProps {
  /** Human-readable name of the gated surface, e.g. "Panel administratora". */
  moduleName?: string;
  children: React.ReactNode;
}

/**
 * MOB-6 — honest "desktop-optimized" notice for dense admin surfaces.
 *
 * The admin / super-admin panels are dense desktop layouts (wide tables,
 * side-by-side preview, multi-column dashboards) that are not yet adapted for
 * small screens. Rather than silently rendering a broken layout, this guard
 * shows a clear notice on phones. It does NOT hard-block: the user can choose
 * "Kontynuuj mimo to" to proceed at their own risk. Full mobile adaptation is
 * a deliberate post-GA item.
 */
export const DesktopOnlyGuard: React.FC<DesktopOnlyGuardProps> = ({ moduleName, children }) => {
  const isMobile = useIsMobile();
  const [forceShow, setForceShow] = useState(false);
  const { t } = useTranslation();

  if (!isMobile || forceShow) {
    return <>{children}</>;
  }

  const surface = moduleName || t('common.thisPanel', 'Ten panel');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
        <Monitor className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {t('admin.desktopOnly.title', 'Najlepiej na większym ekranie')}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-300">
        {t('admin.desktopOnly.body', {
          defaultValue:
            '{{surface}} jest zoptymalizowany na desktop. Na telefonie część układu (tabele, podgląd boczny) może być trudna w obsłudze.',
          surface,
        })}
      </p>
      <button
        type="button"
        onClick={() => setForceShow(true)}
        className="mt-6 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-c-border-subtle dark:text-slate-200 dark:hover:bg-white/5"
      >
        {t('admin.desktopOnly.continue', 'Kontynuuj mimo to')}
      </button>
    </div>
  );
};

export default DesktopOnlyGuard;
