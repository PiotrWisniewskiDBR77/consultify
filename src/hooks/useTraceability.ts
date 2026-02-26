/**
 * useTraceability (V3-A01)
 * Hook for components that create outputs (Initiative/Report/Deck).
 */

import { useCallback } from 'react';

import {
  ensureTraceability,
  getSourceMetadata,
  materializeMyWorkSession,
  validateTraceability,
} from '@/services/traceabilityService';
import type {
  MyWorkDerivedSource,
  SourceType,
  TraceabilityMetadata,
} from '@/types/domain/traceability';

export function useTraceability() {
  const ensureSource = useCallback(
    async (
      outputType: string,
      sourceInfo?: Partial<TraceabilityMetadata>
    ): Promise<TraceabilityMetadata> => {
      return ensureTraceability(outputType, sourceInfo);
    },
    []
  );

  const materializeMyWork = useCallback(async (sources: MyWorkDerivedSource[]) => {
    return materializeMyWorkSession(sources);
  }, []);

  const getSource = useCallback(
    async (type: SourceType, id: string): Promise<TraceabilityMetadata | null> => {
      return getSourceMetadata(type, id);
    },
    []
  );

  const isValid = useCallback((metadata: Partial<TraceabilityMetadata>) => {
    return validateTraceability(metadata).valid;
  }, []);

  return {
    ensureSource,
    materializeMyWork,
    getSource,
    isValid,
  };
}
