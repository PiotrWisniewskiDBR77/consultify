/**
 * PublicFormFieldInput — Standalone field renderer used by the public form
 * pages (`PublicFormPage` slug surface and `PublicJwtFormPage` JWT surface).
 *
 * Extracted from `PublicFormPage.tsx` (Block D · D-S4) so both public surfaces
 * render identical inputs with identical validation. The renderer is a pure
 * presentational component — it neither owns state nor talks to APIs.
 */

import { Star } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface PublicFormField {
  id: string;
  name: string;
  fieldType: string;
  options?: {
    options?: Array<{ id: string; name: string; color?: string }>;
    [key: string]: unknown;
  };
}

interface PublicFormFieldInputProps {
  field: PublicFormField;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: boolean;
}

export function PublicFormFieldInput({ field, value, onChange, error }: PublicFormFieldInputProps) {
  const { t } = useTranslation();
  const base = `w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-info ${
    error
      ? 'border-c-danger bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)]'
      : 'border-c-border-subtle bg-c-surface'
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
              value ? 'bg-c-info' : 'bg-c-surface-raised'
            }`}
          >
            <div
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-c-surface shadow transition-transform ${
                value ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </div>
          <span className="text-sm text-c-text-secondary">{value ? 'Yes' : 'No'}</span>
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
          <option value="">{t('ideas.table.publicForm.selectOption', 'Select...')}</option>
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
                  className="h-4 w-4 rounded border-c-border-subtle text-c-info focus:ring-c-focus"
                />
                <span className="text-sm text-c-text-secondary">{opt.name}</span>
              </label>
            );
          })}
          {options.length === 0 && (
            <p className="text-xs text-c-text-secondary">
              {t('ideas.table.publicForm.noOptionsConfigured', 'No options configured')}
            </p>
          )}
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
                  i < current ? 'fill-yellow-400 text-c-warning' : 'text-c-text-secondary'
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
          className={`rounded-lg border-2 border-dashed p-4 text-center ${error ? 'border-c-danger' : 'border-c-border-subtle'}`}
        >
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(file.name);
            }}
            className="text-sm text-c-text-muted"
          />
          <p className="mt-1 text-xs text-c-text-secondary">
            {t('ideas.table.publicForm.uploadFile', 'Upload a file')}
          </p>
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

export default PublicFormFieldInput;
