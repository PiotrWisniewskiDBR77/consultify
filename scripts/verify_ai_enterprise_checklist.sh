#!/bin/bash
# ============================================================================
# MASTER CHECKLIST VERIFICATION SCRIPT
# AI Actions + Playbooks Enterprise System (Steps 9-18)
# ============================================================================
# Usage: ./scripts/verify_ai_enterprise_checklist.sh [--full] [--json]
# Options:
#   --full   Run detailed checks (slower)
#   --json   Output as JSON
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
WARN=0

# Options
FULL_CHECK=false
JSON_OUTPUT=false

for arg in "$@"; do
  case $arg in
    --full) FULL_CHECK=true ;;
    --json) JSON_OUTPUT=true ;;
  esac
done

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ============================================================================
# Helper functions
# ============================================================================

check_file() {
  local file="$1"
  local desc="$2"
  local section="$3"
  
  if [ -f "$file" ]; then
    if [ "$JSON_OUTPUT" = false ]; then
      echo -e "${GREEN}✅${NC} [$section] $desc"
      echo "   → $file"
    fi
    ((PASS++))
    return 0
  else
    if [ "$JSON_OUTPUT" = false ]; then
      echo -e "${RED}❌${NC} [$section] $desc"
      echo "   → MISSING: $file"
    fi
    ((FAIL++))
    return 1
  fi
}

check_grep() {
  local pattern="$1"
  local file="$2"
  local desc="$3"
  local section="$4"
  
  if [ -f "$file" ] && grep -q "$pattern" "$file" 2>/dev/null; then
    if [ "$JSON_OUTPUT" = false ]; then
      echo -e "${GREEN}✅${NC} [$section] $desc"
    fi
    ((PASS++))
    return 0
  else
    if [ "$JSON_OUTPUT" = false ]; then
      echo -e "${RED}❌${NC} [$section] $desc"
      echo "   → Pattern '$pattern' not found in $file"
    fi
    ((FAIL++))
    return 1
  fi
}

check_endpoint() {
  local pattern="$1"
  local files="$2"
  local desc="$3"
  local section="$4"
  
  if grep -rq "$pattern" $files 2>/dev/null; then
    if [ "$JSON_OUTPUT" = false ]; then
      echo -e "${GREEN}✅${NC} [$section] Endpoint: $desc"
    fi
    ((PASS++))
    return 0
  else
    if [ "$JSON_OUTPUT" = false ]; then
      echo -e "${RED}❌${NC} [$section] Endpoint: $desc"
    fi
    ((FAIL++))
    return 1
  fi
}

check_db_table() {
  local table="$1"
  local desc="$2"
  local section="$3"
  
  # Check in database files
  local found=false
  for dbfile in server/database.sqlite.active.js server/database.postgres.js; do
    if [ -f "$dbfile" ] && grep -q "CREATE TABLE.*$table" "$dbfile" 2>/dev/null; then
      found=true
      break
    fi
    if [ -f "$dbfile" ] && grep -q "'$table'" "$dbfile" 2>/dev/null; then
      found=true
      break
    fi
  done
  
  # Also check migrations
  if grep -rq "CREATE TABLE.*$table" server/migrations/ 2>/dev/null; then
    found=true
  fi
  
  if [ "$found" = true ]; then
    if [ "$JSON_OUTPUT" = false ]; then
      echo -e "${GREEN}✅${NC} [$section] DB Table: $table"
    fi
    ((PASS++))
    return 0
  else
    if [ "$JSON_OUTPUT" = false ]; then
      echo -e "${YELLOW}⚠️${NC} [$section] DB Table: $table (needs verification)"
    fi
    ((WARN++))
    return 1
  fi
}

section_header() {
  if [ "$JSON_OUTPUT" = false ]; then
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  fi
}

# ============================================================================
# A. Platform Core: Organizacja, RBAC, Permissions
# ============================================================================
section_header "A. PLATFORM CORE: RBAC & PERMISSIONS"

check_file "server/middleware/authMiddleware.js" "Auth middleware" "A1"
# check_file "server/middleware/requireAuth.js" "RequireAuth middleware" "A1" # Covered by authMiddleware
check_file "server/migrations/014_governance_enterprise.sql" "Governance migration" "A2"
check_file "server/services/permissionService.js" "Permission service" "A2"
check_file "components/governance/PermissionManager.tsx" "PermissionManager UI" "A3"
check_file "components/governance/AuditLogViewer.tsx" "AuditLogViewer UI" "A3"

# ============================================================================
# B. Step 9.1 — Action Proposal Engine
# ============================================================================
section_header "B. STEP 9.1 — ACTION PROPOSAL ENGINE"

check_file "server/ai/actionProposalMapper.js" "Action Proposal Mapper" "B1"
check_file "server/ai/actionProposalEngine.js" "Action Proposal Engine" "B1"
check_file "tests/unit/actionProposalEngine.test.js" "Proposal Engine Tests" "B4"

check_endpoint "proposals" "server/routes/ai.js" "GET /api/ai/actions/proposals" "B3"

# ============================================================================
# C. Step 9.2 — Approval & Audit Layer
# ============================================================================
section_header "C. STEP 9.2 — APPROVAL & AUDIT LAYER"

check_file "server/ai/actionDecisionService.js" "Action Decision Service" "C2"
check_file "server/routes/actionDecisions.js" "Action Decisions Routes" "C3"
check_file "tests/integration/actionDecision.test.js" "Decision Integration Tests" "C4"

check_db_table "action_decisions" "Action Decisions Table" "C1"
check_grep "proposal_snapshot" "server/ai/actionDecisionService.js" "proposal_snapshot field" "C2"

# ============================================================================
# D. Step 9.3 — Execution Adapter
# ============================================================================
section_header "D. STEP 9.3 — EXECUTION ADAPTER"

check_file "server/ai/actionExecutionAdapter.js" "Execution Adapter" "D1"
check_file "server/ai/actionExecutors/taskExecutor.js" "Task Executor" "D3"
check_file "server/ai/actionExecutors/playbookExecutor.js" "Playbook Executor" "D3"
check_file "server/ai/actionExecutors/meetingExecutor.js" "Meeting Executor" "D3"
check_file "tests/integration/actionExecution.test.js" "Execution Integration Tests" "D5"

check_db_table "action_executions" "Action Executions Table" "D1"
check_grep "idempotent" "server/ai/actionExecutionAdapter.js" "Idempotency logic" "D2"

# ============================================================================
# E. Step 9.4 — UI: AI Action Proposals
# ============================================================================
section_header "E. STEP 9.4 — AI ACTION PROPOSALS UI"

check_file "components/ai/ActionProposalDetail.tsx" "ActionProposalDetail" "E1"
check_file "components/ai/ActionProposalList.tsx" "ActionProposalList" "E1"
check_file "components/ai/ActionDecisionDialog.tsx" "ActionDecisionDialog" "E2"
check_file "components/ai/ActionAuditTrail.tsx" "ActionAuditTrail" "E3"

# ============================================================================
# F. Step 9.5 — Observability & Error Catalog
# ============================================================================
section_header "F. STEP 9.5 — OBSERVABILITY & ERROR CATALOG"

check_file "server/ai/actionErrors.js" "Action Errors Catalog" "F1"
check_file "server/services/aiAuditLogger.js" "AI Audit Logger" "F2"

check_grep "RBAC_DENIED\|NOT_FOUND\|ALREADY_EXECUTED" "server/ai/actionErrors.js" "Error codes" "F1"
check_grep "correlation_id" "server/services/aiAuditLogger.js" "Correlation ID" "F3"

# ============================================================================
# G. Step 9.6 — Dry-run Execution
# ============================================================================
section_header "G. STEP 9.6 — DRY-RUN EXECUTION"

check_endpoint "dry-run" "server/routes/actionDecisions.js" "Dry-run endpoint" "G"
check_grep "dry.?run\|dryRun\|DRY_RUN" "server/ai/actionExecutionAdapter.js" "Dry-run logic" "G"

# ============================================================================
# H. Step 9.7 — Retention + Export
# ============================================================================
section_header "H. STEP 9.7 — RETENTION + EXPORT"

check_file "server/ai/auditExport.js" "Audit Export Service" "H1"
check_file "server/services/retentionPolicyService.js" "Retention Policy Service" "H2"

check_grep "exportCSV\|exportJSON\|csv\|json" "server/ai/auditExport.js" "CSV/JSON export" "H1"

# ============================================================================
# I. Step 9.8 — Policy Engine
# ============================================================================
section_header "I. STEP 9.8 — POLICY ENGINE"

check_file "server/ai/policyEngine.js" "Policy Engine" "I2"
check_file "tests/unit/policyEngine.test.js" "Policy Engine Tests" "I4"

check_db_table "ai_policy_rules" "Policy Rules Table" "I1"
check_db_table "ai_policy_settings" "Policy Settings Table" "I1"
check_grep "HIGH.*risk\|auto.?approv" "server/ai/policyEngine.js" "Risk-based approval" "I2"

# ============================================================================
# J. Step 10-12 — AI Playbooks + Branching
# ============================================================================
section_header "J. STEPS 10-12 — AI PLAYBOOKS + BRANCHING"

check_file "server/ai/aiPlaybookService.js" "Playbook Service" "J1"
check_file "server/ai/aiPlaybookExecutor.js" "Playbook Executor" "J1"
check_file "server/ai/aiPlaybookRoutingEngine.js" "Routing Engine" "J3"
check_file "server/routes/aiPlaybooks.js" "Playbooks Routes" "J4"
check_file "tests/unit/aiPlaybookRoutingEngine.test.js" "Routing Tests" "J6"
check_file "tests/integration/aiPlaybookBranching.test.js" "Branching Tests" "J6"

check_db_table "ai_playbook_templates" "Playbook Templates Table" "J1"
check_db_table "ai_playbook_runs" "Playbook Runs Table" "J1"
check_grep "BRANCH\|CHECK\|WAIT\|ACTION" "server/ai/aiPlaybookRoutingEngine.js" "Step types" "J2"

# ============================================================================
# K. Step 11 — Async / Queue / Saga
# ============================================================================
section_header "K. STEP 11 — ASYNC / QUEUE / SAGA"

check_file "server/ai/asyncJobService.js" "Async Job Service" "K1"
check_file "server/workers/asyncJobProcessor.js" "Async Job Processor" "K2"
check_file "tests/unit/asyncJobService.test.js" "Async Job Tests" "K"
check_file "server/routes/aiAsync.js" "Async Routes" "K3"

check_db_table "async_jobs" "Async Jobs Table" "K1"
check_grep "EXECUTE_DECISION\|ADVANCE_PLAYBOOK" "server/workers/asyncJobProcessor.js" "Task types" "K2"

# ============================================================================
# L. Step 13 — Visual Playbook Editor
# ============================================================================
section_header "L. STEP 13 — VISUAL PLAYBOOK EDITOR"

check_file "server/ai/templateGraphService.js" "Template Graph Service" "L2"
check_file "server/ai/templateValidationService.js" "Template Validation Service" "L3"
check_file "tests/unit/templateGraphService.test.js" "Graph Service Tests" "L6"
check_file "tests/unit/templateValidationService.test.js" "Validation Tests" "L6"

check_file "components/PlaybookEditor/PlaybookCanvas.tsx" "Playbook Canvas" "L5"
check_file "components/PlaybookEditor/PlaybookNode.tsx" "Playbook Node" "L5"
check_file "components/PlaybookEditor/PlaybookPropertiesPanel.tsx" "Properties Panel" "L5"
check_file "components/PlaybookEditor/PlaybookToolbar.tsx" "Toolbar" "L5"

check_grep "stepsToGraph\|graphToSteps" "server/ai/templateGraphService.js" "Graph functions" "L2"
check_grep "validateDAG\|findDeadEnds" "server/ai/templateGraphService.js" "Validation functions" "L2"

# ============================================================================
# M. Step 14 — Governance, Security & Enterprise Controls
# ============================================================================
section_header "M. STEP 14 — GOVERNANCE & SECURITY"

check_file "server/services/governanceAuditService.js" "Governance Audit Service" "M2"
check_file "server/services/breakGlassService.js" "Break Glass Service" "M3"
check_file "tests/unit/breakGlassService.test.js" "Break Glass Tests" "M3"
check_file "tests/unit/governanceAudit.test.js" "Governance Audit Tests" "M2"

check_file "components/governance/BreakGlassBanner.tsx" "Break Glass Banner" "M5"
check_file "server/routes/governanceAdmin.js" "Governance Admin Routes" "M3"

check_grep "hash\|prev_hash\|tamper" "server/services/governanceAuditService.js" "Hash chain" "M2"

# PII Redactor - check both possible locations
if [ -f "server/services/piiRedactor.js" ]; then
  check_file "server/services/piiRedactor.js" "PII Redactor" "M1"
elif [ -f "server/utils/piiRedactor.js" ]; then
  check_file "server/utils/piiRedactor.js" "PII Redactor" "M1"
else
  check_file "server/services/piiRedactor.js" "PII Redactor" "M1"
fi
check_file "tests/unit/piiRedactor.test.js" "PII Redactor Tests" "M1"

# ============================================================================
# N. Step 15 — Explainability Ledger & Evidence Pack
# ============================================================================
section_header "N. STEP 15 — EXPLAINABILITY LEDGER"

check_file "server/services/evidenceLedgerService.js" "Evidence Ledger Service" "N2"
check_file "server/routes/aiExplain.js" "AI Explain Routes" "N3"
check_file "server/migrations/005_ai_explainability.sql" "Explainability Migration" "N1"
check_file "server/migrations/006_ai_evidence_ledger.sql" "Evidence Ledger Migration" "N1"
check_file "tests/integration/aiExplainability.test.js" "Explainability Tests" "N"

check_file "components/ai/EvidencePanel.tsx" "Evidence Panel UI" "N5"
check_file "components/ai/ConfidenceBadge.tsx" "Confidence Badge UI" "N5"
check_file "components/ai/PlaybookStepEvidence.tsx" "Playbook Step Evidence" "N5"

check_db_table "ai_evidence_objects" "Evidence Objects Table" "N1"
check_grep "createEvidenceObject\|linkEvidence" "server/services/evidenceLedgerService.js" "Evidence functions" "N2"

# ============================================================================
# O. Step 16 — Human Workflow + SLA + Notifications
# ============================================================================
section_header "O. STEP 16 — HUMAN WORKFLOW + SLA"

check_file "server/services/workqueueService.js" "Workqueue Service" "O2"
check_file "server/services/slaService.js" "SLA Service" "O2"
check_file "server/services/notificationOutboxService.js" "Notification Outbox Service" "O2"
check_file "server/routes/workqueue.js" "Workqueue Routes" "O4"
check_file "server/routes/notificationSettings.js" "Notification Settings Routes" "O4"
check_file "server/cron/scheduler.js" "Cron Scheduler" "O3"

check_file "tests/unit/workqueueService.test.js" "Workqueue Tests" "O"
check_file "tests/unit/slaService.test.js" "SLA Tests" "O"
check_file "tests/unit/notificationOutboxService.test.js" "Notification Outbox Tests" "O"

check_db_table "approval_assignments" "Approval Assignments Table" "O1"
check_db_table "notification_outbox" "Notification Outbox Table" "O1"

# ============================================================================
# P. Step 17 — Integrations & Secrets Platform
# ============================================================================
section_header "P. STEP 17 — INTEGRATIONS & SECRETS"

check_file "server/services/connectorService.js" "Connector Service" "P1"
check_file "server/services/connectorRegistry.js" "Connector Registry" "P1"
check_file "server/services/connectorHealthService.js" "Connector Health Service" "P1"
check_file "server/services/secretsVault.js" "Secrets Vault" "P2"
check_file "server/ai/connectorAdapter.js" "Connector Adapter" "P4"
check_file "server/routes/connectors.js" "Connectors Routes" "P3"

check_file "tests/unit/secretsVault.test.js" "Secrets Vault Tests" "P2"
check_file "tests/unit/connectorRegistry.test.js" "Connector Registry Tests" "P"
check_file "tests/unit/connectorAdapter.test.js" "Connector Adapter Tests" "P4"

check_db_table "connectors" "Connectors Table" "P1"
check_db_table "org_connector_configs" "Org Connector Configs Table" "P1"
check_db_table "connector_health" "Connector Health Table" "P1"

check_grep "AES.?256\|encrypt\|decrypt" "server/services/secretsVault.js" "AES-256 encryption" "P2"

# ============================================================================
# Q. Step 18 — Outcomes, ROI & Analytics
# ============================================================================
section_header "Q. STEP 18 — OUTCOMES, ROI & ANALYTICS"

check_file "server/services/outcomeService.js" "Outcome Service" "Q2"
check_file "server/services/roiService.js" "ROI Service" "Q2"
check_file "server/services/aiAnalyticsService.js" "AI Analytics Service" "Q2"
check_file "server/routes/aiAnalytics.js" "AI Analytics Routes" "Q3"

check_file "components/AIAnalyticsDashboard.tsx" "Analytics Dashboard UI" "Q4"

check_db_table "outcome_definitions" "Outcome Definitions Table" "Q1"
check_db_table "outcome_measurements" "Outcome Measurements Table" "Q1"
check_db_table "roi_models" "ROI Models Table" "Q1"

# ============================================================================
# R. Cross-Cutting Checks
# ============================================================================
section_header "R. CROSS-CUTTING ENTERPRISE CHECKS"

# Check for org_id filtering in key services
if [ "$FULL_CHECK" = true ]; then
  echo ""
  echo -e "${BLUE}Checking org_id isolation...${NC}"
  
  ORG_ISOLATION_FILES=(
    "server/ai/actionDecisionService.js"
    "server/ai/actionExecutionAdapter.js"
    "server/ai/aiPlaybookService.js"
    "server/services/evidenceLedgerService.js"
    "server/services/aiAnalyticsService.js"
  )
  
  for file in "${ORG_ISOLATION_FILES[@]}"; do
    if [ -f "$file" ]; then
      org_count=$(grep -c "organization_id\|org_id\|orgId" "$file" 2>/dev/null || echo "0")
      if [ "$org_count" -gt 0 ]; then
        echo -e "${GREEN}✅${NC} [R1] Org isolation in $(basename $file): $org_count references"
        ((PASS++))
      else
        echo -e "${YELLOW}⚠️${NC} [R1] Org isolation check needed: $(basename $file)"
        ((WARN++))
      fi
    fi
  done
fi

# Check for correlation_id in services
if grep -rq "correlation_id\|correlationId" server/ai/ server/services/ 2>/dev/null; then
  if [ "$JSON_OUTPUT" = false ]; then
    echo -e "${GREEN}✅${NC} [R4] Correlation ID found in codebase"
  fi
  ((PASS++))
else
  if [ "$JSON_OUTPUT" = false ]; then
    echo -e "${YELLOW}⚠️${NC} [R4] Correlation ID not found"
  fi
  ((WARN++))
fi

# Check for PII redaction in exports
if grep -q "redact\|pii\|PII" server/ai/auditExport.js 2>/dev/null; then
  if [ "$JSON_OUTPUT" = false ]; then
    echo -e "${GREEN}✅${NC} [R5] PII redaction in exports"
  fi
  ((PASS++))
else
  if [ "$JSON_OUTPUT" = false ]; then
    echo -e "${YELLOW}⚠️${NC} [R5] PII redaction in exports needs verification"
  fi
  ((WARN++))
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

TOTAL=$((PASS + FAIL + WARN))

if [ "$JSON_OUTPUT" = true ]; then
  echo "{"
  echo "  \"total\": $TOTAL,"
  echo "  \"passed\": $PASS,"
  echo "  \"failed\": $FAIL,"
  echo "  \"warnings\": $WARN,"
  echo "  \"pass_rate\": \"$((PASS * 100 / TOTAL))%\""
  echo "}"
else
  echo -e "${GREEN}✅ PASSED:${NC}   $PASS"
  echo -e "${RED}❌ FAILED:${NC}   $FAIL"
  echo -e "${YELLOW}⚠️  WARNINGS:${NC} $WARN"
  echo ""
  echo -e "Total checks: $TOTAL"
  echo -e "Pass rate: $((PASS * 100 / TOTAL))%"
  echo ""
  
  if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical checks passed!${NC}"
  else
    echo -e "${RED}⚠️  $FAIL critical items need attention.${NC}"
    echo "Run with --full for detailed org isolation checks."
  fi
fi

echo ""
echo "See docs/MASTER_CHECKLIST_AI_ACTIONS.md for the full checklist."
