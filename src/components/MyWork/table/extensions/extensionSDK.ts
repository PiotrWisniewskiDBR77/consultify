/**
 * Consultify Table Platform Extension SDK
 * Include this in your extension's index.html to communicate with the host.
 *
 * Usage:
 *   import { sdk } from './extensionSDK';
 *   sdk.onReady(() => {
 *     const records = await sdk.getRecords();
 *     sdk.notify('Loaded!', 'success');
 *   });
 */

type RequestCallback = (data: unknown, error?: string) => void;

class ConsultifySDK {
  private callbacks = new Map<string, RequestCallback>();
  private _baseId = '';
  private _tableId = '';
  private _config: Record<string, unknown> = {};
  private _scopes: string[] = [];
  private _onReady: (() => void) | null = null;

  constructor() {
    window.addEventListener('message', (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'tp:init') {
        this._baseId = msg.baseId;
        this._tableId = msg.tableId;
        this._config = msg.config || {};
        this._scopes = msg.scopes || [];
        this._onReady?.();
      }
      if (msg?.type === 'tp:response') {
        const cb = this.callbacks.get(msg.requestId);
        if (cb) {
          cb(msg.data, msg.error);
          this.callbacks.delete(msg.requestId);
        }
      }
    });

    window.parent.postMessage({ type: 'tp:ready' }, '*');
  }

  onReady(callback: () => void): void {
    this._onReady = callback;
  }

  get baseId(): string {
    return this._baseId;
  }
  get tableId(): string {
    return this._tableId;
  }
  get config(): Record<string, unknown> {
    return this._config;
  }
  get scopes(): string[] {
    return this._scopes;
  }

  private request(type: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      this.callbacks.set(requestId, (data, error) => {
        if (error) reject(new Error(error));
        else resolve(data);
      });
      window.parent.postMessage({ type, requestId, ...payload }, '*');
    });
  }

  async getRecords(tableId?: string, options?: unknown): Promise<unknown> {
    return this.request('tp:getRecords', { tableId: tableId || this._tableId, options });
  }

  async createRecord(tableId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request('tp:createRecord', { tableId, data });
  }

  async updateRecord(recordId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request('tp:updateRecord', { recordId, data });
  }

  async deleteRecord(recordId: string): Promise<unknown> {
    return this.request('tp:deleteRecord', { recordId });
  }

  async getSchema(tableId?: string): Promise<unknown> {
    return this.request('tp:getSchema', { tableId: tableId || this._tableId });
  }

  async getConfig(): Promise<Record<string, unknown>> {
    return this.request('tp:getConfig') as Promise<Record<string, unknown>>;
  }

  async setConfig(config: Record<string, unknown>): Promise<void> {
    await this.request('tp:setConfig', { config });
  }

  notify(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    window.parent.postMessage(
      { type: 'tp:showNotification', message, notificationType: type },
      '*'
    );
  }
}

export const sdk = new ConsultifySDK();
