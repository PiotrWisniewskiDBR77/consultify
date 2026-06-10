/**
 * Report Generator Wizard (Task #20 / Lane L9).
 *
 * Mount <ReportGeneratorWizard /> once near the Reporting surface (e.g. inside
 * ExecutionHub). It self-opens on the 'reporting:new-report' CustomEvent and
 * emits 'reporting:report-created' with a ReportConfig on Complete.
 */
export { default, ReportGeneratorWizard } from './ReportGeneratorWizard';
export type {
  CadenceMode,
  RecurrenceUnit,
  ReportConfig,
  ReportDensity,
  ReportTypeDef,
  ReportTypeId,
} from './reportWizardTypes';
export {
  REPORT_CREATED_EVENT,
  REPORT_TYPES,
  REPORT_WIZARD_OPEN_EVENT,
  resolveCadenceLabel,
} from './reportWizardTypes';
