import type { IdeaWorkspaceImportPayload } from '../ideaSelectionTypes';

function safeText(value: string | null | undefined, fallback: string) {
  const text = String(value || '').trim();
  return text || fallback;
}

export function buildInteropMappingReport(params: {
  title: string;
  nodes: any[];
  edges: any[];
  extensions?: Record<string, unknown>;
  format?: string;
}): string[] {
  return [
    `# ${params.title || 'Idea Workspace'} Mapping Report`,
    '',
    `- Format: ${params.format || 'native'}`,
    `- Exported at: ${new Date().toISOString()}`,
    `- Nodes: ${params.nodes.length}`,
    `- Edges: ${params.edges.length}`,
    '',
    '## Fidelity baseline',
    '- Native package semantics: real',
    '- Graph topology: real',
    '- External styling parity: best effort',
    '',
    '## Potential degradations',
    '- Custom styling may flatten outside Consultify.',
    '- Governance and AI replay stay inside `extensions`.',
    '- Artifact refs stay fully navigable only in Consultify runtime.',
    '',
    '## Extension keys',
    ...Object.keys(params.extensions || {}).map((key) => `- ${key}`),
    '',
  ];
}

export function parseDiagramPackage(raw: string): IdeaWorkspaceImportPayload {
  const parsed = JSON.parse(raw);
  return {
    sourceFormat: 'diagram_package',
    title: parsed?.title || parsed?.name || 'Imported package',
    nodes: Array.isArray(parsed?.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed?.edges) ? parsed.edges : [],
    extensions:
      parsed?.extensions && typeof parsed.extensions === 'object' ? parsed.extensions : {},
    mappingReport: buildInteropMappingReport({
      title: parsed?.title || 'Imported package',
      nodes: Array.isArray(parsed?.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed?.edges) ? parsed.edges : [],
      extensions:
        parsed?.extensions && typeof parsed.extensions === 'object' ? parsed.extensions : {},
      format: 'diagram_package',
    }),
  };
}

export function parseDrawIoXml(raw: string): IdeaWorkspaceImportPayload {
  const xml = new DOMParser().parseFromString(raw, 'text/xml');
  const cells = Array.from(xml.querySelectorAll('mxCell[id]'));
  const nodes: any[] = [];
  const edges: any[] = [];

  cells.forEach((cell, index) => {
    const id = safeText(cell.getAttribute('id'), `mx-${index}`);
    const source = cell.getAttribute('source');
    const target = cell.getAttribute('target');
    const geom = cell.querySelector('mxGeometry');
    const x = Number(geom?.getAttribute('x') || index * 180);
    const y = Number(geom?.getAttribute('y') || 80);
    const label = safeText(cell.getAttribute('value'), id);

    if (source && target) {
      edges.push({
        id,
        source,
        target,
        type: 'flowEdge',
        label: cell.getAttribute('value') || undefined,
      });
      return;
    }

    if (id === '0' || id === '1') return;
    nodes.push({
      id,
      type: 'flowNode',
      position: { x, y },
      data: {
        label,
        shape: label.toLowerCase().includes('decision') ? 'decision' : 'action',
        semanticType: 'process',
      },
    });
  });

  return {
    sourceFormat: 'drawio_xml',
    title: safeText(xml.querySelector('diagram')?.getAttribute('name'), 'Imported draw.io'),
    nodes,
    edges,
    extensions: {
      interop: {
        importedFrom: 'draw.io',
        fidelity: 'best_effort',
      },
    },
    mappingReport: buildInteropMappingReport({
      title: 'Imported draw.io',
      nodes,
      edges,
      format: 'drawio_xml',
    }),
  };
}

export function parseBpmnXml(raw: string): IdeaWorkspaceImportPayload {
  const xml = new DOMParser().parseFromString(raw, 'text/xml');
  const q = (selector: string) => Array.from(xml.querySelectorAll(selector));
  const nodes: any[] = [];
  const edges: any[] = [];

  const addNode = (el: Element, shape: string, idx: number) => {
    const id = safeText(el.getAttribute('id'), `${shape}-${idx}`);
    nodes.push({
      id,
      type: 'flowNode',
      position: { x: 120 + idx * 220, y: 120 },
      data: {
        label: safeText(el.getAttribute('name'), id),
        shape,
        semanticType: shape === 'bpmn_gateway' ? 'decision' : 'process',
      },
    });
  };

  q('startEvent, bpmn\\:startEvent').forEach((el, idx) => addNode(el, 'bpmn_event', idx));
  q('task, bpmn\\:task, userTask, bpmn\\:userTask, serviceTask, bpmn\\:serviceTask').forEach(
    (el, idx) => addNode(el, 'bpmn_task', idx + nodes.length)
  );
  q('exclusiveGateway, bpmn\\:exclusiveGateway, parallelGateway, bpmn\\:parallelGateway').forEach(
    (el, idx) => addNode(el, 'bpmn_gateway', idx + nodes.length)
  );
  q('endEvent, bpmn\\:endEvent').forEach((el, idx) =>
    addNode(el, 'bpmn_event', idx + nodes.length)
  );

  q('sequenceFlow, bpmn\\:sequenceFlow').forEach((el, idx) => {
    const source = el.getAttribute('sourceRef');
    const target = el.getAttribute('targetRef');
    if (!source || !target) return;
    edges.push({
      id: safeText(el.getAttribute('id'), `flow-${idx}`),
      source,
      target,
      type: 'flowEdge',
      label: el.getAttribute('name') || undefined,
    });
  });

  return {
    sourceFormat: 'bpmn_xml',
    title: safeText(
      xml.querySelector('process, bpmn\\:process')?.getAttribute('name'),
      'Imported BPMN'
    ),
    nodes,
    edges,
    extensions: {
      processFlow: { semanticKit: 'bpmn' },
      interop: {
        importedFrom: 'bpmn',
        fidelity: 'typed_best_effort',
      },
    },
    mappingReport: buildInteropMappingReport({
      title: 'Imported BPMN',
      nodes,
      edges,
      extensions: { processFlow: { semanticKit: 'bpmn' } },
      format: 'bpmn_xml',
    }),
  };
}
