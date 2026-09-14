import pg from "pg";
const { Client } = pg;
const c = new Client({ connectionString: (process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL), ssl: false });
await c.connect();
await c.query("BEGIN READ ONLY");
const r = await c.query(`SELECT table_schema, table_name, column_name, ordinal_position, data_type, udt_name, column_default, is_nullable, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
await c.query("ROLLBACK");
await c.end();
process.stdout.write(JSON.stringify(r.rows));
