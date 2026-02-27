/**
 * NMode Completeness — Type definitions
 *
 * Required sections/fields per artifact type and status.
 * Completeness score, missing list, AI fill proposals.
 *
 * @see V3-K01: N-mode required sections/fields + completeness + AI assist
 */

export type ArtifactType = 'initiative' | 'decision' | 'task' | 'notification';

export type CompletionStatus = 'complete' | 'partial' | 'missing';

export interface RequiredField {
  id: string;
  sectionId: string;
  fieldPath: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'rich_text' | 'list';
  isCritical: boolean; // blocks gate if missing
}

export interface RequiredSection {
  id: string;
  label: string;
  fields: RequiredField[];
}

export interface CompletenessConfig {
  artifactType: ArtifactType;
  status: string;
  requiredSections: RequiredSection[];
}

export interface MissingItem {
  fieldId: string;
  sectionId: string;
  sectionLabel: string;
  fieldLabel: string;
  fieldPath: string;
  isCritical: boolean;
}

export interface CompletenessResult {
  score: number; // 0-100
  totalRequired: number;
  totalFilled: number;
  missingItems: MissingItem[];
  criticalMissing: MissingItem[];
  gateReady: boolean;
}

export interface AIFillProposal {
  fieldId: string;
  fieldPath: string;
  fieldLabel?: string;
  /** Field type for value coercion (e.g. number, date) */
  type?: 'string' | 'number' | 'date';
  proposedValue: unknown;
  confidence: number;
  source: string;
  reasoning: string;
}
