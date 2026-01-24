import { getDatabase } from './Database.js';
import * as base from '../../db/sqliteAsync.js';

function resolveDb(maybeDb) {
  if (maybeDb && typeof maybeDb.get === 'function') return maybeDb;
  return getDatabase();
}

export function runAsync(dbOrSql, sqlOrParams, params = []) {
  if (typeof dbOrSql === 'string') {
    const db = resolveDb(null);
    return base.runAsync(db, dbOrSql, sqlOrParams || []);
  }
  return base.runAsync(resolveDb(dbOrSql), sqlOrParams, params);
}

export function getAsync(dbOrSql, sqlOrParams, params = []) {
  if (typeof dbOrSql === 'string') {
    const db = resolveDb(null);
    return base.getAsync(db, dbOrSql, sqlOrParams || []);
  }
  return base.getAsync(resolveDb(dbOrSql), sqlOrParams, params);
}

export function allAsync(dbOrSql, sqlOrParams, params = []) {
  if (typeof dbOrSql === 'string') {
    const db = resolveDb(null);
    return base.allAsync(db, dbOrSql, sqlOrParams || []);
  }
  return base.allAsync(resolveDb(dbOrSql), sqlOrParams, params);
}

export function withTransaction(dbOrFn, maybeFn) {
  if (typeof dbOrFn === 'function') {
    const db = resolveDb(null);
    return base.withTransaction(db, dbOrFn);
  }
  return base.withTransaction(resolveDb(dbOrFn), maybeFn);
}

export default {
  runAsync,
  getAsync,
  allAsync,
  withTransaction,
};
