import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { GridView } from './GridView';
import type { ColumnDef, TableNode } from './tableTypes';

export default function PublicViewPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{ columns: ColumnDef[]; rows: TableNode[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    TablePlatformApi.getSharedViewData(token)
      .then((res: any) => {
        setData({
          columns: res.columns || [],
          rows: (res.records || []).map((r: any) => ({ id: r.id, ...r.data })),
        });
      })
      .catch((e: any) => setError(e?.message || 'Failed to load shared view'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="space-y-3 w-full max-w-2xl p-8">
          <div className="h-10 bg-slate-200 dark:bg-navy-800 rounded-xl animate-pulse" />
          <div className="h-8 bg-slate-200 dark:bg-navy-800 rounded-lg animate-pulse" />
          <div className="h-8 bg-slate-200 dark:bg-navy-800 rounded-lg animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20 p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-rose-800 dark:text-rose-200">View Unavailable</h2>
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-navy-700 dark:bg-navy-900 overflow-hidden">
          <GridView rows={data.rows} columns={data.columns} locked={true} />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Shared view — read only
        </p>
      </div>
    </div>
  );
}
