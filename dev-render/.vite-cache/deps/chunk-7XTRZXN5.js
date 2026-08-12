import {
  getConfig2
} from "./chunk-ZYK4GX4N.js";
import {
  __name
} from "./chunk-4VTTE2ZV.js";
import {
  select_default
} from "./chunk-SSKQ5L5F.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/mermaid/dist/chunks/mermaid.core/chunk-VAUOI2AC.mjs
var selectSvgElement = __name((id) => {
  var _a;
  const { securityLevel } = getConfig2();
  let root = select_default("body");
  if (securityLevel === "sandbox") {
    const sandboxElement = select_default(`#i${id}`);
    const doc = ((_a = sandboxElement.node()) == null ? void 0 : _a.contentDocument) ?? document;
    root = select_default(doc.body);
  }
  const svg = root.select(`#${id}`);
  return svg;
}, "selectSvgElement");

export {
  selectSvgElement
};
//# sourceMappingURL=chunk-7XTRZXN5.js.map
