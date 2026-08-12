import {
  Panel,
  cc,
  getBoundsOfRects,
  getNodePositionWithOrigin,
  getNodesBounds,
  shallow,
  useStore,
  useStoreApi
} from "./chunk-OXB7RIKY.js";
import {
  identity,
  pointer_default,
  select_default,
  zoom_default
} from "./chunk-SSKQ5L5F.js";
import {
  require_react
} from "./chunk-4PAIT6J7.js";
import {
  __toESM
} from "./chunk-OL46QLBJ.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/@reactflow/minimap/dist/esm/index.mjs
var import_react = __toESM(require_react(), 1);
var MiniMapNode = ({ id, x, y, width, height, style, color, strokeColor, strokeWidth, className, borderRadius, shapeRendering, onClick, selected }) => {
  const { background, backgroundColor } = style || {};
  const fill = color || background || backgroundColor;
  return import_react.default.createElement("rect", { className: cc(["react-flow__minimap-node", { selected }, className]), x, y, rx: borderRadius, ry: borderRadius, width, height, fill, stroke: strokeColor, strokeWidth, shapeRendering, onClick: onClick ? (event) => onClick(event, id) : void 0 });
};
MiniMapNode.displayName = "MiniMapNode";
var MiniMapNode$1 = (0, import_react.memo)(MiniMapNode);
var selector$1 = (s) => s.nodeOrigin;
var selectorNodes = (s) => s.getNodes().filter((node) => !node.hidden && node.width && node.height);
var getAttrFunction = (func) => func instanceof Function ? func : () => func;
function MiniMapNodes({
  nodeStrokeColor = "transparent",
  nodeColor = "#e2e2e2",
  nodeClassName = "",
  nodeBorderRadius = 5,
  nodeStrokeWidth = 2,
  // We need to rename the prop to be `CapitalCase` so that JSX will render it as
  // a component properly.
  nodeComponent: NodeComponent = MiniMapNode$1,
  onClick
}) {
  const nodes = useStore(selectorNodes, shallow);
  const nodeOrigin = useStore(selector$1);
  const nodeColorFunc = getAttrFunction(nodeColor);
  const nodeStrokeColorFunc = getAttrFunction(nodeStrokeColor);
  const nodeClassNameFunc = getAttrFunction(nodeClassName);
  const shapeRendering = typeof window === "undefined" || !!window.chrome ? "crispEdges" : "geometricPrecision";
  return import_react.default.createElement(import_react.default.Fragment, null, nodes.map((node) => {
    const { x, y } = getNodePositionWithOrigin(node, nodeOrigin).positionAbsolute;
    return import_react.default.createElement(NodeComponent, { key: node.id, x, y, width: node.width, height: node.height, style: node.style, selected: node.selected, className: nodeClassNameFunc(node), color: nodeColorFunc(node), borderRadius: nodeBorderRadius, strokeColor: nodeStrokeColorFunc(node), strokeWidth: nodeStrokeWidth, shapeRendering, onClick, id: node.id });
  }));
}
var MiniMapNodes$1 = (0, import_react.memo)(MiniMapNodes);
var defaultWidth = 200;
var defaultHeight = 150;
var selector = (s) => {
  const nodes = s.getNodes();
  const viewBB = {
    x: -s.transform[0] / s.transform[2],
    y: -s.transform[1] / s.transform[2],
    width: s.width / s.transform[2],
    height: s.height / s.transform[2]
  };
  return {
    viewBB,
    boundingRect: nodes.length > 0 ? getBoundsOfRects(getNodesBounds(nodes, s.nodeOrigin), viewBB) : viewBB,
    rfId: s.rfId
  };
};
var ARIA_LABEL_KEY = "react-flow__minimap-desc";
function MiniMap({
  style,
  className,
  nodeStrokeColor = "transparent",
  nodeColor = "#e2e2e2",
  nodeClassName = "",
  nodeBorderRadius = 5,
  nodeStrokeWidth = 2,
  // We need to rename the prop to be `CapitalCase` so that JSX will render it as
  // a component properly.
  nodeComponent,
  maskColor = "rgb(240, 240, 240, 0.6)",
  maskStrokeColor = "none",
  maskStrokeWidth = 1,
  position = "bottom-right",
  onClick,
  onNodeClick,
  pannable = false,
  zoomable = false,
  ariaLabel = "React Flow mini map",
  inversePan = false,
  zoomStep = 10,
  offsetScale = 5
}) {
  const store = useStoreApi();
  const svg = (0, import_react.useRef)(null);
  const { boundingRect, viewBB, rfId } = useStore(selector, shallow);
  const elementWidth = (style == null ? void 0 : style.width) ?? defaultWidth;
  const elementHeight = (style == null ? void 0 : style.height) ?? defaultHeight;
  const scaledWidth = boundingRect.width / elementWidth;
  const scaledHeight = boundingRect.height / elementHeight;
  const viewScale = Math.max(scaledWidth, scaledHeight);
  const viewWidth = viewScale * elementWidth;
  const viewHeight = viewScale * elementHeight;
  const offset = offsetScale * viewScale;
  const x = boundingRect.x - (viewWidth - boundingRect.width) / 2 - offset;
  const y = boundingRect.y - (viewHeight - boundingRect.height) / 2 - offset;
  const width = viewWidth + offset * 2;
  const height = viewHeight + offset * 2;
  const labelledBy = `${ARIA_LABEL_KEY}-${rfId}`;
  const viewScaleRef = (0, import_react.useRef)(0);
  viewScaleRef.current = viewScale;
  (0, import_react.useEffect)(() => {
    if (svg.current) {
      const selection = select_default(svg.current);
      const zoomHandler = (event) => {
        const { transform, d3Selection, d3Zoom } = store.getState();
        if (event.sourceEvent.type !== "wheel" || !d3Selection || !d3Zoom) {
          return;
        }
        const pinchDelta = -event.sourceEvent.deltaY * (event.sourceEvent.deltaMode === 1 ? 0.05 : event.sourceEvent.deltaMode ? 1 : 2e-3) * zoomStep;
        const zoom = transform[2] * Math.pow(2, pinchDelta);
        d3Zoom.scaleTo(d3Selection, zoom);
      };
      const panHandler = (event) => {
        const { transform, d3Selection, d3Zoom, translateExtent, width: width2, height: height2 } = store.getState();
        if (event.sourceEvent.type !== "mousemove" || !d3Selection || !d3Zoom) {
          return;
        }
        const moveScale = viewScaleRef.current * Math.max(1, transform[2]) * (inversePan ? -1 : 1);
        const position2 = {
          x: transform[0] - event.sourceEvent.movementX * moveScale,
          y: transform[1] - event.sourceEvent.movementY * moveScale
        };
        const extent = [
          [0, 0],
          [width2, height2]
        ];
        const nextTransform = identity.translate(position2.x, position2.y).scale(transform[2]);
        const constrainedTransform = d3Zoom.constrain()(nextTransform, extent, translateExtent);
        d3Zoom.transform(d3Selection, constrainedTransform);
      };
      const zoomAndPanHandler = zoom_default().on("zoom", pannable ? panHandler : null).on("zoom.wheel", zoomable ? zoomHandler : null);
      selection.call(zoomAndPanHandler);
      return () => {
        selection.on("zoom", null);
      };
    }
  }, [pannable, zoomable, inversePan, zoomStep]);
  const onSvgClick = onClick ? (event) => {
    const rfCoord = pointer_default(event);
    onClick(event, { x: rfCoord[0], y: rfCoord[1] });
  } : void 0;
  const onSvgNodeClick = onNodeClick ? (event, nodeId) => {
    const node = store.getState().nodeInternals.get(nodeId);
    onNodeClick(event, node);
  } : void 0;
  return import_react.default.createElement(
    Panel,
    { position, style, className: cc(["react-flow__minimap", className]), "data-testid": "rf__minimap" },
    import_react.default.createElement(
      "svg",
      { width: elementWidth, height: elementHeight, viewBox: `${x} ${y} ${width} ${height}`, role: "img", "aria-labelledby": labelledBy, ref: svg, onClick: onSvgClick },
      ariaLabel && import_react.default.createElement("title", { id: labelledBy }, ariaLabel),
      import_react.default.createElement(MiniMapNodes$1, { onClick: onSvgNodeClick, nodeColor, nodeStrokeColor, nodeBorderRadius, nodeClassName, nodeStrokeWidth, nodeComponent }),
      import_react.default.createElement("path", { className: "react-flow__minimap-mask", d: `M${x - offset},${y - offset}h${width + offset * 2}v${height + offset * 2}h${-width - offset * 2}z
        M${viewBB.x},${viewBB.y}h${viewBB.width}v${viewBB.height}h${-viewBB.width}z`, fill: maskColor, fillRule: "evenodd", stroke: maskStrokeColor, strokeWidth: maskStrokeWidth, pointerEvents: "none" })
    )
  );
}
MiniMap.displayName = "MiniMap";
var MiniMap$1 = (0, import_react.memo)(MiniMap);

export {
  MiniMap$1
};
//# sourceMappingURL=chunk-5CTGX5M5.js.map
