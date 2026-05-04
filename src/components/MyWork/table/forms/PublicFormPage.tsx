/**
 * PublicFormPage — Standalone public form renderer at /forms/:slug.
 * Loads form definition without auth, renders fields, validates, and submits.
 */
import { AlertCircle, CheckCircle2, Loader2, Star } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

// ── Types ────────────────────────────────────────────────────────────────────

interface FormFieldConfig {
  fieldId: string;
  label?: string;
  required?: boolean;
  helpText?: string;
  defaultValue?: unknown;
  hidden?: boolean;
}

interface PublicFormField {
  id: string;
  name: string;
  fieldType: string;
  options?: {
    options?: Array<{ id: string; name: string; color?: string }>;
    [key: string]: unknown;
  };
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error && !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          <h2 className="mb-2 text-lg font-semibold text-gray-900">Form not found</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!form) return null;

  // ── Success ────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            {form.config?.submitMessage || 'Response recorded!'}
          </h2>
          {form.config?.allowMultiple && (
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
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-semibold text-gray-900">{form.name}</h1>
        {form.description && <p className="mb-6 text-sm text-gray-500">{form.description}</p>}

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {fc.label || field.name}
                  {fc.required && <span className="ml-1 text-rose-500">*</span>}
                </label>
                {fc.helpText && <p className="mb-1 text-xs text-gray-400">{fc.helpText}</p>}
                <FormInput
                  field={field}
                  value={values[fc.fieldId]}
                  onChange={(val) => setValue(fc.fieldId, val)}
                  error={!!fieldError}
                />
                {fieldError && <p className="mt-1 text-xs text-rose-500">{fieldError}</p>}
              </div>
            );
          })}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-gray-400">Powered by Consultify Table Platform</p>
    </div>
  );
}

// ── Form Input Renderer ──────────────────────────────────────────────────────

function FormInput({
  field,
  value,
  onChange,
  error,
}: {
  field: PublicFormField;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: boolean;
}) {
  const base = `w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
    error ? 'border-rose-300 bg-rose-50' : 'border-gray-200 bg-white'
  }`;

  switch (field.fieldType) {
    case 'singleLineText':
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );

    case 'longText':
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={base}
        />
      );

    case 'number':
    case 'currency':
    case 'percent':
      return (
        <input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className={base}
          step={field.fieldType === 'number' ? 'any' : '0.01'}
        />
      );

    case 'email':
      return (
        <input
          type="email"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder="email@example.com"
          className={base}
        />
      );

    case 'url':
      return (
        <input
          type="url"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className={base}
        />
      );

    case 'phone':
      return (
        <input
          type="tel"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder="+1..."
          className={base}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );

    case 'checkbox':
      return (
        <label className="flex cursor-pointer items-center gap-2">
          <div
            onClick={() => onChange(!value)}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              value ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <div
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                value ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </div>
          <span className="text-sm text-gray-600">{value ? 'Yes' : 'No'}</span>
        </label>
      );

    case 'singleSelect': {
      const options = field.options?.options ?? [];
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.name}>
              {opt.name}
            </option>
          ))}
        </select>
      );
    }

    case 'multiSelect': {
      const options = field.options?.options ?? [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1.5">
          {options.map((opt) => {
            const checked = selected.includes(opt.name);
            return (
              <label key={opt.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    onChange(
                      checked ? selected.filter((s) => s !== opt.name) : [...selected, opt.name]
                    );
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{opt.name}</span>
              </label>
            );
          })}
          {options.length === 0 && <p className="text-xs text-gray-400">No options configured</p>}
        </div>
      );
    }

    case 'rating': {
      const current = typeof value === 'number' ? value : 0;
      const max = 5;
      return (
        <div className="flex gap-1">
          {Array.from({ length: max }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i + 1 === current ? 0 : i + 1)}
              className="transition-colors"
            >
              <Star
                className={`h-6 w-6 ${
                  i < current ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
      );
    }

    case 'attachment':
      return (
        <div
          className={`rounded-lg border-2 border-dashed p-4 text-center ${error ? 'border-rose-300' : 'border-gray-200'}`}
        >
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(file.name);
            }}
            className="text-sm text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-400">Upload a file</p>
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );
  }
}

export default PublicFormPage;
