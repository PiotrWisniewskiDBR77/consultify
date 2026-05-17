/**
 * @vitest-environment node
 */
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import inputSanitizationMiddleware from '../inputSanitization.middleware.js';

describe('inputSanitization middleware', () => {
  it('skips sanitization for multipart content type case-insensitively', async () => {
    const req = {
      headers: { 'content-type': 'MULTIPART/FORM-DATA; boundary=----x' },
      body: { note: '<script>alert(1)</script>' },
      query: {},
      path: '/upload',
      method: 'POST',
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;

    await inputSanitizationMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req.body as { note: string }).note).toBe('<script>alert(1)</script>');
  });

  it('skips sanitization for multipart when content-type header is an array', async () => {
    const req = {
      headers: { 'content-type': ['MULTIPART/FORM-DATA; boundary=----x'] as any },
      body: { note: '<script>alert(1)</script>' },
      query: {},
      path: '/upload',
      method: 'POST',
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;

    await inputSanitizationMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req.body as { note: string }).note).toBe('<script>alert(1)</script>');
  });

  it('skips sanitization for multipart/related content type', async () => {
    const req = {
      headers: { 'content-type': 'multipart/related; boundary=----x' },
      body: { note: '<script>alert(1)</script>' },
      query: {},
      params: { id: '<script>alert(1)</script>' },
      path: '/upload',
      method: 'POST',
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;

    await inputSanitizationMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req.body as { note: string }).note).toBe('<script>alert(1)</script>');
    expect((req.params as { id: string }).id).toBe('<script>alert(1)</script>');
  });

  it('sanitizes req.params strings similarly to req.query', async () => {
    const req = {
      headers: { 'content-type': 'application/json' },
      body: {},
      query: {},
      params: { slug: '<script>alert(1)</script>' },
      path: '/items/:slug',
      method: 'GET',
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;

    await inputSanitizationMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req.params as { slug: string }).slug).toContain('&lt;');
    expect((req.params as { slug: string }).slug).not.toContain('<script>');
  });
});
