/**
 * Reduced fixture captured from Mermaid's SVG flowchart shape when
 * `flowchart.htmlLabels=false`: labels are SVG `<text>` nodes and arrows use a
 * local marker reference. Decorative attributes were removed only to keep the
 * security regression test readable.
 */
export const MERMAID_STRICT_FLOWCHART_FIXTURE = `
<svg xmlns="http://www.w3.org/2000/svg" role="graphics-document document">
  <defs>
    <marker id="flowchart-v2-pointEnd" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" class="arrowMarkerPath"/>
    </marker>
  </defs>
  <g class="root">
    <g class="nodes">
      <g class="node default" id="flowchart-A-0"><rect width="90" height="40"/><text><tspan>Draft</tspan></text></g>
      <g class="node default" id="flowchart-B-1"><rect width="90" height="40"/><text><tspan>Approve</tspan></text></g>
    </g>
    <g class="edgePaths"><path class="flowchart-link" d="M90,20L150,20" marker-end="url(#flowchart-v2-pointEnd)"/></g>
  </g>
</svg>`;
