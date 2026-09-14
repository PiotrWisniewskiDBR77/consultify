import pg from 'pg';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
const {Pool}=pg;
const url=process.env.DATABASE_URL;
const secret=process.env.JWT_SECRET;
const pool=new Pool({connectionString:url});
const tag='iaa-ui-v4-20260913';
const ids={orgId:`${tag}-org`,managerId:`${tag}-manager`,respondentId:`${tag}-respondent`,superadminId:`${tag}-superadmin`,sessionId:`${tag}-session`,assignmentId:`${tag}-assignment`,q1:`${tag}-q1`,q2:`${tag}-q2`,submissionId:`${tag}-submission-1`};
try {
 await pool.query(`INSERT INTO organizations(id,name) VALUES($1,'Interview approval V4')`,[ids.orgId]);
 for (const [id,role,email] of [[ids.managerId,'ADMIN','manager-v4@example.invalid'],[ids.respondentId,'MEMBER','respondent-v4@example.invalid'],[ids.superadminId,'SUPERADMIN','superadmin-v4@example.invalid']]) {
  await pool.query(`INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,access_level,locale) VALUES($1,$2,$3,'local-fixture-not-login',$4,'Fixture',$5,'active','full','en')`,[id,ids.orgId,email,role==='ADMIN'?'Manager':role==='MEMBER'?'Respondent':'Superadmin',role]);
  await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES(gen_random_uuid(),$1,$2,$3,'ACTIVE')`,[ids.orgId,id,role==='SUPERADMIN'?'ADMIN':role]);
 }
 await pool.query(`INSERT INTO organization_ai_policy(organization_id,policy) VALUES($1,$2::jsonb)`,[ids.orgId,JSON.stringify({futureTop:{preserved:'yes'},interview:{answerApproval:{version:1,mode:'manager',futureModeKey:'keep-me'},futureInterviewKey:{preserved:42}},operating_mode:'standard'})]);
 await pool.query(`INSERT INTO interview_sessions(id,organization_id,name,owner_id,status,total_questions,answered_questions,assignment_id,runtime_mode_default) VALUES($1,$2,'September operating interview',$3,'in_progress',2,2,$4,'single_question')`,[ids.sessionId,ids.orgId,ids.managerId,ids.assignmentId]);
 await pool.query(`INSERT INTO interview_assignments(id,organization_id,assignee_user_id,created_by,template_id,template_version,status,session_id) VALUES($1,$2,$3,$4,'template-v4',1,'in_progress',$5)`,[ids.assignmentId,ids.orgId,ids.respondentId,ids.managerId,ids.sessionId]);
 for (const [id,text,answer,sort] of [[ids.q1,'What evidence confirms the current lead time?','Cycle time is 14 days in the September sample.',0],[ids.q2,'What should be corrected before approval?','The current result omits the validated source date.',1]]) await pool.query(`INSERT INTO interview_questions(id,session_id,organization_id,category,question_text,answer_text,status,is_required,answer_type,answer_mode,answer_payload,sort_order) VALUES($1,$2,$3,'strategy',$4,$5,'answered',1,'open','text',$6::jsonb,$7)`,[id,ids.sessionId,ids.orgId,text,answer,JSON.stringify({text:answer}),sort]);
 const token=(id,role)=>jwt.sign({id,userId:id,sub:id,organizationId:ids.orgId,role,email:`${role.toLowerCase()}-v4@example.invalid`},secret,{expiresIn:'2h'});
 const state={...ids,tokens:{manager:token(ids.managerId,'ADMIN'),respondent:token(ids.respondentId,'MEMBER'),superadmin:token(ids.superadminId,'SUPERADMIN')}};
 const res=await fetch(`http://127.0.0.1:4214/api/v8/interview/assignments/${ids.assignmentId}/submit`,{method:'POST',headers:{authorization:`Bearer ${state.tokens.respondent}`,'content-type':'application/json'},body:JSON.stringify({submissionId:ids.submissionId,clientRequestId:`${tag}-submit-1`})});
 const body=await res.json(); if(res.status!==200) throw new Error(`submit ${res.status} ${JSON.stringify(body)}`);
 fs.writeFileSync('/private/tmp/iaa-ui-v4-state.json',JSON.stringify(state,null,2),{mode:0o600});
 console.log(JSON.stringify({status:'PASS',ids,submitStatus:res.status,approvalCount:body?.data?.approvals?.length ?? body?.data?.decisions?.length ?? null},null,2));
} finally {await pool.end();}
