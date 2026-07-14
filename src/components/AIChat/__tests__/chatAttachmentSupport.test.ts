import { describe, expect, it } from 'vitest';

import {
  isSupportedChatAttachment,
  SUPPORTED_CHAT_ATTACHMENT_ACCEPT,
  SUPPORTED_CHAT_ATTACHMENT_EXTENSIONS,
  SUPPORTED_CHAT_ATTACHMENT_LABEL,
} from '../chatAttachmentSupport';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('SUPPORTED_CHAT_ATTACHMENT constants', () => {
  it('includes docx alongside the original text-extractable types', () => {
    expect(SUPPORTED_CHAT_ATTACHMENT_EXTENSIONS).toEqual([
      'pdf',
      'txt',
      'md',
      'json',
      'csv',
      'docx',
    ]);
  });

  it('builds the accept string from the extension list with a leading dot', () => {
    expect(SUPPORTED_CHAT_ATTACHMENT_ACCEPT).toBe('.pdf,.txt,.md,.json,.csv,.docx');
  });

  it('keeps the human-readable label in sync', () => {
    expect(SUPPORTED_CHAT_ATTACHMENT_LABEL).toContain('DOCX');
    expect(SUPPORTED_CHAT_ATTACHMENT_LABEL).toContain('PDF');
  });
});

describe('isSupportedChatAttachment — accepted types', () => {
  it('accepts a folder regardless of name/type', () => {
    expect(isSupportedChatAttachment({ isFolder: true })).toBe(true);
  });

  it('accepts PDF by mime type', () => {
    expect(isSupportedChatAttachment({ name: 'a.pdf', type: 'application/pdf' })).toBe(true);
  });

  it('accepts JSON by mime type', () => {
    expect(isSupportedChatAttachment({ name: 'a.json', type: 'application/json' })).toBe(true);
  });

  it('accepts CSV by mime type', () => {
    expect(isSupportedChatAttachment({ name: 'a.csv', type: 'text/csv' })).toBe(true);
  });

  it('accepts any text/* mime type', () => {
    expect(isSupportedChatAttachment({ name: 'notes', type: 'text/plain' })).toBe(true);
    expect(isSupportedChatAttachment({ name: 'doc', type: 'text/markdown' })).toBe(true);
  });

  it('accepts DOCX by its office mime type', () => {
    expect(isSupportedChatAttachment({ name: 'report.docx', type: DOCX_MIME })).toBe(true);
  });

  it('accepts DOCX by extension even when the browser supplies no mime type', () => {
    expect(isSupportedChatAttachment({ name: 'report.docx', type: '' })).toBe(true);
  });

  it('accepts known extensions when mime type is empty', () => {
    expect(isSupportedChatAttachment({ name: 'file.md', type: '' })).toBe(true);
    expect(isSupportedChatAttachment({ name: 'file.csv', type: '' })).toBe(true);
    expect(isSupportedChatAttachment({ name: 'file.txt', mimeType: '' })).toBe(true);
  });

  it('matches extensions case-insensitively', () => {
    expect(isSupportedChatAttachment({ name: 'REPORT.DOCX', type: '' })).toBe(true);
    expect(isSupportedChatAttachment({ name: 'DATA.PDF', type: '' })).toBe(true);
  });
});

describe('isSupportedChatAttachment — rejected types', () => {
  // The server ingest pipeline (/ai/attachments/ingest) only text-extracts
  // pdf, docx, and text/* — xlsx and images are intentionally NOT supported.
  it('rejects XLSX (binary spreadsheet, no extractor)', () => {
    expect(isSupportedChatAttachment({ name: 'sheet.xlsx', type: XLSX_MIME })).toBe(false);
  });

  it('rejects images', () => {
    expect(isSupportedChatAttachment({ name: 'pic.png', type: 'image/png' })).toBe(false);
    expect(isSupportedChatAttachment({ name: 'pic.jpg', type: 'image/jpeg' })).toBe(false);
  });

  it('rejects arbitrary binary / unknown extensions', () => {
    expect(isSupportedChatAttachment({ name: 'app.exe', type: 'application/octet-stream' })).toBe(
      false
    );
    expect(isSupportedChatAttachment({ name: 'archive.zip', type: 'application/zip' })).toBe(false);
  });

  it('rejects a file with no name and no recognized mime type', () => {
    expect(isSupportedChatAttachment({})).toBe(false);
    expect(isSupportedChatAttachment({ name: 'noextension', type: '' })).toBe(false);
  });
});
