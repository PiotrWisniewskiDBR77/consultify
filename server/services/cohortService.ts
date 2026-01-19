/**
 * Cohort Analysis Service
 *
 * Tracks user retention by sign-up cohort (weekly).
 */

import _db from '../database.js';

interface Database {
  all: (
    sql: string,
    params: unknown[],
    callback: (err: Error | null, rows: unknown[]) => void
  ) => void;
}

export interface RetentionRow {
  week_start: string;
  cohort_size: number;
  week_0: number;
  week_1: number;
  week_2: number;
  week_4: number;
}

export interface CohortServiceInterface {
  getRetentionMatrix: () => Promise<RetentionRow[]>;
}

const CohortService: CohortServiceInterface = {
  /**
   * Get retention matrix
   * Rows: Cohort (Week Start)
   * Cols: Weeks since signup (0, 1, 2, 4, 8)
   */
  async getRetentionMatrix(): Promise<RetentionRow[]> {
    const db = _db as Database;

    const sql = `
            WITH UserCohorts AS (
                SELECT 
                    id as user_id,
                    strftime('%Y-%W', created_at) as cohort_week,
                    date(created_at, 'weekday 0', '-6 days') as week_start
                FROM users
            ),
            UserActivity AS (
                SELECT 
                    user_id,
                    strftime('%Y-%W', created_at) as activity_week
                FROM journey_events
                GROUP BY user_id, activity_week
            )
            SELECT 
                uc.week_start,
                COUNT(DISTINCT uc.user_id) as cohort_size,
                COUNT(DISTINCT CASE WHEN ua.activity_week = uc.cohort_week THEN uc.user_id END) as week_0,
                COUNT(DISTINCT CASE WHEN ua.activity_week = strftime('%Y-%W', date(uc.week_start, '+7 days')) THEN uc.user_id END) as week_1,
                COUNT(DISTINCT CASE WHEN ua.activity_week = strftime('%Y-%W', date(uc.week_start, '+14 days')) THEN uc.user_id END) as week_2,
                COUNT(DISTINCT CASE WHEN ua.activity_week = strftime('%Y-%W', date(uc.week_start, '+28 days')) THEN uc.user_id END) as week_4
            FROM UserCohorts uc
            LEFT JOIN UserActivity ua ON uc.user_id = ua.user_id
            GROUP BY uc.week_start
            ORDER BY uc.week_start DESC
            LIMIT 12
        `;

    return new Promise((resolve, reject) => {
      (db as Database).all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve((rows as RetentionRow[]) || []);
      });
    });
  },
};

export default CohortService;
