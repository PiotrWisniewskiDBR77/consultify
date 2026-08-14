import crypto from 'node:crypto';

export const ACCEPTANCE_NAMESPACE = 'consultify-demo-acceptance-v1';

export type FixtureContext = { organizationId: string; userId: string };
export type FixtureStatement = { domain: string; sql: string; params: unknown[]; verifySql: string; verifyParams: unknown[] };

export const FINANCE_ACCEPTANCE_FLAG_KEYS = [
  'financeWorkspacePlatformV1',
  'financeLineageNavigatorV1',
  'financeAnalysisWorkspaceV1',
  'financePredictionWorkspaceV1',
  'financeCompareV1',
  'financeStatementPackWorkspaceV2',
  'financeCommentsV1',
  'financeValuationWorkspaceV1',
  'financeSavedViewsV1',
  'financeExportImportV1',
  'financeBaselineWorkspaceV1',
] as const;

export function stableTextId(ctx: FixtureContext, entity: string): string {
  return `${ctx.organizationId}--acceptance--${entity}`;
}

export function stableUuid(ctx: FixtureContext, entity: string): string {
  const hex = crypto.createHash('sha256').update(`${ACCEPTANCE_NAMESPACE}:${ctx.organizationId}:${entity}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function row(domain: string, sql: string, params: unknown[], table: string, key: string, id: string, organizationId: string): FixtureStatement {
  return { domain, sql, params, verifySql: `SELECT count(*)::int AS count FROM ${table} WHERE ${key} = $1 AND organization_id = $2`, verifyParams: [id, organizationId] };
}

/** Root records only. They make every acceptance surface non-empty while normal UI/API flows create children. */
export function buildFixturePlan(ctx: FixtureContext): FixtureStatement[] {
  const project = stableTextId(ctx, 'case-project');
  const initiative = stableTextId(ctx, 'initiative');
  const caseId = stableTextId(ctx, 'case');
  const kpi = stableUuid(ctx, 'kpi');
  const roi = stableUuid(ctx, 'roi');
  const okr = stableUuid(ctx, 'okr-program');
  const finance = stableTextId(ctx, 'finance-model');
  const deck = stableTextId(ctx, 'artifact-presentation');
  const idea = stableTextId(ctx, 'idea');
  const presentationSource = { source_type:'acceptance_fixture', source_id:initiative, label:'Zweryfikowany plan realizacji korzyści', captured_at:'2026-08-13T00:00:00.000Z' };
  const financeAssumptions = {
    acceptanceFixture: ACCEPTANCE_NAMESPACE,
    initialCash: 200000,
    initialEquity: 600000,
    initialDebt: 300000,
    initialPPE: 550000,
    initialAR: 150000,
    initialInventory: 100000,
    initialAP: 100000,
    baseline: { revenue:1200000, cogs:720000, opex:240000, depreciation:60000, interest:24000, tax:37440, capex:120000 },
    seedStatus: { mode:'acceptance_fixture', missingBaselineLines:[] },
  };
  const presentationSlides = [
    { intent:'cover', key_message:'Decyzja o przyspieszeniu realizacji korzyści', source_refs:[presentationSource], content:{ type:'cover', title:'Realizacja korzyści transformacji', subtitle:'Materiał dla komitetu sterującego' } },
    { intent:'performance_overview', key_message:'Zweryfikowana realizacja wynosi 76% wobec celu 90%', source_refs:[presentationSource], content:{ type:'performance_overview', kpis:[{label:'Realizacja',value:'76%'},{label:'Cel',value:'90%'},{label:'Jakość danych',value:'Zweryfikowana'}], context:'Największa luka dotyczy adopcji nowego sposobu pracy.' } },
    { intent:'executive_summary', key_message:'Program ma dodatnią wartość i wymaga kontrolowanego planu naprawczego', source_refs:[presentationSource], content:{ type:'executive_summary', key_findings:['NPV: 612 tys. PLN','IRR: 31,4%','Okres zwrotu: 7,8 miesiąca'], recommendation:'Kontynuować program z miesięcznym przeglądem KPI i niezależnym potwierdzeniem finansowym.' } },
    { intent:'roadmap', key_message:'Trzy kroki prowadzą od zweryfikowanej bazy do utrwalonego rezultatu', source_refs:[presentationSource], content:{ type:'roadmap', context:'Każdy etap ma właściciela, termin i mierzalny warunek przejścia.', phases:[{title:'Zweryfikować bazę',timing:'Sierpień',owner:'Piotr Wiśniewski'},{title:'Zamknąć lukę realizacji',timing:'Wrzesień',owner:'Właściciele inicjatyw'},{title:'Potwierdzić korzyści',timing:'Październik',owner:'Finance + Results'}] } },
    { intent:'risk_management', key_message:'Ryzyko adopcji jest jawne i ma przypisaną kontrolę', source_refs:[presentationSource], content:{ type:'risk_management', context:'Kontrole koncentrują się na adopcji i spójności danych finansowych.', risks:[{risk:'Adopcja poniżej planu',likelihood:'Średnie',impact:'Wysoki',mitigation:'Miesięczny pomiar, właściciel i plan naprawczy'},{risk:'Niespójne dane korzyści',likelihood:'Niskie',impact:'Wysoki',mitigation:'Niezależne uzgodnienie Finance i KPI'}] } },
    { intent:'next_steps', key_message:'Komitet powinien zatwierdzić kontrolowany plan realizacji', source_refs:[presentationSource], content:{ type:'next_steps', actions:[{action:'Zatwierdzić plan naprawczy',owner:'Komitet sterujący',deadline:'14 sierpnia 2026'},{action:'Uruchomić miesięczny przegląd',owner:'Piotr Wiśniewski',deadline:'31 sierpnia 2026'}], closing_message:'Decyzja uruchamia realizację; nie wysyła komunikacji zewnętrznej.' } },
  ];
  const financeFlags: FixtureStatement[] = FINANCE_ACCEPTANCE_FLAG_KEYS.map(flagKey => ({
    domain: `finance-flag:${flagKey}`,
    sql: `INSERT INTO feature_flags
      (id,flag_key,name,description,enabled,rules,flag_type,targeting_rules,rollout_percentage,environment,organization_id,variants,created_by,created_at,updated_at)
      VALUES ($1,$2,$2,$3,true,'[]','boolean','[]',100,'production',$4,'[]',$5,now(),now())
      ON CONFLICT (flag_key) DO UPDATE SET
        enabled=true, environment='production', rollout_percentage=100,
        name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now()
      WHERE feature_flags.organization_id = EXCLUDED.organization_id`,
    params: [stableTextId(ctx, `finance-flag-${flagKey}`), flagKey, ACCEPTANCE_NAMESPACE, ctx.organizationId, ctx.userId],
    verifySql: `SELECT count(*)::int AS count FROM feature_flags
      WHERE flag_key=$1 AND organization_id=$2 AND environment='production' AND enabled=true`,
    verifyParams: [flagKey, ctx.organizationId],
  }));
  return [
    row('case', `INSERT INTO projects (id, organization_id, name, description, status) VALUES ($1,$2,$3,$4,'active') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description`, [project,ctx.organizationId,'Program poprawy realizacji korzyści','Osiągnąć co najmniej 90% zweryfikowanej realizacji korzyści w ciągu 90 dni.'], 'projects','id',project,ctx.organizationId),
    row('case', `INSERT INTO case_core (case_id,project_id,organization_id,case_name,case_profile,governance_tier,case_status,contracted_closure_type,delivery_status,decision_status,implementation_status,outcome_status,sponsor_user_id,acceptance_criteria_ref,created_by_actor_id) VALUES ($1,$2,$3,$4,'TRANSFORMATION','CONTROLLED','ACTIVE','OUTCOME_VALIDATED','PENDING','PENDING','PENDING','PENDING',$5,$6,$5) ON CONFLICT (case_id) DO UPDATE SET case_name=EXCLUDED.case_name,case_status='ACTIVE' WHERE case_core.organization_id=EXCLUDED.organization_id`, [caseId,project,ctx.organizationId,'Program poprawy realizacji korzyści',ctx.userId,`${ACCEPTANCE_NAMESPACE}:case`], 'case_core','case_id',caseId,ctx.organizationId),
    row('shared', `INSERT INTO initiatives (id,organization_id,name,status) VALUES ($1,$2,$3,'EXECUTING') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`, [initiative,ctx.organizationId,'Poprawa realizacji korzyści programu'], 'initiatives','id',initiative,ctx.organizationId),
    row('kpi', `INSERT INTO rvn_kpi_definitions (kpi_id,organization_id,kpi_code,status,owner_user_id,created_by) VALUES ($1,$2,'Realizacja zweryfikowanych korzyści','draft',$3,$3) ON CONFLICT (kpi_id) DO UPDATE SET kpi_code=EXCLUDED.kpi_code WHERE rvn_kpi_definitions.organization_id=EXCLUDED.organization_id`, [kpi,ctx.organizationId,ctx.userId], 'rvn_kpi_definitions','kpi_id',kpi,ctx.organizationId),
    row('roi', `INSERT INTO rvn_roi_cases (case_id,organization_id,initiative_id,title,owner_user_id,status,currency,analysis_start,analysis_end,created_by) VALUES ($1,$2,$3,$4,$5,'draft','PLN',CURRENT_DATE,CURRENT_DATE + 365,$5) ON CONFLICT (case_id) DO UPDATE SET title=EXCLUDED.title WHERE rvn_roi_cases.organization_id=EXCLUDED.organization_id`, [roi,ctx.organizationId,initiative,'Program poprawy realizacji korzyści',ctx.userId], 'rvn_roi_cases','case_id',roi,ctx.organizationId),
    row('okr', `INSERT INTO okr_vnext_programs (program_id,organization_id,name,status,created_by) VALUES ($1,$2,$3,'draft',$4) ON CONFLICT (program_id) DO UPDATE SET name=EXCLUDED.name WHERE okr_vnext_programs.organization_id=EXCLUDED.organization_id`, [okr,ctx.organizationId,'Rezultaty transformacji 2026',ctx.userId], 'okr_vnext_programs','program_id',okr,ctx.organizationId),
    row('finance', `INSERT INTO financial_models (id,organization_id,initiative_id,name,description,start_date,status,assumptions_json,created_by) VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,'draft',$6,$7) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,assumptions_json=EXCLUDED.assumptions_json`, [finance,ctx.organizationId,initiative,'Zintegrowany model transformacji','Model finansowy programu poprawy realizacji korzyści.',JSON.stringify(financeAssumptions),ctx.userId], 'financial_models','id',finance,ctx.organizationId),
    row('artifact', `INSERT INTO presentation_decks (id,organization_id,project_id,title,description,status,generated_by,slide_count,outline_json,unified_json,deck_json) VALUES ($1,$2,$3,$4,$5,'ready',$6,6,$7,$8,NULL) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,status='ready',slide_count=6,outline_json=EXCLUDED.outline_json,unified_json=EXCLUDED.unified_json,deck_json=NULL`, [deck,ctx.organizationId,project,'Przegląd korzyści transformacji','Materiał decyzyjny dla komitetu sterującego.',ctx.userId,JSON.stringify(presentationSlides.map(slide=>({title:slide.key_message}))),JSON.stringify({meta:{project:'Program poprawy realizacji korzyści',client:'Komitet sterujący',template:'corporate',language:'pl',confidentiality:'internal'},slides:presentationSlides,marker:ACCEPTANCE_NAMESPACE})], 'presentation_decks','id',deck,ctx.organizationId),
    row('ideas', `INSERT INTO my_ideas (id,user_id,organization_id,title,body,tags,source_type) VALUES ($1,$2,$3,$4,$5,$6,'acceptance_fixture') ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body,tags=EXCLUDED.tags`, [idea,ctx.userId,ctx.organizationId,'Automatyczne monitorowanie realizacji korzyści','Pomysł na połączenie KPI, sygnałów wykonania i miesięcznego przeglądu zarządczego.',JSON.stringify(['benefits','automation','decision-log','financial-case','business-case'])], 'my_ideas','id',idea,ctx.organizationId),
    ...financeFlags,
  ];
}
