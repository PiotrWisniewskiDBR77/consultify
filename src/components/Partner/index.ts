/**
 * Partner Module Components
 *
 * Exports all partner-related components for the Partner Portal
 *
 * Layout Architecture:
 * - PartnerLayout: Two-column layout with sidebar (280px) and content area
 * - PartnerSidebar: Non-collapsible navigation groups (HubSpot-style)
 *
 * Design System:
 * - Violet accent colors (consistent with Admin module)
 * - Floating panel design (ClickUp-style)
 * - Dark sidebar with light content area
 */

// Layout components
export { type Breadcrumb, PartnerLayout } from './PartnerLayout';
export { type PartnerSection, PartnerSidebar } from './PartnerSidebar';
