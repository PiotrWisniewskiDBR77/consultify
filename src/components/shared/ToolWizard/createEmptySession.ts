/**
 * Factory for creating an empty WizardSessionData.
 */

import type { WizardSessionData } from './types';

export function createEmptyWizardSession(sessionId: string, toolType: string): WizardSessionData {
  const now = new Date().toISOString();
  return {
    sessionId,
    toolType,
    status: 'DRAFT',
    currentStep: 'define',
    define: {},
    inputs: {},
    assumptions: [],
    workData: null,
    review: {
      summaries: [],
      missingItems: [],
      aiSuggestions: [],
    },
    outputs: [],
    locked: false,
    createdAt: now,
    updatedAt: now,
  };
}
