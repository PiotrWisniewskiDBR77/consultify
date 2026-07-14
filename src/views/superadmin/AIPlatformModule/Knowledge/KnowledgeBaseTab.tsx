/**
 * KnowledgeBaseTab - Knowledge > Knowledge Base (Idea Inbox)
 * Wrapper for AdminKnowledgeView candidates tab
 */

import React from 'react';

import { AdminKnowledgeView } from '../../components/AdminKnowledgeView';

export const KnowledgeBaseTab: React.FC = () => {
  // Render the AdminKnowledgeView - it will default to 'candidates' tab
  // The component manages its own tab state internally
  return <AdminKnowledgeView />;
};

export default KnowledgeBaseTab;
