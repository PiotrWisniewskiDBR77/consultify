import { Lock } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { GridView } from './GridView';
import type { ColumnDef, ColumnType, TableNode } from './tableTypes';

/** Maps tp_fields.field_type (backend) → the FE grid's ColumnType. Unknown/new
 * backend types safely fall back to plain text rather than breaking the grid. */
const FIELD_TYPE_TO_COLUMN_TYPE: Record<string, ColumnType> = {
  singleLineText: 'text',
  single_line_text: 'text',
  longText: 'text',
  long_text: 'text',
  number: 'number',
  currency: 'currency',
  percent: 'progress',
  singleSelect: 'select',
  single_select: 'select',
  multiSelect: 'multiselect',
  multi_select: 'multiselect',
  checkbox: 'checkbox',
  date: 'date',
  createdTime: 'created_time',
  created_time: 'created_time',
  lastModifiedTime: 'last_edited_time',
  last_modified_time: 'last_edited_time',
  url: 'url',
  email: 'email',
  phone: 'phone',
  rating: 'rating',
  formula: 'formula',
  rollup: 'rollup',
  linkedRecord: 'relation',
  linked_record: 'relation',
  attachment: 'file',
};

function fieldTypeToColumnType(fieldType: string | undefined): ColumnType {
  if (!fieldType) return 'text';
  return FIELD_TYPE_TO_COLUMN_TYPE[fieldType] ?? 'text';
}

interface SharedGroup {
  value: string | null;
  count: number;
  rows: TableNode[];
}

interface SharedViewData {
  columns: ColumnDef[];
  rows: TableNode[];
  groups: SharedGroup[] | null;
}

export default function PublicViewPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedViewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (pw?: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // The metadata call surfaces the password gate (401 VIEW_PASSWORD_REQUIRED)
      // before we ever touch record data.
      await TablePlatformApi.getSharedViewData(token, pw);
      const res: any = await TablePlatformApi.getSharedViewRecords(token, {
        pageSize: 200,
        password: pw,
      });

      // The server already applied the view's filters/sorts and stripped any
      // field not on the view's visible-fields allow-list — this page only
      // renders what it was given, it does not re-filter or re-sort.
      const columns: ColumnDef[] = (res.fields || []).map((f: any) => ({
        key: f.id,
        header: f.name,
        type: fieldTypeToColumnType(f.field_type),
        visible: true,
        width: 160,
      }));

      const toRow = (r: any): TableNode => ({ id: r.id, data: { ...r.data } });

      let groups: SharedGroup[] | null = null;
      let rows: TableNode[] = [];
      if (Array.isArray(res.groups) && res.groups.length > 0) {
        groups = res.groups.map((g: any) => ({
          value: g.value ?? null,
          count: g.count ?? (g.records || []).length,
          rows: (g.records || []).map(toRow),
        }));
      } else {
        rows = (res.records || []).map(toRow);
      }

      setData({ columns, rows, groups });
      setNeedsPassword(false);
    } catch (e: any) {
      if (e?.code === 'VIEW_PASSWORD_REQUIRED') {
        setNeedsPassword(true);
        if (pw) setPasswordError(t('table.incorrectPassword'));
      } else {
        setError(e?.message || t('table.failedToLoadSharedView'));
      }
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (needsPassword) inputRef.current?.focus();
  }, [needsPassword]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setChecking(true);
    setPasswordError(null);
    load(password.trim());
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-c-surface-raised">
        <div className="space-y-3 w-full max-w-2xl p-8">
          <div className="h-10 bg-c-border-subtle rounded-xl animate-pulse" />
          <div className="h-8 bg-c-border-subtle rounded-lg animate-pulse" />
          <div className="h-8 bg-c-border-subtle rounded-lg animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-c-surface-raised">
        <form
          onSubmit={handlePasswordSubmit}
          className="rounded-2xl border border-c-border-subtle bg-c-surface p-8 w-full max-w-sm shadow-sm text-center space-y-4"
        >
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-c-surface-raised">
              <Lock size={20} className="text-c-text-secondary" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-semibold text-c-text">
              {t('table.passwordProtected')}
            </h2>
            <p className="mt-1 text-xs text-c-text-muted">
              {t('table.enterPasswordToView')}
            </p>
          </div>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('table.enterPasswordPlaceholder')}
            className="w-full rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm text-c-text placeholder:text-c-text-muted dark:placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-border"
          />
          {passwordError && (
            <p className="text-xs text-danger-600 dark:text-danger-400">{passwordError}</p>
          )}
          <button
            type="submit"
            disabled={!password.trim() || checking}
            className="w-full rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-bg hover:bg-c-text-secondary disabled:opacity-50 transition-colors"
          >
            {checking ? t('table.verifying') : t('table.viewTable')}
          </button>
        </form>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-c-surface-raised">
        <div className="rounded-xl border border-danger-200 bg-danger-50 dark:border-danger-800 dark:bg-danger-900/20 p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-danger-800 dark:text-danger-200">

            {t('table.viewUnavailable')}
            View Unavailable
          </h2>
          <p className="mt-2 text-sm text-danger-600 dark:text-danger-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-c-surface-raised p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {data.groups ? (
          <div className="space-y-4" data-testid="shared-view-groups">
            {data.groups.map((group, idx) => (
              <div
                key={`${group.value ?? 'empty'}-${idx}`}
                className="rounded-2xl border border-c-border-subtle bg-c-surface shadow-sm overflow-hidden"
              >
                <div
                  className="flex items-center justify-between border-b border-c-border-subtle bg-c-surface-raised px-4 py-2"
                  data-testid="shared-view-group-header"
                >
                  <span className="text-sm font-semibold text-c-text">
                    {group.value ?? t('table.groupEmptyValue')}
                  </span>
                  <span className="text-xs text-c-text-secondary">{group.count}</span>
                </div>
                <GridView rows={group.rows} columns={data.columns} locked={true} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-c-border-subtle bg-c-surface shadow-sm overflow-hidden">
            <GridView rows={data.rows} columns={data.columns} locked={true} />
          </div>
        )}
        <p className="mt-4 text-center text-xs text-c-text-secondary">
          {t('table.sharedViewReadOnly')}
        </p>
      </div>
    </div>
  );
}
