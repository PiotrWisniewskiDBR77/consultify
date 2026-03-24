import React from 'react';
import { useTranslation } from 'react-i18next';

import { useV8Gate } from '@/hooks/useV8Gate';
import { useV8Snapshots } from '@/hooks/useV8Chat';

interface V8ContextIndicatorProps {
  conversationId: string | null;
}

export function V8ContextIndicator({ conversationId }: V8ContextIndicatorProps) {
  const { t } = useTranslation();
  const { showV8Chat } = useV8Gate();

  const { data: snapshots, isLoading, isError } = useV8Snapshots(
    showV8Chat && conversationId ? conversationId : undefined,
  );

  if (!showV8Chat) return null;
  if (isLoading || isError) return null;

  const items = Array.isArray(snapshots) ? snapshots : [];
  if (items.length === 0) return null;

  return (
    <div
      data-testid="v8-context-indicator"
      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-900/25 dark:text-emerald-300"
      title={t('v8.contextSnapshots', 'V8 Context Snapshots: {{count}}', { count: items.length })}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
      V8 {items.length}
    </div>
  );
}
