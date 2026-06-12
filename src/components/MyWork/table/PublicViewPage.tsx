import { Lock } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { GridView } from './GridView';
import type { ColumnDef, TableNode } from './tableTypes';

export default function PublicViewPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{ columns: ColumnDef[]; rows: TableNode[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = (pw?: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    TablePlatformApi.getSharedViewData(token, pw)
      .then((res: any) => {
        setData({
          columns: res.columns || [],
          rows: (res.records || []).map((r: any) => ({ id: r.id, ...r.data })),
        });
        setNeedsPassword(false);
      })
      .catch((e: any) => {
        if (e?.code === 'VIEW_PASSWORD_REQUIRED') {
          setNeedsPassword(true);
          if (pw) setPasswordError('Incorrect password');
        } else {
          setError(e?.message || 'Failed to load shared view');
        }
      })
      .finally(() => {
        setLoading(false);
        setChecking(false);
      });
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="space-y-3 w-full max-w-2xl p-8">
          <div className="h-10 bg-slate-200 dark:bg-navy-800 rounded-xl animate-pulse" />
          <div className="h-8 bg-slate-200 dark:bg-navy-800 rounded-lg animate-pulse" />
          <div className="h-8 bg-slate-200 dark:bg-navy-800 rounded-lg animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-navy-950">
        <form
          onSubmit={handlePasswordSubmit}
          className="rounded-2xl border border-slate-200 bg-white dark:border-navy-700 dark:bg-navy-900 p-8 w-full max-w-sm shadow-sm text-center space-y-4"
        >
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-slate-100 dark:bg-navy-800">
              <Lock size={20} className="text-slate-600 dark:text-slate-400" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">
              Password Protected
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Enter the password to view this shared table.
            </p>
          </div>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 px-3 py-2 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          {passwordError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{passwordError}</p>
          )}
          <button
            type="submit"
            disabled={!password.trim() || checking}
            className="w-full rounded-lg bg-slate-800 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
          >
            {checking ? 'Verifying…' : 'View Table'}
          </button>
        </form>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20 p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-rose-800 dark:text-rose-200">
            View Unavailable
          </h2>
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
        <p className="mt-4 text-center text-xs text-slate-600 dark:text-slate-500">
          Shared view — read only
        </p>
      </div>
    </div>
  );
}
