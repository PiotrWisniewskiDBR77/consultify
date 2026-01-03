/**
 * UI Component Library - Apple HIG Design System
 * 
 * A comprehensive UI component library following Apple Human Interface Guidelines.
 * Components are organized into primitives (atomic) and composed (higher-level).
 * 
 * @example
 * // Import primitives
 * import { Button, Card, Input, Modal } from '@/components/ui';
 * 
 * // Import composed components
 * import { MetricCard, DataTable } from '@/components/ui';
 * 
 * // Or import from specific modules
 * import { Button } from '@/components/ui/primitives';
 * import { MetricCard } from '@/components/ui/composed';
 */

// Re-export all primitives
export * from './primitives';

// Re-export all composed components
export * from './composed';

// Legacy exports for backwards compatibility
export { Card as BaseCard } from './BaseCard';





