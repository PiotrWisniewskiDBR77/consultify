/**
 * DependenciesSection wrapper
 */

import React from 'react';

import type { TaskDependency } from '../../MyWork/shared';
import { DependenciesSection as SharedDependenciesSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const DependenciesSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { dependencies, setDependencies, isPolish } = useInitiativeContext();

  return (
    <SharedDependenciesSection
      dependencies={dependencies}
      onAdd={(type) => {
        const newDep: TaskDependency = {
          id: Math.random().toString(36).substr(2, 9),
          taskId: '',
          taskTitle: isPolish ? 'Nowa zależność' : 'New dependency',
          type,
        };
        setDependencies([...dependencies, newDep]);
      }}
      onRemove={(id) => setDependencies(dependencies.filter((d) => d.id !== id))}
      expanded={expanded}
      onToggleExpand={onToggle}
    />
  );
};
