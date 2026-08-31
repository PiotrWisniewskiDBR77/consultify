import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../../server/src/Gateway';
import { queryAll, queryRun } from '../../../../server/src/utils/queryHelpers';
import {
  deleteDecisionAttachmentAndReload,
  uploadDecisionAttachmentsAndReload,
} from '../DecisionDetailView';
import {
  deleteTaskAttachmentAndReload,
  downloadTaskAttachment,
  uploadTaskAttachmentsAndReload,
} from '../TaskDetailView';

const orgId = 'day148-org';
const userId = 'day148-user';
const outsiderId = 'day148-outsider';
const taskId = 'day148-task';
const decisionId = 'day148-decision';
const secret = 'cx148-test-secret-do-not-reuse-00000000';

const tokenFor = (id: string) =>
  jwt.sign({ id, email: `${id}@example.test`, role: 'USER', organizationId: orgId }, secret);

describe('day148 real ApiGateway object attachment flow', { retry: 0 }, () => {
  const app = express();
  const token = tokenFor(userId);

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    ApiGateway.getInstance().initializeRoutes(app);
    await queryRun(
      `INSERT INTO organizations (id, name, status) VALUES (?, ?, 'active') ON CONFLICT (id) DO NOTHING`,
      [orgId, 'Day 148 Organization']
    );
    for (const id of [userId, outsiderId]) {
      await queryRun(
        `INSERT INTO users (id, organization_id, email, role, status) VALUES (?, ?, ?, 'USER', 'active') ON CONFLICT (id) DO NOTHING`,
        [id, orgId, `${id}@example.test`]
      );
      await queryRun(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES (?, ?, ?, 'USER', 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
        [`day148-member-${id}`, orgId, id]
      );
    }
    await queryRun(
      `INSERT INTO tasks (id, organization_id, title, assignee_id, reporter_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [taskId, orgId, 'Day 148 task', userId, userId]
    );
    await queryRun(
      `INSERT INTO decisions (id, organization_id, title, decision_maker_id, created_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [decisionId, orgId, 'Day 148 decision', userId, userId]
    );
  });

  afterAll(async () => {
    await queryRun(`DELETE FROM object_attachments WHERE organization_id = ?`, [orgId]);
    await queryRun(`DELETE FROM decisions WHERE id = ?`, [decisionId]);
    await queryRun(`DELETE FROM tasks WHERE id = ?`, [taskId]);
    await queryRun(`DELETE FROM organization_members WHERE organization_id = ?`, [orgId]);
    await queryRun(`DELETE FROM users WHERE id IN (?, ?)`, [userId, outsiderId]);
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
      if (response.status !== 201) throw new Error(`POST ${response.status}: ${response.text}`);
      return { data: response.body };
    },
    get: async (url: string) => {
      const response = await request(app).get(`/api${url}`).set('Authorization', `Bearer ${token}`);
      if (response.status !== 200) throw new Error(`GET ${response.status}: ${response.text}`);
      return { data: response.body };
    },
    delete: async (url: string) => {
      const response = await request(app)
        .delete(`/api${url}`)
        .set('Authorization', `Bearer ${token}`);
      if (response.status !== 204) throw new Error(`DELETE ${response.status}: ${response.text}`);
      return { data: undefined };
    },
  };

  it('persists, lists, downloads, and deletes a task attachment through the caller', async () => {
    const original = 'day148-task-evidence';
    const [attachment] = await uploadTaskAttachmentsAndReload(api, taskId, [
      new File([original], 'task-evidence.txt', { type: 'text/plain' }),
    ]);
    const rows = await queryAll<any>(
      `SELECT object_id as "objectId", organization_id as "organizationId", size_bytes as "sizeBytes" FROM object_attachments WHERE id = ?`,
      [attachment.id]
    );
    expect(rows).toEqual([
      { objectId: taskId, organizationId: orgId, sizeBytes: String(original.length) },
    ]);

    let downloadedBody = '';
    const blob = await downloadTaskAttachment(
      {
        downloadObjectAttachment: async (url) => {
          const response = await request(app)
            .get(`/api${url}`)
            .set('Authorization', `Bearer ${token}`)
            .buffer(true);
          expect(response.status).toBe(200);
          downloadedBody = response.text;
          return { size: Buffer.byteLength(downloadedBody) } as Blob;
        },
      },
      taskId,
      attachment.id
    );
    expect(downloadedBody).toBe(original);
    expect(blob.size).toBe(Buffer.byteLength(original));

    await expect(deleteTaskAttachmentAndReload(api, taskId, attachment.id)).resolves.toEqual([]);
    expect(
      await queryAll(`SELECT id FROM object_attachments WHERE id = ?`, [attachment.id])
    ).toEqual([]);
  });

  it('persists and deletes a decision attachment through the same caller contract', async () => {
    const [attachment] = await uploadDecisionAttachmentsAndReload(api, decisionId, [
      new File(['decision'], 'decision-evidence.txt', { type: 'text/plain' }),
    ]);
    const rows = await queryAll<any>(
      `SELECT object_id as "objectId", organization_id as "organizationId" FROM object_attachments WHERE id = ?`,
      [attachment.id]
    );
    expect(rows).toEqual([{ objectId: decisionId, organizationId: orgId }]);
    await expect(
      deleteDecisionAttachmentAndReload(api, decisionId, attachment.id)
    ).resolves.toEqual([]);
  });

  it('refuses a non-participant and leaves the database unchanged', async () => {
    const before = await queryAll(`SELECT id FROM object_attachments WHERE organization_id = ?`, [
      orgId,
    ]);
    const response = await request(app)
      .post(`/api/my-work/object-attachments/task/${taskId}`)
      .set('Authorization', `Bearer ${tokenFor(outsiderId)}`)
      .attach('file', Buffer.from('forbidden'), 'forbidden.txt');
    expect(response.status, response.text).toBe(403);
    const after = await queryAll(`SELECT id FROM object_attachments WHERE organization_id = ?`, [
      orgId,
    ]);
    expect(after).toEqual(before);
  });
});
