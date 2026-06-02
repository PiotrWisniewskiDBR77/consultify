/**
 * ThinkingBlock (simplified)
 *
 * User request: remove the "thinking table/window" UI.
 * We keep only a minimal, single-line status text while streaming.
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ThinkingStep } from '../../../types';
import ThinkingStatusLine, { ThinkingLineItem } from '../ThinkingStatusLine';

interface ThinkingBlockProps {
  steps: ThinkingStep[];
  isStreaming?: boolean;
  className?: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  steps,
  isStreaming = false,
  className = '',
}) => {
  const { t } = useTranslation();

  // Build rich step items with status indicators for ThinkingStatusLine
  const richSteps = useMemo((): ThinkingLineItem[] => {
    const raw = (steps || [])
      .filter((s) => String((s as any)?.label || '').trim())
      .map((s) => ({
        label: String((s as any)?.label || '').trim(),
        status:
          s.status === 'done' || s.status === 'completed'
            ? ('done' as const)
            : s.status === 'in_progress'
              ? ('in_progress' as const)
              : ('pending' as const),
      }));
    return raw.slice(-8);
  }, [steps]);

  if (!isStreaming) return null;
  if (!steps || steps.length === 0) return null;

  const fallbackLabel =
    richSteps[richSteps.length - 1]?.label || t('thinking.processing', 'Thinking…');

  return (
    <div className={`mb-2 ${className}`}>
      <ThinkingStatusLine label={fallbackLabel} steps={richSteps} showSpinner={false} show />
    </div>
  );
};

export default ThinkingBlock;
