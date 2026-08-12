import {
  AbstractMermaidTokenBuilder,
  CommonValueConverter,
  EmptyFileSystem,
  MermaidGeneratedSharedModule,
  RadarGrammarGeneratedModule,
  __name,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  inject
} from "./chunk-W3NVCRJF.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/@mermaid-js/parser/dist/chunks/mermaid-parser.core/chunk-QBLGF6JB.mjs
var _a;
var RadarTokenBuilder = (_a = class extends AbstractMermaidTokenBuilder {
  constructor() {
    super(["radar-beta"]);
  }
}, __name(_a, "RadarTokenBuilder"), _a);
var RadarModule = {
  parser: {
    TokenBuilder: __name(() => new RadarTokenBuilder(), "TokenBuilder"),
    ValueConverter: __name(() => new CommonValueConverter(), "ValueConverter")
  }
};
function createRadarServices(context = EmptyFileSystem) {
  const shared = inject(
    createDefaultSharedCoreModule(context),
    MermaidGeneratedSharedModule
  );
  const Radar = inject(
    createDefaultCoreModule({ shared }),
    RadarGrammarGeneratedModule,
    RadarModule
  );
  shared.ServiceRegistry.register(Radar);
  return { shared, Radar };
}
__name(createRadarServices, "createRadarServices");

export {
  RadarModule,
  createRadarServices
};
//# sourceMappingURL=chunk-WTLHOEKP.js.map
