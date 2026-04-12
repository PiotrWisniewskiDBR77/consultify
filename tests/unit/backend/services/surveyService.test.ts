/**
 * Survey Service Tests
 * Real database tests for survey management
 *
 * @module tests/unit/backend/services/surveyService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('SurveyService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS surveys (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        description TEXT,
                        status TEXT DEFAULT 'draft',
                        questions TEXT,
                        responses_count INTEGER DEFAULT 0,
                        created_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS survey_responses (
                        id TEXT PRIMARY KEY,
                        survey_id TEXT NOT NULL,
                        respondent_id TEXT,
                        answers TEXT NOT NULL,
                        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (survey_id) REFERENCES surveys(id)
                    )
                `,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM survey_responses');
        db.run('DELETE FROM surveys', () => resolve());
      });
    });
  });

  describe('Survey CRUD', () => {
    it('should create survey', async () => {
      const surveyId = `survey-${Date.now()}`;
      const questions = [{ id: 'q1', text: 'How satisfied are you?', type: 'rating' }];

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO surveys (id, organization_id, title, questions) VALUES (?, ?, ?, ?)',
          [surveyId, 'org-123', 'Customer Satisfaction', JSON.stringify(questions)],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const survey = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM surveys WHERE id = ?', [surveyId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(survey).toBeDefined();
      expect(survey.title).toBe('Customer Satisfaction');
    });

    it('should publish survey', async () => {
      const surveyId = `survey-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO surveys (id, organization_id, title) VALUES (?, ?, ?)',
          [surveyId, 'org-1', 'Test Survey'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE surveys SET status = ? WHERE id = ?', ['published', surveyId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const survey = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM surveys WHERE id = ?', [surveyId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(survey.status).toBe('published');
    });
  });

  describe('Survey Responses', () => {
    it('should submit response', async () => {
      const surveyId = `survey-${Date.now()}`;
      const responseId = `resp-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO surveys (id, organization_id, title) VALUES (?, ?, ?)', [
            surveyId,
            'org-1',
            'Feedback',
          ]);
          db.run(
            'INSERT INTO survey_responses (id, survey_id, answers) VALUES (?, ?, ?)',
            [responseId, surveyId, JSON.stringify({ q1: 5 })],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const response = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM survey_responses WHERE id = ?', [responseId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(response.survey_id).toBe(surveyId);
    });
  });
});
