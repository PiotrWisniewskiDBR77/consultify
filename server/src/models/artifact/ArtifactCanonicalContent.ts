export type NodeId = string & { readonly __brand: 'NodeId' };

export function unsafeNodeId(value: string): NodeId {
  return String(value) as NodeId;
}

export type ArtifactCanonicalContent = {
  readonly __opaqueType: string;
  readonly blob: unknown;
};
