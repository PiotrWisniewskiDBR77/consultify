import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export const LegacyAssessmentReportRedirect: React.FC = () => {
  const params = useParams<{ reportId?: string }>();
  const reportId = params.reportId;
  if (!reportId) return <Navigate to="/reports/builder" replace />;
  return <Navigate to={`/reports/builder/${encodeURIComponent(reportId)}`} replace />;
};
