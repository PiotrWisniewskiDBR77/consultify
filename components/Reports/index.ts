// DRD Audit Report Builder Components
export { EmbeddedMatrix } from './EmbeddedMatrix';
export { InitiativesReportSection } from './InitiativesReportSection';
export { ReportBuilder } from './ReportBuilder';
export { ReportHeader } from './ReportHeader';
export { ReportSection } from './ReportSection';
export { RichTextEditor } from './RichTextEditor';
export { TableOfContents } from './TableOfContents';

// New Enterprise Components
export { FinancialImpact } from './FinancialImpact';
export { GanttChart } from './GanttChart';
export { HeatmapMatrix } from './HeatmapMatrix';
export { IndustryBenchmark } from './IndustryBenchmark';
export { KeyTakeaways, QuickStats } from './KeyTakeaways';
export { ProgressRing, ProgressRingCompact } from './ProgressRing';
export { RadarChartComponent, RadarChartMini } from './RadarChart';
export { ReadingModeProvider, ReadingModeSimpleToggle, ReadingModeToggle } from './ReadingModeToggle';
export { RiskMatrix } from './RiskMatrix';
export { StickyNavigation } from './StickyNavigation';

// Area-based Report Components (Enterprise DRD)
export type { AreaDetailData, AreaLevelInfo, InterviewData } from './AreaDetailCard';
export { AreaDetailCard } from './AreaDetailCard';
export type { AreaAssessment } from './AreaMatrixTable';
export { AreaMatrixTable, BUSINESS_AREAS, MATURITY_LEVELS } from './AreaMatrixTable';
export type { AxisInfo, AxisReportData } from './AxisReportSection';
export { AxisReportSection } from './AxisReportSection';

// Management Reports Module (Team Meeting & Steering Committee)
export * from './Management';
