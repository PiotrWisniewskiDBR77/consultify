import dotenv from 'dotenv';
import { resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
dotenv.config({path:'.env'});dotenv.config({path:'.env.local'});
type Db={query:<T>(s:string,p?:unknown[])=>Promise<{rows?:T[]}>};
async function main(){
 const t=resolveScriptDatabaseTarget({label:'d2',databaseUrl:process.env.DATABASE_URL,publicDatabaseUrl:process.env.DATABASE_PUBLIC_URL,requireExplicitTarget:true});
 process.env.DATABASE_URL=t.connectionString;
 const {getDatabaseAsync}=await import('../src/database/Database.js');
 const db=(await getDatabaseAsync()) as unknown as Db;
 const uid='7f8ef469-f326-4527-890e-b2ecc7f224cf';
 console.log('elkomtech initiatives status/source/project:');
 console.table((await db.query<any>(`SELECT status, source_type, project_id, count(*)::int n FROM initiatives WHERE organization_id='elkomtech' GROUP BY status,source_type,project_id`)).rows);
 console.log('projects in elkomtech org:');
 console.table((await db.query<any>(`SELECT id, name FROM projects WHERE organization_id='elkomtech'`)).rows);
 console.log('Piotr project_members in elkomtech projects:');
 console.table((await db.query<any>(`SELECT pm.project_id, pm.role FROM project_members pm JOIN projects p ON p.id=pm.project_id WHERE p.organization_id='elkomtech' AND pm.user_id=$1`,[uid])).rows);
 console.log('insights archived count:');
 console.table((await db.query<any>(`SELECT count(*) FILTER (WHERE archived_at IS NULL)::int active, count(*) FILTER (WHERE archived_at IS NOT NULL)::int archived FROM interview_insights WHERE organization_id='elkomtech'`)).rows);
}
main().catch(e=>{console.error('Failed:',e.message||e);process.exit(1);});
