/**
 * Database helper shim — provides dbAll / dbGet wrappers
 * used by KnowledgeService and other modules.
 */
import { queryAll, queryOne, queryRun } from '../utils/queryHelpers.js';

export const dbAll = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  return queryAll<T>(sql, params);
};

export const dbGet = async <T = any>(sql: string, params: any[] = []): Promise<T | null> => {
  return queryOne<T>(sql, params);
};

export const dbRun = async (sql: string, params: any[] = []) => {
  return queryRun(sql, params);
};

export default { dbAll, dbGet, dbRun };
