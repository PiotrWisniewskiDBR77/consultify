/**
 * S3Adapter — durable object storage via the S3 API. Compatible with
 * Cloudflare R2 (R2 exposes an S3-compatible endpoint), AWS S3, MinIO, etc.
 *
 * DESIGN CONSTRAINTS (see storage/types.ts):
 *  - Must COMPILE without `@aws-sdk/client-s3` installed. The SDK is loaded via
 *    a dynamic `import()` behind a typeless boundary, so `tsc` never needs the
 *    module's types. `pnpm i` (adding the dep to server/package.json) is
 *    required before this adapter can actually run.
 *  - Must not require secrets at import time. Credentials/endpoint are read
 *    lazily from env on first use, so importing this file (e.g. from the
 *    factory) is safe even when the provider is unconfigured.
 *
 * ENV (read lazily):
 *  - S3_BUCKET            (required) bucket name
 *  - S3_REGION            (default "auto" — correct for R2)
 *  - S3_ENDPOINT          (required for R2, e.g. https://<acct>.r2.cloudflarestorage.com)
 *  - S3_ACCESS_KEY_ID     (required) access key
 *  - S3_SECRET_ACCESS_KEY (required) secret key
 *  - S3_FORCE_PATH_STYLE  ("true" for MinIO / some R2 setups; default false)
 *  - S3_PUBLIC_URL_BASE   (optional) public/CDN base for getUrl; when set,
 *                         getUrl returns `${base}/${key}` instead of a signed URL
 *  - S3_SIGNED_URL_TTL_SECONDS (default 900) TTL for pre-signed GET URLs
 */

import type { Readable } from 'stream';

import type {
  GetObjectResult,
  GetUrlOptions,
  PutObjectInput,
  PutObjectResult,
  StorageAdapter,
} from './types.js';

// Minimal structural types for just the bits we use, so this file has no
// compile-time dependency on @aws-sdk/client-s3.
interface S3ClientLike {
  send(command: unknown): Promise<unknown>;
}
interface S3Module {
  S3Client: new (config: unknown) => S3ClientLike;
  PutObjectCommand: new (input: unknown) => unknown;
  GetObjectCommand: new (input: unknown) => unknown;
  DeleteObjectCommand: new (input: unknown) => unknown;
  HeadObjectCommand: new (input: unknown) => unknown;
}
interface S3PresignerModule {
  getSignedUrl: (client: unknown, command: unknown, options?: unknown) => Promise<string>;
}

// Package specifiers assembled at runtime so bundler/static analyzers (Vite,
// esbuild) never try to resolve @aws-sdk at build/import time. The SDK is only
// needed when STORAGE_PROVIDER=s3 AND the deps have been installed (pnpm i).
const S3_CLIENT_PKG = ['@aws-sdk', 'client-s3'].join('/');
const S3_PRESIGNER_PKG = ['@aws-sdk', 's3-request-presigner'].join('/');

// Indirection through a runtime-resolved dynamic import. Using an expression
// (not a string literal) keeps Vite's import-analysis plugin from statically
// resolving the module — critical so the whole server bundle/test-suite loads
// even when @aws-sdk is absent.
const dynamicImport = (specifier: string): Promise<unknown> =>
  (Function('s', 'return import(s)') as (s: string) => Promise<unknown>)(specifier);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[S3Adapter] Missing required env var ${name}. Set STORAGE_PROVIDER=s3 only with S3/R2 credentials configured.`
    );
  }
  return value;
}

export class S3Adapter implements StorageAdapter {
  readonly provider = 's3';

  private clientPromise?: Promise<S3ClientLike>;
  private sdkPromise?: Promise<S3Module>;
  private presignerPromise?: Promise<S3PresignerModule>;

  /** Lazy-load the AWS SDK. Throws a clear error if the dep is not installed. */
  private async sdk(): Promise<S3Module> {
    if (!this.sdkPromise) {
      this.sdkPromise = (async () => {
        try {
          const mod = (await dynamicImport(S3_CLIENT_PKG)) as unknown as S3Module;
          return mod;
        } catch (err) {
          throw new Error(
            `[S3Adapter] @aws-sdk/client-s3 is not installed. Run "pnpm i" in server/ after adding it to dependencies. Original: ${(err as Error).message}`
          );
        }
      })();
    }
    return this.sdkPromise;
  }

  private async presigner(): Promise<S3PresignerModule> {
    if (!this.presignerPromise) {
      this.presignerPromise = (async () => {
        try {
          const mod = (await dynamicImport(S3_PRESIGNER_PKG)) as unknown as S3PresignerModule;
          return mod;
        } catch (err) {
          throw new Error(
            `[S3Adapter] @aws-sdk/s3-request-presigner is not installed. Run "pnpm i" in server/. Original: ${(err as Error).message}`
          );
        }
      })();
    }
    return this.presignerPromise;
  }

  private async client(): Promise<S3ClientLike> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { S3Client } = await this.sdk();
        const config: Record<string, unknown> = {
          region: process.env.S3_REGION || 'auto',
          credentials: {
            accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
            secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
          },
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        };
        // R2 and MinIO require an explicit endpoint; real AWS S3 does not.
        if (process.env.S3_ENDPOINT) {
          config.endpoint = process.env.S3_ENDPOINT;
        }
        return new S3Client(config);
      })();
    }
    return this.clientPromise;
  }

  private bucket(): string {
    return requireEnv('S3_BUCKET');
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const [{ PutObjectCommand }, client] = await Promise.all([this.sdk(), this.client()]);
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      })
    );
    return { key: input.key };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const [{ GetObjectCommand }, client] = await Promise.all([this.sdk(), this.client()]);
    const res = (await client.send(new GetObjectCommand({ Bucket: this.bucket(), Key: key }))) as {
      Body?: unknown;
      ContentLength?: number;
      ContentType?: string;
    };

    if (!res.Body) {
      throw new Error(`Object not found: ${key}`);
    }
    return {
      // In Node, the AWS SDK v3 Body is a Readable stream.
      stream: res.Body as Readable,
      size: res.ContentLength,
      contentType: res.ContentType,
    };
  }

  async exists(key: string): Promise<boolean> {
    const [{ HeadObjectCommand }, client] = await Promise.all([this.sdk(), this.client()]);
    try {
      await client.send(new HeadObjectCommand({ Bucket: this.bucket(), Key: key }));
      return true;
    } catch (err) {
      const name = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (name.name === 'NotFound' || name.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async getUrl(key: string, options?: GetUrlOptions): Promise<string> {
    // If a public/CDN base is configured (public bucket or R2 custom domain),
    // return a plain URL — no signing needed.
    const publicBase = process.env.S3_PUBLIC_URL_BASE;
    if (publicBase) {
      const encoded = key
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
      return `${publicBase.replace(/\/+$/, '')}/${encoded}`;
    }

    const [{ GetObjectCommand }, client, { getSignedUrl }] = await Promise.all([
      this.sdk(),
      this.client(),
      this.presigner(),
    ]);
    const ttl =
      options?.expiresInSeconds ?? parseInt(process.env.S3_SIGNED_URL_TTL_SECONDS || '900', 10);
    return getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucket(), Key: key }), {
      expiresIn: ttl,
    });
  }

  async delete(key: string): Promise<void> {
    const [{ DeleteObjectCommand }, client] = await Promise.all([this.sdk(), this.client()]);
    // S3/R2 DeleteObject is already idempotent (no error for a missing key).
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }));
  }
}
