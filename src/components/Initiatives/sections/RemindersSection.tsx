/**
 * RemindersSection wrapper
 */

import React from 'react';

import type { EscalationRule } from '../../MyWork/shared';
import { EscalationRulesSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const RemindersSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const {
    reminders,
    setReminders,
    escalationRules,
    setEscalationRules,
    thresholds,
    setThresholds,
    users,
    initiative,
  } = useInitiativeContext();

  const escalation: EscalationRule | null =
    escalationRules.length > 0
      ? {
          id: escalationRules[0].id,
          enabled: escalationRules[0].enabled,
          escalateTo: escalationRules[0].escalateTo,
          escalateToName: escalationRules[0].escalateToName,
          afterDays: escalationRules[0].afterDays,
          message: escalationRules[0].message,
        }
      : null;

  return (
    <EscalationRulesSection
      reminders={reminders}
      escalation={escalation}
      thresholds={thresholds}
      availableUsers={users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))}
      onRemindersChange={(nextReminders) =>
        setReminders(
          nextReminders.map((rule) => ({
            ...rule,
            delivery: {
              coreChannels: [
                ...(rule.inAppNotification ? ['in_app' as const] : []),
                ...(rule.emailNotification ? ['email' as const] : []),
              ],
              integrationChannels: [],
              syncTargets: [],
            },
          }))
        )
      }
      onEscalationChange={(nextEscalation) => {
        if (!nextEscalation) {
          setEscalationRules([]);
          return;
        }

        setEscalationRules((prev) => {
          const existing = prev[0];
          const nextRule = {
            id: nextEscalation.id,
            enabled: nextEscalation.enabled,
            escalateTo: nextEscalation.escalateTo,
            escalateToName: nextEscalation.escalateToName,
            afterDays: nextEscalation.afterDays,
            message: nextEscalation.message,
            warningDays: existing?.warningDays ?? thresholds.warningDays,
            criticalDays: existing?.criticalDays ?? thresholds.criticalDays,
            escalationMode: existing?.escalationMode ?? 'notify_only',
            delivery: existing?.delivery ?? {
              coreChannels: ['in_app'],
              integrationChannels: [],
              syncTargets: [],
            },
          };
          return [nextRule];
        });
      }}
      onThresholdsChange={setThresholds}
      dueDate={initiative?.plannedEndDate || ''}
    />
  );
};
