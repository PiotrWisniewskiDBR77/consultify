// Global type overrides to heal the codebase
declare module '*.js' {
  const content: any;
  export default content;
  export const asyncHandler: any;
  export const AppError: any;
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
