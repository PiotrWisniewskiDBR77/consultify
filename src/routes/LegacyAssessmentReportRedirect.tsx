import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { Api } from '@/services/api';

export const LegacyAssessmentReportRedirect: React.FC = () => {
  const params = useParams<{ reportId?: string }>();
  const reportId = params.reportId;
  const [target, setTarget] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!reportId) return;
    let cancelled = false;

    Api.get(`/assessment-reports/${encodeURIComponent(reportId)}/full`)
      .then((data: any) => {
        if (cancelled) return;
        const r = data?.report || data;
        const builderId = r?.builderReportId || r?.builder_report_id || null;
        setTarget(builderId ? `/reports/builder/${encodeURIComponent(String(builderId))}` : null);
      })
      .catch(() => {
        if (cancelled) return;
        setTarget(null);
      });

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (!reportId) return <Navigate to="/reports/builder" replace />;

  // If we can't resolve a linked report builder id, fall back to previous behavior
  return <Navigate to={target || `/reports/builder/${encodeURIComponent(reportId)}`} replace />;
};
