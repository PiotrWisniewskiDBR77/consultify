
[1m[46m RUN [49m[22m [36mv4.0.16 [39m[90m/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server[39m

Sourcemap for "/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/node-cron/dist/esm/node-cron.js" points to missing source files
[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[Database:DEBUG] MOCK_DB: [90mundefined[39m NODE_ENV: test shouldMock: [33mtrue[39m

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[DB:z33gl] Initializing database at :memory:
[DB:z33gl] Connected to the SQLite database.
[DB:z33gl] WAL mode, Busy Timeout (10s), and Synchronous=NORMAL enabled.
Created billing tables and seeded default subscription plans.
Created professional billing system enhancement tables.
Enterprise Customers Module tables created.
Advanced IAM, Security, Analytics, Customer Management, and Revenue Management tables created.
Seeded SuperAdmin and DBR77 Users.

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39mProjects table created successfully (or already exists).

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[InternalMockDB] run called {
  sql: [32m'\n'[39m +
    [32m'                CREATE TABLE IF NOT EXISTS ai_drafts (\n'[39m +
    [32m'                    id TEXT PRIMARY KEY,\n'[39m +
    [32m'                    organization_id TEXT NOT NULL,\n'[39m +
    [32m'                    project_id TEXT,\n'[39m +
    [32m'                    user_id TEXT NOT NULL,\n'[39m +
    [32m'                    draft_type TEXT NOT NULL,\n'[39m +
    [32m'                    target_entity_type TEXT,\n'[39m +
    [32m'                    target_entity_id TEXT,\n'[39m +
    [32m'                    target_field TEXT,\n'[39m +
    [32m'                    original_content TEXT,\n'[39m +
    [32m'                    suggested_content TEXT NOT NULL,\n'[39m +
    [32m'                    diff_data TEXT,\n'[39m +
    [32m'                    confidence_score REAL DEFAULT 0.8,\n'[39m +
    [32m'                    reasoning TEXT,\n'[39m +
    [32m"                    status TEXT DEFAULT 'PENDING',\n"[39m +
    [32m'                    reviewed_by TEXT,\n'[39m +
    [32m'                    reviewed_at TEXT,\n'[39m +
    [32m'                    review_notes TEXT,\n'[39m +
    [32m'                    model_used TEXT,\n'[39m +
    [32m'                    prompt_id TEXT,\n'[39m +
    [32m'                    tokens_used INTEGER,\n'[39m +
    [32m'                    expires_at TEXT,\n'[39m +
    [32m"                    created_at TEXT DEFAULT (datetime('now'))\n"[39m +
    [32m'                )\n'[39m +
    [32m'            '[39m
}

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39mDatabase initialization complete.

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[Redis] Initializing client...
[Redis] Using Mock Client

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[Database:DEBUG] MOCK_DB: [90mundefined[39m NODE_ENV: test shouldMock: [33mtrue[39m

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[Database:DEBUG] MOCK_DB: [90mundefined[39m NODE_ENV: test shouldMock: [33mtrue[39m

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[WhatsappService] Disabled - Missing credentials in .env

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[2026-01-04T16:40:54.776Z] [INFO] [AI:[Queue] Using Mock Queue for ai-tasks] undefined

[90mstderr[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[Knowledge] NotificationOutboxService not available

[90mstderr[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[STT] Failed to initialize OpenAI: OpenAI is not defined

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[OAuth] Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)
[OAuth] LinkedIn OAuth not configured (missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET)
[OAuth] Microsoft OAuth not configured (missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET)

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[2026-01-04T16:40:55.733Z] [INFO] [AI:CircuitBreaker] LLM circuit breakers initialized

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[InternalMockDB] run called {
  sql: [32m'\n'[39m +
    [32m'                CREATE TABLE IF NOT EXISTS project_memory (\n'[39m +
    [32m'                    id TEXT PRIMARY KEY,\n'[39m +
    [32m'                    project_id TEXT NOT NULL,\n'[39m +
    [32m'                    memory_type TEXT NOT NULL,\n'[39m +
    [32m'                    content TEXT NOT NULL,\n'[39m +
    [32m'                    title TEXT,\n'[39m +
    [32m'                    importance INTEGER DEFAULT 1,\n'[39m +
    [32m'                    recorded_by TEXT,\n'[39m +
    [32m'                    tags TEXT,\n'[39m +
    [32m'                    related_entity_type TEXT,\n'[39m +
    [32m'                    related_entity_id TEXT,\n'[39m +
    [32m"                    created_at TEXT DEFAULT (datetime('now')),\n"[39m +
    [32m"                    updated_at TEXT DEFAULT (datetime('now'))\n"[39m +
    [32m'                )\n'[39m +
    [32m'            '[39m
}

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[InternalMockDB] run called {
  sql: [32m'\n'[39m +
    [32m'                CREATE TABLE IF NOT EXISTS organization_memory (\n'[39m +
    [32m'                    id TEXT PRIMARY KEY,\n'[39m +
    [32m'                    organization_id TEXT NOT NULL,\n'[39m +
    [32m'                    memory_type TEXT NOT NULL,\n'[39m +
    [32m'                    title TEXT NOT NULL,\n'[39m +
    [32m'                    description TEXT NOT NULL,\n'[39m +
    [32m'                    content TEXT NOT NULL,\n'[39m +
    [32m'                    embedding TEXT,\n'[39m +
    [32m'                    source_project_id TEXT,\n'[39m +
    [32m'                    source_assessment_id TEXT,\n'[39m +
    [32m'                    applicability_score REAL DEFAULT 1.0,\n'[39m +
    [32m'                    usage_count INTEGER DEFAULT 0,\n'[39m +
    [32m'                    last_used_at TEXT,\n'[39m +
    [32m'                    tags TEXT,\n'[39m +
    [32m'                    industry TEXT,\n'[39m +
    [32m'                    company_size TEXT,\n'[39m +
    [32m'                    is_active INTEGER DEFAULT 1,\n'[39m +
    [32m'                    created_by TEXT,\n'[39m +
    [32m"                    created_at TEXT DEFAULT (datetime('now')),\n"[39m +
    [32m"                    updated_at TEXT DEFAULT (datetime('now'))\n"[39m +
    [32m'                )\n'[39m +
    [32m'            '[39m
}

[90mstderr[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[TTS] Failed to initialize OpenAI: Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[Sentry] Disabled (no SENTRY_DSN or not in production/staging)
2026-01-04T16:40:56.333Z [32minfo[39m: [Server] Initializing database... 
2026-01-04T16:40:56.334Z [32minfo[39m: [ApiGateway] Initializing gateway routes... 
2026-01-04T16:40:56.336Z [31merror[39m: [ApiGateway] Error loading routes: {"error":"chaosRoutes is not defined","stack":"ReferenceError: chaosRoutes is not defined\n    at ApiGateway.initializeRoutes (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/Gateway.ts:389:39)\n    at /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/index.ts:452:12\n    at processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at VitestModuleEvaluator._runInlinedModule (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vitest/dist/module-evaluator.js:197:4)\n    at VitestModuleRunner.directRequest (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vite/dist/node/module-runner.js:1284:61)\n    at VitestModuleRunner.cachedRequest (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vite/dist/node/module-runner.js:1180:76)\n    at /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/tests/integration/managementReports.integration.test.ts:9:1\n    at VitestModuleEvaluator._runInlinedModule (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vitest/dist/module-evaluator.js:197:4)\n    at VitestModuleRunner.directRequest (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vite/dist/node/module-runner.js:1284:61)\n    at VitestModuleRunner.cachedRequest (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vite/dist/node/module-runner.js:1180:76)\n    at VitestModuleRunner.import (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vite/dist/node/module-runner.js:1117:12)\n    at file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/@vitest/runner/dist/index.js:1385:5\n    at collectTests (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/@vitest/runner/dist/index.js:1365:3)\n    at startTests (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/@vitest/runner/dist/index.js:1937:17)\n    at file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vitest/dist/chunks/base.Bin-9uYm.js:86:26\n    at run (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vitest/dist/chunks/base.Bin-9uYm.js:79:2)\n    at runBaseTests (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vitest/dist/chunks/base.Bin-9uYm.js:161:2)\n    at executeTests (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vitest/dist/chunks/init-forks.v9UONQS6.js:29:4)\n    at execute (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vitest/dist/chunks/init.KmQZdqFg.js:104:3)\n    at process.onMessage (file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/vitest/dist/chunks/init.KmQZdqFg.js:233:14)","name":"ReferenceError"}
[Server] Database instance created: OK

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m2026-01-04T16:40:56.339Z [32minfo[39m: [DatabaseInitializer] Starting database initialization... 

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m2026-01-04T16:40:56.340Z [32minfo[39m: [DatabaseInitializer] Database type: sqlite 

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m2026-01-04T16:40:56.340Z [33mwarn[39m: [DatabaseInitializer] SQLite schema incomplete. Missing tables: organizations, users, sessions, projects, tasks, teams, invitations, notifications, settings 
2026-01-04T16:40:56.340Z [32minfo[39m: [DatabaseInitializer] SQLite schema should be initialized by database.sqlite.active.js 

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[InternalMockDB] run called {
  sql: [32m'INSERT OR REPLACE INTO organizations (id, name) VALUES (?, ?)'[39m
}
[InternalMockDB] run called {
  sql: [32m'INSERT OR REPLACE INTO users (id, email, first_name, last_name, organization_id, role) VALUES (?, ?, ?, ?, ?, ?)'[39m
}
[InternalMockDB] run called {
  sql: [32m'INSERT OR REPLACE INTO projects (id, name, organization_id, status) VALUES (?, ?, ?, ?)'[39m
}

[90mstdout[2m | tests/integration/managementReports.integration.test.ts[2m > [22m[2mManagement Reports API[2m > [22m[2mPOST /api/management-reports/generate[2m > [22m[2mshould generate a team meeting report for a project
[22m[39m2026-01-04T16:40:56.356Z [37mdebug[39m: [174f357c-b5d8-44f3-ac1b-569819521870] Incoming POST /api/management-reports/generate 
[Index] Pre-Gateway: /api/management-reports/generate

[90mstderr[2m | tests/integration/managementReports.integration.test.ts[2m > [22m[2mManagement Reports API[2m > [22m[2mPOST /api/management-reports/generate[2m > [22m[2mshould generate a team meeting report for a project
[22m[39m[InputSanitization] Error sanitizing request: TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
    at inputSanitizationMiddleware [90m(/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/[39msrc/middleware/inputSanitization.middleware.ts:127:17[90m)[39m
    at Layer.handleRequest (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/lib/layer.js:152:17)
    at trimPrefix (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:342:13)
    at /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:297:9
    at processParams (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:582:12)
    at next (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:291:5)
    at [90m/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/[39msrc/utils/RequestStore.ts:44:9
[90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_context_frame:63:14)[39m
    at correlationMiddleware [90m(/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/[39msrc/utils/RequestStore.ts:40:13[90m)[39m
    at Layer.handleRequest (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/lib/layer.js:152:17)
    at trimPrefix (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:342:13)
    at /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:297:9
    at processParams (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:582:12)
    at next (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:291:5)
    at cookieParser [90m(/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/[39mnode_modules/[4mcookie-parser[24m/index.js:57:14[90m)[39m
    at Layer.handleRequest (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/lib/layer.js:152:17)
    at trimPrefix (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:342:13)
    at /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:297:9
    at processParams (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:582:12)
    at next (/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mrouter[24m/index.js:291:5)
    at /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules/[4mbody-parser[24m/lib/read.js:172:5
[90m    at AsyncResource.runInAsyncScope (node:async_hooks:214:14)[39m

[90mstderr[2m | tests/integration/managementReports.integration.test.ts[2m > [22m[2mManagement Reports API[2m > [22m[2mPOST /api/management-reports/generate[2m > [22m[2mshould generate a team meeting report for a project
[22m[39m[ManagementReports] Generate error: Error: Project not found
    at Object.generateTeamMeetingReport [90m(/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/[39mservices/managementReportsService.js:64:19[90m)[39m
    at [90m/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/[39mroutes/managementReports.js:156:26

[90mstdout[2m | tests/integration/managementReports.integration.test.ts[2m > [22m[2mManagement Reports API[2m > [22m[2mPOST /api/management-reports/generate[2m > [22m[2mshould generate a team meeting report for a project
[22m[39m2026-01-04T16:40:56.363Z [33mwarn[39m: [174f357c-b5d8-44f3-ac1b-569819521870] Performance metric {"method":"POST","path":"/api/management-reports/generate","statusCode":500,"responseTime":7,"dbQueryCount":0,"dbQueryTime":0,"memoryDelta":{"heapUsed":6072480,"external":3856,"rss":4964352},"userId":"73a022ae-5dd1-4240-b806-df3a977ad8d4","organizationId":null,"isSlow":false,"isError":true}
2026-01-04T16:40:56.363Z [31merror[39m: [174f357c-b5d8-44f3-ac1b-569819521870] HTTP POST /api/management-reports/generate - 500 {"method":"POST","url":"/api/management-reports/generate","status":500,"duration":"7ms","ip":"::ffff:127.0.0.1","userAgent":"unknown"}

[90mstdout[2m | tests/integration/managementReports.integration.test.ts[2m > [22m[2mManagement Reports API[2m > [22m[2mPOST /api/management-reports/generate[2m > [22m[2mshould generate a team meeting report for a project
[22m[39mResponse Status: [33m500[39m
Response Body: {
  "error": "Project not found"
}

[90mstdout[2m | tests/integration/managementReports.integration.test.ts
[22m[39m[InternalMockDB] run called {
  sql: [32m'DELETE FROM management_report_comments WHERE report_id IN (SELECT id FROM management_reports WHERE organization_id = ?)'[39m
}
[InternalMockDB] run called {
  sql: [32m'DELETE FROM management_report_audit_log WHERE report_id IN (SELECT id FROM management_reports WHERE organization_id = ?)'[39m
}
[InternalMockDB] run called {
  sql: [32m'DELETE FROM management_report_versions WHERE report_id IN (SELECT id FROM management_reports WHERE organization_id = ?)'[39m
}
[InternalMockDB] run called {
  sql: [32m'DELETE FROM management_report_approvals WHERE report_id IN (SELECT id FROM management_reports WHERE organization_id = ?)'[39m
}
[InternalMockDB] run called { sql: [32m'DELETE FROM management_reports WHERE organization_id = ?'[39m }
[InternalMockDB] run called { sql: [32m'DELETE FROM projects WHERE id = ?'[39m }
[InternalMockDB] run called { sql: [32m'DELETE FROM users WHERE id = ?'[39m }
[InternalMockDB] run called { sql: [32m'DELETE FROM organizations WHERE id = ?'[39m }

 [31m❯[39m tests/integration/managementReports.integration.test.ts [2m([22m[2m31 tests[22m[2m | [22m[31m1 failed[39m[2m | [22m[33m30 skipped[39m[2m)[22m[32m 25[2mms[22m[39m
[31m       [31m×[31m should generate a team meeting report for a project[39m[32m 23[2mms[22m[39m
       [2m[90m↓[39m[22m should generate a steering committee report for portfolio
       [2m[90m↓[39m[22m should require authentication
       [2m[90m↓[39m[22m should validate required fields
       [2m[90m↓[39m[22m should retrieve a report by ID
       [2m[90m↓[39m[22m should return 404 for non-existent report
       [2m[90m↓[39m[22m should return paginated report history
       [2m[90m↓[39m[22m should filter by report type
       [2m[90m↓[39m[22m should submit report for approval
       [2m[90m↓[39m[22m should get approval status
       [2m[90m↓[39m[22m should approve report
       [2m[90m↓[39m[22m should get pending approvals for user
       [2m[90m↓[39m[22m should get report versions
       [2m[90m↓[39m[22m should get specific version
       [2m[90m↓[39m[22m should compare versions
       [2m[90m↓[39m[22m should add a comment to report
       [2m[90m↓[39m[22m should get comments for report
       [2m[90m↓[39m[22m should update a comment
       [2m[90m↓[39m[22m should resolve a comment
       [2m[90m↓[39m[22m should delete a comment
       [2m[90m↓[39m[22m should get audit log for report
       [2m[90m↓[39m[22m should filter audit log by action
       [2m[90m↓[39m[22m should finalize a report
       [2m[90m↓[39m[22m should prevent editing finalized report
       [2m[90m↓[39m[22m should unlock report with admin privileges
       [2m[90m↓[39m[22m should generate PDF export
       [2m[90m↓[39m[22m should generate PPTX export
       [2m[90m↓[39m[22m should create share link
       [2m[90m↓[39m[22m should get usage analytics
       [2m[90m↓[39m[22m should get report types breakdown
       [2m[90m↓[39m[22m should export multiple reports as ZIP

[31m⎯⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Tests 1 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m tests/integration/managementReports.integration.test.ts[2m > [22mManagement Reports API[2m > [22mPOST /api/management-reports/generate[2m > [22mshould generate a team meeting report for a project
[31m[1mAssertionError[22m: expected 500 to be 200 // Object.is equality[39m

[32m- Expected[39m
[31m+ Received[39m

[32m- 200[39m
[31m+ 500[39m

[36m [2m❯[22m tests/integration/managementReports.integration.test.ts:[2m111:37[22m[39m
    [90m109| [39m            }
    [90m110| [39m
    [90m111| [39m            [34mexpect[39m(response[33m.[39mstatus)[33m.[39m[34mtoBe[39m([34m200[39m)[33m;[39m
    [90m   | [39m                                    [31m^[39m
    [90m112| [39m            [34mexpect[39m(response[33m.[39mbody[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m
    [90m113| [39m            [34mexpect[39m(response[33m.[39mbody[33m.[39mreport)[33m.[39m[34mtoBeDefined[39m()[33m;[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m


[2m Test Files [22m [1m[31m1 failed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[31m1 failed[39m[22m[2m | [22m[33m30 skipped[39m[90m (31)[39m
[2m   Start at [22m 17:40:52
[2m   Duration [22m 4.30s[2m (transform 1.82s, setup 0ms, import 4.07s, tests 25ms, environment 0ms)[22m

