/**
 * validateFlow — client-side structural/semantic validation for Process Flow.
 *
 * Extracted from IdeaProcessFlowTool.tsx (DP-7: the V8 `/process-flow/:id/validate`
 * route was cut; this util replaces the dead backend round-trip with the same
 * rule set, evaluated entirely from the in-memory graph).
 *
 * Two output shapes are exposed:
 *  - `validateFlowWarnings` — the original lightweight warning list consumed by
 *    the inline toolbar warnings banner (unchanged behavior/format).
 *  - `validateFlow` — a `ValidationResult` (issues grouped by layer/severity)
 *    matching the shape `ValidationResultsPanel` expects, so the panel can be
 *    driven without any backend call.
 */
import type { Edge, Node } from 'reactflow';

import { type ProcessFlowSemanticKit } from '../canvas/canvasOsContract';

export type ValidationWarning = { id: string; message: string; messagePl: string };

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

/**
 * Core rule set — unchanged logic, previously inline in IdeaProcessFlowTool.tsx.
 */
export function validateFlowWarnings(
  nodes: Node[],
  edges: Edge[],
  semanticKit: ProcessFlowSemanticKit
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const flowNodes = nodes.filter((n: Node) => n.type === 'flowNode');

  const startShapes =
    semanticKit === 'bpmn'
      ? ['start', 'bpmn_event']
      : semanticKit === 'system' || semanticKit === 'org'
        ? []
        : ['start'];
  const endShapes =
    semanticKit === 'bpmn'
      ? ['end', 'bpmn_event']
      : semanticKit === 'system' || semanticKit === 'org'
        ? []
        : ['end'];
  const hasStart =
    startShapes.length === 0 ||
    flowNodes.some((n: Node) => startShapes.includes(String(n.data?.shape || '')));
  const hasEnd =
    endShapes.length === 0 ||
    flowNodes.some((n: Node) => endShapes.includes(String(n.data?.shape || '')));

  if (startShapes.length > 0 && !hasStart) {
    warnings.push({ id: 'no-start', message: 'Missing Start node', messagePl: 'Brak węzła Start' });
  }
  if (endShapes.length > 0 && !hasEnd) {
    warnings.push({ id: 'no-end', message: 'Missing End node', messagePl: 'Brak węzła Koniec' });
  }

  if (semanticKit === 'bpmn') {
    const hasGateway = flowNodes.some((n: Node) => n.data?.shape === 'bpmn_gateway');
    const hasTask = flowNodes.some((n: Node) => n.data?.shape === 'bpmn_task');
    if (!hasGateway) {
      warnings.push({
        id: 'bpmn-no-gateway',
        message: 'BPMN kit: add at least one gateway',
        messagePl: 'Kit BPMN: dodaj przynajmniej jedną bramkę',
      });
    }
    if (!hasTask) {
      warnings.push({
        id: 'bpmn-no-task',
        message: 'BPMN kit: add at least one task',
        messagePl: 'Kit BPMN: dodaj przynajmniej jedno zadanie',
      });
    }
  }

  if (semanticKit === 'system') {
    const hasActor = flowNodes.some((n: Node) => n.data?.shape === 'system_actor');
    const hasService = flowNodes.some((n: Node) => n.data?.shape === 'system_service');
    if (!hasActor) {
      warnings.push({
        id: 'system-no-actor',
        message: 'System kit: missing actor boundary',
        messagePl: 'Kit systemowy: brakuje granicy aktora',
      });
    }
    if (!hasService) {
      warnings.push({
        id: 'system-no-service',
        message: 'System kit: missing service node',
        messagePl: 'Kit systemowy: brakuje węzła serwisu',
      });
    }
  }

  if (semanticKit === 'org') {
    const hasRole = flowNodes.some((n: Node) => n.data?.shape === 'org_role');
    const hasHandoff = flowNodes.some((n: Node) => n.data?.shape === 'org_handoff');
    if (!hasRole) {
      warnings.push({
        id: 'org-no-role',
        message: 'Org kit: add at least one role',
        messagePl: 'Kit organizacyjny: dodaj przynajmniej jedną rolę',
      });
    }
    if (!hasHandoff) {
      warnings.push({
        id: 'org-no-handoff',
        message: 'Org kit: missing handoff marker',
        messagePl: 'Kit organizacyjny: brakuje markera przekazania',
      });
    }
  }

  for (const node of flowNodes) {
    const outgoing = edges.filter((e: Edge) => e.source === node.id);
    const incoming = edges.filter((e: Edge) => e.target === node.id);

    if (
      ['decision', 'bpmn_gateway', 'org_handoff'].includes(String(node.data?.shape)) &&
      outgoing.length < 2
    ) {
      warnings.push({
        id: `decision-exits-${node.id}`,
        message: `Decision "${node.data?.label || node.id}" needs at least 2 exits`,
        messagePl: `Decyzja "${node.data?.label || node.id}" wymaga min. 2 wyjść`,
      });
    }

    if (!startShapes.includes(String(node.data?.shape || '')) && incoming.length === 0) {
      warnings.push({
        id: `dangling-${node.id}`,
        message: `"${node.data?.label || node.id}" has no incoming connections`,
        messagePl: `"${node.data?.label || node.id}" nie ma połączeń wejściowych`,
      });
    }

    if (!endShapes.includes(String(node.data?.shape || '')) && outgoing.length === 0) {
      warnings.push({
        id: `no-exit-${node.id}`,
        message: `"${node.data?.label || node.id}" has no outgoing connections`,
        messagePl: `"${node.data?.label || node.id}" nie ma połączeń wyjściowych`,
      });
    }
  }

  // V5-IDEA-23: VSM-specific validation
  const vsmNodes = nodes.filter(
    (n: Node) => n.data?.shape?.startsWith('vsm_') || n.type?.startsWith('vsm_')
  );
  if (vsmNodes.length > 0) {
    const hasSupplier = vsmNodes.some(
      (n) => n.data?.shape === 'vsm_supplier' || n.type === 'vsm_supplier'
    );
    const hasCustomer = vsmNodes.some(
      (n) => n.data?.shape === 'vsm_customer' || n.type === 'vsm_customer'
    );
    const hasProcess = vsmNodes.some(
      (n) => n.data?.shape === 'vsm_process' || n.type === 'vsm_process'
    );

    if (!hasSupplier) {
      warnings.push({
        id: 'vsm-no-supplier',
        message: 'VSM: Missing Supplier node',
        messagePl: 'VSM: Brak węzła Dostawca',
      });
    }
    if (!hasCustomer) {
      warnings.push({
        id: 'vsm-no-customer',
        message: 'VSM: Missing Customer node',
        messagePl: 'VSM: Brak węzła Klient',
      });
    }
    if (!hasProcess) {
      warnings.push({
        id: 'vsm-no-process',
        message: 'VSM: Missing Process node',
        messagePl: 'VSM: Brak węzła Proces',
      });
    }

    const processNodes = vsmNodes.filter(
      (n) => n.data?.shape === 'vsm_process' || n.type === 'vsm_process'
    );
    for (const pn of processNodes) {
      if (!pn.data?.cycleTime) {
        warnings.push({
          id: `vsm-no-ct-${pn.id}`,
          message: `VSM: "${pn.data?.label || pn.id}" missing Cycle Time`,
          messagePl: `VSM: "${pn.data?.label || pn.id}" brak Czasu Cyklu`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Maps a warning id to the (layer, severity, rule) triple expected by
 * ValidationResultsPanel. "no-start"/"no-end"/decision-exit issues are
 * semantic_first errors; dangling/no-exit/kit-completeness issues are
 * structural_bounded warnings.
 */
function classifyWarning(id: string): { layer: ValidationIssue['layer']; severity: ValidationIssue['severity']; rule: string } {
  if (id === 'no-start' || id === 'no-end' || id.startsWith('decision-exits-')) {
    return { layer: 'semantic_first', severity: 'error', rule: id.startsWith('decision-exits-') ? 'decision_needs_two_exits' : id };
  }
  if (id.startsWith('dangling-')) {
    return { layer: 'structural_bounded', severity: 'warning', rule: 'dangling_node' };
  }
  if (id.startsWith('no-exit-')) {
    return { layer: 'structural_bounded', severity: 'warning', rule: 'no_outgoing_connection' };
  }
  if (id.startsWith('vsm-')) {
    return { layer: 'structural_bounded', severity: 'warning', rule: id };
  }
  if (id.startsWith('bpmn-') || id.startsWith('system-') || id.startsWith('org-')) {
    return { layer: 'structural_bounded', severity: 'warning', rule: id };
  }
  return { layer: 'structural_bounded', severity: 'warning', rule: id };
}

function extractObjectId(warningId: string): string | undefined {
  const prefixes = ['decision-exits-', 'dangling-', 'no-exit-', 'vsm-no-ct-'];
  for (const prefix of prefixes) {
    if (warningId.startsWith(prefix)) return warningId.slice(prefix.length);
  }
  return undefined;
}

/**
 * Full `ValidationResult` shape for ValidationResultsPanel — client-side,
 * computed synchronously from the in-memory graph (no fetch).
 */
export function validateFlow(
  nodes: Node[],
  edges: Edge[],
  semanticKit: ProcessFlowSemanticKit
): ValidationResult {
  const warnings = validateFlowWarnings(nodes, edges, semanticKit);
  const issues: ValidationIssue[] = warnings.map((w) => {
    const { layer, severity, rule } = classifyWarning(w.id);
    return {
      layer,
      severity,
      object_id: extractObjectId(w.id),
      rule,
      message: w.message,
    };
  });
  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
    validated_at: new Date().toISOString(),
  };
}
