import {
  __name
} from "./chunk-4VTTE2ZV.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/mermaid/dist/chunks/mermaid.core/chunk-JWPE2WC7.mjs
function populateCommonDb(ast, db) {
  var _a, _b, _c;
  if (ast.accDescr) {
    (_a = db.setAccDescription) == null ? void 0 : _a.call(db, ast.accDescr);
  }
  if (ast.accTitle) {
    (_b = db.setAccTitle) == null ? void 0 : _b.call(db, ast.accTitle);
  }
  if (ast.title) {
    (_c = db.setDiagramTitle) == null ? void 0 : _c.call(db, ast.title);
  }
}
__name(populateCommonDb, "populateCommonDb");

export {
  populateCommonDb
};
//# sourceMappingURL=chunk-J72IZXCG.js.map
