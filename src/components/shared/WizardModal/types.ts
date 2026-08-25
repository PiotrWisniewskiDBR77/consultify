/**
 * Shared types for the canonical <WizardModal> shell (§5).
 *
 * These types describe a single, governed multi-step wizard frame that the three
 * platform wizards (survey / insight / initiative) are meant to adopt so they
 * look and behave identically (owner's principle #1: "managed colors, one
 * consistent frame"). See WizardModal.tsx for the full rationale.
 */
import type React from 'react';

import type { WizardGeometry } from './geometry';

/** A localized string pair. Every label/hint in the shell is bilingual. */
export interface LocalizedText {
  en: string;
  pl: string;
}

/**
 * Per-step status, used to drive the stepper pill state and the empty-step
 * message:
 *  - 'empty'    → step has no content yet (e.g. "until you generate"); shows a
 *                 clear placeholder message and a muted pill.
 *  - 'ready'    → step has content / is in progress.
 *  - 'complete' → step is satisfied; the pill renders a check.
 */
export type WizardStepStatus = 'empty' | 'ready' | 'complete';

/** A single wizard step descriptor. */
export interface WizardStep {
  /** Stable id used as the React key and for callbacks. */
  id: string;
  /** Bilingual short label shown in the pill. */
  label: LocalizedText;
  /** Bilingual one-line hint shown under the active pill and as the pill title. */
  hint?: LocalizedText;
  /** Drives the pill state + the canonical "empty step" placeholder message. */
  status?: WizardStepStatus;
  /** Optional steps render an "(optional)" affordance and never block Next. */
  optional?: boolean;
  /**
   * Per-step content. The active step's content is rendered in the body. If a
   * step omits `content`, the shell falls back to the `children` prop (so a host
   * can render the active step itself by switching on `activeStepIndex`).
   */
  content?: React.ReactNode;
}

export interface WizardModalProps {
  /** Additive geometry variant; legacy remains the default for existing consumers. */
  geometry?: WizardGeometry;
  /** Creator-only context line below the title. */
  creatorSubtitle?: React.ReactNode;
  /** Creator-only draft/save status rendered in the fixed header band. */
  creatorHeaderStatus?: React.ReactNode;
  /** Creator-only one-line outcome summary rendered below the steps. */
  creatorScopeSummary?: React.ReactNode;
  /** Whether the modal is mounted/visible. When false, nothing renders. */
  open: boolean;
  /** Close request (overlay click, Esc, X button, Cancel). */
  onClose: () => void;
  /** Bilingual modal title shown in the header. */
  title: LocalizedText;
  /** Ordered list of steps. */
  steps: WizardStep[];
  /** Index of the currently-active step (controlled). */
  activeStepIndex: number;
  /** Requests a move to another step index (pill click / Back / Next). */
  onStepChange: (index: number) => void;
  /** Fired when the user confirms the final step. */
  onComplete: () => void;
  /** When true, the Complete button shows a spinner and is disabled. */
  completing?: boolean;
  /**
   * Optional override for the entire footer. When provided, the default
   * Back / Next / Complete row is replaced by this node.
   */
  footer?: React.ReactNode;
  /**
   * Force Polish. When omitted, the shell self-localizes from react-i18next
   * (i18n.language === 'pl').
   */
  isPolish?: boolean;
  /**
   * Managed accent color (any CSS color string) for the active pill / progress
   * fill, so survey / insight / initiative can differ within one consistent
   * frame. Defaults to the app's primary token.
   */
  accentColor?: string;
  /**
   * Disable the Next/Complete action (e.g. host-side validation blocker). The
   * Back action and pill navigation remain available.
   */
  nextDisabled?: boolean;
  /**
   * Fallback body content used when the active step has no `content` of its own.
   */
  children?: React.ReactNode;
}
