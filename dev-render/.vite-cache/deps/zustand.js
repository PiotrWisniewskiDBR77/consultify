import {
  createStore
} from "./chunk-WJAWASF2.js";
import {
  require_react
} from "./chunk-4PAIT6J7.js";
import {
  __toESM
} from "./chunk-OL46QLBJ.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/zustand/esm/react.mjs
var import_react = __toESM(require_react(), 1);
var identity = (arg) => arg;
function useStore(api, selector = identity) {
  const slice = import_react.default.useSyncExternalStore(
    api.subscribe,
    import_react.default.useCallback(() => selector(api.getState()), [api, selector]),
    import_react.default.useCallback(() => selector(api.getInitialState()), [api, selector])
  );
  import_react.default.useDebugValue(slice);
  return slice;
}
var createImpl = (createState) => {
  const api = createStore(createState);
  const useBoundStore = (selector) => useStore(api, selector);
  Object.assign(useBoundStore, api);
  return useBoundStore;
};
var create = ((createState) => createState ? createImpl(createState) : createImpl);
export {
  create,
  createStore,
  useStore
};
//# sourceMappingURL=zustand.js.map
