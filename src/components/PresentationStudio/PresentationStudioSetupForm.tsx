/**
 * PresentationStudioSetupForm (Sprint S8)
 *
 * Module: Consultify Presentation Studio.
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - DRD/UI_UX_SOURCE_OF_TRUTH.md
 *   - DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md
 *
 * Replaces the S5 hard-coded `DEFAULT_SETUP` placeholder with a
 * governance-aware setup form. The form owns the editable subset of the
 * `setup` payload that drives every Studio preview and the approval-gated
 * generate flow:
 *   - title (required)
 *   - audience
 *   - goal
 *   - deckType (required — drives the template architect dispatcher)
 *   - language
 *
 * Honest UI invariants applied here:
 *   - No silent defaults on REQUIRED fields. Title and deck type both start
 *     empty and explicit inline validation messages appear on the first
 *     submit attempt. Audience, goal, and language have clearly labeled
 *     defaults so the user can see what they will get.
 *   - The form NEVER mutates anything by itself; it only emits a typed
 *     `value` upward. The parent decides when to call /preview or
 *     /request-approval.
 *   - Shape mirrors `PresentationStudioSetupInput` so the parent can pass
 *     the value straight to the API without reshaping. The default source
 *     artifact (a single demo readiness assessment) is appended in the
 *     parent so the form stays purely declarative on user-editable fields.
 */

import React, { useCallback, useMemo } from 'react';

import type { PresentationStudioSetupInput } from '@/services/api/presentationStudio.api';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** User-editable subset of the Studio setup. Required fields use plain string
 * to allow honest empty states; the parent validates before submit. */
export interface PresentationStudioSetupFormValue {
  title: string;
  audience: NonNullable<PresentationStudioSetupInput['audience']>;
  goal: NonNullable<PresentationStudioSetupInput['goal']>;
  deckType: string;
  language: NonNullable<PresentationStudioSetupInput['language']>;
}

export interface PresentationStudioSetupFormErrors {
  title?: string;
  deckType?: string;
}

export interface PresentationStudioSetupFormProps {
  value: PresentationStudioSetupFormValue;
  onChange: (next: PresentationStudioSetupFormValue) => void;
  /**
   * When `true`, the form renders inline validation messages for any field
   * that is currently invalid. Parent flips this to `true` after a submit
   * attempt with invalid fields. Honest UX rule: never show errors before
   * the user has actually submitted.
   */
  showErrors?: boolean;
  /** Optional id used by the parent to associate the form with a submit button. */
  formId?: string;
  /** Optional disabled flag — set while a preview/approval call is in flight. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Static option metadata
// ---------------------------------------------------------------------------

interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

const AUDIENCE_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'executive', label: 'Executive (CXO, board)' },
  { value: 'sponsor', label: 'Sponsor / steering committee' },
  { value: 'investor', label: 'Investor' },
  { value: 'internal', label: 'Internal team' },
];

const GOAL_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'decide', label: 'Decide — drive a decision' },
  { value: 'inform', label: 'Inform — share a status update' },
  { value: 'sell', label: 'Sell — convince a buyer' },
  { value: 'align', label: 'Align — coordinate stakeholders' },
];

const LANGUAGE_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'en', label: 'English' },
  { value: 'pl', label: 'Polski' },
];

const DECK_TYPE_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'steering_committee', label: 'Steering committee' },
  { value: 'project_pulse', label: 'Project pulse' },
  { value: 'board_update', label: 'Board update' },
  { value: 'sales_pitch', label: 'Sales pitch' },
];

/** Default value the parent should use when first instantiating the form. Required fields are intentionally empty so honest validation runs. */
export const PRESENTATION_STUDIO_SETUP_FORM_DEFAULT: PresentationStudioSetupFormValue = {
  title: '',
  audience: 'executive',
  goal: 'decide',
  deckType: '',
  language: 'en',
};

/** Produce honest validation errors for the current form value. Empty object means valid. */
export function validatePresentationStudioSetupForm(
  value: PresentationStudioSetupFormValue
): PresentationStudioSetupFormErrors {
  const errors: PresentationStudioSetupFormErrors = {};
  if (!value.title.trim()) {
    errors.title = 'Title is required.';
  }
  if (!value.deckType.trim()) {
    errors.deckType = 'Deck type is required.';
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const FIELD_BASE =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm transition-colors focus-visible:border-c-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:border-c-focus';

const FIELD_LABEL =
  'mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400';

const FIELD_ERROR = 'mt-1 text-xs font-medium text-danger-600 dark:text-danger-400';

const FIELD_HELP = 'mt-1 text-xs text-slate-500 dark:text-slate-400';

const FIELD_BORDER_ERROR = 'border-danger-400 focus:border-danger-500 focus:ring-danger-500/20';

export const PresentationStudioSetupForm: React.FC<PresentationStudioSetupFormProps> = ({
  value,
  onChange,
  showErrors = false,
  formId,
  disabled = false,
}) => {
  const errors = useMemo(() => validatePresentationStudioSetupForm(value), [value]);

  const setField = useCallback(
    <K extends keyof PresentationStudioSetupFormValue>(
      key: K,
      next: PresentationStudioSetupFormValue[K]
    ) => {
      onChange({ ...value, [key]: next });
    },
    [onChange, value]
  );

  const titleErrorVisible = showErrors && !!errors.title;
  const deckTypeErrorVisible = showErrors && !!errors.deckType;

  return (
    <form
      id={formId}
      data-testid="presentation-studio-setup-form"
      onSubmit={(event) => {
        // The parent owns submit semantics (Run preview button outside the
        // form). Stop the default browser submit so a stray Enter doesn't
        // hide the page.
        event.preventDefault();
      }}
      className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Deck setup</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Fields drive the source pack, narrative plan, template architect, and generate previews.
          Required fields are marked with <span className="text-danger-500">*</span>; no silent
          defaults.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="psstudio-title" className={FIELD_LABEL}>
            Title <span className="text-danger-500">*</span>
          </label>
          <input
            id="psstudio-title"
            type="text"
            value={value.title}
            onChange={(e) => setField('title', e.target.value)}
            disabled={disabled}
            placeholder="e.g. Q3 transformation steering"
            data-testid="psstudio-field-title"
            aria-invalid={titleErrorVisible || undefined}
            aria-describedby={titleErrorVisible ? 'psstudio-title-error' : undefined}
            className={`${FIELD_BASE} ${titleErrorVisible ? FIELD_BORDER_ERROR : ''}`}
          />
          {titleErrorVisible ? (
            <p
              id="psstudio-title-error"
              className={FIELD_ERROR}
              role="alert"
              data-testid="psstudio-error-title"
            >
              {errors.title}
            </p>
          ) : (
            <p className={FIELD_HELP}>One-line working title for the deck.</p>
          )}
        </div>

        <div>
          <label htmlFor="psstudio-deck-type" className={FIELD_LABEL}>
            Deck type <span className="text-danger-500">*</span>
          </label>
          <select
            id="psstudio-deck-type"
            value={value.deckType}
            onChange={(e) => setField('deckType', e.target.value)}
            disabled={disabled}
            data-testid="psstudio-field-deck-type"
            aria-invalid={deckTypeErrorVisible || undefined}
            aria-describedby={deckTypeErrorVisible ? 'psstudio-deck-type-error' : undefined}
            className={`${FIELD_BASE} ${deckTypeErrorVisible ? FIELD_BORDER_ERROR : ''}`}
          >
            <option value="">Select deck type…</option>
            {DECK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {deckTypeErrorVisible ? (
            <p
              id="psstudio-deck-type-error"
              className={FIELD_ERROR}
              role="alert"
              data-testid="psstudio-error-deck-type"
            >
              {errors.deckType}
            </p>
          ) : (
            <p className={FIELD_HELP}>Drives the template architect dispatcher.</p>
          )}
        </div>

        <div>
          <label htmlFor="psstudio-audience" className={FIELD_LABEL}>
            Audience
          </label>
          <select
            id="psstudio-audience"
            value={value.audience}
            onChange={(e) =>
              setField('audience', e.target.value as PresentationStudioSetupFormValue['audience'])
            }
            disabled={disabled}
            data-testid="psstudio-field-audience"
            className={FIELD_BASE}
          >
            {AUDIENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="psstudio-goal" className={FIELD_LABEL}>
            Goal
          </label>
          <select
            id="psstudio-goal"
            value={value.goal}
            onChange={(e) =>
              setField('goal', e.target.value as PresentationStudioSetupFormValue['goal'])
            }
            disabled={disabled}
            data-testid="psstudio-field-goal"
            className={FIELD_BASE}
          >
            {GOAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="psstudio-language" className={FIELD_LABEL}>
            Language
          </label>
          <select
            id="psstudio-language"
            value={value.language}
            onChange={(e) =>
              setField('language', e.target.value as PresentationStudioSetupFormValue['language'])
            }
            disabled={disabled}
            data-testid="psstudio-field-language"
            className={FIELD_BASE}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
};

export default PresentationStudioSetupForm;
