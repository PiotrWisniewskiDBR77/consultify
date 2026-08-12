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
import {
  createRailroadPegServices
} from "./chunk-MXBEPZF5.js";
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

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/mermaid/dist/chunks/mermaid.core/pegDiagram-2B236MQR.mjs
var langiumParser = createRailroadPegServices().RailroadPeg.parser.LangiumParser;
var transformOrderedChoice = __name((choice) => {
  const alternatives = choice.alternatives.map(transformSequence);
  if (alternatives.length === 1) {
    return alternatives[0];
  }
  return {
    type: "choice",
    alternatives
  };
}, "transformOrderedChoice");
var transformSequence = __name((sequence) => {
  const elements = sequence.elements.map(transformPrefix);
  if (elements.length === 1) {
    return elements[0];
  }
  return {
    type: "sequence",
    elements
  };
}, "transformSequence");
var transformPrefix = __name((prefix) => {
  const inner = transformSuffix(prefix.suffix);
  if (!prefix.operator) {
    return inner;
  }
  const label = prefix.operator === "&" ? `&${nodeToLabel(inner)}` : `!${nodeToLabel(inner)}`;
  return {
    type: "special",
    text: label
  };
}, "transformPrefix");
var nodeToLabel = __name((node) => {
  switch (node.type) {
    case "terminal":
      return `"${node.value}"`;
    case "nonterminal":
      return node.name;
    case "special":
      return node.text;
    default:
      return "(...)";
  }
}, "nodeToLabel");
var transformSuffix = __name((suffix) => {
  const inner = transformPrimary(suffix.primary);
  if (!suffix.operator) {
    return inner;
  }
  switch (suffix.operator) {
    case "?":
      return { type: "optional", element: inner };
    case "*":
      return { type: "repetition", element: inner, min: 0, max: Infinity };
    case "+":
      return { type: "repetition", element: inner, min: 1, max: Infinity };
    default:
      throw new Error(`Unsupported PEG suffix operator: ${suffix.operator}`);
  }
}, "transformSuffix");
var transformPrimary = __name((primary) => {
  switch (primary.$type) {
    case "PegLiteral":
      return {
        type: "terminal",
        value: primary.value
      };
    case "PegIdentifier":
      return {
        type: "nonterminal",
        name: primary.name
      };
    case "PegGroup":
      return transformOrderedChoice(primary.element);
    case "PegAny":
      return {
        type: "special",
        text: primary.dot
      };
    default:
      throw new Error(`Unsupported PEG primary node: ${primary.$type}`);
  }
}, "transformPrimary");
var transformRule = __name((rule) => {
  return {
    name: rule.name,
    definition: transformOrderedChoice(rule.definition)
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
    log.debug("[PEG Parser] Starting Langium parse");
    const result = langiumParser.parse(input);
    if (result.lexerErrors.length > 0 || result.parserErrors.length > 0) {
      throw new MermaidParseError(result);
    }
    const ast = result.value;
    log.debug("[PEG Parser] Parsed rules:", ast.rules.length);
    populateDb(ast);
    log.debug("[PEG Parser] Parse complete");
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
export {
  diagram
};
//# sourceMappingURL=pegDiagram-2B236MQR-4ZOYKLZK.js.map
