/**
 * SourceReferenceCell — Read-only display for `source_reference` specialized
 * field type.
 *
 * Accepts three value shapes (mirror of server-side
 * `SpecializedFieldTypes.checkSpecializedFieldValue`):
 *
 *   1. UUID string (a `tp_record_sources.id`).
 *   2. `{ source_id: <UUID> }` object.
 *   3. `{ external_url: <https://...> }` object — only when the field
 *      `allow_external = true`.
 *
 * The UI renders a compact source badge:
 *   - UUID-backed sources → "Source" link (opens ProvenanceDrawer in lane —
 *     for now exposed via `data-source-id` for downstream wiring).
 *   - External URL → outbound link with truncated host.
 *   - External URL when `allow_external = false` → rose "blocked" chip.
 *   - Empty → dash with "Add source" affordance.
 *
 * Block A · EPIC-T7 · Sprint A-S5 frontend.
 *
 * DBR77 invariants: no raw hex literals; semantic Tailwind tone classes only.
 */
import { Anchor, ExternalLink, Link2Off } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { SourceReferenceFieldOptions } from '@/types/tablePlatform';

interface SourceReferenceCellProps {
  value: unknown;
  fieldOptions?: SourceReferenceFieldOptions;
  /** Optional callback to open the in-lane provenance drawer for a source UUID. */
  onOpenSource?: (sourceId: string) => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EXTERNAL_URL = 2048;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 32);
  }
}

export const SourceReferenceCell: React.FC<SourceReferenceCellProps> = ({
  value,
  fieldOptions,
  onOpenSource,
}) => {
  const { t } = useTranslation();
  const allowExternal = fieldOptions?.allow_external === true;

  if (value == null || value === '') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1 text-xs text-c-text-muted italic"
        data-testid="source-ref-empty"
      >
        <Anchor size={10} className="flex-shrink-0" />
        <span>{t('myWorkTable.sourceReferenceCell.noSource', 'No source')}</span>
      </span>
    );
  }

  // Shape 1: bare UUID string.
  if (typeof value === 'string' && UUID_REGEX.test(value)) {
    return (
      <button
        type="button"
        onClick={() => onOpenSource?.(value)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-c-success bg-c-success text-[10px] font-semibold text-c-success hover:bg-c-success transition-colors"
        data-testid="source-ref-internal"
        data-source-id={value}
        title={t('myWorkTable.sourceReferenceCell.internalSource', 'Internal source {{id}}', {
          id: value,
        })}
      >
        <Anchor size={10} className="flex-shrink-0" />
        <span>{t('myWorkTable.sourceReferenceCell.source', 'Source')}</span>
      </button>
    );
  }

  // Shape 1b: bare external URL string when allow_external = true.
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!allowExternal) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-c-danger bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] text-[10px] font-semibold text-c-danger"
          data-testid="source-ref-blocked"
          title={t('myWorkTable.sourceReferenceCell.externalBlocked', 'External sources not allowed for this field')}
        >
          <Link2Off size={10} className="flex-shrink-0" />
          <span>{t('myWorkTable.sourceReferenceCell.blocked', 'Blocked')}</span>
        </span>
      );
    }
    if (trimmed.length === 0 || trimmed.length > MAX_EXTERNAL_URL) {
      return (
        <span
          className="inline-flex items-center gap-1 text-xs text-c-danger px-1"
          data-testid="source-ref-invalid"
          title={t('myWorkTable.sourceReferenceCell.invalidLength', 'source_reference value invalid (length {{length}})', {
            length: trimmed.length,
          })}
        >
          !
        </span>
      );
    }
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-c-info bg-c-info text-[10px] font-semibold text-c-info hover:bg-c-info transition-colors max-w-full"
        data-testid="source-ref-external"
        data-href={trimmed}
        title={trimmed}
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink size={10} className="flex-shrink-0" />
        <span className="truncate">{safeHost(trimmed)}</span>
      </a>
    );
  }

  // Shape 2 & 3: object with `source_id` or `external_url`.
  if (isPlainObject(value)) {
    const sid = (value as { source_id?: unknown }).source_id;
    const ext = (value as { external_url?: unknown }).external_url;

    if (typeof sid === 'string' && UUID_REGEX.test(sid)) {
      return (
        <button
          type="button"
          onClick={() => onOpenSource?.(sid)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-c-success bg-c-success text-[10px] font-semibold text-c-success hover:bg-c-success transition-colors"
          data-testid="source-ref-internal"
          data-source-id={sid}
          title={t('myWorkTable.sourceReferenceCell.internalSource', 'Internal source {{id}}', {
            id: sid,
          })}
        >
          <Anchor size={10} className="flex-shrink-0" />
          <span>{t('myWorkTable.sourceReferenceCell.source', 'Source')}</span>
        </button>
      );
    }

    if (typeof ext === 'string' && ext.length > 0) {
      if (!allowExternal) {
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-c-danger bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] text-[10px] font-semibold text-c-danger"
            data-testid="source-ref-blocked"
            title={t('myWorkTable.sourceReferenceCell.externalBlocked', 'External sources not allowed for this field')}
          >
            <Link2Off size={10} className="flex-shrink-0" />
            <span>{t('myWorkTable.sourceReferenceCell.blocked', 'Blocked')}</span>
          </span>
        );
      }
      return (
        <a
          href={ext}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-c-info bg-c-info text-[10px] font-semibold text-c-info hover:bg-c-info transition-colors max-w-full"
          data-testid="source-ref-external"
          data-href={ext}
          title={ext}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={10} className="flex-shrink-0" />
          <span className="truncate">{safeHost(ext)}</span>
        </a>
      );
    }
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-c-danger px-1"
      data-testid="source-ref-invalid"
      title={t('myWorkTable.sourceReferenceCell.invalidShape', 'source_reference value has unrecognized shape')}
    >
      !
    </span>
  );
};

SourceReferenceCell.displayName = 'SourceReferenceCell';

export default SourceReferenceCell;
