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
import "./chunk-CLKH6EFU.js";
import {
  createRailroadEbnfServices
} from "./chunk-NXMDDFY6.js";
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

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/mermaid/dist/chunks/mermaid.core/ebnfDiagram-CCIWWBDH.mjs
var langiumParser = createRailroadEbnfServices().RailroadEbnf.parser.LangiumParser;
var transformChoice = __name((choice) => {
  const alternatives = choice.alternatives.map(transformSequence);
  if (alternatives.length === 1) {
    return alternatives[0];
  }
  return {
    type: "choice",
    alternatives
  };
}, "transformChoice");
var transformSequence = __name((sequence) => {
  const elements = sequence.elements.map(transformTerm);
  if (elements.length === 1) {
    return elements[0];
  }
  return {
    type: "sequence",
    elements
  };
}, "transformSequence");
var transformPrimary = __name((primary) => {
  switch (primary.$type) {
    case "EbnfTerminal":
      return {
        type: "terminal",
        value: primary.value
      };
    case "EbnfNonTerminal":
      return {
        type: "nonterminal",
        name: primary.name
      };
    case "EbnfSpecial":
      return {
        type: "special",
        text: primary.text
      };
    case "EbnfGroup":
      return transformChoice(primary.element);
    case "EbnfOptional":
      return {
        type: "optional",
        element: transformChoice(primary.element)
      };
    case "EbnfRepetition":
      return {
        type: "repetition",
        element: transformChoice(primary.element),
        min: 0,
        max: Infinity
      };
    default:
      throw new Error(`Unsupported EBNF primary node: ${primary.$type}`);
  }
}, "transformPrimary");
var transformPostfix = __name((node, postfix) => {
  switch (postfix.$type) {
    case "EbnfOptionalPostfix":
      return {
        type: "optional",
        element: node
      };
    case "EbnfZeroOrMorePostfix":
      return {
        type: "repetition",
        element: node,
        min: 0,
        max: Infinity
      };
    case "EbnfOneOrMorePostfix":
      return {
        type: "repetition",
        element: node,
        min: 1,
        max: Infinity
      };
    case "EbnfExceptionPostfix":
      return {
        type: "sequence",
        elements: [
          node,
          { type: "terminal", value: "-" },
          transformPrimary(postfix.except)
        ]
      };
    default:
      throw new Error(`Unsupported EBNF postfix node: ${postfix.$type}`);
  }
}, "transformPostfix");
var transformTerm = __name((term) => {
  return term.postfixes.reduce((currentNode, postfix) => {
    return transformPostfix(currentNode, postfix);
  }, transformPrimary(term.base));
}, "transformTerm");
var transformRule = __name((rule) => {
  return {
    name: rule.name,
    definition: transformChoice(rule.definition)
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
    log.debug("[EBNF Parser] Starting Langium parse");
    const result = langiumParser.parse(input);
    if (result.lexerErrors.length > 0 || result.parserErrors.length > 0) {
      throw new MermaidParseError(result);
    }
    const ast = result.value;
    log.debug("[EBNF Parser] Parsed rules:", ast.rules.length);
    populateDb(ast);
    log.debug("[EBNF Parser] Parse complete");
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
//# sourceMappingURL=ebnfDiagram-CCIWWBDH-ZAN7D2MO.js.map
