import { useCallback, useEffect, useState } from 'react';

import { Api } from '../services/api';
import type { TokenBalance } from '../types';

const LOW_BALANCE_THRESHOLD = 1000;
const ZERO_BALANCE_THRESHOLD = 0;

export const useTokenBalance = () => {
  const [data, setData] = useState<TokenBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const balance = (await Api.getTokenBalance()) as TokenBalance;
      setData(balance);
    } catch (error) {
      console.error('[useTokenBalance] Failed to load balance:', error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const available = data?.available ?? 0;
  const isZeroBalance = available <= ZERO_BALANCE_THRESHOLD;
  const isLowBalance = available > ZERO_BALANCE_THRESHOLD && available <= LOW_BALANCE_THRESHOLD;

  return {
    balance: available,
    isLowBalance,
    isZeroBalance,
    isLoading,
    ZERO_BALANCE_THRESHOLD,
    refresh,
  };
};

export default useTokenBalance;
