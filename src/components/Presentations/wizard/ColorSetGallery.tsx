/**
 * Fala 1 (2026-07-28): moved to `src/components/shared/colorPatterns/` so
 * the Deck AND Word Template Architects can render the same gallery, not
 * just this Wizard. Re-exported here (same name, same props) so
 * `SetupStep.tsx` keeps working unchanged.
 */
export type { ColorPatternPickerProps as ColorSetGalleryProps } from '@/components/shared/colorPatterns/ColorPatternPicker';
export { ColorPatternPicker as ColorSetGallery } from '@/components/shared/colorPatterns/ColorPatternPicker';
