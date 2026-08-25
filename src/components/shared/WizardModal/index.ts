/**
 * Canonical wizard shell (§5). Adopt this across the survey / insight /
 * initiative wizards so they share one consistent, managed-color frame.
 */
export type { LocalizedText, WizardModalProps, WizardStep, WizardStepStatus } from './types';
export { default, WizardModal } from './WizardModal';
export { CREATOR_SHELL_GEOMETRY } from './geometry';
export type { WizardGeometry } from './geometry';
// Exported so the 3 wizards can adopt the shared header (progress bar + step
// pills + managed accent color) without re-parenting their whole bodies (§5).
export { WizardStepper } from './WizardStepper';
