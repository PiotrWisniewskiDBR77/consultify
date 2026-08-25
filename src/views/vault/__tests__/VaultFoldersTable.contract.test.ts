import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../VaultFoldersTable.tsx'), 'utf8');

describe('Vault folder list contract', () => {
  it('loads user, organization and each accessible project scope', () => {
    expect(source).toContain("Api.getVaultFolders({ scope: 'user' })");
    expect(source).toContain("Api.getVaultFolders({ scope: 'organization' })");
    expect(source).toContain("Api.getVaultFolders({ scope: 'project', projectId: project.id })");
  });

  it('uses the canonical table and folder dialog with project options', () => {
    expect(source).toContain('<StandardTable');
    expect(source).toContain('<FolderCreateDialog');
    expect(source).toContain('projects={projects}');
    expect(source).not.toContain('window.prompt');
  });

  it('provides real create, rename and delete operations', () => {
    expect(source).toContain('Api.createVaultFolder(input)');
    expect(source).toContain('Api.updateVaultFolder(editing.id');
    expect(source).toContain('Api.deleteVaultFolder(deleting.id)');
    expect(source).toContain('<ConfirmDialog');
  });

  it('shows retryable error and an explanatory empty state', () => {
    expect(source).toContain('error={error}');
    expect(source).toContain('onRetry={load}');
    expect(source).toContain("'Brak folderów'");
  });
});
