/**
 * Dropbox Service - OAuth Integration
 * Provides access to Dropbox files for AI context
 *
 * @version 1.0.0
 */

import { aiLogger } from '../ai/logger.js';

export interface DropboxConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface DropboxToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountId?: string;
}

export interface DropboxFile {
  id: string;
  name: string;
  pathDisplay: string;
  pathLower: string;
  size?: number;
  isDownloadable?: boolean;
  clientModified?: string;
  serverModified?: string;
  rev?: string;
  contentHash?: string;
  tag: 'file' | 'folder' | 'deleted';
  sharingInfo?: {
    readOnly: boolean;
    sharedFolderId?: string;
  };
}

export interface DropboxSearchResult {
  matches: Array<{
    metadata: DropboxFile;
    matchType: string;
  }>;
  hasMore: boolean;
  cursor?: string;
}

export interface DropboxListResult {
  entries: DropboxFile[];
  cursor: string;
  hasMore: boolean;
}

const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_URL = 'https://content.dropboxapi.com/2';

class DropboxService {
  private config: DropboxConfig | null = null;

  /**
   * Initialize the service with OAuth credentials
   */
  initialize(config: DropboxConfig): void {
    this.config = config;
    aiLogger.info('DropboxService', 'Initialized');
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!(this.config?.clientId && this.config?.clientSecret);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    if (!this.config) {
      throw new Error('DropboxService not initialized');
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      token_access_type: 'offline',
      state,
    });

    return `${DROPBOX_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<DropboxToken> {
    if (!this.config) {
      throw new Error('DropboxService not initialized');
    }

    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      accountId: data.account_id,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<DropboxToken> {
    if (!this.config) {
      throw new Error('DropboxService not initialized');
    }

    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Dropbox doesn't return a new refresh token
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
  }

  /**
   * Ensure token is valid, refresh if needed
   */
  async ensureValidToken(token: DropboxToken): Promise<DropboxToken> {
    if (Date.now() < token.expiresAt - 60000) {
      return token;
    }

    return this.refreshAccessToken(token.refreshToken);
  }

  /**
   * List files in a folder
   */
  async listFolder(
    accessToken: string,
    path: string = '',
    cursor?: string
  ): Promise<DropboxListResult> {
    const endpoint = cursor
      ? `${DROPBOX_API_URL}/files/list_folder/continue`
      : `${DROPBOX_API_URL}/files/list_folder`;

    const body = cursor
      ? { cursor }
      : {
          path: path || '',
          recursive: false,
          include_media_info: false,
          include_deleted: false,
          include_has_explicit_shared_members: true,
        };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list folder: ${error}`);
    }

    const data = await response.json();

    return {
      entries: (data.entries || []).map(this.mapEntry),
      cursor: data.cursor,
      hasMore: data.has_more,
    };
  }

  /**
   * Search for files
   */
  async searchFiles(
    accessToken: string,
    query: string,
    cursor?: string
  ): Promise<DropboxSearchResult> {
    const body: any = {
      query,
      options: {
        path: '',
        max_results: 25,
        file_status: 'active',
        filename_only: false,
      },
    };

    if (cursor) {
      body.options.cursor = cursor;
    }

    const response = await fetch(`${DROPBOX_API_URL}/files/search_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search failed: ${error}`);
    }

    const data = await response.json();

    return {
      matches: (data.matches || []).map((match: any) => ({
        metadata: this.mapEntry(match.metadata?.metadata),
        matchType: match.match_type?.['.tag'] || 'content',
      })),
      hasMore: data.has_more,
      cursor: data.cursor,
    };
  }

  /**
   * Get file metadata
   */
  async getMetadata(accessToken: string, path: string): Promise<DropboxFile> {
    const response = await fetch(`${DROPBOX_API_URL}/files/get_metadata`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get metadata: ${error}`);
    }

    const data = await response.json();
    return this.mapEntry(data);
  }

  /**
   * Download file content
   */
  async downloadFile(accessToken: string, path: string): Promise<{ content: string; name: string }> {
    const response = await fetch(`${DROPBOX_CONTENT_URL}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path }),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download file: ${error}`);
    }

    // Get metadata from response header
    const apiResult = response.headers.get('Dropbox-API-Result');
    const metadata = apiResult ? JSON.parse(apiResult) : {};

    const content = await response.text();

    return {
      content,
      name: metadata.name || path.split('/').pop() || 'unknown',
    };
  }

  /**
   * Get temporary link for file
   */
  async getTemporaryLink(accessToken: string, path: string): Promise<{ link: string; metadata: DropboxFile }> {
    const response = await fetch(`${DROPBOX_API_URL}/files/get_temporary_link`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get temporary link: ${error}`);
    }

    const data = await response.json();

    return {
      link: data.link,
      metadata: this.mapEntry(data.metadata),
    };
  }

  /**
   * Get storage quota
   */
  async getSpaceUsage(accessToken: string): Promise<{ used: number; allocated: number }> {
    const response = await fetch(`${DROPBOX_API_URL}/users/get_space_usage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get space usage: ${error}`);
    }

    const data = await response.json();

    return {
      used: data.used || 0,
      allocated: data.allocation?.allocated || 0,
    };
  }

  /**
   * Get current account info
   */
  async getCurrentAccount(accessToken: string): Promise<{
    accountId: string;
    displayName: string;
    email: string;
    profilePhotoUrl?: string;
  }> {
    const response = await fetch(`${DROPBOX_API_URL}/users/get_current_account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get account: ${error}`);
    }

    const data = await response.json();

    return {
      accountId: data.account_id,
      displayName: data.name?.display_name || '',
      email: data.email || '',
      profilePhotoUrl: data.profile_photo_url,
    };
  }

  /**
   * Revoke access token
   */
  async revokeToken(accessToken: string): Promise<void> {
    await fetch(`${DROPBOX_API_URL}/auth/token/revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  /**
   * Map Dropbox API entry to our interface
   */
  private mapEntry(entry: any): DropboxFile {
    return {
      id: entry.id,
      name: entry.name,
      pathDisplay: entry.path_display,
      pathLower: entry.path_lower,
      size: entry.size,
      isDownloadable: entry.is_downloadable,
      clientModified: entry.client_modified,
      serverModified: entry.server_modified,
      rev: entry.rev,
      contentHash: entry.content_hash,
      tag: entry['.tag'],
      sharingInfo: entry.sharing_info
        ? {
            readOnly: entry.sharing_info.read_only,
            sharedFolderId: entry.sharing_info.shared_folder_id,
          }
        : undefined,
    };
  }
}

export const dropboxService = new DropboxService();
export default dropboxService;
