#!/usr/bin/env npx tsx
import { Client } from 'pg';

const REQUIRED_DATABASE = 'cx_day55';
const REQUIRED_CONFIRMATION = '--confirm-db=cx_day55';

export function validateTarget(argv: string[], env: NodeJS.ProcessEnv): URL {
  const raw = env.DATABASE_URL?.trim();
  if (!raw) throw new Error('odmowa: brak DATABASE_URL');
  const url = new URL(raw);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('odmowa: seed Ustawień działa wyłącznie na lokalnym hoście');
  }
  if (url.pathname.slice(1) !== REQUIRED_DATABASE) {
    throw new Error(`odmowa: wymagana baza ${REQUIRED_DATABASE}`);
  }
  if (!argv.includes(REQUIRED_CONFIRMATION)) {
    throw new Error(`odmowa: wymagane jawne ${REQUIRED_CONFIRMATION}`);
  }
  return url;
}

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`odmowa: brak ${prefix}<wartosc>`);
  return value;
}

async function main() {
  const databaseUrl = validateTarget(process.argv.slice(2), process.env);
  const userId = argument('user-id');
  const organizationId = argument('organization-id');
  const client = new Client({ connectionString: databaseUrl.toString() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const identity = await client.query(
      `SELECT 1 FROM users WHERE id=$1 AND organization_id=$2`,
      [userId, organizationId]
    );
    if (identity.rowCount !== 1) throw new Error('odmowa: użytkownik nie należy do organizacji');

    const preferences: Array<[string, unknown]> = [
      ['settings:language', { language: 'pl' }],
      [
        'settings:regional',
        {
          timezone: 'Europe/Warsaw',
          currency: 'PLN',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '24h',
          units: 'metric',
        },
      ],
      ['settings:notification-digest', { frequency: 'weekly', content: 'summary', format: 'html' }],
    ];
    for (const [key, value] of preferences) {
      await client.query(
        `INSERT INTO user_preferences (user_id,key,value,updated_at)
         VALUES ($1,$2,$3,now()::text)
         ON CONFLICT (user_id,key) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at`,
        [userId, key, JSON.stringify(value)]
      );
    }
    await client.query(
      `INSERT INTO notification_settings (user_id,settings,updated_at)
       VALUES ($1,$2,CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=EXCLUDED.updated_at`,
      [userId, JSON.stringify({ digest: 'weekly', email: true, inApp: true })]
    );
    await client.query(
      `INSERT INTO email_signatures (id,user_id,name,content,is_default,created_at,updated_at)
       VALUES ('settings-day55-demo-signature',$1,'Podpis główny','Pozdrawiam,<br>Piotr',1,now()::text,now()::text)
       ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id,name=EXCLUDED.name,
         content=EXCLUDED.content,is_default=EXCLUDED.is_default,updated_at=EXCLUDED.updated_at`,
      [userId]
    );
    await client.query(
      `INSERT INTO gdpr_requests
         (id,organization_id,user_id,type,status,metadata,created_at,updated_at)
       VALUES ('settings-day55-demo-export',$1,$2,'export','pending',$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id,user_id=EXCLUDED.user_id,
         type=EXCLUDED.type,status=EXCLUDED.status,metadata=EXCLUDED.metadata,updated_at=EXCLUDED.updated_at`,
      [organizationId, userId, JSON.stringify({ format: 'json', source: 'settings-demo-day55' })]
    );
    await client.query('COMMIT');
    console.log(`OK: ustawienia demo zapisane dla ${userId} w ${REQUIRED_DATABASE}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
