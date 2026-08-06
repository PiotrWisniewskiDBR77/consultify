import React, { useCallback, useRef, useState } from 'react';

import Button from '@/components/ui/primitives/Button';

interface PromptRequest {
  title: string;
  defaultValue: string;
  confirmOnly: boolean;
}

export function useManualPrompt(): {
  requestText: (title: string, defaultValue?: string) => Promise<string | null>;
  requestConfirm: (title: string) => Promise<boolean>;
  promptDialog: React.ReactNode;
} {
  const [request, setRequest] = useState<PromptRequest | null>(null);
  const [value, setValue] = useState('');
  const resolver = useRef<((value: string | null) => void) | null>(null);

  const requestText = useCallback((title: string, defaultValue = '') => {
    resolver.current?.(null);
    setValue(defaultValue);
    setRequest({ title, defaultValue, confirmOnly: false });
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const requestConfirm = useCallback((title: string) => {
    resolver.current?.(null);
    setValue('confirm');
    setRequest({ title, defaultValue: 'confirm', confirmOnly: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = (answer) => resolve(answer !== null);
    });
  }, []);

  const close = useCallback((answer: string | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    resolve?.(answer);
  }, []);

  const promptDialog = request ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-manual-prompt-title"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      data-testid="document-manual-prompt"
    >
      <form
        className="w-full max-w-md rounded-xl border border-c-border bg-c-surface p-4 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          close(value);
        }}
      >
        <h2 id="document-manual-prompt-title" className="text-sm font-semibold text-c-text">
          {request.title}
        </h2>
        {!request.confirmOnly ? (
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="mt-3 w-full rounded-lg border border-c-border bg-c-background px-3 py-2 text-sm text-c-text outline-none focus:ring-2 focus:ring-c-focus"
            aria-label={request.title}
          />
        ) : (
          <p className="mt-2 text-xs text-c-text-secondary">
            Tej operacji nie można cofnąć po zamknięciu sesji.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => close(null)}>
            Anuluj
          </Button>
          <Button type="submit" variant={request.confirmOnly ? 'danger' : 'primary'} size="sm">
            {request.confirmOnly ? 'Potwierdź' : 'Zastosuj'}
          </Button>
        </div>
      </form>
    </div>
  ) : null;

  return { requestText, requestConfirm, promptDialog };
}
