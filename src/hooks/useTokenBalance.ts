import { useCallback, useEffect, useState } from 'react';

import { Api } from '../services/api';

const LOW_BALANCE_THRESHOLD = 1000;
const ZERO_BALANCE_THRESHOLD = 100;

export const useTokenBalance = () => {
  const [data, setData] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const raw = await Api.getTokenBalance();
      const n = typeof raw === 'number' ? raw : Number(raw);
      setData(Number.isFinite(n) ? n : 0);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[useTokenBalance] Failed to load balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to load balance');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const available = data ?? 0;
  const isZeroBalance = available <= ZERO_BALANCE_THRESHOLD;
  const isLowBalance = available > ZERO_BALANCE_THRESHOLD && available <= LOW_BALANCE_THRESHOLD;
  const shouldShowWarning = isLowBalance || isZeroBalance;
  const shouldBlockAI = isZeroBalance;

  return {
    balance: available,
    isLowBalance,
    isZeroBalance,
    shouldShowWarning,
    shouldBlockAI,
    isLoading,
    error,
    lastUpdated,
    LOW_BALANCE_THRESHOLD,
    ZERO_BALANCE_THRESHOLD,
    refreshBalance,
    refresh: refreshBalance,
  };
};

export default useTokenBalance;
