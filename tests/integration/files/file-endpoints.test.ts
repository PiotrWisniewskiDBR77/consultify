import { describe, expect, it } from 'vitest';

import { fileFilter, uploadLimits } from '../../../server/src/middleware/fileUpload.middleware.ts';

describe('File upload middleware - REAL_CODE', () => {
  it('accepts PDF by extension + mimetype', () => {
    const cb = (err: any, accept: boolean) => {
      expect(err).toBeNull();
      expect(accept).toBe(true);
    };
    fileFilter({} as any, { originalname: 'a.pdf', mimetype: 'application/pdf' } as any, cb as any);
  });

  it('rejects disallowed extensions', () => {
    const cb = (err: any, accept: boolean) => {
      expect(err).toBeInstanceOf(Error);
      expect(accept).toBe(false);
    };
    fileFilter(
      {} as any,
      { originalname: 'a.exe', mimetype: 'application/octet-stream' } as any,
      cb as any
    );
  });

  it('rejects disallowed mimetypes even with allowed extension', () => {
    const cb = (err: any, accept: boolean) => {
      expect(err).toBeInstanceOf(Error);
      expect(accept).toBe(false);
    };
    fileFilter({} as any, { originalname: 'a.pdf', mimetype: 'text/plain' } as any, cb as any);
  });

  it('upload middleware has a 10MB fileSize limit', () => {
    expect(uploadLimits.fileSize).toBe(10 * 1024 * 1024);
  });
});
