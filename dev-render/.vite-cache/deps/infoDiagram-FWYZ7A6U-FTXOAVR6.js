import {
  parse
} from "./chunk-BWYJ7QLI.js";
import "./chunk-MXBEPZF5.js";
import "./chunk-UPB7OULX.js";
import "./chunk-PYMLLHYE.js";
import "./chunk-244A2F4N.js";
import "./chunk-MTRTQJPB.js";
import "./chunk-4AOE4CRZ.js";
import "./chunk-YVAXX4UJ.js";
import "./chunk-Q4JDNYHZ.js";
import "./chunk-WTLHOEKP.js";
import "./chunk-CLKH6EFU.js";
import "./chunk-NXMDDFY6.js";
import "./chunk-R3CQRA2I.js";
import "./chunk-NQMWOWF5.js";
import "./chunk-LUKGZP47.js";
import "./chunk-LJO7IGPF.js";
import "./chunk-W3NVCRJF.js";
import {
  selectSvgElement
} from "./chunk-7XTRZXN5.js";
import {
  configureSvgSize
} from "./chunk-ZYK4GX4N.js";
import {
  log
} from "./chunk-TVIGGMP2.js";
import {
  __name
} from "./chunk-4VTTE2ZV.js";
import "./chunk-WOJM4EPJ.js";
import "./chunk-TT73JFLM.js";
import "./chunk-L6N5AKK3.js";
import "./chunk-SSKQ5L5F.js";
import "./chunk-YBZR3XJN.js";
import "./chunk-YLOWU2IH.js";
import "./chunk-OL46QLBJ.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/mermaid/dist/chunks/mermaid.core/infoDiagram-FWYZ7A6U.mjs
var parser = {
  parse: __name(async (input) => {
    const ast = await parse("info", input);
    log.debug(ast);
  }, "parse")
};
var DEFAULT_INFO_DB = {
  version: "11.16.0" + (true ? "" : "-tiny")
};
var getVersion = __name(() => DEFAULT_INFO_DB.version, "getVersion");
var db = {
  getVersion
};
var draw = __name((text, id, version) => {
  log.debug("rendering info diagram\n" + text);
  const svg = selectSvgElement(id);
  configureSvgSize(svg, 100, 400, true);
  const group = svg.append("g");
  group.append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${version}`);
}, "draw");
var renderer = { draw };
var diagram = {
  parser,
  db,
  renderer
};
export {
  diagram
};
//# sourceMappingURL=infoDiagram-FWYZ7A6U-FTXOAVR6.js.map
