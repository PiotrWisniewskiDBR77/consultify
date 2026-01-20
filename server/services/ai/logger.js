import baseLogger from '../../ai/logger.js';

export const aiLogger = baseLogger || {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

export default aiLogger;
