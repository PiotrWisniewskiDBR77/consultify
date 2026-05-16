import React from 'react';

import type { PresentationRuntimeEvent } from '@/services/presentationRuntimeEvents';

import { AgentActivityPanel } from './AgentActivityPanel';

interface AgentPanelProps {
  onClose?: () => void;
  events?: PresentationRuntimeEvent[];
  degraded?: boolean;
  reason?: string;
}

/**
 * Legacy compatibility wrapper. Deck Builder no longer owns a conversational
 * agent surface; free-form AI instructions belong to Teresa (`UnifiedChatPanel`).
 */
export const AgentPanel: React.FC<AgentPanelProps> = ({
  events = [],
  degraded = false,
  reason,
}) => <AgentActivityPanel events={events} degraded={degraded} reason={reason} />;

export default AgentPanel;
