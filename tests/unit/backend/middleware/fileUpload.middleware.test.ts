import * as fs from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ASSESSMENTS_UPLOAD_ROOT,
  buildSafeUploadedFilename,
  FILE_UPLOAD_DISALLOWED_TYPE_CODE,
  FILE_UPLOAD_DISALLOWED_TYPE_MESSAGE,
  FILE_UPLOAD_FILTER_RUNTIME_CODE,
  FILE_UPLOAD_FILTER_RUNTIME_MESSAGE,
  FILE_UPLOAD_INVALID_FILENAME_CODE,
  FILE_UPLOAD_INVALID_FILENAME_MESSAGE,
  FILE_UPLOAD_WORKSPACE_UNAVAILABLE_CODE,
  FILE_UPLOAD_WORKSPACE_UNAVAILABLE_MESSAGE,
  MAX_CLIENT_ORIGINALNAME_LENGTH,
  fileFilter,
  isPathInsideDir,
  resolveAssessmentUploadDir,
  resolveUploadDestinationForMulter,
  sanitizeOrgIdForUploadPath,
  uploadLimits,
} from '../../../../server/src/middleware/fileUpload.middleware.ts';

describe('fileUpload.middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const expectDisallowedTypeError = (err: unknown) => {
    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { code?: string }).code).toBe(FILE_UPLOAD_DISALLOWED_TYPE_CODE);
    expect((err as Error).message).toBe(FILE_UPLOAD_DISALLOWED_TYPE_MESSAGE);
  };
  const expectInvalidFilenameError = (err: unknown) => {
    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { code?: string }).code).toBe(FILE_UPLOAD_INVALID_FILENAME_CODE);
    expect((err as Error).message).toBe(FILE_UPLOAD_INVALID_FILENAME_MESSAGE);
  };

  it('rejects file safely when originalname accessor throws', () => {
    const req: any = {};
    const file: any = { mimetype: 'application/pdf' };
    Object.defineProperty(file, 'originalname', {
      configurable: true,
      get: () => {
        throw new Error('originalname getter failed');
      },
    });
    const cb = vi.fn();

    expect(() => fileFilter(req, file, cb)).not.toThrow();
    expect(cb).toHaveBeenCalledTimes(1);
    expectDisallowedTypeError(cb.mock.calls[0][0]);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it('rejects file safely when mimetype accessor throws', () => {
    const req: any = {};
    const file: any = { originalname: 'report.pdf' };
    Object.defineProperty(file, 'mimetype', {
      configurable: true,
      get: () => {
        throw new Error('mimetype getter failed');
      },
    });
    const cb = vi.fn();

    expect(() => fileFilter(req, file, cb)).not.toThrow();
    expect(cb).toHaveBeenCalledTimes(1);
    expectDisallowedTypeError(cb.mock.calls[0][0]);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it('buildSafeUploadedFilename handles invalid or throwing originalname values', () => {
    const filenameFromUndefined = buildSafeUploadedFilename(undefined);
    expect(filenameFromUndefined).toContain('-unknown.file.bin');

    const throwingName = {
      get value() {
        throw new Error('originalname getter failed');
      },
    } as unknown;
    const filenameFromObject = buildSafeUploadedFilename(throwingName);
    expect(filenameFromObject).toContain('-unknown.file.bin');

    const filenameUpperExt = buildSafeUploadedFilename('Report.PDF');
    expect(filenameUpperExt).toMatch(/\.pdf$/);

    const filenameInvalidUnicode = buildSafeUploadedFilename('report\u200B\n.pdf');
    expect(filenameInvalidUnicode).not.toContain('\u200B');
    expect(filenameInvalidUnicode).not.toContain('\n');

    const filenameUnknownExt = buildSafeUploadedFilename('report.TXT');
    expect(filenameUnknownExt).toMatch(/\.bin$/);
  });

  it('buildSafeUploadedFilename normalizes Windows-style path separators to filename tail', () => {
    const filename = buildSafeUploadedFilename('nested\\reports\\Q1-summary.pdf');
    expect(filename).toMatch(/\.pdf$/);
    expect(filename).not.toContain('\\');
  });

  it('buildSafeUploadedFilename truncates oversized client basenames', () => {
    const filename = buildSafeUploadedFilename(`${'a'.repeat(500)}.pdf`);
    expect(filename).toMatch(/\.pdf$/);
    expect(filename.length).toBeLessThanOrEqual(200);
  });

  it('buildSafeUploadedFilename uses non-decimal entropy segment', () => {
    const filename = buildSafeUploadedFilename('report.pdf');
    expect(filename).toMatch(/^\d+-[a-f0-9]{16}-report\.pdf$/);
  });

  it('rejects invalid documents with stable code and message', () => {
    const req: any = {};
    const file: any = { originalname: 'payload.exe', mimetype: 'application/octet-stream' };
    const cb = vi.fn();

    expect(() => fileFilter(req, file, cb)).not.toThrow();
    expect(cb).toHaveBeenCalledTimes(1);
    expectDisallowedTypeError(cb.mock.calls[0][0]);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it('rejects oversized originalname metadata before extension checks', () => {
    const req: any = {};
    const file: any = {
      originalname: `${'a'.repeat(MAX_CLIENT_ORIGINALNAME_LENGTH + 1)}.pdf`,
      mimetype: 'application/pdf',
    };
    const cb = vi.fn();

    expect(() => fileFilter(req, file, cb)).not.toThrow();
    expect(cb).toHaveBeenCalledTimes(1);
    expectDisallowedTypeError(cb.mock.calls[0][0]);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it('rejects mismatched but substring-like spreadsheet mimetype', () => {
    const req: any = {};
    const file: any = {
      originalname: 'report.xlsx',
      mimetype: 'application/vnd.oasis.opendocument.spreadsheet',
    };
    const cb = vi.fn();

    fileFilter(req, file, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expectDisallowedTypeError(cb.mock.calls[0][0]);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it('accepts valid PDF mimetype with charset parameter', () => {
    const req: any = {};
    const file: any = {
      originalname: 'report.pdf',
      mimetype: 'application/pdf; charset=binary',
    };
    const cb = vi.fn();

    fileFilter(req, file, cb);

    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('accepts valid PDF when originalname contains Windows-style path segments', () => {
    const req: any = {};
    const file: any = {
      originalname: 'nested\\reports\\q1.pdf',
      mimetype: 'application/pdf',
    };
    const cb = vi.fn();

    fileFilter(req, file, cb);

    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('rejects extension/mimetype mismatch when both values are individually allowed', () => {
    const req: any = {};
    const file: any = {
      originalname: 'report.docx',
      mimetype: 'application/pdf',
    };
    const cb = vi.fn();

    fileFilter(req, file, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expectDisallowedTypeError(cb.mock.calls[0][0]);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it('accepts matching Word and Excel extension/mimetype pairs', () => {
    const req: any = {};
    const wordCb = vi.fn();
    const xlsCb = vi.fn();
    const xlsxCb = vi.fn();

    fileFilter(
      req,
      {
        originalname: 'report.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      } as any,
      wordCb
    );
    fileFilter(req, { originalname: 'report.xls', mimetype: 'application/vnd.ms-excel' } as any, xlsCb);
    fileFilter(
      req,
      {
        originalname: 'report.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as any,
      xlsxCb
    );

    expect(wordCb).toHaveBeenCalledWith(null, true);
    expect(xlsCb).toHaveBeenCalledWith(null, true);
    expect(xlsxCb).toHaveBeenCalledWith(null, true);
  });

  it('rejects filenames containing null-byte control characters', () => {
    const req: any = {};
    const file: any = {
      originalname: 'report\u0000.pdf',
      mimetype: 'application/pdf',
    };
    const cb = vi.fn();

    fileFilter(req, file, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expectInvalidFilenameError(cb.mock.calls[0][0]);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it('rejects filenames containing newline control characters', () => {
    const req: any = {};
    const file: any = {
      originalname: 'report\n.pdf',
      mimetype: 'application/pdf',
    };
    const cb = vi.fn();

    fileFilter(req, file, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expectInvalidFilenameError(cb.mock.calls[0][0]);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it('rejects filenames containing zero-width Unicode characters', () => {
    const req: any = {};
    const file: any = {
      originalname: 'report\u200B.pdf',
      mimetype: 'application/pdf',
    };
    const cb = vi.fn();

    fileFilter(req, file, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expectInvalidFilenameError(cb.mock.calls[0][0]);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it('exports stable runtime filter error contract constants', () => {
    expect(FILE_UPLOAD_FILTER_RUNTIME_CODE).toBe('FILE_UPLOAD_FILTER_RUNTIME');
    expect(FILE_UPLOAD_FILTER_RUNTIME_MESSAGE).toBe('Failed to validate uploaded file metadata');
  });

  it('sanitizeOrgIdForUploadPath falls back to unknown for unsafe path-like values', () => {
    expect(sanitizeOrgIdForUploadPath('org-1')).toBe('org-1');
    expect(sanitizeOrgIdForUploadPath('../../../etc')).toBe('unknown');
    expect(sanitizeOrgIdForUploadPath('org/1')).toBe('unknown');
    expect(sanitizeOrgIdForUploadPath('a'.repeat(129))).toBe('unknown');
    expect(sanitizeOrgIdForUploadPath('..')).toBe('unknown');
  });

  it('resolveAssessmentUploadDir rejects path traversal organization ids', () => {
    const resolved = resolveAssessmentUploadDir({
      user: { organizationId: '../../../etc/passwd' },
    } as any);

    expect(resolved).toContain('/uploads/assessments/unknown');
  });

  it('resolveAssessmentUploadDir returns canonical real path for organization directory', () => {
    const resolved = resolveAssessmentUploadDir({
      user: { organizationId: 'org-canonical' },
    } as any);

    expect(resolved).toContain('/uploads/assessments/org-canonical');
    expect(resolved).toBe(fs.realpathSync(resolved));
  });

  it('resolveAssessmentUploadDir creates org directory with owner-only mode when missing', () => {
    const organizationId = `perm-test-${Date.now()}`;
    const req: any = { user: { organizationId } };
    const resolved = resolveAssessmentUploadDir(req as any);
    const stat = fs.statSync(resolved);

    expect((stat.mode & 0o777)).toBe(0o700);
  });

  it('resolveUploadDestinationForMulter passes non-empty fallback destination when resolver throws', () => {
    const cb = vi.fn();
    const resolver = () => {
      throw new Error(FILE_UPLOAD_WORKSPACE_UNAVAILABLE_MESSAGE);
    };

    resolveUploadDestinationForMulter({} as any, cb, resolver as any);

    expect(cb).toHaveBeenCalledTimes(1);
    const [err, destination] = cb.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe(FILE_UPLOAD_WORKSPACE_UNAVAILABLE_MESSAGE);
    expect(destination).toBe(ASSESSMENTS_UPLOAD_ROOT);
    expect(destination.length).toBeGreaterThan(0);
  });

  it('exports stable workspace-unavailable error contract constants', () => {
    expect(FILE_UPLOAD_WORKSPACE_UNAVAILABLE_MESSAGE).toBe('Upload workspace unavailable');
    expect(FILE_UPLOAD_WORKSPACE_UNAVAILABLE_CODE).toBe('FILE_UPLOAD_WORKSPACE_UNAVAILABLE');
  });

  it('isPathInsideDir accepts nested paths and rejects parent traversal', () => {
    expect(isPathInsideDir('/base/root', '/base/root/a/b')).toBe(true);
    expect(isPathInsideDir('/base/root', '/base/other')).toBe(false);
  });

  it('defines multipart limits for fields and parts', () => {
    expect(uploadLimits.fields).toBe(24);
    expect(uploadLimits.parts).toBe(48);
    expect(uploadLimits.fieldSize).toBe(256 * 1024);
    expect(uploadLimits.fieldNameSize).toBe(256);
    expect(uploadLimits.headerPairs).toBe(1000);
  });
});
