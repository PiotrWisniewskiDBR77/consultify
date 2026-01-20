import { useCallback, useEffect, useState } from 'react';

import type { Bottleneck, ExecutionScore, VelocityMetrics } from '../types/myWork';

interface UseExecutionScoreOptions {
  autoLoad?: boolean;
}

const defaultScore: ExecutionScore = {
  current: 72,
  trend: 'up',
  vsLastWeek: 6,
  breakdown: {
    completionRate: 78,
    onTimeRate: 82,
    velocityScore: 70,
    qualityScore: 58,
  },
  rank: {
    position: 4,
    totalInTeam: 18,
    percentile: 78,
  },
  streak: {
    current: 5,
    best: 9,
  },
};

const defaultVelocity: VelocityMetrics = {
  period: 'week',
  data: [
    { date: '2026-01-01', completed: 6, created: 5, netVelocity: 1 },
    { date: '2026-01-08', completed: 8, created: 7, netVelocity: 1 },
    { date: '2026-01-15', completed: 5, created: 6, netVelocity: -1 },
    { date: '2026-01-22', completed: 9, created: 8, netVelocity: 1 },
  ],
  averageVelocity: 7,
  teamAverageVelocity: 6,
  trend: 'up',
};

const defaultBottlenecks: Bottleneck[] = [
  {
    type: 'overdue_cluster',
    count: 3,
    impact: 'medium',
    suggestion: 'Review overdue tasks and reassign owners.',
  },
  {
    type: 'decision_delay',
    count: 2,
    impact: 'high',
    suggestion: 'Escalate pending decisions to unblock execution.',
  },
];

export const useExecutionScore = (options: UseExecutionScoreOptions = {}) => {
  const [score, setScore] = useState<ExecutionScore | null>(null);
  const [velocity, setVelocity] = useState<VelocityMetrics | null>(null);
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [loading, setLoading] = useState(Boolean(options.autoLoad));

  const load = useCallback(() => {
    setLoading(true);
    setScore(defaultScore);
    setVelocity(defaultVelocity);
    setBottlenecks(defaultBottlenecks);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (options.autoLoad !== false) {
      load();
    }
  }, [load, options.autoLoad]);

  const loadVelocity = useCallback(async () => {
    setVelocity(defaultVelocity);
  }, []);

  return {
    score,
    velocity,
    bottlenecks,
    loading,
    loadVelocity,
  };
};

export default useExecutionScore;
