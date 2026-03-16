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
          ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          : level === 'warning'
            ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
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
          className="px-2 py-0.5 rounded-lg bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 transition-colors"
        >
          {isPl ? 'Włącz' : 'Enable'}
        </button>
      )}
      {simplified && (
        <button
          onClick={toggleSimplified}
          className="px-2 py-0.5 rounded-lg bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 transition-colors"
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
