import { Link2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * DEC-2026-08-24-12 (owner decision on TRI-MUST-02) — the three switches this
 * panel used to render (guest access, external link sharing, tool approval
 * required) write to and read from adminP32.routes.ts / the P32 registry,
 * but nothing in the product ever consults those values: grepping the
 * codebase for a consumer turns up only the storage layer and this panel's
 * own tests. The panel therefore looked like a working policy control while
 * actually being a no-op — exactly the "policy placebo" the owner ruled out.
 *
 * Per the owner's decision the controls are hidden (not deleted — the
 * backend route/registry stay in place) until real enforcement ships as its
 * own, separately-accepted, post-MVP task. This placeholder replaces them.
 */
export const AdminCollaborationControlsPanel: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('admin.security.collaborationControls.title', 'Collaboration Controls')}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t(
            'admin.security.collaborationControls.description',
            'Canonical P32 controls for guest access, sharing, and tool approval.'
          )}
        </p>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/15 dark:bg-white/5">
          <Link2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t(
              'admin.security.collaborationControls.plannedNotice',
              'Planned — this policy will be enforced once implemented.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminCollaborationControlsPanel;
