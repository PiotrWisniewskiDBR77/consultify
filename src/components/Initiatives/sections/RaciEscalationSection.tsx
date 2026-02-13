/**
 * RaciEscalationSection
 *
 * Composite section for RACI & Escalation.
 * Reuses initiative wrappers that directly map to MyWork shared components,
 * so behavior stays aligned with Task/Decision artifacts.
 */

import React from 'react';
import { RemindersSection } from './RemindersSection';
import { StakeholdersSection } from './StakeholdersSection';
import type { InitiativeSectionProps } from './types';

export const RaciEscalationSection: React.FC<InitiativeSectionProps> = (props) => {
  return (
    <div className="space-y-6">
      <StakeholdersSection {...props} />
      <RemindersSection {...props} />
    </div>
  );
};
