/**
 * ThinkingBlock (simplified)
 *
 * User request: remove the "thinking table/window" UI.
 * We keep only a minimal, single-line status text while streaming.
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ThinkingStep } from '../../../types';
import ThinkingStatusLine from '../ThinkingStatusLine';

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

  const lines = useMemo(() => {
    const raw = (steps || []).map((s) => String((s as any)?.label || '').trim()).filter(Boolean);
    if (raw.length === 0) return [t('thinking.processing', 'Rozważam Twoje zapytanie...')];
    // Deduplicate consecutive duplicates
    const out: string[] = [];
    for (const l of raw) {
      if (out.length === 0 || out[out.length - 1] !== l) out.push(l);
    }
    return out.slice(-6);
  }, [steps, t]);

  if (!isStreaming) return null;
  if (!steps || steps.length === 0) return null;

  return (
    <div className={`mb-2 ${className}`}>
      <ThinkingStatusLine
        label={lines[lines.length - 1] || t('thinking.processing', 'Rozważam Twoje zapytanie...')}
        lines={lines}
        showSpinner={false}
        show
      />
    </div>
  );
};

export default ThinkingBlock;
