import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { QueryAdapter } from '../utils/QueryAdapter.js';

type AssetRow = {
  id: string;
  tool_slug: string;
  asset_type: string;
  file_path: string | null;
  file_format: string | null;
  file_size_bytes: number | null;
  is_required: boolean;
  status: string;
  uploaded_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ToolAssetItem = {
  id: string;
  toolSlug: string;
  assetType: string;
  filePath: string | null;
  fileFormat: string | null;
  fileSizeBytes: number | null;
  isRequired: boolean;
  status: string;
  exists: boolean;
};

class ToolAssetsService {
  private async getDb(): Promise<IDatabase> {
    return getDatabase();
  }

  async getAssetsByTool(toolSlug: string): Promise<ToolAssetItem[]> {
    const db = await this.getDb();
    const qa = new QueryAdapter(db);
    const rows = await qa.all<AssetRow>(
      'SELECT * FROM tool_assets WHERE tool_slug = $1 ORDER BY asset_type',
      [toolSlug]
    );
    return rows.map(this.mapRow);
  }

  async getAuditReport(): Promise<{
    totalTools: number;
    thumbnailsPresent: number;
    thumbnailsMissing: number;
    microVideosPresent: number;
    microVideosMissing: number;
    previewGraphicsPresent: number;
    previewGraphicsMissing: number;
    r0Gate: boolean;
    r1Gate: boolean;
    tools: { toolSlug: string; assets: ToolAssetItem[] }[];
  }> {
    const db = await this.getDb();
    const qa = new QueryAdapter(db);
    const rows = await qa.all<AssetRow>(
      'SELECT * FROM tool_assets ORDER BY tool_slug, asset_type'
    );

    const byTool = new Map<string, ToolAssetItem[]>();
    for (const row of rows) {
      const item = this.mapRow(row);
      if (!byTool.has(item.toolSlug)) byTool.set(item.toolSlug, []);
      byTool.get(item.toolSlug)!.push(item);
    }

    let thumbnailsPresent = 0,
      thumbnailsMissing = 0;
    let microVideosPresent = 0,
      microVideosMissing = 0;
    let previewGraphicsPresent = 0,
      previewGraphicsMissing = 0;

    for (const [, assets] of byTool) {
      for (const a of assets) {
        if (a.assetType === 'thumbnail') {
          a.exists ? thumbnailsPresent++ : thumbnailsMissing++;
        }
        if (a.assetType === 'micro_video') {
          a.exists ? microVideosPresent++ : microVideosMissing++;
        }
        if (a.assetType === 'preview_graphic') {
          a.exists ? previewGraphicsPresent++ : previewGraphicsMissing++;
        }
      }
    }

    const r0Gate = thumbnailsMissing === 0 && previewGraphicsMissing === 0;
    const r1Gate = r0Gate && microVideosMissing === 0;

    return {
      totalTools: byTool.size,
      thumbnailsPresent,
      thumbnailsMissing,
      microVideosPresent,
      microVideosMissing,
      previewGraphicsPresent,
      previewGraphicsMissing,
      r0Gate,
      r1Gate,
      tools: Array.from(byTool.entries()).map(([toolSlug, assets]) => ({ toolSlug, assets })),
    };
  }

  async updateAssetStatus(
    toolSlug: string,
    assetType: string,
    update: {
      filePath?: string;
      fileFormat?: string;
      fileSizeBytes?: number;
      status?: string;
    }
  ): Promise<ToolAssetItem | null> {
    const db = await this.getDb();
    const qa = new QueryAdapter(db);
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 0;

    if (update.filePath !== undefined) {
      idx++;
      sets.push(`file_path = $${idx}`);
      params.push(update.filePath);
    }
    if (update.fileFormat !== undefined) {
      idx++;
      sets.push(`file_format = $${idx}`);
      params.push(update.fileFormat);
    }
    if (update.fileSizeBytes !== undefined) {
      idx++;
      sets.push(`file_size_bytes = $${idx}`);
      params.push(update.fileSizeBytes);
    }
    if (update.status !== undefined) {
      idx++;
      sets.push(`status = $${idx}`);
      params.push(update.status);
    }

    idx++;
    params.push(toolSlug);
    idx++;
    params.push(assetType);

    await qa.run(
      `UPDATE tool_assets SET ${sets.join(', ')} WHERE tool_slug = $${idx - 1} AND asset_type = $${idx}`,
      params
    );

    const row = await qa.get<AssetRow>(
      'SELECT * FROM tool_assets WHERE tool_slug = $1 AND asset_type = $2',
      [toolSlug, assetType]
    );
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: AssetRow): ToolAssetItem {
    return {
      id: row.id,
      toolSlug: row.tool_slug,
      assetType: row.asset_type,
      filePath: row.file_path,
      fileFormat: row.file_format,
      fileSizeBytes: row.file_size_bytes,
      isRequired: row.is_required,
      status: row.status,
      exists: row.status !== 'missing' && row.file_path !== null,
    };
  }
}

export default new ToolAssetsService();
