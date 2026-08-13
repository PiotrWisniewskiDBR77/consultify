/**
 * PublicFormPage — Standalone public form renderer at /forms/:slug.
 * Loads form definition without auth, renders fields, validates, and submits.
 */
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { type PublicFormField, PublicFormFieldInput } from './PublicFormFieldInput';

// ── Types ────────────────────────────────────────────────────────────────────

interface FormFieldConfig {
  fieldId: string;
  label?: string;
  required?: boolean;
  helpText?: string;
  defaultValue?: unknown;
  hidden?: boolean;
}

interface PublicFormData {
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

// ── Component ────────────────────────────────────────────────────────────────

export function PublicFormPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();

  const [form, setForm] = useState<PublicFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    TablePlatformApi.getPublicForm(slug)
      .then((data) => {
        setForm(data);
        const defaults: Record<string, unknown> = {};
        (data.config?.fields ?? []).forEach((fc: FormFieldConfig) => {
          if (fc.defaultValue !== undefined) defaults[fc.fieldId] = fc.defaultValue;
        });
        setValues(defaults);
      })
      .catch((err) => setError(err?.message || 'Form not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  const visibleFieldConfigs = useMemo(() => {
    if (!form) return [];
    return (form.config?.fields ?? []).filter((fc) => !fc.hidden);
  }, [form]);

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
      if (!slug || !form) return;
      if (!validate()) return;

      setSubmitting(true);
      try {
        const submitData: Record<string, unknown> = {};
        for (const fc of form.config?.fields ?? []) {
          const val = values[fc.fieldId];
          if (val !== undefined && val !== null && val !== '') {
            submitData[fc.fieldId] = val;
          } else if (fc.hidden && fc.defaultValue !== undefined) {
            submitData[fc.fieldId] = fc.defaultValue;
          }
        }
        await TablePlatformApi.submitPublicForm(slug, submitData);
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
    [slug, form, values, validate]
  );

  const handleSubmitAnother = useCallback(() => {
    setSubmitted(false);
    setValues({});
    setErrors({});
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-c-surface-raised">
        <Loader2 className="h-8 w-8 animate-spin text-c-text-secondary" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error && !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-c-surface-raised">
        <div className="max-w-md rounded-2xl border border-c-danger bg-c-surface p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-c-danger" />
          <h2 className="mb-2 text-lg font-semibold text-c-text">
            {t('ideas.table.publicForm.formNotFound', 'Form not found')}
          </h2>
          <p className="text-sm text-c-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!form) return null;

  // ── Success ────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-c-surface-raised px-4">
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

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-c-surface-raised px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-lg rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-8 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-semibold text-c-text">{form.name}</h1>
        {form.description && <p className="mb-6 text-sm text-c-text-muted">{form.description}</p>}

        {error && (
          <div className="mb-4 rounded-xl border border-c-danger bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] px-4 py-3 text-sm text-c-danger">
            {error}
          </div>
        )}

        <div className="space-y-5">
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
          disabled={submitting}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-c-info px-4 py-3 text-sm font-medium text-c-text transition-colors hover:bg-c-info disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('ideas.table.publicForm.submit', 'Submit')}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-c-text-secondary">
        {t('ideas.table.publicForm.poweredBy', 'Powered by Consultify Table Platform')}
      </p>
    </div>
  );
}

export default PublicFormPage;
