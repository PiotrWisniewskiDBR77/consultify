/** @vitest-environment node */
import net from 'node:net';
import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader.js';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';
import { runScheduledInitiativeWorkReport } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes.js';
vi.unmock('../../../server/src/services/emailService.js');
const emailServiceModule = await vi.importActual<
  typeof import('../../../server/src/services/emailService.js')
>('../../../server/src/services/emailService.js');
const setEmailDependencies = emailServiceModule.setDependencies;

const databaseUrl = process.env.TEST_DATABASE_URL;
const maybeDescribe = databaseUrl ? describe : describe.skip;

maybeDescribe(
  'scheduled work report — runner → EmailService → SMTP → PostgreSQL → dashboard',
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const organizationId = randomUUID();
    const definitionId = randomUUID();
    const initiativeId = randomUUID();
    const ownerId = randomUUID();
    const approverId = randomUUID();
    let smtp: net.Server;
    let smtpPort = 0;
    let transcript = '';
    const savedEnv = new Map<string, string | undefined>();
    const envKeys = [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_SECURE',
      'SMTP_FROM',
    ];

    beforeAll(async () => {
      for (const key of envKeys) savedEnv.set(key, process.env[key]);
      await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY, organization_id text NOT NULL, first_name text, last_name text, email text
      );
      CREATE TABLE IF NOT EXISTS ie_aggregate_state (
        organization_id text NOT NULL, aggregate_type text NOT NULL, aggregate_id text NOT NULL,
        version integer NOT NULL, payload_json jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (organization_id, aggregate_type, aggregate_id)
      );
      CREATE TABLE IF NOT EXISTS ie_command_receipts (
        organization_id text NOT NULL, client_request_id text NOT NULL, command_type text NOT NULL,
        aggregate_type text NOT NULL, aggregate_id text NOT NULL, aggregate_version integer NOT NULL,
        correlation_id text NOT NULL, request_fingerprint text NOT NULL, response_json jsonb NOT NULL,
        PRIMARY KEY (organization_id, client_request_id)
      );
      CREATE TABLE IF NOT EXISTS ie_audit_events (
        organization_id text NOT NULL, actor_id text NOT NULL, aggregate_type text NOT NULL,
        aggregate_id text NOT NULL, aggregate_version integer NOT NULL, command_type text NOT NULL,
        client_request_id text NOT NULL, correlation_id text NOT NULL, policy_id text NOT NULL,
        policy_version integer NOT NULL, payload_json jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ie_outbox_events (
        organization_id text NOT NULL, aggregate_type text NOT NULL, aggregate_id text NOT NULL,
        aggregate_version integer NOT NULL, event_type text NOT NULL, correlation_id text NOT NULL,
        causation_id text NOT NULL, payload_json jsonb NOT NULL
      );
    `);
      const definition = {
        definitionId,
        tenantId: organizationId,
        currentVersion: 1,
        versions: [
          {
            definitionVersion: 1,
            state: 'PUBLISHED',
            ownerId,
            approverId,
            name: 'Full-stack work report',
            purpose: 'SMTP and persistence proof',
            audience: ['board'],
            cadence: 'WEEKLY',
            scope: { type: 'organization', refs: [], projectIds: [], generalBacklogAllowed: true },
            outputSchema: {},
            sections: [{ sectionId: 'portfolio', title: 'Portfolio', mandatory: true }],
            sourceBindings: [
              {
                bindingId: 'initiatives',
                sourceType: 'initiative',
                required: true,
                scope: 'organization',
              },
            ],
            formulas: [],
            units: [],
            currencies: [],
            windows: [],
            access: { audienceRoles: ['admin'], classification: 'INTERNAL' },
            redaction: { rules: [], defaultState: 'FULL' },
            freshnessThresholdMinutes: 60,
            confidenceThreshold: 'HIGH',
            validationFindings: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            publishedBy: approverId,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await pool.query(
        `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES ($1,'report_definition',$2,1,$3::jsonb),
              ($1,'initiative',$4,4,$5::jsonb)`,
        [
          organizationId,
          definitionId,
          JSON.stringify(definition),
          initiativeId,
          JSON.stringify({
            title: 'PostgreSQL initiative',
            status: 'IN_EXECUTION',
            projectId: null,
            ownerId,
          }),
        ]
      );

      smtp = net.createServer((socket) => {
        socket.setEncoding('utf8');
        let input = '';
        let dataMode = false;
        socket.write('220 local.test ESMTP\r\n');
        socket.on('data', (chunk) => {
          transcript += chunk;
          input += chunk;
          if (dataMode) {
            const end = input.indexOf('\r\n.\r\n');
            if (end >= 0) {
              input = input.slice(end + 5);
              dataMode = false;
              socket.write('250 2.0.0 queued\r\n');
            }
            return;
          }
          for (;;) {
            const lineEnd = input.indexOf('\r\n');
            if (lineEnd < 0) break;
            const line = input.slice(0, lineEnd);
            input = input.slice(lineEnd + 2);
            if (/^EHLO/i.test(line))
              socket.write('250-local.test\r\n250-AUTH PLAIN\r\n250 SIZE 10485760\r\n');
            else if (/^AUTH PLAIN/i.test(line)) socket.write('235 2.7.0 authenticated\r\n');
            else if (/^(MAIL FROM|RCPT TO)/i.test(line)) socket.write('250 2.1.0 ok\r\n');
            else if (/^DATA/i.test(line)) {
              dataMode = true;
              socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
            } else if (/^QUIT/i.test(line)) socket.end('221 2.0.0 bye\r\n');
            else socket.write('250 ok\r\n');
          }
        });
      });
      await new Promise<void>((resolve) => smtp.listen(0, '127.0.0.1', resolve));
      smtpPort = (smtp.address() as net.AddressInfo).port;
      process.env.SMTP_HOST = '127.0.0.1';
      process.env.SMTP_PORT = String(smtpPort);
      process.env.SMTP_USER = 'sender@example.test';
      process.env.SMTP_PASS = 'secret';
      process.env.SMTP_SECURE = 'false';
      process.env.SMTP_FROM = 'sender@example.test';
      setEmailDependencies({
        db: {
          all: (_sql: string, _params: unknown[], callback: Function) => callback(null, []),
        } as never,
        nodemailer: { createTransport: nodemailer.createTransport.bind(nodemailer) },
        config: {},
      });
    });

    afterAll(async () => {
      await pool.query('DELETE FROM ie_command_receipts WHERE organization_id=$1', [
        organizationId,
      ]);
      await pool.query('DELETE FROM ie_audit_events WHERE organization_id=$1', [organizationId]);
      await pool.query('DELETE FROM ie_outbox_events WHERE organization_id=$1', [organizationId]);
      await pool.query('DELETE FROM ie_aggregate_state WHERE organization_id=$1', [organizationId]);
      await pool.end();
      await new Promise<void>((resolve, reject) =>
        smtp.close((error) => (error ? reject(error) : resolve()))
      );
      for (const key of envKeys) {
        const value = savedEnv.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it('publishes only after real SMTP acceptance and exposes the durable result in dashboard readback', async () => {
      expect(vi.isMockFunction(emailServiceModule.send)).toBe(false);
      const reader = new PostgresInitiativeReader(pool);
      const unitOfWork = new PostgresMaterialCommandUnitOfWork(pool);
      const reportRunId = await runScheduledInitiativeWorkReport(
        {
          id: 'full-stack-schedule',
          organizationId,
          runtimeReport: {
            definitionId,
            definitionVersion: 1,
            templateId: 'EXECUTIVE_SUMMARY',
            title: 'Full-stack work report',
            projectIds: [],
            ownerId,
            approverId,
            recipients: ['dashboard@example.test'],
            cadence: 'WEEKLY',
          },
        },
        { unitOfWork, reader, sendEmail: (options) => emailServiceModule.send(options) }
      );

      const dashboard = await reader.listReportRuns(organizationId);
      expect(dashboard).toEqual([
        expect.objectContaining({
          reportRunId,
          status: 'PUBLISHED',
          distributionReceipts: [
            expect.objectContaining({ receiptId: `scheduled-delivery-${reportRunId}` }),
          ],
          deliveryAttempts: [
            expect.objectContaining({
              recipients: [
                expect.objectContaining({ address: 'dashboard@example.test', status: 'DELIVERED' }),
              ],
            }),
          ],
        }),
      ]);
      const persisted = await pool.query(
        `SELECT payload_json, version FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='report_run' AND aggregate_id=$2`,
        [organizationId, reportRunId]
      );
      expect(persisted.rows[0].payload_json.status).toBe('PUBLISHED');
      expect(persisted.rows[0].payload_json.exportPackage.contentHash).toMatch(/^[0-9a-f]{64}$/);
      const events = await pool.query(
        `SELECT event_type FROM ie_outbox_events WHERE organization_id=$1 AND aggregate_id=$2 ORDER BY aggregate_version`,
        [organizationId, reportRunId]
      );
      expect(events.rows.map((row) => row.event_type)).toContain('report-run.publish');
      expect(transcript).toContain('dashboard@example.test');
      expect(transcript).toContain('Content-Type: application/pdf');
      expect(transcript).toContain('filename=work-report-');
      expect(transcript).toContain('JVBERi');
    });
  }
);
