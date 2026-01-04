import db from './database.js';

const isPg = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
const query = isPg
    ? "SELECT column_name as name, data_type as type, is_nullable as notnull, column_default as dflt_value, (CASE WHEN column_name IN (SELECT column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_name = 'sessions' AND tc.constraint_type = 'PRIMARY KEY') THEN 1 ELSE 0 END) as pk FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' ORDER BY ordinal_position"
    : "PRAGMA table_info(sessions)";

console.log(`Inspecting sessions table schema (${isPg ? 'PostgreSQL' : 'SQLite'})...`);
db.all(query, [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(rows);
    }
    if (db.close) db.close();
});
