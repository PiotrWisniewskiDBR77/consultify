export const EXPORT_DESTINATIONS = ['download', 'email', 'drive', 'sharepoint'] as const;
export type ExportDestination = (typeof EXPORT_DESTINATIONS)[number];

export type EvidenceRef = {
  readonly sourceId: string;
  readonly uri: string;
  readonly retrievedAt: string;
};

export type ExportManifest = {
  readonly format: string;
  readonly destination: ExportDestination;
  readonly sha256: string;
  readonly sources: readonly EvidenceRef[];
};
