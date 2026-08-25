import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const contentSource = fs.readFileSync(path.resolve(__dirname, '../../NotebookContent.tsx'), 'utf8');
const menuSource = fs.readFileSync(path.resolve(__dirname, '../NotebookHamburgerMenu.tsx'), 'utf8');

describe('MYW-NBK-006 local toolbar simplification', () => {
  it('keeps right-side workspace actions behind the rail and kebab', () => {
    expect(contentSource).not.toContain('data-testid="notebook-expand-to-document"');
    expect(contentSource).not.toContain("'Ask AI about this note'");
    expect(contentSource).not.toContain("aria-label={t('notebook.notebookContent.ariaLabel3'");
    expect(contentSource).toContain('onGraph={() => setShowGraphView((v) => !v)}');
    expect(contentSource).toContain('data-testid="notebook-toolbar-right-actions"');
    expect(contentSource).not.toContain('<History size={14} />');
    expect(contentSource).toContain('onExport={() => setNotebookExportOpen(true)}');
    expect(contentSource).toContain('onVersionHistory={() => setShowVersionHistory');
    expect(menuSource).toContain("id: 'export'");
    expect(menuSource).toContain("id: 'version-history'");
  });

  it('routes Verification to the canonical Work rail instead of a removed legacy strip', () => {
    expect(contentSource).toContain('onVerification={() => {');
    expect(contentSource).toContain("setNotebookRailTab('work')");
    expect(contentSource).not.toContain(
      'onVerification={() =>\n                      verificationStripRef.current?.scrollIntoView'
    );
  });

  it('retains the unique graph action in the canonical note menu', () => {
    expect(menuSource).toContain("id: 'connection-graph'");
    expect(menuSource).toContain("'Connection graph'");
    expect(menuSource).toContain('onClick: onGraph');
  });

  it('retains existing expand and Ask AI handlers in the same menu', () => {
    expect(menuSource).toContain("id: 'expand-document'");
    expect(menuSource).toContain("id: 'ask-ai'");
  });

  it('qualifies Delete only through an idempotent server receipt and scoped readback', () => {
    // DEC-25: 'expand-document' joined 'delete' on the same real server
    // capability check (was previously ungated dead click — see
    // notebookExpandToDocument.ts / server/src/routes/v8/my-work.routes.ts
    // action-capabilities). receiptCapableActionIds now folds both flags into
    // one array instead of the single-action ternary this test used to assert.
    expect(contentSource).toContain("...(isDeleteReceiptCapable ? ['delete'] : [])");
    expect(contentSource).toContain(
      "...(isExpandDocumentReceiptCapable ? ['expand-document'] : [])"
    );
    expect(contentSource).toContain('Api.getNotebookActionCapabilities(pageId)');
    expect(contentSource).toContain('result.actorUserId !== currentUserId');
    expect(contentSource).toContain('result.organizationId !== currentOrganizationId');
    expect(contentSource).toContain('actionCapabilities.organizationId === currentOrganizationId');
    expect(contentSource).toContain("receiptContract === 'notebook_delete_receipt_v1'");
    expect(contentSource).toContain('deleteRequestRef.current?.pageId === activePage.id');
    expect(contentSource).toContain('globalThis.crypto.randomUUID()');
    expect(contentSource).toContain('activePage.updatedAt');
    expect(contentSource).toContain('Api.getNotebookActionReceipt(receipt.receiptId)');
    expect(contentSource).toContain("readBack.action !== 'NOTEBOOK_PAGE_DELETED'");
    expect(contentSource).toContain("throw new Error('Notebook delete receipt readback mismatch')");
  });
});
