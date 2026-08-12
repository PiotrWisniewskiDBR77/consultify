import {
  db,
  getStyles,
  renderer
} from "./chunk-DGTXOZID.js";
import {
  populateCommonDb
} from "./chunk-J72IZXCG.js";
import {
  MermaidParseError
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
import {
  createRailroadServices
} from "./chunk-CLKH6EFU.js";
import "./chunk-NXMDDFY6.js";
import "./chunk-R3CQRA2I.js";
import "./chunk-NQMWOWF5.js";
import "./chunk-LUKGZP47.js";
import "./chunk-LJO7IGPF.js";
import "./chunk-W3NVCRJF.js";
import "./chunk-7XTRZXN5.js";
import "./chunk-ZYK4GX4N.js";
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

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/mermaid/dist/chunks/mermaid.core/railroadDiagram-RFXS5EU6.mjs
var langiumParser = createRailroadServices().Railroad.parser.LangiumParser;
var transformExpression = __name((expr) => {
  switch (expr.$type) {
    case "RailroadTerminalExpr":
      return {
        type: "terminal",
        value: expr.value
      };
    case "RailroadNonTerminalExpr":
      return {
        type: "nonterminal",
        name: expr.name
      };
    case "RailroadSpecialExpr":
      return {
        type: "special",
        text: expr.text
      };
    case "RailroadSequenceExpr": {
      const elements = expr.elements.map(transformExpression);
      return elements.length === 1 ? elements[0] : { type: "sequence", elements };
    }
    case "RailroadChoiceExpr": {
      const alternatives = expr.alternatives.map(transformExpression);
      return alternatives.length === 1 ? alternatives[0] : { type: "choice", alternatives };
    }
    case "RailroadOptionalExpr":
      return {
        type: "optional",
        element: transformExpression(expr.element)
      };
    case "RailroadOneOrMoreExpr":
      return {
        type: "repetition",
        element: transformExpression(expr.element),
        min: 1,
        max: Infinity
      };
    case "RailroadZeroOrMoreExpr":
      return {
        type: "repetition",
        element: transformExpression(expr.element),
        min: 0,
        max: Infinity
      };
    default:
      throw new Error(`Unsupported railroad expression: ${expr.$type}`);
  }
}, "transformExpression");
var transformRule = __name((rule) => {
  return {
    name: rule.name,
    definition: transformExpression(rule.definition)
  };
}, "transformRule");
var populateDb = __name((ast) => {
  populateCommonDb(ast, db);
  if (ast.title) {
    db.setTitle(ast.title);
  }
  ast.rules.map((rule) => db.addRule(transformRule(rule)));
}, "populateDb");
var parser = {
  parse: __name((input) => {
    db.clear();
    log.debug("[Railroad Parser] Starting Langium parse");
    const result = langiumParser.parse(input);
    if (result.lexerErrors.length > 0 || result.parserErrors.length > 0) {
      throw new MermaidParseError(result);
    }
    const ast = result.value;
    log.debug("[Railroad Parser] Parsed rules:", ast.rules.length);
    populateDb(ast);
    log.debug("[Railroad Parser] Parse complete");
  }, "parse"),
  parser: {
    yy: db
  }
};
var diagram = {
  parser,
  db,
  renderer,
  styles: getStyles
};
var railroadDiagram_default = diagram;
export {
  railroadDiagram_default as default,
  diagram
};
//# sourceMappingURL=railroadDiagram-RFXS5EU6-3W4UGF7O.js.map
