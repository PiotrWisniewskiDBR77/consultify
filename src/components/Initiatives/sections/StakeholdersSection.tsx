/**
 * StakeholdersSection wrapper
 */

import React from 'react';
import toast from 'react-hot-toast';

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
  const { stakeholders, setStakeholders, users, initiativeId, isPolish } = useInitiativeContext();

  return (
    <SharedStakeholdersSection
      stakeholders={stakeholders}
      availableUsers={users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
      }))}
      onAdd={(
        userId: string,
        role: StakeholderRole,
        notificationSettings: StakeholderNotificationSettings
      ) => {
        const user = users.find((u) => u.id === userId);
        const newStakeholder: Stakeholder = {
          id: Math.random().toString(36).substr(2, 9),
          decisionId: initiativeId,
          userId,
          userName: user ? `${user.firstName} ${user.lastName}` : undefined,
          userEmail: user?.email,
          role,
          notificationSettings,
        };
        setStakeholders([...stakeholders, newStakeholder]);
        toast.success(isPolish ? 'Dodano interesariusza' : 'Stakeholder added');
      }}
      onUpdate={(id: string, updates: Partial<Stakeholder>) => {
        setStakeholders(stakeholders.map((s) => (s.id === id ? { ...s, ...updates } : s)));
      }}
      onRemove={(id: string) => {
        setStakeholders(stakeholders.filter((s) => s.id !== id));
        toast.success(isPolish ? 'Usunięto interesariusza' : 'Stakeholder removed');
      }}
    />
  );
};
