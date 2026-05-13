import { describe, expect, it, vi } from 'vitest';

import {
  buildSafeUploadedFilename,
  FILE_UPLOAD_DISALLOWED_TYPE_CODE,
  FILE_UPLOAD_DISALLOWED_TYPE_MESSAGE,
  fileFilter,
  isPathInsideDir,
  resolveAssessmentUploadDir,
  sanitizeOrgIdForUploadPath,
  uploadLimits,
} from '../../../../server/src/middleware/fileUpload.middleware.ts';

describe('fileUpload.middleware', () => {
  const expectDisallowedTypeError = (err: unknown) => {
    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { code?: string }).code).toBe(FILE_UPLOAD_DISALLOWED_TYPE_CODE);
    expect((err as Error).message).toBe(FILE_UPLOAD_DISALLOWED_TYPE_MESSAGE);
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
    expect(filenameFromUndefined).toContain('-upload.bin');

    const throwingName = {
      get value() {
        throw new Error('originalname getter failed');
      },
    } as unknown;
    const filenameFromObject = buildSafeUploadedFilename(throwingName);
    expect(filenameFromObject).toContain('-upload.bin');
  });

  it('buildSafeUploadedFilename truncates oversized client basenames', () => {
    const filename = buildSafeUploadedFilename(`${'a'.repeat(500)}.pdf`);
    expect(filename).toMatch(/\.pdf$/);
    expect(filename.length).toBeLessThan(220);
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
