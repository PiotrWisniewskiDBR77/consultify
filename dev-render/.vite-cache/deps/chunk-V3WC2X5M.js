import {
  configureSvgSize
} from "./chunk-ZYK4GX4N.js";
import {
  log
} from "./chunk-TVIGGMP2.js";
import {
  __name
} from "./chunk-4VTTE2ZV.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/mermaid/dist/chunks/mermaid.core/chunk-VR4S4FIN.mjs
var setupViewPortForSVG = __name((svg, padding, cssDiagram, useMaxWidth) => {
  svg.attr("class", cssDiagram);
  const { width, height, x, y } = calculateDimensionsWithPadding(svg, padding);
  configureSvgSize(svg, height, width, useMaxWidth);
  const viewBox = createViewBox(x, y, width, height, padding);
  svg.attr("viewBox", viewBox);
  log.debug(`viewBox configured: ${viewBox} with padding: ${padding}`);
}, "setupViewPortForSVG");
var calculateDimensionsWithPadding = __name((svg, padding) => {
  var _a;
  const bounds = ((_a = svg.node()) == null ? void 0 : _a.getBBox()) || { width: 0, height: 0, x: 0, y: 0 };
  return {
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
    x: bounds.x,
    y: bounds.y
  };
}, "calculateDimensionsWithPadding");
var createViewBox = __name((x, y, width, height, padding) => {
  return `${x - padding} ${y - padding} ${width} ${height}`;
}, "createViewBox");

export {
  setupViewPortForSVG
};
//# sourceMappingURL=chunk-V3WC2X5M.js.map
