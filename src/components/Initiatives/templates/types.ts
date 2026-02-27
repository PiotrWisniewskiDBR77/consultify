/**
 * Initiative Level Template Types
 *
 * V3-F01: Initiative template-driven N-mode per InitiativeLevel.
 * InitiativeLevel controls: visible sections, required fields, gates, completeness.
 */

export type InitiativeLevel = 'quick_win' | 'standard' | 'strategic' | 'transformation';

export interface RequiredFieldConfig {
  sectionId: string;
  fieldPath: string;
  label: string;
  isCritical: boolean;
  /** For completeness calculation; defaults to 'text' */
  type?: 'text' | 'number' | 'date' | 'select' | 'rich_text' | 'list';
}

export interface InitiativeLevelTemplate {
  level: InitiativeLevel;
  label: string;
  description: string;
  icon: string;
  visibleSections: string[];
  requiredFieldsByStatus: Record<string, RequiredFieldConfig[]>;
  color: string;
}
