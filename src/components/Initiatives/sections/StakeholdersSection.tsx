/**
 * StakeholdersSection wrapper
 */

import React from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import type {
  Stakeholder,
  StakeholderNotificationSettings,
  StakeholderRole,
} from '../../MyWork/shared';
import { StakeholdersSection as SharedStakeholdersSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const StakeholdersSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { stakeholders, setStakeholders, users, initiativeId } = useInitiativeContext();

  const toRaciLetter = (role: StakeholderRole): 'A' | 'R' | 'C' | 'I' => {
    if (role === 'accountable') return 'A';
    if (role === 'responsible') return 'R';
    if (role === 'consulted') return 'C';
    return 'I';
  };

  return (
    <SharedStakeholdersSection
      stakeholders={stakeholders}
      availableUsers={users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
      }))}
      onAdd={async (
        userId: string,
        role: StakeholderRole,
        notificationSettings: StakeholderNotificationSettings
      ) => {
        const user = users.find((u) => u.id === userId);
        try {
          const res = await Api.post(`/initiatives/${initiativeId}/stakeholders`, {
            userId,
            // Persist RACI in raciType; backend maps to DB-safe role internally.
            raciType: toRaciLetter(role),
            role,
            influenceLevel: 3,
            interestLevel: 3,
          });
          const id = res?.id || res?.stakeholderId || Math.random().toString(36).substr(2, 9);
          const newStakeholder: Stakeholder = {
            id,
            decisionId: initiativeId,
            userId,
            userName: user ? `${user.firstName} ${user.lastName}` : undefined,
            userEmail: user?.email,
            role,
            notificationSettings,
          };
          setStakeholders([...stakeholders, newStakeholder]);
          toast.success(t('initiatives.stakeholdersSection.stakeholderAdded'));
        } catch (e: any) {
          toast.error(e?.message || t('initiatives.stakeholdersSection.failedAddStakeholder'));
        }
      }}
      onUpdate={(id: string, updates: Partial<Stakeholder>) => {
        setStakeholders(stakeholders.map((s) => (s.id === id ? { ...s, ...updates } : s)));
      }}
      onRemove={async (id: string) => {
        setStakeholders(stakeholders.filter((s) => s.id !== id));
        try {
          await Api.delete(`/initiatives/${initiativeId}/stakeholders/${id}`);
        } catch {
          // best-effort
        }
        toast.success(t('initiatives.stakeholdersSection.stakeholderRemoved'));
      }}
    />
  );
};
