# E2E-1 krok 2 — admin-nw-northwind-admin-en-light

- Base: http://127.0.0.1:5430
- SHA: d9f8b2203f-local
- Flags snapshot: 2
- Modules: 16/16
- Cells: 214
- PASS: 167
- FAIL/MISSING/BLOCKED: 47
- Classes: PRODUCT 14 · CONTRACT 33 · ENV 0
- Flag profile: 7d90533cf1c4
- Writes observed: 47
- Cleanup verified: YES

## Diff vs previous run

No previous artifact for this exact variant.

| Module | Surface | Control | Result | Class | Why | Screenshot | Console / HTTP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01-chat | menu1 | /chat | PASS | — | — | screenshots/01-chat-menu1-chat.png | — |
| 01-chat | menu2 | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/01-chat-menu2-missing.png | — |
| 01-chat | menu3 | Open work panel | PASS | — | — | screenshots/01-chat-menu3-open-work-panel-1.png | — |
| 01-chat | menu3 | Enable voice reading | PASS | — | — | screenshots/01-chat-menu3-enable-voice-reading-2.png | — |
| 01-chat | menu3 | Auto | PASS | — | — | screenshots/01-chat-menu3-auto-3.png | — |
| 01-chat | menu3 | Documents | PASS | — | — | screenshots/01-chat-menu3-documents-4.png | — |
| 01-chat | menu3 | Tables | PASS | — | — | screenshots/01-chat-menu3-tables-5.png | — |
| 01-chat | menu3 | Presentations | PASS | — | — | screenshots/01-chat-menu3-presentations-6.png | — |
| 01-chat | kebab | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/01-chat-kebab-missing.png | — |
| 01-chat | right-panel | first-row | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/01-chat-right-panel-missing.png | — |
| 01-chat | create | New conversation | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) | screenshots/01-chat-create-new-conversation-6.png | [ConversationStore] Create error: TypeError: Failed to fetch     at window.fetch (http://127.0.0.1:5430/src/services/globalAuthFetchGuard.ts:34:28)     at window.fetch (http://127.0.0.1:5430/src/services/feedbackCollector/NetworkBuffer.ts:43:32)     at window.fetch (http://127.0.0.1:5430/src/service; [UnifiedChatPanel] Failed to create new chat: TypeError: Failed to fetch     at window.fetch (http://127.0.0.1:5430/src/services/globalAuthFetchGuard.ts:34:28)     at window.fetch (http://127.0.0.1:5430/src/services/feedbackCollector/NetworkBuffer.ts:43:32)     at window.fetch (http://127.0.0.1:5430 |
| 01-chat | ai | Auto | PASS | — | — | screenshots/01-chat-ai-auto-10.png | — |
| 02-my-work | menu1 | /my-work | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) | screenshots/02-my-work-menu1-my-work.png | — |
| 02-my-work | menu2 | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/02-my-work-menu2-missing.png | — |
| 02-my-work | menu3 | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) | screenshots/02-my-work-menu3-teresa-1.png | — |
| 02-my-work | kebab | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/02-my-work-kebab-missing.png | — |
| 02-my-work | right-panel | first-row | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/02-my-work-right-panel-missing.png | — |
| 02-my-work | create | Triage all new items for me | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) | screenshots/02-my-work-create-triage-all-new-items-for-me-32.png | [ConversationStore] Create error: TypeError: Failed to fetch     at window.fetch (http://127.0.0.1:5430/src/services/globalAuthFetchGuard.ts:34:28)     at window.fetch (http://127.0.0.1:5430/src/services/feedbackCollector/NetworkBuffer.ts:43:32)     at window.fetch (http://127.0.0.1:5430/src/service; [UnifiedChatPanel] Failed to create conversation: TypeError: Failed to fetch     at window.fetch (http://127.0.0.1:5430/src/services/globalAuthFetchGuard.ts:34:28)     at window.fetch (http://127.0.0.1:5430/src/services/feedbackCollector/NetworkBuffer.ts:43:32)     at window.fetch (http://127.0.0.1: |
| 02-my-work | ai | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) | screenshots/02-my-work-ai-teresa-5.png | — |
| 03-interview | menu1 | /interview | PASS | — | — | screenshots/03-interview-menu1-interview.png | — |
| 03-interview | menu2 | Inbox | PASS | — | — | screenshots/03-interview-menu2-inbox-1.png | — |
| 03-interview | menu2 | Sessions | PASS | — | — | screenshots/03-interview-menu2-sessions-2.png | — |
| 03-interview | menu2 | Assigned | PASS | — | — | screenshots/03-interview-menu2-assigned-3.png | — |
| 03-interview | menu2 | Templates | PASS | — | — | screenshots/03-interview-menu2-templates-4.png | — |
| 03-interview | menu2 | Insights | PASS | — | — | screenshots/03-interview-menu2-insights-5.png | — |
| 03-interview | menu2 | Initiatives | PASS | — | — | screenshots/03-interview-menu2-initiatives-6.png | — |
| 03-interview | menu3 | Teresa | PASS | — | — | screenshots/03-interview-menu3-teresa-1.png | — |
| 03-interview | kebab | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/03-interview-kebab-missing.png | — |
| 03-interview | right-panel | first-row | PASS | — | — | screenshots/03-interview-right-panel-first-row.png | — |
| 03-interview | create | Add files | FAIL | CONTRACT | control not interactable within the harness budget and the app reported no error | screenshots/03-interview-create-add-files-29.png | — |
| 03-interview | ai | Teresa | PASS | — | — | screenshots/03-interview-ai-teresa-5.png | — |
| 04-tools | menu1 | /discovery-tools | PASS | — | — | screenshots/04-tools-menu1-discovery-tools.png | — |
| 04-tools | menu2 | Library | PASS | — | — | screenshots/04-tools-menu2-library-1.png | — |
| 04-tools | menu2 | Sessions | PASS | — | — | screenshots/04-tools-menu2-sessions-2.png | — |
| 04-tools | menu2 | Insights | PASS | — | — | screenshots/04-tools-menu2-insights-3.png | — |
| 04-tools | menu2 | Reports | PASS | — | — | screenshots/04-tools-menu2-reports-4.png | — |
| 04-tools | menu2 | Initiatives | PASS | — | — | screenshots/04-tools-menu2-initiatives-5.png | — |
| 04-tools | menu3 | Teresa | PASS | — | — | screenshots/04-tools-menu3-teresa-1.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-27.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-28.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-29.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-30.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-31.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-32.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-33.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-34.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-35.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-36.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-37.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-38.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-39.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-40.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-41.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-42.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-43.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-44.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-45.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-46.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-47.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-48.png | Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to fetch tasks TypeError: Failed to fetch     at window.fetch (http://127.0.0.1:5430/src/services/globalAuthFetchGuard.ts:34:28)     at window.fetch (http://127.0.0.1:5430/src/services/feedbackCollector/NetworkBuffer.ts:43:32)     at window.fetch (http://127.0.0.1:5430/src/services/csrfClient; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load users for Author column TypeError: Failed to fetch     at window.fetch (http://127.0.0.1:5430/src/services/globalAuthFetchGuard.ts:34:28)     at window.fetch (http://127.0.0.1:5430/src/services/feedbackCollector/NetworkBuffer.ts:43:32)     at window.fetch (http://127.0.0.1:5430/src/se; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; Failed to load resource: net::ERR_NETWORK_CHANGED; %o  %s  %s  TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:5430/src/components/AIChat/UnifiedChatPanel.tsx The above error occurred in one of your React components. React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBound; [ErrorBoundary] Uncaught error: TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:5430/src/components/AIChat/UnifiedChatPanel.tsx; [ErrorBoundary] Error info: {componentStack:      at Lazy (<anonymous>)     at Suspense (<anony…/AppProviders.tsx:116:57     at App (<anonymous>)}; [ErrorBoundary] Error stack: TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:5430/src/components/AIChat/UnifiedChatPanel.tsx |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-49.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-50.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-51.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-52.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-53.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-54.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-55.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-56.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-57.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-58.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-59.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-60.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-61.png | — |
| 04-tools | kebab | Row actions | PASS | — | — | screenshots/04-tools-kebab-row-actions-62.png | — |
| 04-tools | right-panel | first-row | PASS | — | — | screenshots/04-tools-right-panel-first-row.png | — |
| 04-tools | create | Add tool | PASS | — | — | screenshots/04-tools-create-add-tool-15.png | — |
| 04-tools | ai | Teresa | FAIL | CONTRACT | control not interactable within the harness budget and the app reported no error | screenshots/04-tools-ai-teresa-5.png | — |
| 05-assessment | menu1 | /assessment | PASS | — | — | screenshots/05-assessment-menu1-assessment.png | — |
| 05-assessment | menu2 | Library | PASS | — | — | screenshots/05-assessment-menu2-library-1.png | — |
| 05-assessment | menu2 | Processes | PASS | — | — | screenshots/05-assessment-menu2-processes-2.png | — |
| 05-assessment | menu2 | Insights | PASS | — | — | screenshots/05-assessment-menu2-insights-3.png | — |
| 05-assessment | menu2 | Reports | PASS | — | — | screenshots/05-assessment-menu2-reports-4.png | — |
| 05-assessment | menu2 | Initiatives | PASS | — | — | screenshots/05-assessment-menu2-initiatives-5.png | — |
| 05-assessment | menu3 | Teresa | PASS | — | — | screenshots/05-assessment-menu3-teresa-1.png | — |
| 05-assessment | kebab | Row actions | PASS | — | — | screenshots/05-assessment-kebab-row-actions-20.png | — |
| 05-assessment | kebab | Row actions | PASS | — | — | screenshots/05-assessment-kebab-row-actions-22.png | — |
| 05-assessment | kebab | Row actions | PASS | — | — | screenshots/05-assessment-kebab-row-actions-24.png | — |
| 05-assessment | kebab | Row actions | PASS | — | — | screenshots/05-assessment-kebab-row-actions-26.png | — |
| 05-assessment | kebab | Row actions | PASS | — | — | screenshots/05-assessment-kebab-row-actions-28.png | — |
| 05-assessment | right-panel | first-row | PASS | — | — | screenshots/05-assessment-right-panel-first-row.png | — |
| 05-assessment | create | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/05-assessment-create-missing.png | — |
| 05-assessment | ai | Teresa | PASS | — | — | screenshots/05-assessment-ai-teresa-5.png | — |
| 06-audits | menu1 | /audit-programs | PASS | — | — | screenshots/06-audits-menu1-audit-programs.png | — |
| 06-audits | menu2 | Library | PASS | — | — | screenshots/06-audits-menu2-library-1.png | — |
| 06-audits | menu2 | Sessions | PASS | — | — | screenshots/06-audits-menu2-sessions-2.png | — |
| 06-audits | menu2 | Conclusions | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) | screenshots/06-audits-menu2-conclusions-3.png | — |
| 06-audits | menu2 | Reports | PASS | — | — | screenshots/06-audits-menu2-reports-4.png | — |
| 06-audits | menu2 | Initiatives | PASS | — | — | screenshots/06-audits-menu2-initiatives-5.png | — |
| 06-audits | menu3 | Teresa | PASS | — | — | screenshots/06-audits-menu3-teresa-1.png | — |
| 06-audits | menu3 | All 1 | PASS | — | — | screenshots/06-audits-menu3-all-1-2.png | — |
| 06-audits | menu3 | Verified 0 | PASS | — | — | screenshots/06-audits-menu3-verified-0-3.png | — |
| 06-audits | menu3 | Pending review 0 | PASS | — | — | screenshots/06-audits-menu3-pending-review-0-4.png | — |
| 06-audits | kebab | Row actions | PASS | — | — | screenshots/06-audits-kebab-row-actions-23.png | — |
| 06-audits | right-panel | first-row | PASS | — | — | screenshots/06-audits-right-panel-first-row.png | — |
| 06-audits | create | New audit | FAIL | CONTRACT | control not interactable within the harness budget and the app reported no error | screenshots/06-audits-create-new-audit-14.png | — |
| 06-audits | ai | Teresa | PASS | — | — | screenshots/06-audits-ai-teresa-5.png | — |
| 07-initiatives | menu1 | /initiatives | PASS | — | — | screenshots/07-initiatives-menu1-initiatives.png | — |
| 07-initiatives | menu2 | Initiatives | PASS | — | — | screenshots/07-initiatives-menu2-initiatives-1.png | — |
| 07-initiatives | menu2 | Plan | PASS | — | — | screenshots/07-initiatives-menu2-plan-2.png | — |
| 07-initiatives | menu2 | Load | PASS | — | — | screenshots/07-initiatives-menu2-load-3.png | — |
| 07-initiatives | menu3 | Teresa | PASS | — | — | screenshots/07-initiatives-menu3-teresa-1.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-27.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-28.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-29.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-30.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-31.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-32.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-33.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-34.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-35.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-36.png | — |
| 07-initiatives | kebab | Row actions | PASS | — | — | screenshots/07-initiatives-kebab-row-actions-37.png | — |
| 07-initiatives | right-panel | first-row | PASS | — | — | screenshots/07-initiatives-right-panel-first-row.png | — |
| 07-initiatives | create | New initiative | PASS | — | — | screenshots/07-initiatives-create-new-initiative-19.png | — |
| 07-initiatives | ai | Teresa | PASS | — | — | screenshots/07-initiatives-ai-teresa-5.png | — |
| 08-projects | menu1 | /projects | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) | screenshots/08-projects-menu1-projects.png | — |
| 08-projects | menu2 | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/08-projects-menu2-missing.png | — |
| 08-projects | menu3 | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) | screenshots/08-projects-menu3-teresa-1.png | — |
| 08-projects | kebab | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/08-projects-kebab-missing.png | — |
| 08-projects | right-panel | first-row | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/08-projects-right-panel-missing.png | — |
| 08-projects | create | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/08-projects-create-missing.png | — |
| 08-projects | ai | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) | screenshots/08-projects-ai-teresa-5.png | — |
| 09-execution | menu1 | /execution | PASS | — | — | screenshots/09-execution-menu1-execution.png | — |
| 09-execution | menu2 | Execution bank | PASS | — | — | screenshots/09-execution-menu2-execution-bank-1.png | — |
| 09-execution | menu2 | Work | PASS | — | — | screenshots/09-execution-menu2-work-2.png | — |
| 09-execution | menu2 | Risk management | PASS | — | — | screenshots/09-execution-menu2-risk-management-3.png | — |
| 09-execution | menu2 | Reports | PASS | — | — | screenshots/09-execution-menu2-reports-4.png | — |
| 09-execution | menu3 | Teresa | PASS | — | — | screenshots/09-execution-menu3-teresa-1.png | — |
| 09-execution | menu3 | All 0 | PASS | — | — | screenshots/09-execution-menu3-all-0-2.png | — |
| 09-execution | menu3 | At risk 0 | PASS | — | — | screenshots/09-execution-menu3-at-risk-0-3.png | — |
| 09-execution | menu3 | Overdue 0 | PASS | — | — | screenshots/09-execution-menu3-overdue-0-4.png | — |
| 09-execution | kebab | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/09-execution-kebab-missing.png | — |
| 09-execution | right-panel | first-row | FAIL | PRODUCT | non-PASS with no harness-contract evidence — counted as a product defect by default | screenshots/09-execution-right-panel-first-row.png | — |
| 09-execution | create | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/09-execution-create-missing.png | — |
| 09-execution | ai | Teresa | PASS | — | — | screenshots/09-execution-ai-teresa-5.png | — |
| 10-results | menu1 | /results/kpi | PASS | — | — | screenshots/10-results-menu1-results-kpi.png | — |
| 10-results | menu2 | KPI | PASS | — | — | screenshots/10-results-menu2-kpi-1.png | — |
| 10-results | menu2 | OKR | PASS | — | — | screenshots/10-results-menu2-okr-2.png | — |
| 10-results | menu2 | ROI | PASS | — | — | screenshots/10-results-menu2-roi-3.png | — |
| 10-results | menu2 | Management reports | PASS | — | — | screenshots/10-results-menu2-management-reports-4.png | — |
| 10-results | menu3 | Teresa | PASS | — | — | screenshots/10-results-menu3-teresa-1.png | — |
| 10-results | kebab | OPEN ACTIONS | PASS | — | — | screenshots/10-results-kebab-open-actions-17.png | — |
| 10-results | right-panel | first-row | FAIL | PRODUCT | non-PASS with no harness-contract evidence — counted as a product defect by default | screenshots/10-results-right-panel-first-row.png | — |
| 10-results | create | New report | PASS | — | — | screenshots/10-results-create-new-report-12.png | — |
| 10-results | ai | Teresa | PASS | — | — | screenshots/10-results-ai-teresa-5.png | — |
| 11-materials | menu1 | /presentations | PASS | — | — | screenshots/11-materials-menu1-presentations.png | — |
| 11-materials | menu2 | All | PASS | — | — | screenshots/11-materials-menu2-all-1.png | — |
| 11-materials | menu2 | Documents | PASS | — | — | screenshots/11-materials-menu2-documents-2.png | — |
| 11-materials | menu2 | Presentations | PASS | — | — | screenshots/11-materials-menu2-presentations-3.png | — |
| 11-materials | menu2 | Sheets | PASS | — | — | screenshots/11-materials-menu2-sheets-4.png | — |
| 11-materials | menu2 | Template Library | PASS | — | — | screenshots/11-materials-menu2-template-library-5.png | — |
| 11-materials | menu3 | Teresa | PASS | — | — | screenshots/11-materials-menu3-teresa-1.png | — |
| 11-materials | kebab | Row actions | PASS | — | — | screenshots/11-materials-kebab-row-actions-26.png | — |
| 11-materials | kebab | Row actions | PASS | — | — | screenshots/11-materials-kebab-row-actions-27.png | — |
| 11-materials | right-panel | first-row | PASS | — | — | screenshots/11-materials-right-panel-first-row.png | — |
| 11-materials | create | New presentation | PASS | — | — | screenshots/11-materials-create-new-presentation-17.png | — |
| 11-materials | ai | Teresa | PASS | — | — | screenshots/11-materials-ai-teresa-5.png | — |
| 12-meeting | menu1 | /meeting | FAIL | PRODUCT | navigation landed on /meetings instead of /meeting | screenshots/12-meeting-menu1-meeting.png | — |
| 12-meeting | menu2 | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/12-meeting-menu2-missing.png | — |
| 12-meeting | menu3 | Teresa | PASS | — | — | screenshots/12-meeting-menu3-teresa-1.png | — |
| 12-meeting | kebab | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/12-meeting-kebab-missing.png | — |
| 12-meeting | right-panel | first-row | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/12-meeting-right-panel-missing.png | — |
| 12-meeting | create | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/12-meeting-create-missing.png | — |
| 12-meeting | ai | Teresa | PASS | — | — | screenshots/12-meeting-ai-teresa-5.png | — |
| 13-organization | menu1 | /organization/profile | PASS | — | — | screenshots/13-organization-menu1-organization-profile.png | — |
| 13-organization | menu2 | Identity | PASS | — | — | screenshots/13-organization-menu2-identity-1.png | — |
| 13-organization | menu2 | Scale | PASS | — | — | screenshots/13-organization-menu2-scale-2.png | — |
| 13-organization | menu2 | Markets & systems | PASS | — | — | screenshots/13-organization-menu2-markets-systems-3.png | — |
| 13-organization | menu3 | Teresa | PASS | — | — | screenshots/13-organization-menu3-teresa-1.png | — |
| 13-organization | menu3 | All 13 | PASS | — | — | screenshots/13-organization-menu3-all-13-2.png | — |
| 13-organization | menu3 | Filled in 8 | PASS | — | — | screenshots/13-organization-menu3-filled-in-8-3.png | — |
| 13-organization | menu3 | To fill in 5 | PASS | — | — | screenshots/13-organization-menu3-to-fill-in-5-4.png | — |
| 13-organization | menu3 | Conflicts 0 | PASS | — | — | screenshots/13-organization-menu3-conflicts-0-5.png | — |
| 13-organization | kebab | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/13-organization-kebab-missing.png | — |
| 13-organization | right-panel | first-row | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/13-organization-right-panel-missing.png | — |
| 13-organization | create | Add org profile details to improve Teresa's answers | PASS | — | — | screenshots/13-organization-create-add-org-profile-details-to-improve-teresa-s-answers-26.png | — |
| 13-organization | ai | Teresa | PASS | — | — | screenshots/13-organization-ai-teresa-5.png | — |
| 14-admin | menu1 | /admin/people | PASS | — | — | screenshots/14-admin-menu1-admin-people.png | — |
| 14-admin | menu2 | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/14-admin-menu2-missing.png | — |
| 14-admin | menu3 | Teresa | PASS | — | — | screenshots/14-admin-menu3-teresa-1.png | — |
| 14-admin | kebab | Row actions | PASS | — | — | screenshots/14-admin-kebab-row-actions-26.png | — |
| 14-admin | kebab | Row actions | PASS | — | — | screenshots/14-admin-kebab-row-actions-27.png | — |
| 14-admin | kebab | Row actions | PASS | — | — | screenshots/14-admin-kebab-row-actions-28.png | — |
| 14-admin | kebab | Row actions | PASS | — | — | screenshots/14-admin-kebab-row-actions-29.png | — |
| 14-admin | kebab | Row actions | PASS | — | — | screenshots/14-admin-kebab-row-actions-30.png | — |
| 14-admin | kebab | Row actions | PASS | — | — | screenshots/14-admin-kebab-row-actions-31.png | — |
| 14-admin | kebab | Row actions | PASS | — | — | screenshots/14-admin-kebab-row-actions-32.png | — |
| 14-admin | right-panel | first-row | FAIL | PRODUCT | non-PASS with no harness-contract evidence — counted as a product defect by default | screenshots/14-admin-right-panel-first-row.png | — |
| 14-admin | create | Add member | PASS | — | — | screenshots/14-admin-create-add-member-23.png | — |
| 14-admin | ai | Teresa | PASS | — | — | screenshots/14-admin-ai-teresa-5.png | — |
| 15-settings | menu1 | /settings/profile | PASS | — | — | screenshots/15-settings-menu1-settings-profile.png | — |
| 15-settings | menu2 | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/15-settings-menu2-missing.png | — |
| 15-settings | menu3 | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/15-settings-menu3-missing.png | — |
| 15-settings | kebab | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/15-settings-kebab-missing.png | — |
| 15-settings | right-panel | first-row | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/15-settings-right-panel-missing.png | — |
| 15-settings | create | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/15-settings-create-missing.png | — |
| 15-settings | ai | AI & automation | PASS | — | — | screenshots/15-settings-ai-ai-automation-12.png | — |
| 16-partners | menu1 | /partner/dashboard | FAIL | PRODUCT | navigation landed on /partner?tab=partner-home instead of /partner/dashboard | screenshots/16-partners-menu1-partner-dashboard.png | — |
| 16-partners | menu2 | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/16-partners-menu2-missing.png | — |
| 16-partners | menu3 | Teresa | PASS | — | — | screenshots/16-partners-menu3-teresa-1.png | — |
| 16-partners | kebab | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/16-partners-kebab-missing.png | — |
| 16-partners | right-panel | first-row | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/16-partners-right-panel-missing.png | — |
| 16-partners | create | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature | screenshots/16-partners-create-missing.png | — |
| 16-partners | ai | Teresa | PASS | — | — | screenshots/16-partners-ai-teresa-5.png | — |

## Settle (spinner-aware wait)

| Module | Settle runs | Spinner gone | Stuck routes | Max elapsed (ms) |
| --- | --- | --- | --- | --- |
| 01-chat | 13 | 13/13 | — | 2572 |
| 02-my-work | 8 | 8/8 | — | 2665 |
| 03-interview | 14 | 14/14 | — | 2312 |
| 04-tools | 49 | 49/49 | — | 4527 |
| 05-assessment | 19 | 19/19 | — | 3570 |
| 06-audits | 18 | 18/18 | — | 2453 |
| 07-initiatives | 23 | 23/23 | — | 2809 |
| 08-projects | 9 | 9/9 | — | 3275 |
| 09-execution | 16 | 16/16 | — | 2792 |
| 10-results | 14 | 14/14 | — | 2365 |
| 11-materials | 16 | 16/16 | — | 2053 |
| 12-meeting | 9 | 9/9 | — | 2482 |
| 13-organization | 16 | 16/16 | — | 2842 |
| 14-admin | 16 | 16/16 | — | 2954 |
| 15-settings | 7 | 7/7 | — | 1870 |
| 16-partners | 9 | 9/9 | — | 2327 |
