const STORAGE_KEY = 'tp_offline_queue';
const MAX_RETRIES = 3;

export interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  tableId: string;
  recordId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

type QueueListener = (queue: QueuedOperation[]) => void;

export class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private listeners: QueueListener[] = [];

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { this.queue = JSON.parse(stored) as QueuedOperation[]; } catch { /* corrupted data, start fresh */ }
    }

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.sync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  enqueue(op: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): void {
    const operation: QueuedOperation = {
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    // LWW merge: if updating the same record, merge data fields
    if (op.type === 'update' && op.recordId) {
      const existingIdx = this.queue.findIndex(
        q => q.type === 'update' && q.recordId === op.recordId
      );
      if (existingIdx >= 0) {
        this.queue[existingIdx]!.data = { ...this.queue[existingIdx]!.data, ...op.data };
        this.queue[existingIdx]!.timestamp = Date.now();
        this.persist();
        this.notify();
        return;
      }
    }

    // Delete cancels a pending create for the same record
    if (op.type === 'delete' && op.recordId) {
      const createIdx = this.queue.findIndex(
        q => q.type === 'create' && q.recordId === op.recordId
      );
      if (createIdx >= 0) {
        this.queue.splice(createIdx, 1);
        this.persist();
        this.notify();
        return;
      }
    }

    this.queue.push(operation);
    this.persist();
    this.notify();

    if (this.isOnline) {
      this.sync();
    }
  }

  async sync(): Promise<{ synced: number; failed: number }> {
    if (this.syncInProgress || !this.isOnline || this.queue.length === 0) {
      return { synced: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let synced = 0;
    let failed = 0;

    try {
      const toProcess = [...this.queue];

      for (const op of toProcess) {
        try {
          await this.executeOperation(op);
          this.queue = this.queue.filter(q => q.id !== op.id);
          synced++;
        } catch {
          op.retryCount++;
          if (op.retryCount >= MAX_RETRIES) {
            this.queue = this.queue.filter(q => q.id !== op.id);
            failed++;
          }
        }
      }

      this.persist();
      this.notify();
    } finally {
      this.syncInProgress = false;
    }

    return { synced, failed };
  }

  private async executeOperation(op: QueuedOperation): Promise<void> {
    const baseUrl = '/api/table-platform';

    switch (op.type) {
      case 'create': {
        const resp = await fetch(`${baseUrl}/tables/${op.tableId}/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: op.data }),
        });
        if (!resp.ok) throw new Error(`Create failed: ${resp.status}`);
        break;
      }
      case 'update': {
        const resp = await fetch(`${baseUrl}/records/${op.recordId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: op.data }),
        });
        if (!resp.ok) throw new Error(`Update failed: ${resp.status}`);
        break;
      }
      case 'delete': {
        const resp = await fetch(`${baseUrl}/records/${op.recordId}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
        break;
      }
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  getQueue(): QueuedOperation[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue = [];
    this.persist();
    this.notify();
  }

  subscribe(listener: QueueListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
  }

  private notify(): void {
    const snapshot = [...this.queue];
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export const offlineQueue = new OfflineQueue();
