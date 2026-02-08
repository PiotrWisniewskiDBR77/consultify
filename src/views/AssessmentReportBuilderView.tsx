import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ReportBuilderWorkspace } from '@/components/assessment/ReportBuilderWorkspace';

export const AssessmentReportBuilderView: React.FC = () => {
  const navigate = useNavigate();
  const { reportId } = useParams();

  if (!reportId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
        Missing reportId.
      </div>
    );
  }

  return (
    <div className="h-full">
      <ReportBuilderWorkspace
        reportId={reportId}
        onClose={() => navigate('/assessment/overview')}
      />
    </div>
  );
};

export default AssessmentReportBuilderView;
