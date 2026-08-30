import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../../server/src/Gateway';
import { queryAll, queryRun } from '../../../../server/src/utils/queryHelpers';
import {
  downloadDecisionAttachment,
  loadDecisionAttachments,
  uploadDecisionAttachmentsAndReload,
} from '../DecisionDetailView';
import { loadTaskAttachments, uploadTaskAttachmentsAndReload } from '../TaskDetailView';

const orgId = 'day155-org';
const userId = 'day155-user';
const taskId = 'day155-task';
const decisionId = 'day155-decision';
let token = '';

describe('day155 refresh and download through real ApiGateway and PostgreSQL', { retry: 0 }, () => {
  const app = express();

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    const { config } = await import('../../../../server/src/config/Config');
    expect(config.JWT_SECRET).toBeTruthy();
    token = jwt.sign(
      { id: userId, email: `${userId}@example.test`, role: 'USER', organizationId: orgId },
      config.JWT_SECRET
    );
    ApiGateway.getInstance().initializeRoutes(app);
    await queryRun(
      `INSERT INTO organizations (id, name, status) VALUES (?, ?, 'active') ON CONFLICT (id) DO NOTHING`,
      [orgId, 'Day 155 Organization']
    );
    await queryRun(
      `INSERT INTO users (id, organization_id, email, role, status) VALUES (?, ?, ?, 'USER', 'active') ON CONFLICT (id) DO NOTHING`,
      [userId, orgId, `${userId}@example.test`]
    );
    await queryRun(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES (?, ?, ?, 'USER', 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
      ['day155-member', orgId, userId]
    );
    await queryRun(
      `INSERT INTO tasks (id, organization_id, title, assignee_id, reporter_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [taskId, orgId, 'Day 155 task', userId, userId]
    );
    await queryRun(
      `INSERT INTO decisions (id, organization_id, title, decision_maker_id, created_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [decisionId, orgId, 'Day 155 decision', userId, userId]
    );
  });

  afterAll(async () => {
    await queryRun(`DELETE FROM object_attachments WHERE organization_id = ?`, [orgId]);
    await queryRun(`DELETE FROM decisions WHERE id = ?`, [decisionId]);
    await queryRun(`DELETE FROM tasks WHERE id = ?`, [taskId]);
    await queryRun(`DELETE FROM organization_members WHERE organization_id = ?`, [orgId]);
    await queryRun(`DELETE FROM users WHERE id = ?`, [userId]);
    await queryRun(`DELETE FROM organizations WHERE id = ?`, [orgId]);
  });

  const api = {
    postMultipart: async (url: string, formData: FormData) => {
      const file = formData.get('file') as File;
      const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(Buffer.from(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(file);
      });
      const response = await request(app)
        .post(`/api${url}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', fileBuffer, file.name);
      expect(response.status, response.text).toBe(201);
      return { data: response.body };
    },
    get: async (url: string) => {
      const response = await request(app).get(`/api${url}`).set('Authorization', `Bearer ${token}`);
      expect(response.status, response.text).toBe(200);
      return { data: response.body };
    },
  };

  it('reloads task and decision attachments from rows created through ApiGateway', async () => {
    const [taskUploaded] = await uploadTaskAttachmentsAndReload(api as any, taskId, [
      new File(['task-after-f5'], 'task-after-f5.txt', { type: 'text/plain' }),
    ]);
    const [decisionUploaded] = await uploadDecisionAttachmentsAndReload(api as any, decisionId, [
      new File(['decision-after-f5'], 'decision-after-f5.txt', { type: 'text/plain' }),
    ]);

    const taskAfterReload = await loadTaskAttachments(api as any, taskId);
    const decisionAfterReload = await loadDecisionAttachments(api as any, decisionId);
    const rows = await queryAll<any>(
      `SELECT id, object_type as "objectType", object_id as "objectId", file_name as "fileName" FROM object_attachments WHERE organization_id = ? ORDER BY object_type`,
      [orgId]
    );

    expect(taskAfterReload).toEqual([
      expect.objectContaining({ id: taskUploaded.id, name: 'task-after-f5.txt' }),
    ]);
    expect(decisionAfterReload).toEqual([
      expect.objectContaining({ id: decisionUploaded.id, name: 'decision-after-f5.txt' }),
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        id: decisionUploaded.id,
        objectType: 'decision',
        objectId: decisionId,
        fileName: 'decision-after-f5.txt',
      }),
      expect.objectContaining({
        id: taskUploaded.id,
        objectType: 'task',
        objectId: taskId,
        fileName: 'task-after-f5.txt',
      }),
    ]);
  });

  it('downloads the decision attachment with exact bytes and content type', async () => {
    const [attachment] = await loadDecisionAttachments(api as any, decisionId);
    let contentType = '';
    let downloadedBody = Buffer.alloc(0);
    const blob = await downloadDecisionAttachment(
      {
        downloadObjectAttachment: async (url) => {
          const response = await request(app)
            .get(`/api${url}`)
            .set('Authorization', `Bearer ${token}`)
            .buffer(true);
          expect(response.status, response.text).toBe(200);
          contentType = response.headers['content-type'];
          downloadedBody = Buffer.from(response.text, 'utf8');
          return { size: downloadedBody.length, type: contentType } as Blob;
        },
      },
      decisionId,
      attachment.id
    );

    expect(contentType).toContain('text/plain');
    expect(downloadedBody.toString('utf8')).toBe('decision-after-f5');
    expect(blob.size).toBe(Buffer.byteLength('decision-after-f5'));
  });
});
