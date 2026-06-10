import dotenv from 'dotenv';
import { resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
dotenv.config({path:'.env'});dotenv.config({path:'.env.local'});
type Db={run:(s:string,p?:unknown[])=>Promise<unknown>;query:<T>(s:string,p?:unknown[])=>Promise<{rows?:T[]}>};
async function main(){
 const apply=process.env.FIX_APPLY==='YES';
 const t=resolveScriptDatabaseTarget({label:'restore',databaseUrl:process.env.DATABASE_URL,publicDatabaseUrl:process.env.DATABASE_PUBLIC_URL,requireExplicitTarget:true});
 process.env.DATABASE_URL=t.connectionString;
 const {getDatabaseAsync}=await import('../src/database/Database.js');
 const db=(await getDatabaseAsync()) as unknown as Db;
 const a=(await db.query<any>(`SELECT count(*)::int n FROM interview_insights WHERE organization_id='elkomtech' AND archived_at IS NOT NULL`)).rows?.[0]?.n;
 const b=(await db.query<any>(`SELECT count(*)::int n FROM initiatives WHERE organization_id='elkomtech' AND source_type='interview_insight_HIDDEN'`)).rows?.[0]?.n;
 console.log(`archived insights=${a}, hidden initiatives=${b}, apply=${apply}`);
 if(apply){
   await db.run(`UPDATE interview_insights SET archived_at=NULL, updated_at=$1 WHERE organization_id='elkomtech' AND archived_at IS NOT NULL`,[new Date().toISOString()]);
   await db.run(`UPDATE initiatives SET source_type='interview_insight', updated_at=$1 WHERE organization_id='elkomtech' AND source_type='interview_insight_HIDDEN'`,[new Date().toISOString()]);
   const a2=(await db.query<any>(`SELECT count(*)::int n FROM interview_insights WHERE organization_id='elkomtech' AND archived_at IS NULL`)).rows?.[0]?.n;
   const b2=(await db.query<any>(`SELECT count(*)::int n FROM initiatives WHERE organization_id='elkomtech' AND source_type='interview_insight'`)).rows?.[0]?.n;
   console.log(`AFTER: active insights=${a2}, visible interview initiatives=${b2}`);
 }
}
main().catch(e=>{console.error('Failed:',e.message||e);process.exit(1);});
