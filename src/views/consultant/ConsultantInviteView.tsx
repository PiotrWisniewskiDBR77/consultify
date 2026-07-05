import { ArrowLeft, Clock, Copy, Send } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface Invite {
  id: string;
  invite_code: string;
  invite_type: string;
  target_email?: string;
  expires_at: string;
  uses_count: number;
  max_uses: number;
  created_at: string;
}

export const ConsultantInviteView = () => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [type, setType] = useState('TRIAL_ORG');
  const [targetEmail, setTargetEmail] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [link, setLink] = useState('');

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    try {
      const data = await Api.getConsultantInvites();
      setInvites(data);
    } catch (error: any) {
      console.error('Failed to load invites:', error);
      toast.error(error instanceof Error ? error.message : t('consultant.invites.noInvites'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const result = await Api.createConsultantInvite({
        email: targetEmail || '',
        invitationType: type,
        firmName: targetCompany || undefined,
      });

      if (result.link) {
        setLink(result.link);
      }

      toast.success('Invite Created Successfully');
      setTargetEmail('');
      setTargetCompany('');
      loadInvites();
    } catch (error: any) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to create invite');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Code ${code} copied!`);
  };

  return (
    <div className="flex flex-col h-full bg-c-surface-raised dark:bg-c-bg p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <button
          onClick={() => setCurrentView(AppView.CONSULTANT_PANEL)}
          className="flex items-center gap-2 text-c-text-muted hover:text-c-text dark:hover:text-c-text transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          {t('consultant.invites.backToPanel')}
        </button>

        <h1 className="text-2xl font-bold text-c-text">
          {t('consultant.invites.generateInvites')}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Access Generation Form */}
          <div className="bg-c-surface-raised rounded-xl shadow-sm border border-c-border-subtle p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Send size={18} className="text-c-accent" />
              {t('consultant.invites.newInvitation')}
            </h2>

            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('consultant.invites.inviteType')}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle rounded-lg text-sm focus:outline-none focus:border-c-accent"
                >
                  <option value="TRIAL_ORG">{t('consultant.invites.typeTrialOrg')}</option>
                  <option value="TRIAL_USER">{t('consultant.invites.typeTrialUser')}</option>
                  <option value="ORG_ADD_CONSULTANT">{t('consultant.invites.typeAddMe')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('consultant.invites.companyName')}
                </label>
                <input
                  type="text"
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  placeholder={t('consultant.invites.companyPlaceholder')}
                  className="w-full px-3 py-2 bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle rounded-lg text-sm focus:outline-none focus:border-c-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('consultant.invites.targetEmail')}
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder={t('consultant.invites.emailPlaceholder')}
                  className="w-full px-3 py-2 bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle rounded-lg text-sm focus:outline-none focus:border-c-accent"
                />
                <p className="text-xs text-c-text-secondary dark:text-c-text-muted mt-1">
                  {t('consultant.invites.emailHint')}
                </p>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2.5 bg-c-text text-c-surface hover:opacity-90 rounded-lg font-medium shadow-md transition-colors disabled:opacity-50"
              >
                {isCreating
                  ? t('consultant.invites.generating')
                  : t('consultant.invites.generateCode')}
              </button>
            </form>
          </div>

          {/* History */}
          <div className="bg-c-surface-raised rounded-xl shadow-sm border border-c-border-subtle flex flex-col">
            <div className="px-6 py-4 border-b border-c-border-subtle text-lg font-semibold flex items-center gap-2">
              <Clock size={18} className="text-c-info" />
              {t('consultant.invites.recentInvites')}
            </div>
            <div className="flex-1 overflow-y-auto max-h-[400px] p-2">
              {isLoading ? (
                <div className="p-4 text-center text-c-text-secondary dark:text-c-text-muted">
                  {t('consultant.panel.loading')}
                </div>
              ) : invites.length === 0 ? (
                <div className="p-8 text-center text-c-text-secondary dark:text-c-text-muted text-sm">
                  {t('consultant.invites.noInvites')}
                </div>
              ) : (
                <div className="space-y-2">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="p-3 bg-c-surface-raised dark:bg-c-surface-raised rounded-lg border border-c-border-subtle"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-mono font-bold text-lg tracking-wider text-c-accent dark:text-c-accent">
                          {invite.invite_code}
                        </div>
                        <button
                          onClick={() => copyToClipboard(invite.invite_code)}
                          className="p-1.5 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded text-c-text-muted"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <div className="text-xs text-c-text-muted space-y-1">
                        <div className="flex justify-between">
                          <span>{t('consultant.invites.labelType')}</span>
                          <span className="font-medium text-c-text-secondary">
                            {invite.invite_type}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('consultant.invites.labelUses')}</span>
                          <span>
                            {invite.uses_count} / {invite.max_uses}
                          </span>
                        </div>
                        {invite.target_email && (
                          <div className="flex justify-between">
                            <span>{t('consultant.invites.labelTo')}</span>
                            <span className="truncate max-w-[120px]">{invite.target_email}</span>
                          </div>
                        )}
                        <div className="pt-1 border-t border-c-border-subtle mt-1 opacity-70">
                          {t('consultant.invites.labelExp')}{' '}
                          {new Date(invite.expires_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
