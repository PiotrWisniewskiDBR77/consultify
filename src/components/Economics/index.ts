/**
 * Economics Module Components
 *
 * Export all components for the Economics module
 */

// Core Components
export { AIRecommendationsPanel } from './AIRecommendationsPanel';
export { DigitizationToolTab } from './DigitizationToolTab';
export { EvidencePanel } from './EvidencePanel';
export { ExcelImportWizard } from './ExcelImportWizard';
export { PDFExportModal } from './PDFExportModal';
export { VersionHistoryPanel } from './VersionHistoryPanel';

// Light shell (Vegas/Oxford, ff.finance_light — OFF by default, harness-only
// caller for now; FinanceHub wiring is a later step, see financeLightFlag.ts)
export { FinanceLightShell } from './FinanceLightShell';

// Financial Analysis Components (Phase 3)
// NOTE: FinancialMetricsPanel kept — has dedicated test coverage
// (tests/components/Economics/FinancialMetricsPanel.test.tsx) even though
// no src/ caller renders it currently. See chore/lightness-deadcode audit.
export { FinancialMetricsPanel } from './FinancialMetricsPanel';

// Initiative Integration (Phase 4)
export { InitiativeFinancialIntegration } from './InitiativeFinancialIntegration';

// Benefits Tracking (Phase 5)
export { BenefitsTrackingDashboard } from './BenefitsTrackingDashboard';

// Types
export * from './types';
