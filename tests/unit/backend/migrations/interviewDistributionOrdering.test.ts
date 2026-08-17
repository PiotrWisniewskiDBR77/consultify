import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  sortMigrationsDeterministically,
  type Migration,
} from '../../../../server/scripts/migrationOrdering';

const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
const producer = '951a_interview_distributions_prerequisite.sql';
const consumer = '952_interview_public_distribution_answers.sql';

describe('Interview distribution fresh-install ordering', () => {
  it('runs the table producer before the public-answer consumer', () => {
    const migrations: Migration[] = [producer, consumer].map((filename) => ({
      filename,
      filepath: path.join(migrationsDir, filename),
    }));

    expect(sortMigrationsDeterministically(migrations).map((item) => item.filename)).toEqual([
      producer,
      consumer,
    ]);
  });

  it('keeps the prerequisite additive and the consumer foreign keys intact', () => {
    const producerSql = fs.readFileSync(path.join(migrationsDir, producer), 'utf8');
    const consumerSql = fs.readFileSync(path.join(migrationsDir, consumer), 'utf8');

    expect(producerSql).toMatch(/CREATE TABLE IF NOT EXISTS interview_distributions/i);
    expect(producerSql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
    expect(consumerSql).toMatch(/REFERENCES interview_distributions\(id\) ON DELETE RESTRICT/i);
  });
});
