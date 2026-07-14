import { Loader2, Save, Share2, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';

type CollaborationControls = {
  guestAccessEnabled: boolean;
  externalLinkSharing: boolean;
  toolApprovalRequired: boolean;
};

const DEFAULT_CONTROLS: CollaborationControls = {
  guestAccessEnabled: false,
  externalLinkSharing: false,
  toolApprovalRequired: true,
};

export const AdminCollaborationControlsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [controls, setControls] = useState<CollaborationControls>(DEFAULT_CONTROLS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await Api.getAdminCollaborationControls();
        setControls({ ...DEFAULT_CONTROLS, ...(response?.controls || {}) });
      } catch (error: any) {
        toast.error(
          error?.message ||
            t(
              'admin.security.collaborationControls.errors.load',
              'Failed to load collaboration controls'
            )
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [t]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.updateAdminCollaborationControls(controls);
      toast.success(
        t('admin.security.collaborationControls.toasts.saved', 'Collaboration controls saved')
      );
    } catch (error: any) {
      toast.error(
        error?.message ||
          t(
            'admin.security.collaborationControls.errors.save',
            'Failed to save collaboration controls'
          )
      );
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    {
      key: 'guestAccessEnabled' as const,
      title: t('admin.security.collaborationControls.cards.guestAccess.title', 'Guest access'),
      description: t(
        'admin.security.collaborationControls.cards.guestAccess.description',
        'Allows restricted guest collaborators in the workspace.'
      ),
      denial: t(
        'admin.security.collaborationControls.cards.guestAccess.denial',
        'When disabled, guest role assignment is blocked.'
      ),
      icon: Users,
    },
    {
      key: 'externalLinkSharing' as const,
      title: t(
        'admin.security.collaborationControls.cards.externalLinkSharing.title',
        'External link sharing'
      ),
      description: t(
        'admin.security.collaborationControls.cards.externalLinkSharing.description',
        'Controls whether members can share workspace artifacts externally.'
      ),
      denial: t(
        'admin.security.collaborationControls.cards.externalLinkSharing.denial',
        'When disabled, outbound share flows must stop at policy check.'
      ),
      icon: Share2,
    },
    {
      key: 'toolApprovalRequired' as const,
      title: t(
        'admin.security.collaborationControls.cards.toolApproval.title',
        'Tool approval required'
      ),
      description: t(
        'admin.security.collaborationControls.cards.toolApproval.description',
        'Requires admin approval before tool usage is enabled.'
      ),
      denial: t(
        'admin.security.collaborationControls.cards.toolApproval.denial',
        'When enabled, users cannot self-activate new tools.'
      ),
      icon: Save,
    },
  ];

  if (loading) {
    return <LoadingState variant="spinner" className="h-56" />;
  }

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

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className="rounded-xl border border-slate-200 p-4 dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                      <Icon className="h-4 w-4 text-primary-500" />
                      {card.title}
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {card.description}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{card.denial}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={controls[card.key]}
                      onChange={(event) =>
                        setControls((prev) => ({ ...prev, [card.key]: event.target.checked }))
                      }
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-navy-900 peer-checked:after:translate-x-full dark:bg-navy-700" />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-c-text text-c-bg px-4 py-2 text-sm font-medium hover:bg-c-text-secondary disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('admin.security.collaborationControls.actions.save', 'Save controls')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminCollaborationControlsPanel;
