import React from 'react';

const TRANSIENT_IMPORT_ERROR_PATTERNS = [
  'Importing a module script failed',
  'module script failed',
  'Failed to fetch dynamically imported module',
  'dynamically imported module',
  'Outdated Optimize Dep',
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientImportError(error: unknown): boolean {
  const message = `${String(error ?? '')}\n${String((error as any)?.message ?? '')}`;
  return TRANSIENT_IMPORT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

type ImportFactory<T extends React.ComponentType<any>> = () => Promise<{ default: T }>;

interface LazyWithRetryOptions {
  retries?: number;
  retryDelayMs?: number;
}

export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: ImportFactory<T>,
  options?: LazyWithRetryOptions
) {
  const retries = options?.retries ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 250;

  return React.lazy(async () => {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;
        if (!isTransientImportError(error) || attempt === retries) {
          throw error;
        }
        attempt += 1;
        await delay(retryDelayMs);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  });
}
