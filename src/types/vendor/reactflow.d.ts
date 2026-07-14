// Vendor typing shim for `reactflow`.
//
// Rationale:
// - Some installs of `reactflow` / `@reactflow/*` can surface TS resolution errors
//   ("index.d.ts is not a module") under `moduleResolution: bundler`.
// - For this codebase we prefer keeping `tsc --noEmit` green for CI/husky pre-push.
// - This shim is type-only and does not affect runtime behavior.
//
// If/when upstream typing issues are resolved, this file can be removed.

declare module 'reactflow' {
  const ReactFlow: any;
  export default ReactFlow;
  export const ReactFlow: any;

  // Components
  export const ReactFlowProvider: any;
  export const Background: any;
  export const Controls: any;
  export const MiniMap: any;
  export const Panel: any;
  export const Handle: any;
  export const NodeResizer: any;

  // Hooks
  export const useReactFlow: any;
  export const useNodesState: any;
  export const useEdgesState: any;
  export const useUpdateNodeInternals: any;
  export const useNodesInitialized: any;
  /** Store selector hook — selektor dostaje wewnętrzny stan ReactFlow (any w shimie). */
  export const useStore: (selector: (state: any) => any) => any;

  // Utils
  export const addEdge: any;
  export const applyNodeChanges: any;
  export const applyEdgeChanges: any;

  // Enums / constants
  export const Position: any;
  export const BackgroundVariant: any;
  export const MarkerType: any;
  export const ConnectionLineType: any;
  export const ConnectionMode: any;

  // Types
  export type Node<T = any> = any;
  export type Edge<T = any> = any;
  export type NodeProps<T = any> = any;
  export type EdgeProps<T = any> = any;
  export type NodeChange = any;
  export type EdgeChange = any;
  export type OnNodesChange = any;
  export type OnEdgesChange = any;
  export type XYPosition = any;
  export type Connection = any;
}
