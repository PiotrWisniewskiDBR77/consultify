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

export type { MetricStripProps } from './MetricStrip';
export { MetricStrip, default as MetricStripDefault } from './MetricStrip';
export type { AIAssistLevel, DetailViewMode, MetricItem, MetricTone } from './types';
export type { ViewModeToggleProps } from './ViewModeToggle';
export { loadDetailViewMode, saveDetailViewMode, ViewModeToggle } from './ViewModeToggle';
