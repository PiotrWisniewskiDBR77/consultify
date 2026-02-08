/**
 * DecisionsHub - Main hub for decision management.
 * ModuleHub pattern for the Decisions module.
 */

import React from 'react';

import { DecisionInbox } from './DecisionInbox';

export const DecisionsHub: React.FC = () => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-4">Decisions Hub</h2>
      <DecisionInbox />
    </div>
  );
};

export default DecisionsHub;
