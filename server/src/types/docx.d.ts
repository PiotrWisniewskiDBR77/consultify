/**
 * Type declaration for docx module.
 * The docx package includes its own types; this is a fallback for build environments
 * where module resolution may differ (e.g. Docker/Railway).
 */
declare module 'docx' {
  export const AlignmentType: Record<string, string>;
  export const HeadingLevel: Record<string, unknown>;
  export const PageNumber: Record<string, unknown>;

  export class Document {
    constructor(options?: Record<string, unknown>);
  }

  export class Paragraph {
    constructor(options?: unknown);
  }

  export class TextRun {
    constructor(options?: string | Record<string, unknown>);
  }

  export class Header {
    constructor(options?: Record<string, unknown>);
  }

  export class Footer {
    constructor(options?: Record<string, unknown>);
  }

  export const Packer: {
    toBuffer(doc: Document): Promise<Buffer>;
    toBlob(doc: Document): Promise<Blob>;
    toBase64String(doc: Document): Promise<string>;
  };
}
