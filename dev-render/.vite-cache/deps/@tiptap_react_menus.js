import {
  useCurrentEditor
} from "./chunk-6IIKS4YM.js";
import "./chunk-DMLA6MXB.js";
import {
  CellSelection
} from "./chunk-N4DOJDP3.js";
import {
  Extension,
  getText,
  getTextSerializersFromSchema,
  isTextSelection,
  posToDOMRect
} from "./chunk-J5DVLQ3E.js";
import "./chunk-VXM7HHNF.js";
import "./chunk-WN56HOU3.js";
import {
  NodeSelection,
  Plugin,
  PluginKey
} from "./chunk-2HIUAPKP.js";
import {
  require_jsx_runtime
} from "./chunk-V5LRHXOW.js";
import {
  arrow,
  autoPlacement,
  computePosition,
  flip,
  hide,
  inline,
  offset,
  shift,
  size
} from "./chunk-AXTWNRXH.js";
import "./chunk-Z4H4V46K.js";
import "./chunk-XJDCD67D.js";
import {
  require_react_dom
} from "./chunk-G3UY3H5U.js";
import {
  require_react
} from "./chunk-4PAIT6J7.js";
import {
  __toESM
} from "./chunk-OL46QLBJ.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/@tiptap/extension-bubble-menu/dist/index.js
function combineDOMRects(rect1, rect2) {
  const top = Math.min(rect1.top, rect2.top);
  const bottom = Math.max(rect1.bottom, rect2.bottom);
  const left = Math.min(rect1.left, rect2.left);
  const right = Math.max(rect1.right, rect2.right);
  const width = right - left;
  const height = bottom - top;
  const x = left;
  const y = top;
  return new DOMRect(x, y, width, height);
}
var BubbleMenuView = class {
  constructor({
    editor,
    element,
    view,
    updateDelay = 250,
    resizeDelay = 60,
    shouldShow,
    appendTo,
    getReferencedVirtualElement,
    options
  }) {
    this.preventHide = false;
    this.isVisible = false;
    this.scrollTarget = window;
    this.floatingUIOptions = {
      strategy: "absolute",
      placement: "top",
      offset: 8,
      flip: {},
      shift: {},
      arrow: false,
      size: false,
      autoPlacement: false,
      hide: false,
      inline: false,
      onShow: void 0,
      onHide: void 0,
      onUpdate: void 0,
      onDestroy: void 0
    };
    this.shouldShow = ({ view: view2, state, from, to }) => {
      const { doc, selection } = state;
      const { empty } = selection;
      const isEmptyTextBlock = !doc.textBetween(from, to).length && isTextSelection(state.selection);
      const isChildOfMenu = this.element.contains(document.activeElement);
      const hasEditorFocus = view2.hasFocus() || isChildOfMenu;
      if (!hasEditorFocus || empty || isEmptyTextBlock || !this.editor.isEditable) {
        return false;
      }
      return true;
    };
    this.mousedownHandler = () => {
      this.preventHide = true;
    };
    this.dragstartHandler = () => {
      this.hide();
    };
    this.resizeHandler = () => {
      if (this.resizeDebounceTimer) {
        clearTimeout(this.resizeDebounceTimer);
      }
      this.resizeDebounceTimer = window.setTimeout(() => {
        this.updatePosition();
      }, this.resizeDelay);
    };
    this.focusHandler = () => {
      setTimeout(() => this.update(this.editor.view));
    };
    this.blurHandler = ({ event }) => {
      var _a2;
      if (this.editor.isDestroyed) {
        this.destroy();
        return;
      }
      if (this.preventHide) {
        this.preventHide = false;
        return;
      }
      if ((event == null ? void 0 : event.relatedTarget) && ((_a2 = this.element.parentNode) == null ? void 0 : _a2.contains(event.relatedTarget))) {
        return;
      }
      if ((event == null ? void 0 : event.relatedTarget) === this.editor.view.dom) {
        return;
      }
      this.hide();
    };
    this.handleDebouncedUpdate = (view2, oldState) => {
      const selectionChanged = !(oldState == null ? void 0 : oldState.selection.eq(view2.state.selection));
      const docChanged = !(oldState == null ? void 0 : oldState.doc.eq(view2.state.doc));
      if (!selectionChanged && !docChanged) {
        return;
      }
      if (this.updateDebounceTimer) {
        clearTimeout(this.updateDebounceTimer);
      }
      this.updateDebounceTimer = window.setTimeout(() => {
        this.updateHandler(view2, selectionChanged, docChanged, oldState);
      }, this.updateDelay);
    };
    this.updateHandler = (view2, selectionChanged, docChanged, oldState) => {
      const { composing } = view2;
      const isSame = !selectionChanged && !docChanged;
      if (composing || isSame) {
        return;
      }
      const shouldShow2 = this.getShouldShow(oldState);
      if (!shouldShow2) {
        this.hide();
        return;
      }
      this.updatePosition();
      this.show();
    };
    this.transactionHandler = ({ transaction: tr }) => {
      const meta = tr.getMeta("bubbleMenu");
      if (meta === "updatePosition") {
        this.updatePosition();
      }
    };
    var _a;
    this.editor = editor;
    this.element = element;
    this.view = view;
    this.updateDelay = updateDelay;
    this.resizeDelay = resizeDelay;
    this.appendTo = appendTo;
    this.scrollTarget = (_a = options == null ? void 0 : options.scrollTarget) != null ? _a : window;
    this.getReferencedVirtualElement = getReferencedVirtualElement;
    this.floatingUIOptions = {
      ...this.floatingUIOptions,
      ...options
    };
    this.element.tabIndex = 0;
    if (shouldShow) {
      this.shouldShow = shouldShow;
    }
    this.element.addEventListener("mousedown", this.mousedownHandler, { capture: true });
    this.view.dom.addEventListener("dragstart", this.dragstartHandler);
    this.editor.on("focus", this.focusHandler);
    this.editor.on("blur", this.blurHandler);
    this.editor.on("transaction", this.transactionHandler);
    window.addEventListener("resize", this.resizeHandler);
    this.scrollTarget.addEventListener("scroll", this.resizeHandler);
    this.update(view, view.state);
    if (this.getShouldShow()) {
      this.show();
      this.updatePosition();
    }
  }
  get middlewares() {
    const middlewares = [];
    if (this.floatingUIOptions.flip) {
      middlewares.push(flip(typeof this.floatingUIOptions.flip !== "boolean" ? this.floatingUIOptions.flip : void 0));
    }
    if (this.floatingUIOptions.shift) {
      middlewares.push(
        shift(typeof this.floatingUIOptions.shift !== "boolean" ? this.floatingUIOptions.shift : void 0)
      );
    }
    if (this.floatingUIOptions.offset) {
      middlewares.push(
        offset(typeof this.floatingUIOptions.offset !== "boolean" ? this.floatingUIOptions.offset : void 0)
      );
    }
    if (this.floatingUIOptions.arrow) {
      middlewares.push(arrow(this.floatingUIOptions.arrow));
    }
    if (this.floatingUIOptions.size) {
      middlewares.push(size(typeof this.floatingUIOptions.size !== "boolean" ? this.floatingUIOptions.size : void 0));
    }
    if (this.floatingUIOptions.autoPlacement) {
      middlewares.push(
        autoPlacement(
          typeof this.floatingUIOptions.autoPlacement !== "boolean" ? this.floatingUIOptions.autoPlacement : void 0
        )
      );
    }
    if (this.floatingUIOptions.hide) {
      middlewares.push(hide(typeof this.floatingUIOptions.hide !== "boolean" ? this.floatingUIOptions.hide : void 0));
    }
    if (this.floatingUIOptions.inline) {
      middlewares.push(
        inline(typeof this.floatingUIOptions.inline !== "boolean" ? this.floatingUIOptions.inline : void 0)
      );
    }
    return middlewares;
  }
  get virtualElement() {
    var _a;
    const { selection } = this.editor.state;
    const referencedVirtualElement = (_a = this.getReferencedVirtualElement) == null ? void 0 : _a.call(this);
    if (referencedVirtualElement) {
      return referencedVirtualElement;
    }
    const domRect = posToDOMRect(this.view, selection.from, selection.to);
    let virtualElement = {
      getBoundingClientRect: () => domRect,
      getClientRects: () => [domRect]
    };
    if (selection instanceof NodeSelection) {
      let node = this.view.nodeDOM(selection.from);
      const nodeViewWrapper = node.dataset.nodeViewWrapper ? node : node.querySelector("[data-node-view-wrapper]");
      if (nodeViewWrapper) {
        node = nodeViewWrapper;
      }
      if (node) {
        virtualElement = {
          getBoundingClientRect: () => node.getBoundingClientRect(),
          getClientRects: () => [node.getBoundingClientRect()]
        };
      }
    }
    if (selection instanceof CellSelection) {
      const { $anchorCell, $headCell } = selection;
      const from = $anchorCell ? $anchorCell.pos : $headCell.pos;
      const to = $headCell ? $headCell.pos : $anchorCell.pos;
      const fromDOM = this.view.nodeDOM(from);
      const toDOM = this.view.nodeDOM(to);
      if (!fromDOM || !toDOM) {
        return;
      }
      const clientRect = fromDOM === toDOM ? fromDOM.getBoundingClientRect() : combineDOMRects(
        fromDOM.getBoundingClientRect(),
        toDOM.getBoundingClientRect()
      );
      virtualElement = {
        getBoundingClientRect: () => clientRect,
        getClientRects: () => [clientRect]
      };
    }
    return virtualElement;
  }
  updatePosition() {
    const virtualElement = this.virtualElement;
    if (!virtualElement) {
      return;
    }
    computePosition(virtualElement, this.element, {
      placement: this.floatingUIOptions.placement,
      strategy: this.floatingUIOptions.strategy,
      middleware: this.middlewares
    }).then(({ x, y, strategy }) => {
      this.element.style.width = "max-content";
      this.element.style.position = strategy;
      this.element.style.left = `${x}px`;
      this.element.style.top = `${y}px`;
      if (this.isVisible && this.floatingUIOptions.onUpdate) {
        this.floatingUIOptions.onUpdate();
      }
    });
  }
  update(view, oldState) {
    const { state } = view;
    const hasValidSelection = state.selection.from !== state.selection.to;
    if (this.updateDelay > 0 && hasValidSelection) {
      this.handleDebouncedUpdate(view, oldState);
      return;
    }
    const selectionChanged = !(oldState == null ? void 0 : oldState.selection.eq(view.state.selection));
    const docChanged = !(oldState == null ? void 0 : oldState.doc.eq(view.state.doc));
    this.updateHandler(view, selectionChanged, docChanged, oldState);
  }
  getShouldShow(oldState) {
    var _a;
    const { state } = this.view;
    const { selection } = state;
    const { ranges } = selection;
    const from = Math.min(...ranges.map((range) => range.$from.pos));
    const to = Math.max(...ranges.map((range) => range.$to.pos));
    const shouldShow = (_a = this.shouldShow) == null ? void 0 : _a.call(this, {
      editor: this.editor,
      element: this.element,
      view: this.view,
      state,
      oldState,
      from,
      to
    });
    return shouldShow || false;
  }
  show() {
    var _a;
    if (this.isVisible) {
      return;
    }
    this.element.style.visibility = "visible";
    this.element.style.opacity = "1";
    const appendToElement = typeof this.appendTo === "function" ? this.appendTo() : this.appendTo;
    (_a = appendToElement != null ? appendToElement : this.view.dom.parentElement) == null ? void 0 : _a.appendChild(this.element);
    if (this.floatingUIOptions.onShow) {
      this.floatingUIOptions.onShow();
    }
    this.isVisible = true;
  }
  hide() {
    if (!this.isVisible) {
      return;
    }
    this.element.style.visibility = "hidden";
    this.element.style.opacity = "0";
    this.element.remove();
    if (this.floatingUIOptions.onHide) {
      this.floatingUIOptions.onHide();
    }
    this.isVisible = false;
  }
  destroy() {
    this.hide();
    this.element.removeEventListener("mousedown", this.mousedownHandler, { capture: true });
    this.view.dom.removeEventListener("dragstart", this.dragstartHandler);
    window.removeEventListener("resize", this.resizeHandler);
    this.scrollTarget.removeEventListener("scroll", this.resizeHandler);
    this.editor.off("focus", this.focusHandler);
    this.editor.off("blur", this.blurHandler);
    this.editor.off("transaction", this.transactionHandler);
    if (this.floatingUIOptions.onDestroy) {
      this.floatingUIOptions.onDestroy();
    }
  }
};
var BubbleMenuPlugin = (options) => {
  return new Plugin({
    key: typeof options.pluginKey === "string" ? new PluginKey(options.pluginKey) : options.pluginKey,
    view: (view) => new BubbleMenuView({ view, ...options })
  });
};
var BubbleMenu = Extension.create({
  name: "bubbleMenu",
  addOptions() {
    return {
      element: null,
      pluginKey: "bubbleMenu",
      updateDelay: void 0,
      appendTo: void 0,
      shouldShow: null
    };
  },
  addProseMirrorPlugins() {
    if (!this.options.element) {
      return [];
    }
    return [
      BubbleMenuPlugin({
        pluginKey: this.options.pluginKey,
        editor: this.editor,
        element: this.options.element,
        updateDelay: this.options.updateDelay,
        options: this.options.options,
        appendTo: this.options.appendTo,
        getReferencedVirtualElement: this.options.getReferencedVirtualElement,
        shouldShow: this.options.shouldShow
      })
    ];
  }
});

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/@tiptap/react/dist/menus/index.js
var import_react2 = __toESM(require_react());
var import_react_dom = __toESM(require_react_dom());
var import_jsx_runtime = __toESM(require_jsx_runtime());

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/@tiptap/extension-floating-menu/dist/index.js
var FloatingMenuView = class {
  constructor({ editor, element, view, options, appendTo, shouldShow }) {
    this.preventHide = false;
    this.isVisible = false;
    this.shouldShow = ({ view: view2, state }) => {
      const { selection } = state;
      const { $anchor, empty } = selection;
      const isRootDepth = $anchor.depth === 1;
      const isEmptyTextBlock = $anchor.parent.isTextblock && !$anchor.parent.type.spec.code && !$anchor.parent.textContent && $anchor.parent.childCount === 0 && !this.getTextContent($anchor.parent);
      if (!view2.hasFocus() || !empty || !isRootDepth || !isEmptyTextBlock || !this.editor.isEditable) {
        return false;
      }
      return true;
    };
    this.floatingUIOptions = {
      strategy: "absolute",
      placement: "right",
      offset: 8,
      flip: {},
      shift: {},
      arrow: false,
      size: false,
      autoPlacement: false,
      hide: false,
      inline: false
    };
    this.updateHandler = (view2, selectionChanged, docChanged, oldState) => {
      const { composing } = view2;
      const isSame = !selectionChanged && !docChanged;
      if (composing || isSame) {
        return;
      }
      const shouldShow2 = this.getShouldShow(oldState);
      if (!shouldShow2) {
        this.hide();
        return;
      }
      this.updatePosition();
      this.show();
    };
    this.mousedownHandler = () => {
      this.preventHide = true;
    };
    this.focusHandler = () => {
      setTimeout(() => this.update(this.editor.view));
    };
    this.blurHandler = ({ event }) => {
      var _a;
      if (this.preventHide) {
        this.preventHide = false;
        return;
      }
      if ((event == null ? void 0 : event.relatedTarget) && ((_a = this.element.parentNode) == null ? void 0 : _a.contains(event.relatedTarget))) {
        return;
      }
      if ((event == null ? void 0 : event.relatedTarget) === this.editor.view.dom) {
        return;
      }
      this.hide();
    };
    this.editor = editor;
    this.element = element;
    this.view = view;
    this.appendTo = appendTo;
    this.floatingUIOptions = {
      ...this.floatingUIOptions,
      ...options
    };
    this.element.tabIndex = 0;
    if (shouldShow) {
      this.shouldShow = shouldShow;
    }
    this.element.addEventListener("mousedown", this.mousedownHandler, { capture: true });
    this.editor.on("focus", this.focusHandler);
    this.editor.on("blur", this.blurHandler);
    this.update(view, view.state);
    if (this.getShouldShow()) {
      this.show();
      this.updatePosition();
    }
  }
  getTextContent(node) {
    return getText(node, { textSerializers: getTextSerializersFromSchema(this.editor.schema) });
  }
  get middlewares() {
    const middlewares = [];
    if (this.floatingUIOptions.flip) {
      middlewares.push(flip(typeof this.floatingUIOptions.flip !== "boolean" ? this.floatingUIOptions.flip : void 0));
    }
    if (this.floatingUIOptions.shift) {
      middlewares.push(
        shift(typeof this.floatingUIOptions.shift !== "boolean" ? this.floatingUIOptions.shift : void 0)
      );
    }
    if (this.floatingUIOptions.offset) {
      middlewares.push(
        offset(typeof this.floatingUIOptions.offset !== "boolean" ? this.floatingUIOptions.offset : void 0)
      );
    }
    if (this.floatingUIOptions.arrow) {
      middlewares.push(arrow(this.floatingUIOptions.arrow));
    }
    if (this.floatingUIOptions.size) {
      middlewares.push(size(typeof this.floatingUIOptions.size !== "boolean" ? this.floatingUIOptions.size : void 0));
    }
    if (this.floatingUIOptions.autoPlacement) {
      middlewares.push(
        autoPlacement(
          typeof this.floatingUIOptions.autoPlacement !== "boolean" ? this.floatingUIOptions.autoPlacement : void 0
        )
      );
    }
    if (this.floatingUIOptions.hide) {
      middlewares.push(hide(typeof this.floatingUIOptions.hide !== "boolean" ? this.floatingUIOptions.hide : void 0));
    }
    if (this.floatingUIOptions.inline) {
      middlewares.push(
        inline(typeof this.floatingUIOptions.inline !== "boolean" ? this.floatingUIOptions.inline : void 0)
      );
    }
    return middlewares;
  }
  getShouldShow(oldState) {
    var _a;
    const { state } = this.view;
    const { selection } = state;
    const { ranges } = selection;
    const from = Math.min(...ranges.map((range) => range.$from.pos));
    const to = Math.max(...ranges.map((range) => range.$to.pos));
    const shouldShow = (_a = this.shouldShow) == null ? void 0 : _a.call(this, {
      editor: this.editor,
      view: this.view,
      state,
      oldState,
      from,
      to
    });
    return shouldShow;
  }
  updatePosition() {
    const { selection } = this.editor.state;
    const domRect = posToDOMRect(this.view, selection.from, selection.to);
    const virtualElement = {
      getBoundingClientRect: () => domRect,
      getClientRects: () => [domRect]
    };
    computePosition(virtualElement, this.element, {
      placement: this.floatingUIOptions.placement,
      strategy: this.floatingUIOptions.strategy,
      middleware: this.middlewares
    }).then(({ x, y, strategy }) => {
      this.element.style.width = "max-content";
      this.element.style.position = strategy;
      this.element.style.left = `${x}px`;
      this.element.style.top = `${y}px`;
      if (this.isVisible && this.floatingUIOptions.onUpdate) {
        this.floatingUIOptions.onUpdate();
      }
    });
  }
  update(view, oldState) {
    const selectionChanged = !(oldState == null ? void 0 : oldState.selection.eq(view.state.selection));
    const docChanged = !(oldState == null ? void 0 : oldState.doc.eq(view.state.doc));
    this.updateHandler(view, selectionChanged, docChanged, oldState);
  }
  show() {
    var _a;
    if (this.isVisible) {
      return;
    }
    this.element.style.visibility = "visible";
    this.element.style.opacity = "1";
    const appendToElement = typeof this.appendTo === "function" ? this.appendTo() : this.appendTo;
    (_a = appendToElement != null ? appendToElement : this.view.dom.parentElement) == null ? void 0 : _a.appendChild(this.element);
    if (this.floatingUIOptions.onShow) {
      this.floatingUIOptions.onShow();
    }
    this.isVisible = true;
  }
  hide() {
    if (!this.isVisible) {
      return;
    }
    this.element.style.visibility = "hidden";
    this.element.style.opacity = "0";
    this.element.remove();
    if (this.floatingUIOptions.onHide) {
      this.floatingUIOptions.onHide();
    }
    this.isVisible = false;
  }
  destroy() {
    this.hide();
    this.element.removeEventListener("mousedown", this.mousedownHandler, { capture: true });
    this.editor.off("focus", this.focusHandler);
    this.editor.off("blur", this.blurHandler);
    if (this.floatingUIOptions.onDestroy) {
      this.floatingUIOptions.onDestroy();
    }
  }
};
var FloatingMenuPlugin = (options) => {
  return new Plugin({
    key: typeof options.pluginKey === "string" ? new PluginKey(options.pluginKey) : options.pluginKey,
    view: (view) => new FloatingMenuView({ view, ...options })
  });
};
var FloatingMenu = Extension.create({
  name: "floatingMenu",
  addOptions() {
    return {
      element: null,
      options: {},
      pluginKey: "floatingMenu",
      appendTo: void 0,
      shouldShow: null
    };
  },
  addProseMirrorPlugins() {
    if (!this.options.element) {
      return [];
    }
    return [
      FloatingMenuPlugin({
        pluginKey: this.options.pluginKey,
        editor: this.editor,
        element: this.options.element,
        options: this.options.options,
        appendTo: this.options.appendTo,
        shouldShow: this.options.shouldShow
      })
    ];
  }
});

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/@tiptap/react/dist/menus/index.js
var import_react4 = __toESM(require_react());
var import_react_dom2 = __toESM(require_react_dom());
var import_jsx_runtime2 = __toESM(require_jsx_runtime());
var BubbleMenu2 = import_react2.default.forwardRef(
  ({
    pluginKey = "bubbleMenu",
    editor,
    updateDelay,
    resizeDelay,
    appendTo,
    shouldShow = null,
    getReferencedVirtualElement,
    options,
    children,
    ...restProps
  }, ref) => {
    const menuEl = (0, import_react2.useRef)(document.createElement("div"));
    if (typeof ref === "function") {
      ref(menuEl.current);
    } else if (ref) {
      ref.current = menuEl.current;
    }
    const { editor: currentEditor } = useCurrentEditor();
    const pluginEditor = editor || currentEditor;
    const bubbleMenuPluginProps = {
      updateDelay,
      resizeDelay,
      appendTo,
      pluginKey,
      shouldShow,
      getReferencedVirtualElement,
      options
    };
    const bubbleMenuPluginPropsRef = (0, import_react2.useRef)(bubbleMenuPluginProps);
    bubbleMenuPluginPropsRef.current = bubbleMenuPluginProps;
    (0, import_react2.useEffect)(() => {
      if (pluginEditor == null ? void 0 : pluginEditor.isDestroyed) {
        return;
      }
      if (!pluginEditor) {
        console.warn("BubbleMenu component is not rendered inside of an editor component or does not have editor prop.");
        return;
      }
      const bubbleMenuElement = menuEl.current;
      bubbleMenuElement.style.visibility = "hidden";
      bubbleMenuElement.style.position = "absolute";
      const plugin = BubbleMenuPlugin({
        ...bubbleMenuPluginPropsRef.current,
        editor: pluginEditor,
        element: bubbleMenuElement
      });
      pluginEditor.registerPlugin(plugin);
      const createdPluginKey = bubbleMenuPluginPropsRef.current.pluginKey;
      return () => {
        pluginEditor.unregisterPlugin(createdPluginKey);
        window.requestAnimationFrame(() => {
          if (bubbleMenuElement.parentNode) {
            bubbleMenuElement.parentNode.removeChild(bubbleMenuElement);
          }
        });
      };
    }, [pluginEditor]);
    return (0, import_react_dom.createPortal)((0, import_jsx_runtime.jsx)("div", { ...restProps, children }), menuEl.current);
  }
);
var FloatingMenu2 = import_react4.default.forwardRef(
  ({ pluginKey = "floatingMenu", editor, appendTo, shouldShow = null, options, children, ...restProps }, ref) => {
    const menuEl = (0, import_react4.useRef)(document.createElement("div"));
    if (typeof ref === "function") {
      ref(menuEl.current);
    } else if (ref) {
      ref.current = menuEl.current;
    }
    const { editor: currentEditor } = useCurrentEditor();
    (0, import_react4.useEffect)(() => {
      const floatingMenuElement = menuEl.current;
      floatingMenuElement.style.visibility = "hidden";
      floatingMenuElement.style.position = "absolute";
      if ((editor == null ? void 0 : editor.isDestroyed) || (currentEditor == null ? void 0 : currentEditor.isDestroyed)) {
        return;
      }
      const attachToEditor = editor || currentEditor;
      if (!attachToEditor) {
        console.warn(
          "FloatingMenu component is not rendered inside of an editor component or does not have editor prop."
        );
        return;
      }
      const plugin = FloatingMenuPlugin({
        editor: attachToEditor,
        element: floatingMenuElement,
        pluginKey,
        appendTo,
        shouldShow,
        options
      });
      attachToEditor.registerPlugin(plugin);
      return () => {
        attachToEditor.unregisterPlugin(pluginKey);
        window.requestAnimationFrame(() => {
          if (floatingMenuElement.parentNode) {
            floatingMenuElement.parentNode.removeChild(floatingMenuElement);
          }
        });
      };
    }, [editor, currentEditor, appendTo, pluginKey, shouldShow, options]);
    return (0, import_react_dom2.createPortal)((0, import_jsx_runtime2.jsx)("div", { ...restProps, children }), menuEl.current);
  }
);
export {
  BubbleMenu2 as BubbleMenu,
  FloatingMenu2 as FloatingMenu
};
//# sourceMappingURL=@tiptap_react_menus.js.map
