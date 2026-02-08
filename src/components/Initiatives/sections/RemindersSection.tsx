/**
 * RemindersSection wrapper
 */

import React from 'react';

import { EscalationRulesSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const RemindersSection: React.FC<InitiativeSectionProps> = ({ sectionType, expanded, onToggle }) => {
  const { reminders, setReminders, escalation, setEscalation, thresholds, setThresholds, users, initiative } = useInitiativeContext();

  return (
    <EscalationRulesSection
      reminders={reminders}
      escalation={escalation}
      thresholds={thresholds}
      availableUsers={users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))}
      onRemindersChange={setReminders}
      onEscalationChange={setEscalation}
      onThresholdsChange={setThresholds}
      dueDate={initiative?.plannedEndDate || ''}
    />
  );
};
