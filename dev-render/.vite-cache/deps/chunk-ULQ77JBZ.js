import {
  cc,
  shallow,
  useStore
} from "./chunk-OXB7RIKY.js";
import {
  require_react
} from "./chunk-4PAIT6J7.js";
import {
  __toESM
} from "./chunk-OL46QLBJ.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/@reactflow/background/dist/esm/index.mjs
var import_react = __toESM(require_react(), 1);
var BackgroundVariant;
(function(BackgroundVariant2) {
  BackgroundVariant2["Lines"] = "lines";
  BackgroundVariant2["Dots"] = "dots";
  BackgroundVariant2["Cross"] = "cross";
})(BackgroundVariant || (BackgroundVariant = {}));
function LinePattern({ color, dimensions, lineWidth }) {
  return import_react.default.createElement("path", { stroke: color, strokeWidth: lineWidth, d: `M${dimensions[0] / 2} 0 V${dimensions[1]} M0 ${dimensions[1] / 2} H${dimensions[0]}` });
}
function DotPattern({ color, radius }) {
  return import_react.default.createElement("circle", { cx: radius, cy: radius, r: radius, fill: color });
}
var defaultColor = {
  [BackgroundVariant.Dots]: "#91919a",
  [BackgroundVariant.Lines]: "#eee",
  [BackgroundVariant.Cross]: "#e2e2e2"
};
var defaultSize = {
  [BackgroundVariant.Dots]: 1,
  [BackgroundVariant.Lines]: 1,
  [BackgroundVariant.Cross]: 6
};
var selector = (s) => ({ transform: s.transform, patternId: `pattern-${s.rfId}` });
function Background({
  id,
  variant = BackgroundVariant.Dots,
  // only used for dots and cross
  gap = 20,
  // only used for lines and cross
  size,
  lineWidth = 1,
  offset = 2,
  color,
  style,
  className
}) {
  const ref = (0, import_react.useRef)(null);
  const { transform, patternId } = useStore(selector, shallow);
  const patternColor = color || defaultColor[variant];
  const patternSize = size || defaultSize[variant];
  const isDots = variant === BackgroundVariant.Dots;
  const isCross = variant === BackgroundVariant.Cross;
  const gapXY = Array.isArray(gap) ? gap : [gap, gap];
  const scaledGap = [gapXY[0] * transform[2] || 1, gapXY[1] * transform[2] || 1];
  const scaledSize = patternSize * transform[2];
  const patternDimensions = isCross ? [scaledSize, scaledSize] : scaledGap;
  const patternOffset = isDots ? [scaledSize / offset, scaledSize / offset] : [patternDimensions[0] / offset, patternDimensions[1] / offset];
  return import_react.default.createElement(
    "svg",
    { className: cc(["react-flow__background", className]), style: {
      ...style,
      position: "absolute",
      width: "100%",
      height: "100%",
      top: 0,
      left: 0
    }, ref, "data-testid": "rf__background" },
    import_react.default.createElement("pattern", { id: patternId + id, x: transform[0] % scaledGap[0], y: transform[1] % scaledGap[1], width: scaledGap[0], height: scaledGap[1], patternUnits: "userSpaceOnUse", patternTransform: `translate(-${patternOffset[0]},-${patternOffset[1]})` }, isDots ? import_react.default.createElement(DotPattern, { color: patternColor, radius: scaledSize / offset }) : import_react.default.createElement(LinePattern, { dimensions: patternDimensions, color: patternColor, lineWidth })),
    import_react.default.createElement("rect", { x: "0", y: "0", width: "100%", height: "100%", fill: `url(#${patternId + id})` })
  );
}
Background.displayName = "Background";
var Background$1 = (0, import_react.memo)(Background);

export {
  BackgroundVariant,
  Background$1
};
//# sourceMappingURL=chunk-ULQ77JBZ.js.map
