/**
 * V3-E11: Tool Assets Baseline
 *
 * Tracks and validates tool assets (thumbnails, micro-videos, preview graphics)
 * for all 31 consulting tools. Provides audit functions and quality gates for
 * R0 (thumbnails required) and R1 (thumbnails + micro-videos required).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssetType = 'thumbnail' | 'micro_video' | 'preview_graphic';

export interface AssetStatus {
  required: boolean;
  exists: boolean;
  path: string | null;
  format: string | null;
  sizeBytes: number | null;
  lastUpdated: string | null;
}

export interface ToolAssetSpec {
  toolSlug: string;
  thumbnail: AssetStatus;
  microVideo: AssetStatus;
  previewGraphic: AssetStatus;
  qualityGatePass: boolean;
}

export interface ToolAssetsAuditReport {
  totalTools: number;
  thumbnailsPresent: number;
  thumbnailsMissing: number;
  microVideosPresent: number;
  microVideosMissing: number;
  qualityGatePassRate: number;
  tools: ToolAssetSpec[];
  r0Gate: boolean;
  r1Gate: boolean;
}

// ---------------------------------------------------------------------------
// All 31 tool slugs (matching TOOL_WIZARD_CONFIGS + KnownToolsService seed)
// ---------------------------------------------------------------------------

const ALL_TOOL_SLUGS: string[] = [
  // Strategic (10)
  'dynamic-swot',
  'market-forces',
  'growth-paths',
  'value-chain',
  'portfolio-priority',
  'risk-uncertainty',
  'capability-mapper',
  'ambition-decomposer',
  'focus-tradeoff',
  'narrative-engine',
  // Operational (10)
  'vsm-builder',
  'sop-builder',
  'a3-problem-solving',
  'smed-planner',
  'dms-builder',
  'constraint-control',
  'decision-engine',
  'control-tower',
  'automation-pipeline',
  'inventory-autopilot',
  // Automation (1)
  'process-automation',
  // Digital (10)
  'robotics-feasibility',
  'logistics-automation',
  'rpa-scanner',
  'ai-discovery',
  'integration-diagnostic',
  'digital-value-pool',
  'legacy-analyzer',
  'data-inventory',
  'pain-to-solution',
  'pain-explorer',
];

// ---------------------------------------------------------------------------
// Asset path helpers
// ---------------------------------------------------------------------------

function thumbnailPath(slug: string): string {
  return `public/assets/tools/${slug}/thumbnail.png`;
}

function microVideoPath(slug: string): string {
  return `public/assets/tools/${slug}/micro-video.mp4`;
}

function previewGraphicPath(slug: string): string {
  return `public/assets/tools/${slug}/preview.png`;
}

// ---------------------------------------------------------------------------
// Build asset specs — files don't exist yet, so exists: false for all
// ---------------------------------------------------------------------------

function buildAssetStatus(path: string, required: boolean, format: string): AssetStatus {
  return {
    required,
    exists: false,
    path,
    format,
    sizeBytes: null,
    lastUpdated: null,
  };
}

function buildToolAssetSpec(slug: string): ToolAssetSpec {
  const thumbnail = buildAssetStatus(thumbnailPath(slug), true, 'image/png');
  const microVideo = buildAssetStatus(microVideoPath(slug), false, 'video/mp4');
  const previewGraphic = buildAssetStatus(previewGraphicPath(slug), true, 'image/png');

  const qualityGatePass = thumbnail.exists && previewGraphic.exists;

  return { toolSlug: slug, thumbnail, microVideo, previewGraphic, qualityGatePass };
}

const TOOL_ASSET_SPECS: ToolAssetSpec[] = ALL_TOOL_SLUGS.map(buildToolAssetSpec);

const SLUG_INDEX = new Map<string, ToolAssetSpec>(TOOL_ASSET_SPECS.map((s) => [s.toolSlug, s]));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getAllToolSlugs(): string[] {
  return [...ALL_TOOL_SLUGS];
}

export function getToolAssetSpec(slug: string): ToolAssetSpec | null {
  return SLUG_INDEX.get(slug) ?? null;
}

export function getAssetPath(slug: string, type: AssetType): string {
  switch (type) {
    case 'thumbnail':
      return thumbnailPath(slug);
    case 'micro_video':
      return microVideoPath(slug);
    case 'preview_graphic':
      return previewGraphicPath(slug);
  }
}

export function runToolAssetsAudit(): ToolAssetsAuditReport {
  const tools = TOOL_ASSET_SPECS;
  const totalTools = tools.length;

  const thumbnailsPresent = tools.filter((t) => t.thumbnail.exists).length;
  const thumbnailsMissing = totalTools - thumbnailsPresent;

  const microVideosPresent = tools.filter((t) => t.microVideo.exists).length;
  const microVideosMissing = totalTools - microVideosPresent;

  const passingTools = tools.filter((t) => t.qualityGatePass).length;
  const qualityGatePassRate = totalTools > 0 ? passingTools / totalTools : 0;

  // R0: all thumbnails + preview graphics present
  const r0Gate =
    tools.every((t) => t.thumbnail.exists) && tools.every((t) => t.previewGraphic.exists);

  // R1: R0 + all micro-videos present
  const r1Gate = r0Gate && tools.every((t) => t.microVideo.exists);

  return {
    totalTools,
    thumbnailsPresent,
    thumbnailsMissing,
    microVideosPresent,
    microVideosMissing,
    qualityGatePassRate,
    tools,
    r0Gate,
    r1Gate,
  };
}

// ---------------------------------------------------------------------------
// API-backed functions (fall back to in-memory when backend unavailable)
// ---------------------------------------------------------------------------

const API_URL = (import.meta.env as any)?.VITE_API_URL || '/api';

async function fetchFromApi<T>(url: string): Promise<T | null> {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchToolAssetsAuditFromDB(): Promise<ToolAssetsAuditReport> {
  const result = await fetchFromApi<any>(`${API_URL}/tool-assets/audit`);
  if (result?.totalTools) {
    const tools: ToolAssetSpec[] = (result.tools || []).map((t: any) => {
      const assets = t.assets || [];
      const findAsset = (type: string) => assets.find((a: any) => a.assetType === type);
      const mapAsset = (a: any): AssetStatus => ({
        required: a?.isRequired ?? true,
        exists: a?.exists ?? false,
        path: a?.filePath ?? null,
        format: a?.fileFormat ?? null,
        sizeBytes: a?.fileSizeBytes ?? null,
        lastUpdated: null,
      });
      return {
        toolSlug: t.toolSlug,
        thumbnail: mapAsset(findAsset('thumbnail')),
        microVideo: mapAsset(findAsset('micro_video')),
        previewGraphic: mapAsset(findAsset('preview_graphic')),
        qualityGatePass:
          (findAsset('thumbnail')?.exists ?? false) &&
          (findAsset('preview_graphic')?.exists ?? false),
      };
    });
    return {
      totalTools: result.totalTools,
      thumbnailsPresent: result.thumbnailsPresent,
      thumbnailsMissing: result.thumbnailsMissing,
      microVideosPresent: result.microVideosPresent,
      microVideosMissing: result.microVideosMissing,
      qualityGatePassRate:
        result.totalTools > 0
          ? tools.filter((t) => t.qualityGatePass).length / result.totalTools
          : 0,
      tools,
      r0Gate: result.r0Gate,
      r1Gate: result.r1Gate,
    };
  }
  return runToolAssetsAudit();
}

export async function fetchToolAssetsFromDB(toolSlug: string): Promise<ToolAssetSpec | null> {
  const result = await fetchFromApi<{ assets: any[] }>(`${API_URL}/tool-assets/${toolSlug}`);
  if (result?.assets?.length) {
    const assets = result.assets;
    const findAsset = (type: string) => assets.find((a: any) => a.assetType === type);
    const mapAsset = (a: any): AssetStatus => ({
      required: a?.isRequired ?? true,
      exists: a?.exists ?? false,
      path: a?.filePath ?? null,
      format: a?.fileFormat ?? null,
      sizeBytes: a?.fileSizeBytes ?? null,
      lastUpdated: null,
    });
    return {
      toolSlug,
      thumbnail: mapAsset(findAsset('thumbnail')),
      microVideo: mapAsset(findAsset('micro_video')),
      previewGraphic: mapAsset(findAsset('preview_graphic')),
      qualityGatePass:
        (findAsset('thumbnail')?.exists ?? false) &&
        (findAsset('preview_graphic')?.exists ?? false),
    };
  }
  return null;
}
