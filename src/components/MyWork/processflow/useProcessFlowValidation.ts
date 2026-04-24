import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from 'reactflow';

export interface ValidationIssue {
  layer: 'semantic_first' | 'structural_bounded';
  severity: 'error' | 'warning';
  object_id?: string;
  rule: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  validated_at: string;
}

interface UseProcessFlowValidationOpts {
  processId: string | null;
  nodes: Node[];
  edges: Edge[];
  autoValidate?: boolean;
}

export function useProcessFlowValidation({
  processId,
  nodes,
  edges,
  autoValidate = true,
}: UseProcessFlowValidationOpts) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const validate = useCallback(async () => {
    if (!processId) return;
    setIsValidating(true);
    try {
      const res = await fetch(`/api/v8/process-flow/${processId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch {
      // Network error — keep last result
    } finally {
      setIsValidating(false);
    }
  }, [processId]);

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
