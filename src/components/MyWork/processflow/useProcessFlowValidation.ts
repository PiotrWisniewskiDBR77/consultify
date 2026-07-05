import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from 'reactflow';

import { type ProcessFlowSemanticKit } from '../canvas/canvasOsContract';
import { validateFlow as computeValidation } from './validateFlow';

export type { ValidationIssue, ValidationResult } from './validateFlow';
import type { ValidationResult } from './validateFlow';

interface UseProcessFlowValidationOpts {
  processId: string | null;
  nodes: Node[];
  edges: Edge[];
  semanticKit?: ProcessFlowSemanticKit;
  autoValidate?: boolean;
  onError?: (message: string) => void;
}

/**
 * Process-flow validation — client-side (DP-7). The V8 mirror
 * (`POST /api/v8/process-flow/:id/validate`) was cut, so this hook now runs
 * the same rule set locally via `validateFlow()` instead of fetching. The
 * public API (result/isValidating/validate/issuesForObject) is unchanged so
 * ValidationResultsPanel and callers need no changes.
 */
export function useProcessFlowValidation({
  processId,
  nodes,
  edges,
  semanticKit = 'classic',
  autoValidate = true,
  onError,
}: UseProcessFlowValidationOpts) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validate = useCallback(async () => {
    if (!processId) return;
    setIsValidating(true);
    try {
      const validation = computeValidation(nodes, edges, semanticKit);
      setResult(validation);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  }, [processId, nodes, edges, semanticKit, onError]);

  // Auto-validate after graph changes (debounced 500ms)
  useEffect(() => {
    if (!autoValidate || !processId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      validate();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [autoValidate, nodes, edges, processId, validate]);

  const issuesForObject = useCallback(
    (objectId: string) => result?.issues.filter((i) => i.object_id === objectId) ?? [],
    [result]
  );

  return { result, isValidating, validate, issuesForObject };
}
