import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { shouldAutoRefreshVaultIndex } from '../vaultIndexRefreshPolicy';

const source = fs.readFileSync(path.resolve(__dirname, '../VaultDocumentsView.tsx'), 'utf8');

describe('MYW-CV-REC-008 opened-safe toolbar', () => {
  it('polls only while indexing is in progress', () => {
    expect(shouldAutoRefreshVaultIndex(['indexed', 'failed'])).toBe(false);
    expect(shouldAutoRefreshVaultIndex(['ready', 'processing'])).toBe(true);
    expect(shouldAutoRefreshVaultIndex(['pending'])).toBe(true);
    expect(shouldAutoRefreshVaultIndex(['future-terminal-status'])).toBe(false);
  });

  it('removes manual refresh and folder creation from the opened-safe toolbar', () => {
    expect(source).not.toContain("id: 'refresh'");
    expect(source).not.toContain("id: 'new-folder'");
    expect(source).not.toContain('<FolderCreateDialog');
    expect(source).toContain('window.setInterval(() => void refreshInBackground(), 5000)');
  });

  it('retains useful status filters and automatic count derivation', () => {
    expect(source).toContain("id: 'indexed' as StatusChipId");
    expect(source).toContain("id: 'processing' as StatusChipId");
    expect(source).toContain("id: 'failed' as StatusChipId");
    expect(source).toContain('const statusCounts = useMemo');
  });

  it('preserves last-known-good rows and fences background refreshes', () => {
    expect(source).toContain('pollInFlightRef.current');
    expect(source).toContain('sequence !== loadSequenceRef.current');
    expect(source).toContain('setBackgroundRefreshError(message)');
    expect(source).toContain('Showing the last successful data.');
    expect(source).toContain('No folders are available at this level');
    expect(source).toContain('disabled={backgroundRefreshing}');
    expect(source).toContain('onClick={() => void refreshInBackground()}');
  });
});
