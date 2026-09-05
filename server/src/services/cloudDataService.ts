/**
 * Cloud Data Service
 *
 * Manages connections to external cloud storage providers (Google Drive, OneDrive, etc.)
 * and imports files for AI analysis.
 */

import logger from '../utils/Logger.js';
import { getValidAccessToken } from './integrationOAuthEngine.js';

export interface CloudSource {
  id: string;
  organizationId: string;
  userId: string;
  provider: 'google_drive' | 'onedrive' | 'dropbox' | 'sharepoint';
  name: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  rootFolderId?: string;
  settings: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error' | 'expired';
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloudImportJob {
  id: string;
  cloudSourceId: string;
  organizationId: string;
  userId: string;
  filePath: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedAt: Date;
  path: string;
  isFolder: boolean;
}

async function getDb() {
  const dbMod = await import('../utils/DbPromise.js');
  return dbMod;
}

export type CloudUploadResult = {
  provider: CloudSource['provider'];
  fileId: string;
  name: string;
  mimeType: string;
  url?: string;
};

export type CloudDownloadResult = {
  fileName: string;
  mimeType: string;
  content: Buffer;
};

async function resolveLiveAccessToken(source: CloudSource, providerLabel: string): Promise<string> {
  const accessToken = await getValidAccessToken(source.userId, source.provider);
  if (!accessToken) throw new Error(`${providerLabel} access token not configured`);
  return accessToken;
}

export async function listCloudSources(organizationId: string): Promise<CloudSource[]> {
  const db = await getDb();
  const rows = (await db.all(
    'SELECT * FROM cloud_sources WHERE organization_id = ? ORDER BY created_at DESC',
    [organizationId]
  )) as any[];
  return rows.map(mapCloudSource);
}

export async function getCloudSource(
  id: string,
  organizationId: string
): Promise<CloudSource | null> {
  const db = await getDb();
  const row = (await db.get('SELECT * FROM cloud_sources WHERE id = ? AND organization_id = ?', [
    id,
    organizationId,
  ])) as any;
  return row ? mapCloudSource(row) : null;
}

export async function createCloudSource(data: {
  organizationId: string;
  userId: string;
  provider: CloudSource['provider'];
  name: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  rootFolderId?: string;
  settings?: Record<string, unknown>;
}): Promise<CloudSource> {
  const db = await getDb();
  const id = crypto.randomUUID?.() || `cs-${Date.now()}`;
  await db.run(
    `INSERT INTO cloud_sources (id, organization_id, user_id, provider, name, access_token, refresh_token, token_expires_at, root_folder_id, settings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.organizationId,
      data.userId,
      data.provider,
      data.name,
      data.accessToken || null,
      data.refreshToken || null,
      data.tokenExpiresAt?.toISOString() || null,
      data.rootFolderId || null,
      JSON.stringify(data.settings || {}),
    ]
  );
  const source = await getCloudSource(id, data.organizationId);
  if (!source) throw new Error('Failed to create cloud source');
  return source;
}

export async function deleteCloudSource(id: string, organizationId: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM cloud_sources WHERE id = ? AND organization_id = ?', [
    id,
    organizationId,
  ]);
}

export async function listCloudFiles(
  sourceId: string,
  organizationId: string,
  folderId?: string
): Promise<CloudFile[]> {
  const source = await getCloudSource(sourceId, organizationId);
  if (!source) throw new Error('Cloud source not found');

  if (source.provider === 'google_drive') {
    return listGoogleDriveFiles(source, folderId);
  }

  if (source.provider === 'onedrive' || source.provider === 'sharepoint') {
    return listOneDriveFiles(source, folderId);
  }

  if (source.provider === 'dropbox') {
    return listDropboxFiles(source, folderId);
  }

  logger.warn(`[CloudData] Provider ${source.provider} not yet implemented`);
  return [];
}

async function listGoogleDriveFiles(source: CloudSource, folderId?: string): Promise<CloudFile[]> {
  const accessToken = await resolveLiveAccessToken(source, 'Google Drive');

  const parentId = folderId || source.rootFolderId || 'root';
  const query = `'${parentId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=100`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error(`[CloudData] Google Drive API error: ${errText}`);
    throw new Error(`Google Drive API error: ${response.status}`);
  }

  const data = (await response.json()) as any;
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: parseInt(f.size || '0', 10),
    modifiedAt: new Date(f.modifiedTime),
    path: f.name,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }));
}

export async function downloadCloudFile(
  sourceId: string,
  organizationId: string,
  fileId: string
): Promise<CloudDownloadResult> {
  const source = await getCloudSource(sourceId, organizationId);
  if (!source) throw new Error('Cloud source not found');

  if (source.provider === 'google_drive') {
    return downloadGoogleDriveFile(source, fileId);
  }

  if (source.provider === 'onedrive' || source.provider === 'sharepoint') {
    return downloadOneDriveFile(source, fileId);
  }

  if (source.provider === 'dropbox') {
    return downloadDropboxFile(source, fileId);
  }

  throw new Error(`Download not supported for provider ${source.provider}`);
}

async function downloadGoogleDriveFile(
  source: CloudSource,
  fileId: string
): Promise<CloudDownloadResult> {
  const accessToken = await resolveLiveAccessToken(source, 'Google Drive');

  const metadataRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!metadataRes.ok) {
    const errText = await metadataRes.text();
    logger.error(`[CloudData] Google Drive metadata error: ${errText}`);
    throw new Error(`Google Drive metadata error: ${metadataRes.status}`);
  }

  const metadata = (await metadataRes.json()) as { name?: string; mimeType?: string };
  const mimeType = metadata.mimeType || 'application/octet-stream';
  const fileName = metadata.name || `cloud-file-${fileId}`;
  const isGoogleWorkspaceDoc = mimeType.startsWith('application/vnd.google-apps');

  const exportMap: Record<string, { mimeType: string; extension: string }> = {
    'application/vnd.google-apps.document': {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: '.docx',
    },
    'application/vnd.google-apps.spreadsheet': {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: '.xlsx',
    },
    'application/vnd.google-apps.presentation': {
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      extension: '.pptx',
    },
    'application/vnd.google-apps.drawing': {
      mimeType: 'image/png',
      extension: '.png',
    },
  };

  let downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  let responseMimeType = mimeType;
  let responseFileName = fileName;

  if (isGoogleWorkspaceDoc) {
    const exportTarget = exportMap[mimeType];
    if (!exportTarget) {
      throw new Error(`Unsupported Google Workspace file type for export: ${mimeType}`);
    }
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportTarget.mimeType)}`;
    responseMimeType = exportTarget.mimeType;
    if (!responseFileName.toLowerCase().endsWith(exportTarget.extension)) {
      responseFileName = `${responseFileName}${exportTarget.extension}`;
    }
  }

  const contentRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!contentRes.ok) {
    const errText = await contentRes.text();
    logger.error(`[CloudData] Google Drive download error: ${errText}`);
    throw new Error(`Google Drive download error: ${contentRes.status}`);
  }

  const arrayBuffer = await contentRes.arrayBuffer();
  return {
    fileName: responseFileName,
    mimeType: responseMimeType,
    content: Buffer.from(arrayBuffer),
  };
}

export async function uploadCloudFile(input: {
  sourceId: string;
  organizationId: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
  folderId?: string;
}): Promise<CloudUploadResult> {
  const source = await getCloudSource(input.sourceId, input.organizationId);
  if (!source) throw new Error('Cloud source not found');

  try {
    const startedAt = Date.now();
    let result: CloudUploadResult;

    if (source.provider === 'google_drive') {
      result = await uploadGoogleDriveFile(
        source,
        input.fileName,
        input.mimeType,
        input.content,
        input.folderId
      );
    } else if (source.provider === 'onedrive' || source.provider === 'sharepoint') {
      result = await uploadOneDriveFile(
        source,
        input.fileName,
        input.mimeType,
        input.content,
        input.folderId
      );
    } else if (source.provider === 'dropbox') {
      result = await uploadDropboxFile(
        source,
        input.fileName,
        input.mimeType,
        input.content,
        input.folderId
      );
    } else {
      throw new Error(`Upload not supported for provider ${source.provider}`);
    }

    await tryLogCloudSync({
      cloudSourceId: input.sourceId,
      organizationId: input.organizationId,
      status: 'success',
      itemsProcessed: 1,
      itemsCreated: 1,
      itemsFailed: 0,
      errorMessage: null,
      durationMs: Math.max(0, Date.now() - startedAt),
      metadata: {
        provider: source.provider,
        fileName: input.fileName,
        fileId: result.fileId,
        url: result.url,
      },
    });

    // Best-effort: write an integration_sync_log entry if org-level integration exists.
    await tryLogIntegrationSync({
      organizationId: input.organizationId,
      providerName: source.provider === 'sharepoint' ? 'onedrive' : source.provider,
      status: 'success',
      itemsProcessed: 1,
      itemsCreated: 1,
      itemsFailed: 0,
      errorDetails: null,
      metadata: {
        cloudSourceId: input.sourceId,
        fileName: input.fileName,
        fileId: result.fileId,
        url: result.url,
      },
    });

    return result;
  } catch (e: any) {
    await tryLogCloudSync({
      cloudSourceId: input.sourceId,
      organizationId: input.organizationId,
      status: 'failed',
      itemsProcessed: 1,
      itemsCreated: 0,
      itemsFailed: 1,
      errorMessage: String(e?.message || 'upload_failed'),
      durationMs: null,
      metadata: { provider: source.provider, fileName: input.fileName },
    }).catch(() => null);

    await tryLogIntegrationSync({
      organizationId: input.organizationId,
      providerName: source.provider === 'sharepoint' ? 'onedrive' : source.provider,
      status: 'failed',
      itemsProcessed: 1,
      itemsCreated: 0,
      itemsFailed: 1,
      errorDetails: [String(e?.message || 'upload_failed')],
      metadata: { cloudSourceId: input.sourceId, fileName: input.fileName },
    }).catch(() => null);
    throw e;
  }
}

async function uploadGoogleDriveFile(
  source: CloudSource,
  fileName: string,
  mimeType: string,
  content: Buffer,
  folderId?: string
): Promise<CloudUploadResult> {
  const accessToken = await resolveLiveAccessToken(source, 'Google Drive');

  const boundary = `-------consultify-${Date.now()}`;
  const metadata: any = { name: fileName };
  if (folderId || source.rootFolderId) {
    metadata.parents = [folderId || source.rootFolderId];
  }

  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody = Buffer.concat([
    Buffer.from(
      delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n`
    ),
    content,
    Buffer.from(closeDelimiter),
  ]);

  const url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(multipartBody.length),
    },
    body: multipartBody,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    logger.error(`[CloudData] Google Drive upload error: ${errText}`);
    throw new Error(`Google Drive upload error: ${response.status}`);
  }

  const data = (await response.json()) as any;
  return {
    provider: source.provider,
    fileId: String(data?.id || ''),
    name: String(data?.name || fileName),
    mimeType,
    url: data?.webViewLink ? String(data.webViewLink) : undefined,
  };
}

async function uploadOneDriveFile(
  source: CloudSource,
  fileName: string,
  mimeType: string,
  content: Buffer,
  folderId?: string
): Promise<CloudUploadResult> {
  const accessToken = await resolveLiveAccessToken(source, 'OneDrive');

  const safeName = encodeURIComponent(fileName);
  const uploadUrl = folderId
    ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(folderId)}:/${safeName}:/content`
    : `https://graph.microsoft.com/v1.0/me/drive/root:/${safeName}:/content`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': mimeType,
    },
    body: content,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    logger.error(`[CloudData] OneDrive upload error: ${errText}`);
    throw new Error(`OneDrive upload error: ${response.status}`);
  }

  const data = (await response.json()) as any;
  return {
    provider: source.provider,
    fileId: String(data?.id || ''),
    name: String(data?.name || fileName),
    mimeType,
    url: data?.webUrl ? String(data.webUrl) : undefined,
  };
}

// ── OneDrive / SharePoint: List + Download ──────────────────────

async function listOneDriveFiles(source: CloudSource, folderId?: string): Promise<CloudFile[]> {
  const accessToken = await resolveLiveAccessToken(source, 'OneDrive');

  const itemPath = folderId
    ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(folderId)}/children`
    : 'https://graph.microsoft.com/v1.0/me/drive/root/children';

  const url = `${itemPath}?$select=id,name,size,lastModifiedDateTime,file,folder&$top=200`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) throw new Error('OneDrive token expired — reauth required');
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OneDrive API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    value?: Array<{
      id: string;
      name: string;
      size?: number;
      lastModifiedDateTime?: string;
      file?: { mimeType?: string };
      folder?: { childCount?: number };
    }>;
  };

  return (data.value || []).map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.file?.mimeType || (item.folder ? 'folder' : 'application/octet-stream'),
    size: item.size || 0,
    modifiedAt: new Date(item.lastModifiedDateTime || Date.now()),
    path: item.name,
    isFolder: !!item.folder,
  }));
}

async function downloadOneDriveFile(
  source: CloudSource,
  fileId: string
): Promise<CloudDownloadResult> {
  const accessToken = await resolveLiveAccessToken(source, 'OneDrive');

  const metaResp = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}?$select=name,file`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!metaResp.ok) throw new Error(`OneDrive metadata error: ${metaResp.status}`);
  const meta = (await metaResp.json()) as { name?: string; file?: { mimeType?: string } };

  const contentResp = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}/content`,
    { headers: { Authorization: `Bearer ${accessToken}` }, redirect: 'follow' }
  );
  if (!contentResp.ok) throw new Error(`OneDrive download error: ${contentResp.status}`);

  const arrayBuffer = await contentResp.arrayBuffer();
  return {
    fileName: meta.name || `onedrive-${fileId}`,
    mimeType: meta.file?.mimeType || 'application/octet-stream',
    content: Buffer.from(arrayBuffer),
  };
}

// ── Dropbox: List + Download + Upload ───────────────────────────

async function listDropboxFiles(source: CloudSource, folderId?: string): Promise<CloudFile[]> {
  const accessToken = await resolveLiveAccessToken(source, 'Dropbox');

  const path = folderId || source.rootFolderId || '';

  const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: path || '', recursive: false, limit: 200 }),
  });

  if (response.status === 401) throw new Error('Dropbox token expired — reauth required');
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Dropbox API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    entries?: Array<{
      '.tag': 'file' | 'folder';
      id: string;
      name: string;
      size?: number;
      server_modified?: string;
      path_display?: string;
    }>;
  };

  return (data.entries || []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    mimeType: entry['.tag'] === 'folder' ? 'folder' : guessMimeType(entry.name),
    size: entry.size || 0,
    modifiedAt: new Date(entry.server_modified || Date.now()),
    path: entry.path_display || entry.name,
    isFolder: entry['.tag'] === 'folder',
  }));
}

async function downloadDropboxFile(
  source: CloudSource,
  fileId: string
): Promise<CloudDownloadResult> {
  const accessToken = await resolveLiveAccessToken(source, 'Dropbox');

  const response = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
    },
  });

  if (!response.ok) throw new Error(`Dropbox download error: ${response.status}`);

  const apiResult = response.headers.get('dropbox-api-result');
  let fileName = `dropbox-${fileId}`;
  let mimeType = 'application/octet-stream';
  if (apiResult) {
    try {
      const parsed = JSON.parse(apiResult) as { name?: string };
      if (parsed.name) {
        fileName = parsed.name;
        mimeType = guessMimeType(parsed.name);
      }
    } catch {
      /* ignore */
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  return { fileName, mimeType, content: Buffer.from(arrayBuffer) };
}

async function uploadDropboxFile(
  source: CloudSource,
  fileName: string,
  _mimeType: string,
  content: Buffer,
  folderId?: string
): Promise<CloudUploadResult> {
  const accessToken = await resolveLiveAccessToken(source, 'Dropbox');

  const path = `${folderId || source.rootFolderId || ''}/${fileName}`;

  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'add',
        autorename: true,
        mute: false,
      }),
      'Content-Type': 'application/octet-stream',
    },
    body: content,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Dropbox upload error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as { id?: string; name?: string; path_display?: string };
  return {
    provider: source.provider,
    fileId: data.id || '',
    name: data.name || fileName,
    mimeType: guessMimeType(fileName),
    url: undefined,
  };
}

function guessMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    csv: 'text/csv',
    txt: 'text/plain',
    json: 'application/json',
    zip: 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

// ── Background Import Processing ────────────────────────────────

export async function processImportJob(jobId: string, organizationId: string): Promise<void> {
  const db = await getDb();
  const job = await getImportJob(jobId, organizationId);
  if (!job) throw new Error('Import job not found');

  await db.run(`UPDATE cloud_import_jobs SET status = 'downloading', progress = 10 WHERE id = ?`, [
    jobId,
  ]);

  try {
    const downloaded = await downloadCloudFile(job.cloudSourceId, organizationId, job.filePath);

    await db.run(`UPDATE cloud_import_jobs SET status = 'processing', progress = 50 WHERE id = ?`, [
      jobId,
    ]);

    const textContent = downloaded.content.toString('utf-8').slice(0, 500_000);

    await db.run(
      `UPDATE cloud_import_jobs SET status = 'completed', progress = 100, result = ?, completed_at = NOW() WHERE id = ?`,
      [
        JSON.stringify({
          fileName: downloaded.fileName,
          mimeType: downloaded.mimeType,
          textLength: textContent.length,
        }),
        jobId,
      ]
    );

    logger.info(`[CloudData] Import job ${jobId} completed: ${downloaded.fileName}`);
  } catch (err) {
    await db.run(
      `UPDATE cloud_import_jobs SET status = 'failed', error = ?, completed_at = NOW() WHERE id = ?`,
      [(err as Error).message, jobId]
    );
    logger.error(`[CloudData] Import job ${jobId} failed`, { error: (err as Error).message });
  }
}

async function tryLogIntegrationSync(input: {
  organizationId: string;
  providerName: string;
  status: 'success' | 'partial' | 'failed';
  itemsProcessed: number;
  itemsCreated: number;
  itemsFailed: number;
  errorDetails: string[] | null;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();

  // Table existence / columns (best-effort, supports both SQLite and Postgres via adapter).
  const logCols = (await db
    .all<{ name: string }>('PRAGMA table_info(integration_sync_log)', [])
    .catch(() => [])) as any[];
  if (!logCols?.length) return;
  const hasNewCols = logCols.some((c) => String((c as any).name) === 'items_processed');

  const intCols = (await db
    .all<{ name: string }>('PRAGMA table_info(integrations)', [])
    .catch(() => [])) as any[];
  const provCols = (await db
    .all<{ name: string }>('PRAGMA table_info(integration_providers)', [])
    .catch(() => [])) as any[];
  if (!intCols?.length || !provCols?.length) return;

  const hasProviderId = intCols.some((c) => String((c as any).name) === 'provider_id');
  if (!hasProviderId) return;

  const integration = (await db.get(
    `
    SELECT i.id
    FROM integrations i
    LEFT JOIN integration_providers p ON p.id = i.provider_id
    WHERE i.organization_id = ?
      AND p.name = ?
      AND (i.status IS NULL OR i.status IN ('active','connected'))
    ORDER BY COALESCE(i.connected_at, i.updated_at, i.last_sync_at) DESC
    LIMIT 1
  `,
    [
      input.organizationId,
      String(input.providerName || '')
        .trim()
        .toLowerCase(),
    ]
  )) as any;

  const integrationId = integration?.id ? String(integration.id) : '';
  if (!integrationId) return;

  const nowIso = new Date().toISOString();
  const id = `log-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const errorDetails =
    input.errorDetails && input.errorDetails.length
      ? JSON.stringify(input.errorDetails.slice(0, 50))
      : null;

  if (hasNewCols) {
    await db.run(
      `INSERT INTO integration_sync_log (
        id, integration_id, sync_type, direction, trigger_type,
        status, items_processed, items_created, items_updated, items_deleted, items_failed, items_skipped,
        error_summary, error_details, started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        integrationId,
        'single_item',
        'push',
        'manual',
        input.status,
        input.itemsProcessed,
        input.itemsCreated,
        0,
        0,
        input.itemsFailed,
        0,
        input.status === 'failed' ? 'cloud_upload_failed' : null,
        errorDetails,
        nowIso,
        nowIso,
        0,
      ]
    );
  } else {
    await db.run(
      `INSERT INTO integration_sync_log (
        id, integration_id, sync_type, direction,
        status, items_synced, items_failed, error_details,
        started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        integrationId,
        'single_item',
        'push',
        input.status,
        input.itemsProcessed,
        input.itemsFailed,
        errorDetails,
        nowIso,
        nowIso,
        0,
      ]
    );
  }

  // Non-blocking trace metadata (if table exists in this schema).
  const metaCols = (await db
    .all<{ name: string }>('PRAGMA table_info(integration_sync_mappings)', [])
    .catch(() => [])) as any[];
  if (!metaCols?.length) return;
  const hasMetadata = metaCols.some((c) => String((c as any).name) === 'metadata');
  if (!hasMetadata) return;
  // We intentionally do not create a mapping here because we don't know the local object context.
  // The caller route (e.g. Report Builder publish) can write a mapping with local_id/external_id.
}

async function tryLogCloudSync(input: {
  cloudSourceId: string;
  organizationId: string;
  status: 'success' | 'partial' | 'failed';
  itemsProcessed: number;
  itemsCreated: number;
  itemsFailed: number;
  errorMessage: string | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();
  const cols = (await db
    .all<{ name: string }>('PRAGMA table_info(cloud_sync_log)', [])
    .catch(() => [])) as any[];
  if (!cols?.length) return;

  const id = `csl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await db
    .run(
      `INSERT INTO cloud_sync_log (
      id, cloud_source_id, organization_id, direction, status,
      items_processed, items_created, items_failed, error_message,
      metadata_json, duration_ms, created_at
    ) VALUES (?, ?, ?, 'push', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        input.cloudSourceId,
        input.organizationId,
        input.status,
        input.itemsProcessed,
        input.itemsCreated,
        input.itemsFailed,
        input.errorMessage,
        JSON.stringify(input.metadata || {}),
        input.durationMs,
      ]
    )
    .catch(() => null);
}

export async function startImportJob(data: {
  cloudSourceId: string;
  organizationId: string;
  userId: string;
  filePath: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
}): Promise<CloudImportJob> {
  const db = await getDb();
  const id = crypto.randomUUID?.() || `cij-${Date.now()}`;
  await db.run(
    `INSERT INTO cloud_import_jobs (id, cloud_source_id, organization_id, user_id, file_path, file_name, file_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.cloudSourceId,
      data.organizationId,
      data.userId,
      data.filePath,
      data.fileName,
      data.fileType || null,
      data.fileSize || null,
    ]
  );

  // In a production system, this would queue a background job
  logger.info(`[CloudData] Import job created: ${id} for file ${data.fileName}`);

  const row = (await db.get('SELECT * FROM cloud_import_jobs WHERE id = ?', [id])) as any;
  return mapImportJob(row);
}

export async function getImportJob(
  id: string,
  organizationId: string
): Promise<CloudImportJob | null> {
  const db = await getDb();
  const row = (await db.get(
    'SELECT * FROM cloud_import_jobs WHERE id = ? AND organization_id = ?',
    [id, organizationId]
  )) as any;
  return row ? mapImportJob(row) : null;
}

function mapCloudSource(row: any): CloudSource {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    provider: row.provider,
    name: row.name,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : undefined,
    rootFolderId: row.root_folder_id,
    settings: JSON.parse(row.settings || '{}'),
    status: row.status,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapImportJob(row: any): CloudImportJob {
  return {
    id: row.id,
    cloudSourceId: row.cloud_source_id,
    organizationId: row.organization_id,
    userId: row.user_id,
    filePath: row.file_path,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    status: row.status,
    progress: row.progress || 0,
    result: row.result,
    error: row.error,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

export default {
  listCloudSources,
  getCloudSource,
  createCloudSource,
  deleteCloudSource,
  listCloudFiles,
  downloadCloudFile,
  uploadCloudFile,
  startImportJob,
  getImportJob,
  processImportJob,
};
