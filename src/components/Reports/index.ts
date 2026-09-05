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
export {
  ReadingModeProvider,
  ReadingModeSimpleToggle,
  ReadingModeToggle,
} from './ReadingModeToggle';
export { RiskMatrix } from './RiskMatrix';
export { StickyNavigation } from './StickyNavigation';

// USUNIĘTE 2026-09-05: `AreaMatrixTable` + jej jedyni wołacze
// (`AxisReportSection`, `AreaDetailCard`). To była macierz odrzucona przez
// właściciela wprost (`docs/program/grafika/DZIENNIK_GRAFIKA.md` Z-10) i piąte
// zgłoszenie tej samej sprawy wzięło się z tego, że kopie tej siatki wciąż
// leżały w repo i wracały na ekrany (Z-12: „kopii jest w tym repo więcej niż
// oryginałów"). Po naprawie ekranu raportu nie miały już ŻADNEGO wołacza
// w `src/` — barrela nie importuje nikt. Jedyna macierz DRD to dziś
// `DRDMatrixGrid` (`src/components/assessment/drd/DRDAssessmentEditor.tsx`),
// w trybie do czytania przez `DRDMatrixReadOnly`.

// Management Reports Module (Team Meeting & Steering Committee)
export * from './Management';
