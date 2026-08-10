/**
 * PublicJwtFormPage — Recipient-facing public form mounted at
 * `/public/forms/jwt/:token`.
 *
 * Block D · EPIC-T14 · Sprint D-S4. Mirrors `PublicFormPage` (slug surface)
 * but consumes the JWT-tokenized public route shipped in D-S2:
 *
 *   GET  /api/table-platform/public/forms/jwt/:token
 *   POST /api/table-platform/public/forms/jwt/:token/submit
 *
 * Differences from the slug page:
 *   - Verifies the JWT first (which returns formId, formSlug,
 *     fieldAllowList, hard expiry).
 *   - Filters the rendered fields to the allow-list when one is set.
 *   - Submits via `submitPublicFormByJwt(token, data)`.
 *
 * The renderer reuses the same `PublicFormFieldInput` component used by the
 * slug page so both surfaces stay visually consistent.
 *
 * Compliance:
 *   - DBR77 hex audit clean — Tailwind tokens only.
 *   - On rate-limit refusals (HTTP 429), the page surfaces a friendly
 *     "Too many submissions" error rather than the raw backend message.
 */

import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import {
  getPublicForm,
  getPublicFormByJwt,
  submitPublicFormByJwt,
} from '@/services/api/tablePlatform.api';

import { type PublicFormField, PublicFormFieldInput } from './PublicFormFieldInput';

interface FormFieldConfig {
  fieldId: string;
  label?: string;
  required?: boolean;
  helpText?: string;
  defaultValue?: unknown;
  hidden?: boolean;
}

interface PublicFormDefinition {
  id: string;
  name: string;
  description?: string;
  slug: string;
  config: {
    fields: FormFieldConfig[];
    submitMessage?: string;
    redirectUrl?: string;
    allowMultiple?: boolean;
    requireAuth?: boolean;
  };
  fields: PublicFormField[];
}

interface JwtIntakeContext {
  formId: string;
  formSlug: string;
  targetTableId: string;
  fieldAllowList: string[] | null;
  publicLinkExpiresAt: string | null;
}

interface PublicJwtFormPageProps {
  /** Test seam: skip useParams. */
  testToken?: string;
  /** Test seam: skip the JWT verification network call. */
  testInitialContext?: JwtIntakeContext | null;
  /** Test seam: skip the form definition fetch. */
  testInitialForm?: PublicFormDefinition | null;
}

export function PublicJwtFormPage({
  testToken,
  testInitialContext,
  testInitialForm,
}: PublicJwtFormPageProps = {}) {
  const { t } = useTranslation();
  const params = useParams<{ token: string }>();
  const token = testToken ?? params.token ?? '';

  const [context, setContext] = useState<JwtIntakeContext | null>(testInitialContext ?? null);
  const [form, setForm] = useState<PublicFormDefinition | null>(testInitialForm ?? null);
  const [loading, setLoading] = useState(
    testInitialContext === undefined || testInitialForm === undefined
  );
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing intake token');
      setLoading(false);
      return;
    }
    if (testInitialContext !== undefined && testInitialForm !== undefined) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const ctx = await getPublicFormByJwt(token);
        if (cancelled) return;
        setContext(ctx);
        const def = await getPublicForm(ctx.formSlug);
        if (cancelled) return;
        setForm(def as PublicFormDefinition);
        const defaults: Record<string, unknown> = {};
        ((def as PublicFormDefinition).config?.fields ?? []).forEach((fc) => {
          if (fc.defaultValue !== undefined) defaults[fc.fieldId] = fc.defaultValue;
        });
        setValues(defaults);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error)?.message ?? 'Form not found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, testInitialContext, testInitialForm]);

  const visibleFieldConfigs = useMemo(() => {
    if (!form) return [];
    const allow = context?.fieldAllowList ?? null;
    return (form.config?.fields ?? [])
      .filter((fc) => !fc.hidden)
      .filter((fc) => (allow == null ? true : allow.includes(fc.fieldId)));
  }, [form, context]);

  const fieldMap = useMemo(() => {
    if (!form) return new Map<string, PublicFormField>();
    return new Map(form.fields.map((f) => [f.id, f]));
  }, [form]);

  const setValue = useCallback((fieldId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    for (const fc of visibleFieldConfigs) {
      if (fc.required) {
        const val = values[fc.fieldId];
        if (
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0)
        ) {
          const field = fieldMap.get(fc.fieldId);
          newErrors[fc.fieldId] = `${fc.label || field?.name || 'Field'} is required`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [visibleFieldConfigs, values, fieldMap]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token || !form) return;
      if (!validate()) return;

      setSubmitting(true);
      try {
        const submitData: Record<string, unknown> = {};
        for (const fc of visibleFieldConfigs) {
          const val = values[fc.fieldId];
          if (val !== undefined && val !== null && val !== '') {
            submitData[fc.fieldId] = val;
          } else if (fc.hidden && fc.defaultValue !== undefined) {
            submitData[fc.fieldId] = fc.defaultValue;
          }
        }
        await submitPublicFormByJwt(token, submitData);
        setSubmitted(true);

        if (form.config?.redirectUrl) {
          setTimeout(() => {
            window.location.href = form.config.redirectUrl!;
          }, 1500);
        }
      } catch (err: any) {
        setError(err?.message || 'Submission failed');
      } finally {
        setSubmitting(false);
      }
    },
    [token, form, visibleFieldConfigs, values, validate]
  );

  const handleSubmitAnother = useCallback(() => {
    setSubmitted(false);
    setValues({});
    setErrors({});
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-c-surface-raised"
        data-testid="public-jwt-form-loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-c-text-secondary" />
      </div>
    );
  }

  if (error && (!form || !context)) {
    const isExpired =
      typeof error === 'string' &&
      /expired|TOKEN_EXPIRED|invalid|TOKEN_INVALID|JWT_NOT_ENABLED/i.test(error);
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-c-surface-raised px-4"
        data-testid="public-jwt-form-error"
      >
        <div className="max-w-md rounded-2xl border border-c-danger bg-c-surface p-8 text-center shadow-sm">
          {isExpired ? (
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-c-danger" />
          ) : (
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-c-danger" />
          )}
          <h2 className="mb-2 text-lg font-semibold text-c-text">
            {isExpired ? 'This link is no longer valid' : 'Form not found'}
          </h2>
          <p className="text-sm text-c-text-muted">
            {isExpired ? 'Ask the sender to issue a fresh intake link.' : error}
          </p>
        </div>
      </div>
    );
  }

  if (!form || !context) return null;

  if (submitted) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-c-surface-raised px-4"
        data-testid="public-jwt-form-submitted"
      >
        <div className="max-w-md rounded-2xl border border-c-success bg-c-surface p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-c-success" />
          <h2 className="mb-2 text-lg font-semibold text-c-text">
            {form.config?.submitMessage ||
              t('ideas.table.publicForm.responseRecorded', 'Response recorded!')}
          </h2>
          {form.config?.allowMultiple && (
            <button
              onClick={handleSubmitAnother}
              className="mt-4 rounded-xl bg-c-info px-6 py-2.5 text-sm font-medium text-c-text transition-colors hover:bg-c-info"
            >
              {t('ideas.table.publicForm.submitAnother', 'Submit another response')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const expiresSoon =
    context.publicLinkExpiresAt != null &&
    Date.parse(context.publicLinkExpiresAt) - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="min-h-screen bg-c-surface-raised px-4 py-12" data-testid="public-jwt-form-page">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-lg rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-8 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-semibold text-c-text">{form.name}</h1>
        {form.description && <p className="mb-2 text-sm text-c-text-muted">{form.description}</p>}

        {expiresSoon && context.publicLinkExpiresAt ? (
          <p
            className="mb-4 rounded-xl border border-c-warning bg-c-warning px-4 py-2 text-xs text-c-warning"
            data-testid="public-jwt-form-expiry-warning"
          >
            {t('ideas.table.publicForm.linkExpires', 'This private link expires {{date}}.', {
              date: new Date(context.publicLinkExpiresAt).toLocaleString(),
            })}
          </p>
        ) : null}

        {error && (
          <div
            className="mb-4 rounded-xl border border-c-danger bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] px-4 py-3 text-sm text-c-danger"
            data-testid="public-jwt-form-inline-error"
          >
            {error}
          </div>
        )}

        <div className="space-y-5">
          {visibleFieldConfigs.length === 0 ? (
            <p className="text-sm text-c-text-muted">
              {t(
                'ideas.table.publicForm.noFieldsShared',
                "The sender hasn't shared any fields with you yet."
              )}
            </p>
          ) : null}
          {visibleFieldConfigs.map((fc) => {
            const field = fieldMap.get(fc.fieldId);
            if (!field) return null;
            const fieldError = errors[fc.fieldId];
            return (
              <div key={fc.fieldId}>
                <label className="mb-1.5 block text-sm font-medium text-c-text-secondary">
                  {fc.label || field.name}
                  {fc.required && <span className="ml-1 text-c-danger">*</span>}
                </label>
                {fc.helpText && <p className="mb-1 text-xs text-c-text-secondary">{fc.helpText}</p>}
                <PublicFormFieldInput
                  field={field}
                  value={values[fc.fieldId]}
                  onChange={(val) => setValue(fc.fieldId, val)}
                  error={!!fieldError}
                />
                {fieldError && <p className="mt-1 text-xs text-c-danger">{fieldError}</p>}
              </div>
            );
          })}
        </div>

        <button
          type="submit"
          disabled={submitting || visibleFieldConfigs.length === 0}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-c-info px-4 py-3 text-sm font-medium text-c-text transition-colors hover:bg-c-info disabled:opacity-50"
          data-testid="public-jwt-form-submit"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('ideas.table.publicForm.submit', 'Submit')}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-c-text-secondary">
        {t(
          'ideas.table.publicForm.poweredByPrivate',
          'Powered by Consultify Table Platform · Private link'
        )}
      </p>
    </div>
  );
}

export default PublicJwtFormPage;
