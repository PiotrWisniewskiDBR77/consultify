/**
 * Full Reports View
 * Deprecated shim: old management reports entry now resolves to the canonical
 * outputs library documents lane.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

export const FullReportsView: React.FC = () => {
  return <Navigate to="/presentations?tab=documents" replace />;
};
