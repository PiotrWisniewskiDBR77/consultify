import { AlertTriangle, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface LargeMapOptimizerProps {
  nodeCount: number;
  edgeCount: number;
  onToggleSimplifiedMode: (simplified: boolean) => void;
}

const THRESHOLDS = {
  WARNING: 150,
  CRITICAL: 300,
  AUTO_SIMPLIFY: 500,
};

export const LargeMapOptimizer: React.FC<LargeMapOptimizerProps> = ({
  nodeCount,
  edgeCount,
  onToggleSimplifiedMode,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [simplified, setSimplified] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const level = useMemo(() => {
    if (nodeCount >= THRESHOLDS.AUTO_SIMPLIFY) return 'critical';
    if (nodeCount >= THRESHOLDS.CRITICAL) return 'warning';
    if (nodeCount >= THRESHOLDS.WARNING) return 'info';
    return null;
  }, [nodeCount]);

  useEffect(() => {
    if (nodeCount >= THRESHOLDS.AUTO_SIMPLIFY && !simplified) {
      setSimplified(true);
      onToggleSimplifiedMode(true);
    }
  }, [nodeCount, simplified, onToggleSimplifiedMode]);

  const toggleSimplified = useCallback(() => {
    const next = !simplified;
    setSimplified(next);
    onToggleSimplifiedMode(next);
  }, [simplified, onToggleSimplifiedMode]);

  if (!level || dismissed) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg border text-xs font-medium ${
        level === 'critical'
          ? 'bg-c-danger dark:bg-c-danger border-c-danger dark:border-c-danger text-c-danger dark:text-c-danger'
          : level === 'warning'
            ? 'bg-c-warning dark:bg-c-warning border-c-warning dark:border-c-warning text-c-warning dark:text-c-warning'
            : 'bg-c-info dark:bg-c-info border-c-info dark:border-c-info text-c-info dark:text-c-info'
      }`}
    >
      {level === 'critical' ? <AlertTriangle size={14} /> : <Zap size={14} />}
      <span>
        {isPl ? `${nodeCount} węzłów — ` : `${nodeCount} nodes — `}
        {simplified
          ? isPl
            ? 'tryb uproszczony aktywny'
            : 'simplified mode active'
          : isPl
            ? 'rozważ tryb uproszczony'
            : 'consider simplified mode'}
      </span>
      {!simplified && (
        <button
          onClick={toggleSimplified}
          className="px-2 py-0.5 rounded-lg bg-c-surface-raised dark:bg-c-bg hover:bg-c-surface-raised dark:hover:bg-c-bg transition-colors"
        >
          {isPl ? 'Włącz' : 'Enable'}
        </button>
      )}
      {simplified && (
        <button
          onClick={toggleSimplified}
          className="px-2 py-0.5 rounded-lg bg-c-surface-raised dark:bg-c-bg hover:bg-c-surface-raised dark:hover:bg-c-bg transition-colors"
        >
          {isPl ? 'Wyłącz' : 'Disable'}
        </button>
      )}
      <button onClick={() => setDismissed(true)} className="ml-1 opacity-50 hover:opacity-100">
        ✕
      </button>
    </div>
  );
};
