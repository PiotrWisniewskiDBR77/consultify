export const normalizeAuthEmail = (email: unknown): string =>
  String(email || '')
    .trim()
    .toLowerCase();

export const buildCaseInsensitiveUserEmailLookupQuery = (selectedColumns = '*'): string =>
  `SELECT ${selectedColumns} FROM users WHERE LOWER(email) = LOWER(?)`;
