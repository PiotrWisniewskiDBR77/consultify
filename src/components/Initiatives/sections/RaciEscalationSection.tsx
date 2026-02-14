import React from 'react';

import { GovernanceCanvas } from '../../shared/NModeSections';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const RaciEscalationSection: React.FC<InitiativeSectionProps> = ({ readonly }) => {
  const {
    stakeholders,
    setStakeholders,
    reminders,
    setReminders,
    escalationRules,
    setEscalationRules,
    users,
    initiativeId,
  } = useInitiativeContext();

  return (
    <GovernanceCanvas
      stakeholders={stakeholders}
      setStakeholders={setStakeholders}
      reminders={reminders}
      setReminders={setReminders}
      escalationRules={escalationRules}
      setEscalationRules={setEscalationRules}
      users={users.map((u) => ({
        id: u.id,
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || '',
      }))}
      artifactId={initiativeId}
      locked={readonly}
    />
  );
};
