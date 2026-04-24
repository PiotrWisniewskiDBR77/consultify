import React from 'react';
import { Navigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

export const KnowledgeBaseEntryView: React.FC = () => (
  <Navigate to={ROUTES.KNOWLEDGE_BASE_PUBLIC} replace />
);

export default KnowledgeBaseEntryView;
