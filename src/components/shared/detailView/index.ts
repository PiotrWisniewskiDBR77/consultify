/**
 * Shared DetailView canon — public barrel.
 *
 * The canonical primitives for heavy-artifact detail views (Insight, Initiative,
 * and future Task/Decision/Report). Generalizes the Initiative document view —
 * the most polished card in the platform — into one shared look.
 *
 * Roadmap (master plan §7): MetricStrip + ViewModeToggle land first (pure
 * presentational, zero risk). DetailHeader, ActionToolbar, SectionSidebar,
 * SectionCard, AIAssist, SummaryCard follow.
 */

export type { ActionToolbarProps, ToolbarGroup, ToolbarMenuItem } from './ActionToolbar';
export { ActionToolbar } from './ActionToolbar';
export type { AIAction, AIAssistProps } from './AIAssist';
export { AIAssist } from './AIAssist';
export type { DetailHeaderProps } from './DetailHeader';
export { DetailHeader } from './DetailHeader';
export type { MetricStripProps } from './MetricStrip';
export { MetricStrip, default as MetricStripDefault } from './MetricStrip';
export type { SectionCardProps } from './SectionCard';
export { SectionCard } from './SectionCard';
export type { SectionSidebarProps, SidebarGroup, SidebarSection } from './SectionSidebar';
export { SectionSidebar } from './SectionSidebar';
export type { SummaryCardProps, SummaryMetric } from './SummaryCard';
export { SummaryCard } from './SummaryCard';
export type { AIAssistLevel, DetailViewMode, MetricItem, MetricTone } from './types';
export type { ViewModeToggleProps } from './ViewModeToggle';
export { loadDetailViewMode, saveDetailViewMode, ViewModeToggle } from './ViewModeToggle';
