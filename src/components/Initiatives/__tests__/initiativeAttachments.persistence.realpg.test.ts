/**
 * Dowód naprawy utraty danych: załącznik dodany do Inicjatywy.
 *
 * DEFEKT (zmierzony przed naprawą, 2026-09-01):
 * `src/components/Initiatives/sections/AttachmentsSection.tsx` wołało
 * WYŁĄCZNIE `URL.createObjectURL(f)` — efemeryczny odnośnik w pamięci
 * przeglądarki — i pokazywało komunikat sukcesu. Zero wywołania API.
 * Po odświeżeniu strony plik nie istniał. `InitiativeDocumentView.tsx`
 * (`fetchAll`) też nigdy nie ładował załączników z serwera dla prawdziwej
 * (nie-showcase'owej) inicjatywy — stan zawsze wracał do `[]`.
 *
 * Ten test wchodzi przez REALNY `ApiGateway` (produkcyjny routing, nie
 * atrapa) na REALNYM PostgreSQL (migracje od zera, kontener jednorazowy),
 * z podpisanym tokenem (`config.JWT_SECRET` — ten sam sekret, którego
 * `verifyToken` middleware realnie używa; wzorzec z `day155`, NIE z `day148`,
 * bo `day148` podpisuje własnym, niezgodnym sekretem i dostaje 401 —
 * zmierzone w tej sesji, patrz raport).
 *
 * Wzorzec „F5" jak w `day155.attachmentPersistence.realpg.test.ts`:
 * upload → `loadInitiativeAttachments` (osobne, świeże GET — dokładnie to,
 * co robi przeładowanie strony) → plik MUSI tam być.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import { ApiGateway } from '../../../../server/src/Gateway';
import { queryAll, queryRun } from '../../../../server/src/utils/queryHelpers';
import {
  deleteInitiativeAttachmentAndReload,
  loadInitiativeAttachments,
  uploadInitiativeAttachmentsAndReload,
} from '../sections/AttachmentsSection';

const orgId = 'initiative-attach-org';
const otherOrgId = 'initiative-attach-other-org';
const uploaderId = 'initiative-attach-uploader';
const teammateId = 'initiative-attach-teammate'; // same org, NOT the uploader — proves org-wide visibility
const outsiderId = 'initiative-attach-outsider'; // different org — must NOT see anything
const initiativeId = 'initiative-attach-initiative';

describe('Initiative attachments survive a reload through real ApiGateway + PostgreSQL', { retry: 0 }, () => {
  const app = express();
  let uploaderToken = '';
  let teammateToken = '';
  let outsiderToken = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    const { config } = await import('../../../../server/src/config/Config');
    expect(config.JWT_SECRET).toBeTruthy();
    const sign = (id: string, organizationId: string) =>
      jwt.sign({ id, email: `${id}@example.test`, role: 'USER', organizationId }, config.JWT_SECRET);
    uploaderToken = sign(uploaderId, orgId);
    teammateToken = sign(teammateId, orgId);
    outsiderToken = sign(outsiderId, otherOrgId);

    ApiGateway.getInstance().initializeRoutes(app);

    await queryRun(
      `INSERT INTO organizations (id, name, status) VALUES (?, ?, 'active') ON CONFLICT (id) DO NOTHING`,
      [orgId, 'Initiative Attachments Org']
    );
    await queryRun(
      `INSERT INTO organizations (id, name, status) VALUES (?, ?, 'active') ON CONFLICT (id) DO NOTHING`,
      [otherOrgId, 'Initiative Attachments Other Org']
    );
    for (const [id, org] of [
      [uploaderId, orgId],
      [teammateId, orgId],
      [outsiderId, otherOrgId],
    ] as const) {
      await queryRun(
        `INSERT INTO users (id, organization_id, email, role, status) VALUES (?, ?, ?, 'USER', 'active') ON CONFLICT (id) DO NOTHING`,
        [id, org, `${id}@example.test`]
      );
      await queryRun(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES (?, ?, ?, 'USER', 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
        [`member-${id}`, org, id]
      );
    }
    await queryRun(
      `INSERT INTO initiatives (id, organization_id, name, status, created_by) VALUES (?, ?, ?, 'DRAFT', ?) ON CONFLICT (id) DO NOTHING`,
      [initiativeId, orgId, 'Initiative attachments proof', uploaderId]
    );
  });

  afterAll(async () => {
    await queryRun(`DELETE FROM object_attachments WHERE organization_id IN (?, ?)`, [
      orgId,
      otherOrgId,
    ]);
    await queryRun(`DELETE FROM initiatives WHERE id = ?`, [initiativeId]);
    await queryRun(`DELETE FROM organization_members WHERE organization_id IN (?, ?)`, [
      orgId,
      otherOrgId,
    ]);
    await queryRun(`DELETE FROM users WHERE id IN (?, ?, ?)`, [
      uploaderId,
      teammateId,
      outsiderId,
    ]);
    await queryRun(`DELETE FROM organizations WHERE id IN (?, ?)`, [orgId, otherOrgId]);
  });

  const apiAs = (token: string) => ({
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
  });

  it('DEFECT DIES: upload followed by an independent reload (F5) still has the file', async () => {
    const original = 'initiative-attachment-survives-reload';
    const [uploaded] = await uploadInitiativeAttachmentsAndReload(apiAs(uploaderToken), initiativeId, [
      new File([original], 'initiative-evidence.txt', { type: 'text/plain' }),
    ]);
    expect(uploaded).toEqual(
      expect.objectContaining({ name: 'initiative-evidence.txt' })
    );

    // Independent GET — exactly what a page reload does. This is the load-bearing
    // assertion: before the fix there was no server call at all, so this row
    // (and this reload) simply did not exist.
    const afterReload = await loadInitiativeAttachments(apiAs(uploaderToken), initiativeId);
    expect(afterReload).toEqual([
      expect.objectContaining({ id: uploaded.id, name: 'initiative-evidence.txt' }),
    ]);

    const rows = await queryAll<any>(
      `SELECT object_type as "objectType", object_id as "objectId", organization_id as "organizationId", size_bytes as "sizeBytes"
         FROM object_attachments WHERE id = ?`,
      [uploaded.id]
    );
    expect(rows).toEqual([
      {
        objectType: 'initiative',
        objectId: initiativeId,
        organizationId: orgId,
        sizeBytes: String(original.length),
      },
    ]);
  });

  it('delete reloads from the server and the row is really gone', async () => {
    const [uploaded] = await uploadInitiativeAttachmentsAndReload(apiAs(uploaderToken), initiativeId, [
      new File(['to-be-deleted'], 'delete-me.txt', { type: 'text/plain' }),
    ]);
    await expect(
      deleteInitiativeAttachmentAndReload(apiAs(uploaderToken), initiativeId, uploaded.id)
    ).resolves.not.toContainEqual(expect.objectContaining({ id: uploaded.id }));
    expect(
      await queryAll(`SELECT id FROM object_attachments WHERE id = ?`, [uploaded.id])
    ).toEqual([]);
  });

  it('PERMISSION PAIR — owner sees it: a teammate in the SAME organization can list the attachment', async () => {
    const [uploaded] = await uploadInitiativeAttachmentsAndReload(apiAs(uploaderToken), initiativeId, [
      new File(['same-org-visible'], 'same-org.txt', { type: 'text/plain' }),
    ]);
    const asTeammate = await loadInitiativeAttachments(apiAs(teammateToken), initiativeId);
    expect(asTeammate).toContainEqual(expect.objectContaining({ id: uploaded.id }));
  });

  it('PERMISSION PAIR — stranger does not see it: a user from a DIFFERENT organization is refused', async () => {
    const response = await request(app)
      .get(`/api/my-work/object-attachments/initiative/${initiativeId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(response.status, response.text).toBe(404);

    const uploadAttempt = await request(app)
      .post(`/api/my-work/object-attachments/initiative/${initiativeId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .attach('file', Buffer.from('forbidden'), 'forbidden.txt');
    expect(uploadAttempt.status, uploadAttempt.text).toBe(404);

    const rows = await queryAll(
      `SELECT id FROM object_attachments WHERE object_id = ? AND organization_id = ?`,
      [initiativeId, otherOrgId]
    );
    expect(rows).toEqual([]);
  });
});
