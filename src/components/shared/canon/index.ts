/**
 * Canon component kit — the spoken component standard, as code.
 *
 * SSOT: Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md (§2, §9, §15, §18.1)
 *       docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md (§15)
 *
 * These components encode the standard by construction — their APIs make the
 * non-compliant layout unrepresentable (one primary, fixed section order,
 * separate save indicator). New surfaces compose these instead of inventing
 * their own headers/panels/chips.
 */

export { ModuleHeaderBar, type ModuleHeaderBarProps } from './ModuleHeaderBar';
export {
  ArtifactHeaderBar,
  type ArtifactHeaderBarProps,
  type ArtifactHeaderIndex,
} from './ArtifactHeaderBar';
export {
  ArtifactPanel,
  ARTIFACT_PANEL_SECTION_ORDER,
  type ArtifactPanelProps,
  type ArtifactPanelSectionKey,
} from './ArtifactPanel';
export {
  MetaStrip,
  MetaField,
  type MetaStripProps,
  type MetaFieldProps,
  type MetaStripOrientation,
  type MetaFieldVariant,
} from './MetaStrip';
export { QuietChip, type QuietChipProps, type QuietChipVariant } from './QuietChip';
export { SaveIndicator, type SaveIndicatorProps, type SaveState } from './SaveIndicator';
export {
  CANON_TABLE,
  lowEntropyCell,
  renderCappedTags,
} from './CanonTableDefaults';
