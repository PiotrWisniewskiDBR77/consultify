/**
 * DependenciesSection wrapper for Initiatives
 *
 * Bridges initiative-level dependencies (from InitiativeContext)
 * into the shared DependenciesSection component using the
 * externalDependencies prop to bypass the task-level API fetch.
 */

import React from 'react';

import { DependenciesSection as SharedDependenciesSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const DependenciesSection: React.FC<InitiativeSectionProps> = () => {
  const { dependencies, onOpenTask } = useInitiativeContext();

  return (
    <SharedDependenciesSection
      externalDependencies={dependencies}
      onOpenTask={onOpenTask}
      readOnly={false}
      showSampleDataWhenEmpty
    />
  );
};
