import dotenv from 'dotenv';
import { resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
dotenv.config({path:'.env'});dotenv.config({path:'.env.local'});
type Db={query:<T>(s:string,p?:unknown[])=>Promise<{rows?:T[]}>};
async function main(){
 const t=resolveScriptDatabaseTarget({label:'scan',databaseUrl:process.env.DATABASE_URL,publicDatabaseUrl:process.env.DATABASE_PUBLIC_URL,requireExplicitTarget:true});
 process.env.DATABASE_URL=t.connectionString;
 const {getDatabaseAsync}=await import('../src/database/Database.js');
 const db=(await getDatabaseAsync()) as unknown as Db;
 console.log('\nINSIGHTS archived vs active per org:');
 console.table((await db.query<any>(`SELECT organization_id, count(*) FILTER (WHERE archived_at IS NULL)::int active, count(*) FILTER (WHERE archived_at IS NOT NULL)::int archived FROM interview_insights GROUP BY organization_id ORDER BY archived DESC`)).rows);
 console.log('\nINSIGHTS archived_at timestamps (bulk-hide detection):');
 console.table((await db.query<any>(`SELECT organization_id, archived_at, count(*)::int n FROM interview_insights WHERE archived_at IS NOT NULL GROUP BY organization_id, archived_at ORDER BY n DESC`)).rows);
 console.log('\nINITIATIVES source_type values (per org, _HIDDEN detection):');
 console.table((await db.query<any>(`SELECT organization_id, source_type, count(*)::int n FROM initiatives WHERE source_type ILIKE '%hidden%' OR source_type ILIKE 'interview%' GROUP BY organization_id, source_type ORDER BY organization_id`)).rows);
 console.log('\nANY _HIDDEN source_type anywhere:');
 console.table((await db.query<any>(`SELECT organization_id, source_type, count(*)::int n FROM initiatives WHERE source_type ILIKE '%hidden%' GROUP BY organization_id, source_type`)).rows);
}
main().catch(e=>{console.error('Failed:',e.message||e);process.exit(1);});
