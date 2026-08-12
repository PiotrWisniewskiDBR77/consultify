import {
  cc,
  clamp,
  useGetPointerPosition,
  useNodeId,
  useStoreApi
} from "./chunk-OXB7RIKY.js";
import {
  drag_default,
  select_default
} from "./chunk-SSKQ5L5F.js";
import {
  require_react
} from "./chunk-4PAIT6J7.js";
import {
  __toESM
} from "./chunk-OL46QLBJ.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/@reactflow/node-resizer/dist/esm/index.mjs
var import_react = __toESM(require_react(), 1);
var ResizeControlVariant;
(function(ResizeControlVariant2) {
  ResizeControlVariant2["Line"] = "line";
  ResizeControlVariant2["Handle"] = "handle";
})(ResizeControlVariant || (ResizeControlVariant = {}));
function getDirection({ width, prevWidth, height, prevHeight, invertX, invertY }) {
  const deltaWidth = width - prevWidth;
  const deltaHeight = height - prevHeight;
  const direction = [deltaWidth > 0 ? 1 : deltaWidth < 0 ? -1 : 0, deltaHeight > 0 ? 1 : deltaHeight < 0 ? -1 : 0];
  if (deltaWidth && invertX) {
    direction[0] = direction[0] * -1;
  }
  if (deltaHeight && invertY) {
    direction[1] = direction[1] * -1;
  }
  return direction;
}
var initPrevValues = { width: 0, height: 0, x: 0, y: 0 };
var initStartValues = {
  ...initPrevValues,
  pointerX: 0,
  pointerY: 0,
  aspectRatio: 1
};
function ResizeControl({ nodeId, position, variant = ResizeControlVariant.Handle, className, style = {}, children, color, minWidth = 10, minHeight = 10, maxWidth = Number.MAX_VALUE, maxHeight = Number.MAX_VALUE, keepAspectRatio = false, shouldResize, onResizeStart, onResize, onResizeEnd }) {
  const contextNodeId = useNodeId();
  const id = typeof nodeId === "string" ? nodeId : contextNodeId;
  const store = useStoreApi();
  const resizeControlRef = (0, import_react.useRef)(null);
  const startValues = (0, import_react.useRef)(initStartValues);
  const prevValues = (0, import_react.useRef)(initPrevValues);
  const getPointerPosition = useGetPointerPosition();
  const defaultPosition = variant === ResizeControlVariant.Line ? "right" : "bottom-right";
  const controlPosition = position ?? defaultPosition;
  (0, import_react.useEffect)(() => {
    if (!resizeControlRef.current || !id) {
      return;
    }
    const selection = select_default(resizeControlRef.current);
    const enableX = controlPosition.includes("right") || controlPosition.includes("left");
    const enableY = controlPosition.includes("bottom") || controlPosition.includes("top");
    const invertX = controlPosition.includes("left");
    const invertY = controlPosition.includes("top");
    const dragHandler = drag_default().on("start", (event) => {
      const node = store.getState().nodeInternals.get(id);
      const { xSnapped, ySnapped } = getPointerPosition(event);
      prevValues.current = {
        width: (node == null ? void 0 : node.width) ?? 0,
        height: (node == null ? void 0 : node.height) ?? 0,
        x: (node == null ? void 0 : node.position.x) ?? 0,
        y: (node == null ? void 0 : node.position.y) ?? 0
      };
      startValues.current = {
        ...prevValues.current,
        pointerX: xSnapped,
        pointerY: ySnapped,
        aspectRatio: prevValues.current.width / prevValues.current.height
      };
      onResizeStart == null ? void 0 : onResizeStart(event, { ...prevValues.current });
    }).on("drag", (event) => {
      const { nodeInternals, triggerNodeChanges } = store.getState();
      const { xSnapped, ySnapped } = getPointerPosition(event);
      const node = nodeInternals.get(id);
      if (node) {
        const changes = [];
        const { pointerX: startX, pointerY: startY, width: startWidth, height: startHeight, x: startNodeX, y: startNodeY, aspectRatio } = startValues.current;
        const { x: prevX, y: prevY, width: prevWidth, height: prevHeight } = prevValues.current;
        const distX = Math.floor(enableX ? xSnapped - startX : 0);
        const distY = Math.floor(enableY ? ySnapped - startY : 0);
        let width = clamp(startWidth + (invertX ? -distX : distX), minWidth, maxWidth);
        let height = clamp(startHeight + (invertY ? -distY : distY), minHeight, maxHeight);
        if (keepAspectRatio) {
          const nextAspectRatio = width / height;
          const isDiagonal = enableX && enableY;
          const isHorizontal = enableX && !enableY;
          const isVertical = enableY && !enableX;
          width = nextAspectRatio <= aspectRatio && isDiagonal || isVertical ? height * aspectRatio : width;
          height = nextAspectRatio > aspectRatio && isDiagonal || isHorizontal ? width / aspectRatio : height;
          if (width >= maxWidth) {
            width = maxWidth;
            height = maxWidth / aspectRatio;
          } else if (width <= minWidth) {
            width = minWidth;
            height = minWidth / aspectRatio;
          }
          if (height >= maxHeight) {
            height = maxHeight;
            width = maxHeight * aspectRatio;
          } else if (height <= minHeight) {
            height = minHeight;
            width = minHeight * aspectRatio;
          }
        }
        const isWidthChange = width !== prevWidth;
        const isHeightChange = height !== prevHeight;
        if (invertX || invertY) {
          const x = invertX ? startNodeX - (width - startWidth) : startNodeX;
          const y = invertY ? startNodeY - (height - startHeight) : startNodeY;
          const isXPosChange = x !== prevX && isWidthChange;
          const isYPosChange = y !== prevY && isHeightChange;
          if (isXPosChange || isYPosChange) {
            const positionChange = {
              id: node.id,
              type: "position",
              position: {
                x: isXPosChange ? x : prevX,
                y: isYPosChange ? y : prevY
              }
            };
            changes.push(positionChange);
            prevValues.current.x = positionChange.position.x;
            prevValues.current.y = positionChange.position.y;
          }
        }
        if (isWidthChange || isHeightChange) {
          const dimensionChange = {
            id,
            type: "dimensions",
            updateStyle: true,
            resizing: true,
            dimensions: {
              width,
              height
            }
          };
          changes.push(dimensionChange);
          prevValues.current.width = width;
          prevValues.current.height = height;
        }
        if (changes.length === 0) {
          return;
        }
        const direction = getDirection({
          width: prevValues.current.width,
          prevWidth,
          height: prevValues.current.height,
          prevHeight,
          invertX,
          invertY
        });
        const nextValues = { ...prevValues.current, direction };
        const callResize = shouldResize == null ? void 0 : shouldResize(event, nextValues);
        if (callResize === false) {
          return;
        }
        onResize == null ? void 0 : onResize(event, nextValues);
        triggerNodeChanges(changes);
      }
    }).on("end", (event) => {
      const dimensionChange = {
        id,
        type: "dimensions",
        resizing: false
      };
      onResizeEnd == null ? void 0 : onResizeEnd(event, { ...prevValues.current });
      store.getState().triggerNodeChanges([dimensionChange]);
    });
    selection.call(dragHandler);
    return () => {
      selection.on(".drag", null);
    };
  }, [
    id,
    controlPosition,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    keepAspectRatio,
    getPointerPosition,
    onResizeStart,
    onResize,
    onResizeEnd
  ]);
  const positionClassNames = controlPosition.split("-");
  const colorStyleProp = variant === ResizeControlVariant.Line ? "borderColor" : "backgroundColor";
  const controlStyle = color ? { ...style, [colorStyleProp]: color } : style;
  return import_react.default.createElement("div", { className: cc(["react-flow__resize-control", "nodrag", ...positionClassNames, variant, className]), ref: resizeControlRef, style: controlStyle }, children);
}
var ResizeControl$1 = (0, import_react.memo)(ResizeControl);
var handleControls = ["top-left", "top-right", "bottom-left", "bottom-right"];
var lineControls = ["top", "right", "bottom", "left"];
function NodeResizer({ nodeId, isVisible = true, handleClassName, handleStyle, lineClassName, lineStyle, color, minWidth = 10, minHeight = 10, maxWidth = Number.MAX_VALUE, maxHeight = Number.MAX_VALUE, keepAspectRatio = false, shouldResize, onResizeStart, onResize, onResizeEnd }) {
  if (!isVisible) {
    return null;
  }
  return import_react.default.createElement(
    import_react.default.Fragment,
    null,
    lineControls.map((c) => import_react.default.createElement(ResizeControl$1, { key: c, className: lineClassName, style: lineStyle, nodeId, position: c, variant: ResizeControlVariant.Line, color, minWidth, minHeight, maxWidth, maxHeight, onResizeStart, keepAspectRatio, shouldResize, onResize, onResizeEnd })),
    handleControls.map((c) => import_react.default.createElement(ResizeControl$1, { key: c, className: handleClassName, style: handleStyle, nodeId, position: c, color, minWidth, minHeight, maxWidth, maxHeight, onResizeStart, keepAspectRatio, shouldResize, onResize, onResizeEnd }))
  );
}

export {
  ResizeControlVariant,
  ResizeControl$1,
  NodeResizer
};
//# sourceMappingURL=chunk-QNGCQGSO.js.map
