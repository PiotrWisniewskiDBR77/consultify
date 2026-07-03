/**
 * PublicFormView — Standalone public form renderer for Table Platform forms.
 * Fetches form config by slug, renders fields, validates, and submits.
 */

import { AlertCircle, Check, CheckSquare, Loader2, Square } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import * as tablePlatformApi from '@/services/api/tablePlatform.api';

// ── Types ────────────────────────────────────────────────────────────────────

interface FormFieldConfig {
  fieldId: string;
  label?: string;
  required?: boolean;
  helpText?: string;
  defaultValue?: unknown;
  hidden?: boolean;
}

interface FormConfig {
  fields: FormFieldConfig[];
  submitMessage?: string;
  redirectUrl?: string;
  allowMultiple?: boolean;
  requireAuth?: boolean;
  styling?: Record<string, unknown>;
}

interface TableField {
  id: string;
  name: string;
  field_type: string;
  options: Record<string, unknown>;
}

interface PublicFormData {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  config: FormConfig;
  fields: TableField[];
}

export interface PublicFormViewProps {
  slug: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PublicFormView({ slug }: PublicFormViewProps) {
  const [form, setForm] = useState<PublicFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    tablePlatformApi
      .getPublicForm(slug)
      .then((data) => {
        if (cancelled) return;
        setForm(data);

        const initial: Record<string, unknown> = {};
        const config = (
          typeof data.config === 'string' ? JSON.parse(data.config) : data.config
        ) as FormConfig;
        for (const fc of config.fields) {
          if (fc.defaultValue !== undefined && !fc.hidden) {
            initial[fc.fieldId] = fc.defaultValue;
          }
        }
        setValues(initial);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load form');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const config = useMemo(() => {
    if (!form) return null;
    return (typeof form.config === 'string' ? JSON.parse(form.config) : form.config) as FormConfig;
  }, [form]);

  const fieldMap = useMemo(() => new Map((form?.fields ?? []).map((f) => [f.id, f])), [form]);

  const visibleFields = useMemo(() => (config?.fields ?? []).filter((fc) => !fc.hidden), [config]);

  const setValue = useCallback((fieldId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    for (const fc of visibleFields) {
      const field = fieldMap.get(fc.fieldId);
      if (!field) continue;

      const val = values[fc.fieldId];
      const isEmpty = val === undefined || val === null || val === '';

      if (fc.required && isEmpty) {
        errors[fc.fieldId] = `${fc.label ?? field.name} is required`;
        continue;
      }

      if (!isEmpty) {
        const typeError = validateFieldType(field.field_type, val, fc.label ?? field.name);
        if (typeError) {
          errors[fc.fieldId] = typeError;
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [visibleFields, fieldMap, values]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setSubmitting(true);
      try {
        await tablePlatformApi.submitPublicForm(slug, values);
        setSubmitted(true);

        if (config?.redirectUrl) {
          window.location.href = config.redirectUrl;
        }
      } catch (err: any) {
        setError(err.message || 'Submission failed');
      } finally {
        setSubmitting(false);
      }
    },
    [slug, values, validate, config]
  );

  const handleSubmitAnother = useCallback(() => {
    setSubmitted(false);
    setValues({});
    setFieldErrors({});
    setError(null);
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-navy-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error && !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-navy-950">
        <div className="mx-4 max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center dark:border-rose-800 dark:bg-navy-900">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-rose-500" />
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            Form not found
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!form || !config) return null;

  // ── Success state ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-navy-950">
        <div className="mx-4 max-w-md rounded-2xl border border-green-200 bg-white p-8 text-center dark:border-green-800 dark:bg-navy-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            {config.submitMessage || 'Thank you for your submission!'}
          </h2>
          {config.allowMultiple && (
            <button
              onClick={handleSubmitAnother}
              className="mt-4 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Submit another response
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 px-4 py-12 dark:bg-navy-950">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-navy-700 dark:bg-navy-800">
          {/* Header */}
          <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">{form.name}</h1>
          {form.description && (
            <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">{form.description}</p>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Form fields */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {visibleFields.map((fc) => {
              const field = fieldMap.get(fc.fieldId);
              if (!field) return null;
              return (
                <FormField
                  key={fc.fieldId}
                  field={field}
                  config={fc}
                  value={values[fc.fieldId]}
                  error={fieldErrors[fc.fieldId]}
                  onChange={(v) => setValue(fc.fieldId, v)}
                />
              );
            })}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-600 dark:text-gray-500">
          Powered by Table Platform
        </p>
      </div>
    </div>
  );
}

// ── Field renderer ───────────────────────────────────────────────────────────

interface FormFieldProps {
  field: TableField;
  config: FormFieldConfig;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}

function FormField({ field, config, value, error, onChange }: FormFieldProps) {
  const label = config.label || field.name;

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {config.required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {config.helpText && (
        <p className="mb-1.5 text-xs text-gray-600 dark:text-gray-500">{config.helpText}</p>
      )}
      <FieldInput
        fieldType={field.field_type}
        options={field.options}
        value={value}
        onChange={onChange}
        hasError={!!error}
      />
      {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

interface FieldInputProps {
  fieldType: string;
  options: Record<string, unknown>;
  value: unknown;
  onChange: (value: unknown) => void;
  hasError: boolean;
}

function FieldInput({ fieldType, options, value, onChange, hasError }: FieldInputProps) {
  const baseClass = `w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-navy-900 dark:text-white ${
    hasError ? 'border-rose-300 dark:border-rose-700' : 'border-gray-200 dark:border-navy-600'
  }`;

  switch (fieldType) {
    case 'singleLineText':
    case 'single_line_text':
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      );

    case 'longText':
    case 'long_text':
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={baseClass}
        />
      );

    case 'number':
    case 'currency':
    case 'percent':
      return (
        <input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? undefined : Number(v));
          }}
          step={fieldType === 'percent' ? '0.01' : 'any'}
          className={baseClass}
        />
      );

    case 'checkbox':
      return (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-gray-700 dark:text-gray-300"
        >
          {value ? (
            <CheckSquare className="h-5 w-5 text-blue-600" />
          ) : (
            <Square className="h-5 w-5 text-gray-600" />
          )}
          {value ? 'Yes' : 'No'}
        </button>
      );

    case 'date':
      return (
        <input
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={baseClass}
        />
      );

    case 'singleSelect':
    case 'single_select': {
      const opts = (options as any)?.options as
        | Array<{ value?: string; name?: string; id?: string }>
        | undefined;
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={baseClass}
        >
          <option value="">Select...</option>
          {opts?.map((o) => {
            const val = o.value ?? o.name ?? o.id ?? '';
            return (
              <option key={val} value={val}>
                {o.name ?? val}
              </option>
            );
          })}
        </select>
      );
    }

    case 'multiSelect':
    case 'multi_select': {
      const opts = (options as any)?.options as
        | Array<{ value?: string; name?: string; id?: string }>
        | undefined;
      const selected = Array.isArray(value) ? (value as string[]) : [];

      return (
        <div className="space-y-1.5">
          {opts?.map((o) => {
            const val = o.value ?? o.name ?? o.id ?? '';
            const isChecked = selected.includes(val);
            return (
              <label
                key={val}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-navy-700"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    const next = isChecked ? selected.filter((v) => v !== val) : [...selected, val];
                    onChange(next.length > 0 ? next : undefined);
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-gray-700 dark:text-gray-300">{o.name ?? val}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case 'email':
      return (
        <input
          type="email"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder="email@example.com"
          className={baseClass}
        />
      );

    case 'url':
      return (
        <input
          type="url"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className={baseClass}
        />
      );

    case 'phone':
      return (
        <input
          type="tel"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder="+1 (555) 123-4567"
          className={baseClass}
        />
      );

    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      );
  }
}

// ── Client-side validation ───────────────────────────────────────────────────

function validateFieldType(fieldType: string, value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;

  switch (fieldType) {
    case 'number':
    case 'currency':
    case 'percent':
      if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
        return `${label} must be a valid number`;
      }
      break;

    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof value === 'string' && !emailRegex.test(value)) {
        return `${label} must be a valid email address`;
      }
      break;
    }

    case 'url':
      if (typeof value === 'string') {
        try {
          new URL(value);
        } catch {
          return `${label} must be a valid URL`;
        }
      }
      break;

    case 'phone':
      if (typeof value === 'string' && value.length > 30) {
        return `${label} is too long (max 30 characters)`;
      }
      break;

    case 'date':
      if (typeof value === 'string' && isNaN(Date.parse(value))) {
        return `${label} must be a valid date`;
      }
      break;
  }

  return null;
}
