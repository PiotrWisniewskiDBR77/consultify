import React, { useEffect } from 'react';

import { AssessmentReportContractView } from '../../src/components/assessment/report/AssessmentReportContractView';
import { resetAssessmentReportViewFlagCache } from '../../src/utils/assessmentReportViewFlag';
import { installMethodCoreFakeServer } from '../mocks/methodCoreFakeServer';

localStorage.setItem('ff.assessment_report_view', '1');
resetAssessmentReportViewFlagCache();
installMethodCoreFakeServer();

export function AssessmentReportContractHarnessScreen(): React.ReactElement {
  useEffect(() => {
    const axis = new URLSearchParams(window.location.search).get('axis');
    if (!axis || axis === '1') return;
    const timer = window.setInterval(() => {
      const target = [...document.querySelectorAll('button')].find((button) =>
        button.textContent?.includes(`Oś ${axis}`)
      );
      if (target instanceof HTMLButtonElement) {
        target.click();
        window.clearInterval(timer);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <AssessmentReportContractView sessionId="session-metalpol-assessment" />
    </div>
  );
}

export default AssessmentReportContractHarnessScreen;
