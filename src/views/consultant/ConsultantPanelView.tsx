import {
  Building,
  ExternalLink,
  LogOut as LucideLogOut,
  Plus,
  Settings as LucideSettings,
  Users as LucideUsers,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface LinkedOrg {
  id: string;
  name: string;
  status: string;
  role_in_org: string;
  link_status: string;
  linked_at: string;
}

export const ConsultantPanelView = () => {
  const { t } = useTranslation();
  const { setCurrentView, currentUser, logout: appLogout } = useAppStore();
  const [linkedOrgs, setLinkedOrgs] = useState<LinkedOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLinkedOrgs();
  }, []);

  const loadLinkedOrgs = async () => {
    try {
      setIsLoading(true);
      // Assuming Api helper handles auth headers
      const data = await Api.getConsultantOrgs();
      setLinkedOrgs(data);
    } catch (error) {
      console.error(error);
      toast.error(t('consultant.panel.loadingError') || 'Error loading organizations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchToOrg = (orgId: string) => {
    // Here we would ideally token-exchange or set the org context
    // For now, let's assume we can navigate if the backend permits.
    // In a real multi-tenant app, this might involve a full reload or context switch API call.
    toast.success(`Switching to organization context: ${orgId}`);
    // TODO: Implement actual context switch logic in AppStore/Backend
  };

  return (
    <div className="flex flex-col h-full bg-c-surface-raised dark:bg-c-bg p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-c-text">
              {t('consultant.panel.title')}
            </h1>
            <p className="text-c-text-muted mt-1">
              {t('consultant.panel.welcome', { name: currentUser?.firstName || 'Consultant' })}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentView(AppView.CONSULTANT_INVITES)}
              className="flex items-center gap-2 px-4 py-2 bg-c-surface-raised text-c-accent border border-c-accent rounded-lg hover:bg-c-accent-soft transition-colors font-medium shadow-sm"
            >
              <Plus size={18} />
              {t('consultant.panel.createInvite')}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-c-surface-raised rounded-xl shadow-sm border border-c-border-subtle overflow-hidden">
            <div className="px-6 py-4 border-b border-c-border-subtle flex items-center justify-between bg-c-surface-raised dark:bg-c-surface-raised">
              <h2 className="text-lg font-semibold text-c-text flex items-center gap-2">
                <Building size={20} className="text-c-accent" />
                {t('consultant.panel.linkedOrgs')}
              </h2>
              <span className="text-xs font-medium px-2 py-1 bg-c-surface-raised text-c-text-secondary rounded-full">
                {t('consultant.panel.activeCount', { count: linkedOrgs.length })}
              </span>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-c-text-secondary dark:text-c-text-muted">
                {t('consultant.panel.loading')}
              </div>
            ) : linkedOrgs.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-c-surface-raised dark:bg-c-surface rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building size={32} className="text-c-text-secondary dark:text-c-text-muted" />
                </div>
                <h3 className="text-lg font-medium text-c-text mb-2">
                  {t('consultant.panel.noOrgsTitle')}
                </h3>
                <p className="text-c-text-muted max-w-sm mx-auto mb-6">
                  {t('consultant.panel.noOrgsMessage')}
                </p>
                <button
                  onClick={() => setCurrentView(AppView.CONSULTANT_INVITES)}
                  className="px-4 py-2 bg-c-text text-c-surface hover:opacity-90 rounded-lg transition-colors font-medium"
                >
                  {t('consultant.panel.inviteClient')}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-c-border-subtle dark:divide-white/5">
                {linkedOrgs.map((org) => (
                  <div
                    key={org.id}
                    className="p-6 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-c-tag-1 text-white flex items-center justify-center font-bold text-xl uppercase">
                          {org.name.substring(0, 2)}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-c-text group-hover:text-c-accent transition-colors">
                            {org.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-c-text-muted mt-1">
                            <span className="capitalize">{org.status.toLowerCase()}</span>
                            <span className="w-1 h-1 bg-c-border rounded-full"></span>
                            <span className="capitalize text-c-text-secondary dark:text-c-text-muted">
                              {t('consultant.panel.role', {
                                role: org.role_in_org.toLowerCase(),
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleSwitchToOrg(org.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-c-surface-raised border border-c-border-subtle text-c-text-secondary rounded-lg hover:border-c-accent hover:text-c-accent dark:hover:text-c-accent transition-all font-medium text-sm"
                        >
                          {t('consultant.panel.openWorkspace')}
                          <ExternalLink size={16} />
                        </button>
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
  );
};
