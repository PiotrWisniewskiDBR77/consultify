/**
 * useConvertTo (V3-C02)
 * Hook that wraps the MyWork → output conversion flow.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConvertToConfirmation } from '@/components/MyWork/ConvertToConfirmation';
import {
  type BudgetConversionConfig,
  type ConversionResult,
  type ConversionSourceType,
  type ConversionTargetType,
  convertMyWorkItem,
  createOutputFromSession,
} from '@/services/conversionService';
import type { MyWorkDerivedSource, MyWorkSession } from '@/types/domain/traceability';

export interface UseConvertToOptions {
  sourceType: ConversionSourceType;
  sourceId: string;
  sourceTitle: string;
  /** Called when conversion completes (output created) */
  onConvertComplete?: (outputType: string, outputId: string) => void;
}

export interface UseConvertToReturn {
  showConvertDialog: boolean;
  setShowConvertDialog: (show: boolean) => void;
  handleConvert: (targetType: ConversionTargetType) => Promise<void>;
  handleConvertFromDialog: (
    session: MyWorkSession,
    targetType: string,
    budgetConfig?: BudgetConversionConfig
  ) => Promise<void>;
  isConverting: boolean;
  lastResult: ConversionResult | null;
  /** Sources for ConvertToDialog */
  sources: MyWorkDerivedSource[];
}

function navigateToOutput(
  navigate: ReturnType<typeof useNavigate>,
  targetType: string,
  outputId: string
) {
  const id = encodeURIComponent(outputId);
  const routes: Record<string, string> = {
    initiative: `/initiatives?open=${id}&mode=doc`,
    report: `/reports/builder/${id}`,
    presentation: `/presentations?deck=${id}`,
    financial_model: `/finance/models/${id}`,
    budget: `/economics?tab=prediction&open=${id}`,
    valuation: `/economics?tab=valuation&open=${id}`,
    analysis: `/finance/analyses/${id}`,
  };
  const route = routes[targetType];
  if (route) navigate(route);
}

export function useConvertTo({
  sourceType,
  sourceId,
  sourceTitle,
  onConvertComplete,
}: UseConvertToOptions): UseConvertToReturn {
  const navigate = useNavigate();
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [lastResult, setLastResult] = useState<ConversionResult | null>(null);

  const sources: MyWorkDerivedSource[] = [{ type: sourceType, id: sourceId, title: sourceTitle }];

  const handleConvert = useCallback(
    async (targetType: ConversionTargetType) => {
      setIsConverting(true);
      setLastResult(null);
      try {
        const result = await convertMyWorkItem({
          sourceType,
          sourceId,
          sourceTitle,
          targetType,
        });
        setLastResult(result);
        if (result.success) {
          ConvertToConfirmation.show({
            outputType: targetType,
            outputId: result.outputId,
            sourceTitle,
            sessionId: result.sessionId,
            onOpenOutput: () => {
              navigateToOutput(navigate, targetType, result.outputId);
              onConvertComplete?.(targetType, result.outputId);
            },
            onOpenSession: () => {
              window.dispatchEvent(
                new CustomEvent('mywork-open-item', {
                  detail: { type: 'notebook', id: result.sessionId, name: sourceTitle },
                })
              );
              onConvertComplete?.(targetType, result.outputId);
            },
          });
          onConvertComplete?.(targetType, result.outputId);
        }
      } finally {
        setIsConverting(false);
      }
    },
    [sourceType, sourceId, sourceTitle, navigate, onConvertComplete]
  );

  const handleConvertFromDialog = useCallback(
    async (session: MyWorkSession, targetType: string, budgetConfig?: BudgetConversionConfig) => {
      setIsConverting(true);
      setLastResult(null);
      try {
        const result = await createOutputFromSession(
          session.id,
          targetType as ConversionTargetType,
          sourceTitle,
          budgetConfig
        );
        setLastResult(result);
        if (result.success) {
          setShowConvertDialog(false);
          ConvertToConfirmation.show({
            outputType: targetType,
            outputId: result.outputId,
            sourceTitle,
            sessionId: result.sessionId,
            onOpenOutput: () => {
              navigateToOutput(navigate, targetType, result.outputId);
              onConvertComplete?.(targetType, result.outputId);
            },
            onOpenSession: () => {
              window.dispatchEvent(
                new CustomEvent('mywork-open-item', {
                  detail: { type: 'notebook', id: result.sessionId, name: sourceTitle },
                })
              );
              onConvertComplete?.(targetType, result.outputId);
            },
          });
          onConvertComplete?.(targetType, result.outputId);
        } else {
          throw new Error(result.error);
        }
      } finally {
        setIsConverting(false);
      }
    },
    [sourceTitle, navigate, onConvertComplete]
  );

  return {
    showConvertDialog,
    setShowConvertDialog,
    handleConvert,
    handleConvertFromDialog,
    isConverting,
    lastResult,
    sources,
  };
}
