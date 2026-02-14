/**
 * DependenciesSection wrapper for Initiatives
 *
 * Bridges initiative-level dependencies (from InitiativeContext)
 * into the shared DependenciesSection component using the
 * externalDependencies prop to bypass the task-level API fetch.
 */

import React from 'react';

import { Api } from '@/services/api';

import { DependenciesSection as SharedDependenciesSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const DependenciesSection: React.FC<InitiativeSectionProps> = () => {
  const { initiativeId, dependencies, setDependencies, onOpenTask } = useInitiativeContext();

  const refresh = React.useCallback(async () => {
    if (!initiativeId) return;
    try {
      const res = await Api.get(`/initiatives/${initiativeId}/task-dependencies`);
      setDependencies(Array.isArray(res?.dependencies) ? res.dependencies : []);
    } catch {
      // best-effort
    }
  }, [initiativeId, setDependencies]);

  return (
    <SharedDependenciesSection
      externalDependencies={dependencies}
      onOpenTask={onOpenTask}
      readOnly={false}
      onRefreshExternalDependencies={refresh}
      showSampleDataWhenEmpty
    />
  );
};
