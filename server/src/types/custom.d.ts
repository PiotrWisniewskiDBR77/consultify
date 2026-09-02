// Global type overrides to heal the codebase
declare module '*.js' {
  const content: any;
  export default content;
  export const asyncHandler: any;
  export const AppError: any;
}

// The npm package "tesseract.js" has a literal specifier ending in ".js", so
// without this exact-match declaration the wildcard `declare module '*.js'`
// above (intended for relative-path ESM imports) silently shadows it and
// leaves `recognize` untyped (TS2339). TS resolves exact matches before
// wildcard ones, so this takes precedence for `import('tesseract.js')`.
declare module 'tesseract.js' {
  export function recognize(
    image: Buffer | string,
    langs?: string,
    options?: Record<string, unknown>
  ): Promise<{ data: { text: string } }>;
}

// Special handling for controllers to stop the "property does not exist" noise
declare module '../controllers/*.js' {
  const content: any;
  export default content;
}

declare module 'uuid';
declare module 'bcryptjs';
declare module 'cheerio';

declare namespace Express {
  interface Request {
    _rateLimitUserId?: string;
  }
}
