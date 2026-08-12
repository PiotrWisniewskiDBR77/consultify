import {
  Position,
  cc,
  getNodesBounds,
  internalsSymbol,
  shallow,
  useNodeId,
  useStore
} from "./chunk-OXB7RIKY.js";
import {
  require_react_dom
} from "./chunk-G3UY3H5U.js";
import {
  require_react
} from "./chunk-4PAIT6J7.js";
import {
  __toESM
} from "./chunk-OL46QLBJ.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/@reactflow/node-toolbar/dist/esm/index.mjs
var import_react = __toESM(require_react(), 1);
var import_react_dom = __toESM(require_react_dom(), 1);
var selector = (state) => {
  var _a;
  return (_a = state.domNode) == null ? void 0 : _a.querySelector(".react-flow__renderer");
};
function NodeToolbarPortal({ children }) {
  const wrapperRef = useStore(selector);
  if (!wrapperRef) {
    return null;
  }
  return (0, import_react_dom.createPortal)(children, wrapperRef);
}
var nodeEqualityFn = (a, b) => {
  var _a, _b, _c, _d, _e, _f;
  return ((_a = a == null ? void 0 : a.positionAbsolute) == null ? void 0 : _a.x) === ((_b = b == null ? void 0 : b.positionAbsolute) == null ? void 0 : _b.x) && ((_c = a == null ? void 0 : a.positionAbsolute) == null ? void 0 : _c.y) === ((_d = b == null ? void 0 : b.positionAbsolute) == null ? void 0 : _d.y) && (a == null ? void 0 : a.width) === (b == null ? void 0 : b.width) && (a == null ? void 0 : a.height) === (b == null ? void 0 : b.height) && (a == null ? void 0 : a.selected) === (b == null ? void 0 : b.selected) && ((_e = a == null ? void 0 : a[internalsSymbol]) == null ? void 0 : _e.z) === ((_f = b == null ? void 0 : b[internalsSymbol]) == null ? void 0 : _f.z);
};
var nodesEqualityFn = (a, b) => {
  return a.length === b.length && a.every((node, i) => nodeEqualityFn(node, b[i]));
};
var storeSelector = (state) => ({
  transform: state.transform,
  nodeOrigin: state.nodeOrigin,
  selectedNodesCount: state.getNodes().filter((node) => node.selected).length
});
function getTransform(nodeRect, transform, position, offset, align) {
  let alignmentOffset = 0.5;
  if (align === "start") {
    alignmentOffset = 0;
  } else if (align === "end") {
    alignmentOffset = 1;
  }
  let pos = [
    (nodeRect.x + nodeRect.width * alignmentOffset) * transform[2] + transform[0],
    nodeRect.y * transform[2] + transform[1] - offset
  ];
  let shift = [-100 * alignmentOffset, -100];
  switch (position) {
    case Position.Right:
      pos = [
        (nodeRect.x + nodeRect.width) * transform[2] + transform[0] + offset,
        (nodeRect.y + nodeRect.height * alignmentOffset) * transform[2] + transform[1]
      ];
      shift = [0, -100 * alignmentOffset];
      break;
    case Position.Bottom:
      pos[1] = (nodeRect.y + nodeRect.height) * transform[2] + transform[1] + offset;
      shift[1] = 0;
      break;
    case Position.Left:
      pos = [
        nodeRect.x * transform[2] + transform[0] - offset,
        (nodeRect.y + nodeRect.height * alignmentOffset) * transform[2] + transform[1]
      ];
      shift = [-100, -100 * alignmentOffset];
      break;
  }
  return `translate(${pos[0]}px, ${pos[1]}px) translate(${shift[0]}%, ${shift[1]}%)`;
}
function NodeToolbar({ nodeId, children, className, style, isVisible, position = Position.Top, offset = 10, align = "center", ...rest }) {
  const contextNodeId = useNodeId();
  const nodesSelector = (0, import_react.useCallback)((state) => {
    const nodeIds = Array.isArray(nodeId) ? nodeId : [nodeId || contextNodeId || ""];
    return nodeIds.reduce((acc, id) => {
      const node = state.nodeInternals.get(id);
      if (node) {
        acc.push(node);
      }
      return acc;
    }, []);
  }, [nodeId, contextNodeId]);
  const nodes = useStore(nodesSelector, nodesEqualityFn);
  const { transform, nodeOrigin, selectedNodesCount } = useStore(storeSelector, shallow);
  const isActive = typeof isVisible === "boolean" ? isVisible : nodes.length === 1 && nodes[0].selected && selectedNodesCount === 1;
  if (!isActive || !nodes.length) {
    return null;
  }
  const nodeRect = getNodesBounds(nodes, nodeOrigin);
  const zIndex = Math.max(...nodes.map((node) => {
    var _a;
    return (((_a = node[internalsSymbol]) == null ? void 0 : _a.z) || 1) + 1;
  }));
  const wrapperStyle = {
    position: "absolute",
    transform: getTransform(nodeRect, transform, position, offset, align),
    zIndex,
    ...style
  };
  return import_react.default.createElement(
    NodeToolbarPortal,
    null,
    import_react.default.createElement("div", { style: wrapperStyle, className: cc(["react-flow__node-toolbar", className]), ...rest }, children)
  );
}

export {
  NodeToolbar
};
//# sourceMappingURL=chunk-246DQFC2.js.map
