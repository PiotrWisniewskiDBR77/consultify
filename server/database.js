/**
 * Compatibility stub - redirects to new location
 * @deprecated Use server/src/database/Database.ts instead
 */
// Legacy default export should behave like a sqlite3 handle (has .all/.get/.run)
export { default } from './src/database/Database.ts';
export * from './src/database/Database.ts';
