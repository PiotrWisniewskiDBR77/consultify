/**
 * Cloud Data Service
 *
 * Manages connections to external cloud storage providers (Google Drive, OneDrive, etc.)
 * and imports files for AI analysis.
 */

import logger from '../utils/Logger.js';

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

  logger.warn(`[CloudData] Provider ${source.provider} not yet implemented`);
  return [];
}

async function listGoogleDriveFiles(source: CloudSource, folderId?: string): Promise<CloudFile[]> {
  if (!source.accessToken) {
    throw new Error('Google Drive access token not configured');
  }

  const parentId = folderId || source.rootFolderId || 'root';
  const query = `'${parentId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=100`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${source.accessToken}` },
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

  if (source.provider === 'google_drive') {
    return uploadGoogleDriveFile(source, input.fileName, input.mimeType, input.content, input.folderId);
  }

  if (source.provider === 'onedrive' || source.provider === 'sharepoint') {
    return uploadOneDriveFile(source, input.fileName, input.mimeType, input.content, input.folderId);
  }

  throw new Error(`Upload not supported for provider ${source.provider}`);
}

async function uploadGoogleDriveFile(
  source: CloudSource,
  fileName: string,
  mimeType: string,
  content: Buffer,
  folderId?: string
): Promise<CloudUploadResult> {
  if (!source.accessToken) throw new Error('Google Drive access token not configured');

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
      Authorization: `Bearer ${source.accessToken}`,
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
  if (!source.accessToken) throw new Error('OneDrive access token not configured');

  const safeName = encodeURIComponent(fileName);
  const uploadUrl = folderId
    ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(folderId)}:/${safeName}:/content`
    : `https://graph.microsoft.com/v1.0/me/drive/root:/${safeName}:/content`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${source.accessToken}`,
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
  uploadCloudFile,
  startImportJob,
  getImportJob,
};
