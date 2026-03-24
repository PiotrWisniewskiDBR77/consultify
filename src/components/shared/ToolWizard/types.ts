/**
 * ToolWizard Types — V3-E03 Tool Wizard Standard
 *
 * Canonical step flow: Define → Inputs & Assumptions → Work → Review → Finalize → Outputs
 * Each tool provides a config that customizes the wizard shell.
 */

export type WizardStepId = 'define' | 'inputs' | 'work' | 'review' | 'finalize' | 'outputs';

export type WorkSurfaceType = 'table' | 'workspace' | 'hybrid';

export type OutputType = 'initiative' | 'report' | 'presentation' | 'idea';

export interface WizardStepConfig {
  id: WizardStepId;
  label: { en: string; pl: string };
  description?: { en: string; pl: string };
  icon?: React.ReactNode;
  optional?: boolean;
  /** Custom validation — return missing item labels if step is incomplete */
  validate?: (data: WizardSessionData) => MissingItem[];
}

export interface MissingItem {
  id: string;
  label: { en: string; pl: string };
  stepId: WizardStepId;
  severity: 'required' | 'recommended';
  resolved?: boolean;
}

export interface WizardToolConfig {
  toolType: string;
  toolName: { en: string; pl: string };
  toolDescription?: { en: string; pl: string };
  category: 'strategic' | 'operational' | 'digital' | 'automation';
  surfaceType: WorkSurfaceType;
  steps: WizardStepConfig[];
  /** Default inputs schema — field definitions for the Inputs step */
  inputFields?: WizardInputField[];
  /** Which output types this tool can create */
  outputCapabilities: OutputType[];
}

export interface WizardInputField {
  id: string;
  label: { en: string; pl: string };
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'date' | 'file';
  required?: boolean;
  placeholder?: { en: string; pl: string };
  options?: Array<{ value: string; label: { en: string; pl: string } }>;
  helpText?: { en: string; pl: string };
}

export interface WizardSessionData {
  sessionId: string;
  toolType: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'FINALIZED';
  currentStep: WizardStepId;
  define: {
    intent?: string;
    scope?: string;
    audience?: string;
    projectContext?: string;
  };
  inputs: Record<string, unknown>;
  assumptions: Array<{
    id: string;
    text: string;
    source: 'user' | 'ai';
    accepted: boolean;
  }>;
  workData: unknown;
  review: {
    summaries: string[];
    missingItems: MissingItem[];
    aiSuggestions: AISuggestion[];
  };
  outputs: WizardOutput[];
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AISuggestion {
  id: string;
  type: 'missing_input' | 'assumption' | 'summary' | 'improvement';
  content: string;
  status: 'pending' | 'accepted' | 'rejected';
  stepId: WizardStepId;
}

export interface WizardOutput {
  id: string;
  type: OutputType;
  title: string;
  status: 'draft' | 'created';
  sourceType: 'tool';
  sourceId: string;
  sourceVersion?: number;
  createdAt?: string;
}

export interface ToolWizardShellProps {
  config: WizardToolConfig;
  sessionData: WizardSessionData;
  onSessionUpdate: (data: Partial<WizardSessionData>) => void;
  onStepChange: (step: WizardStepId) => void;
  onFinalize: () => void;
  onCreateOutput: (type: OutputType) => void;
  onBack: () => void;
  /** Custom work surface renderer */
  renderWorkSurface?: (
    data: WizardSessionData,
    onChange: (workData: unknown) => void
  ) => React.ReactNode;
  /** Custom step content overrides */
  renderStepContent?: (stepId: WizardStepId, data: WizardSessionData) => React.ReactNode | null;
  locked?: boolean;
}
