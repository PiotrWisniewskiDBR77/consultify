declare module 'sharp' {
  interface SharpOptions {
    quality?: number;
    compressionLevel?: number;
    mozjpeg?: boolean;
  }

  interface Sharp {
    metadata(): Promise<{ width?: number; height?: number; format?: string; hasAlpha?: boolean }>;
    resize(width?: number, height?: number, options?: { fit?: string; withoutEnlargement?: boolean }): Sharp;
    png(options?: SharpOptions): Sharp;
    jpeg(options?: SharpOptions): Sharp;
    gif(): Sharp;
    webp(options?: SharpOptions): Sharp;
    toBuffer(): Promise<Buffer>;
  }

  function sharp(input: Buffer | string, options?: any): Sharp;

  export default sharp;
}
