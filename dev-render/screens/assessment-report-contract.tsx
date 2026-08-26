import React from 'react';

import { AssessmentReportContractView } from '../../src/components/assessment/report/AssessmentReportContractView';
import { resetAssessmentReportViewFlagCache } from '../../src/utils/assessmentReportViewFlag';
import { installMethodCoreFakeServer } from '../mocks/methodCoreFakeServer';

localStorage.setItem('ff.assessment_report_view', '1');
resetAssessmentReportViewFlagCache();
installMethodCoreFakeServer();

export function AssessmentReportContractHarnessScreen(): React.ReactElement {
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <AssessmentReportContractView sessionId="session-metalpol-assessment" />
    </div>
  );
}

export default AssessmentReportContractHarnessScreen;
