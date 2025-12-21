const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const TrialService = require('../services/trialService');
const OrganizationService = require('../services/organizationService');
const TokenBillingService = require('../services/tokenBillingService');
const ConsultantService = require('../services/consultantService');
const AiService = require('../services/aiService'); // We will mock dependencies if needed
const AccessPolicyService = require('../services/accessPolicyService');

// MOCK DEPENDENCIES for AI Service to avoid real LLM calls
AiService.setDependencies({
    LLMProvider: {
        generateText: async () => ({ text: "Mock AI Response" })
    },
    // Keep real DB and TokenBilling
});

const fs = require('fs');
const path = require('path');

async function runVerification() {
    console.log(">>> STARTING FINAL INTEGRATION VERIFICATION <<<");


    // DB Deletion handled by external command to avoid I/O errors
    // const dbPath = path.resolve(__dirname, '../consultify.db');
    // if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    const db = require('../database'); // This will re-init
    if (db.initPromise) {
        console.log("   -> Waiting for DB Init...");
        await db.initPromise;
        console.log("   -> DB Ready.");
    }
    const { v4: uuidv4 } = require('uuid');
    const TrialService = require('../services/trialService');

    const userId = uuidv4();
    const consultantId = uuidv4();
    const trialOrgId = uuidv4();

    try {
        // SETUP: clear data or just use new IDs (safer)

        // 1. Create User
        console.log(`1. Creating User: ${userId}`);
        // Based on auth.js, users table uses 'password', 'first_name', 'last_name'
        await new Promise((res, rej) => {
            db.run("INSERT INTO users (id, email, password, first_name, last_name) VALUES (?, ?, 'hash', 'Test', 'User')",
                [userId, `test-${userId}@example.com`], (err) => err ? rej(err) : res());
        });

        // 2. Create Trial Org
        console.log(`2. Creating Trial Org: ${trialOrgId}`);
        // Manually or via Service? Let's use manual to ensure specific state if Service is complex, 
        // but Service is better for integration test.
        // Assuming AccessPolicyService helps creation? Or standard manual insert for speed.
        await new Promise((res, rej) => {
            db.run("INSERT INTO organizations (id, name, status, organization_type, created_by_user_id, token_balance, billing_status) VALUES (?, 'Trial Org', 'active', 'TRIAL', ?, 100, 'PENDING')",
                [trialOrgId, userId], (err) => err ? rej(err) : res());
        });

        // Add User as Owner
        await new Promise((res, rej) => {
            db.run("INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES (?, ?, ?, 'OWNER', 'ACTIVE')",
                [uuidv4(), trialOrgId, userId], (err) => err ? rej(err) : res());
        });

        // 3. Verify Trial Conversion
        console.log("3. Testing convertTrialToOrg...");
        const newOrgName = "Converted Enterprise Org";
        const conversionResult = await TrialService.convertTrialToOrg(trialOrgId, userId, newOrgName);
        console.log("   -> Conversion Result:", conversionResult);

        const newOrgId = conversionResult.newOrganizationId;
        if (!newOrgId) throw new Error("Conversion failed to return newOrgId");

        // Verify Old Org is Locked
        const oldOrg = await new Promise(res => db.get("SELECT status, is_active FROM organizations WHERE id = ?", [trialOrgId], (e, r) => res(r)));
        console.log("   -> Old Org Status:", oldOrg.status);
        if (oldOrg.status !== 'CONVERTED') throw new Error("Old Org not marked CONVERTED");

        // Verify New Org Created
        const newOrg = await new Promise(res => db.get("SELECT status, billing_status, organization_type FROM organizations WHERE id = ?", [newOrgId], (e, r) => res(r)));
        console.log("   -> New Org Status:", newOrg);
        if (newOrg.billing_status !== 'PENDING') throw new Error("New Org billing_status should be PENDING initially");

        // 4. Activate Billing
        console.log("4. Activating Billing...");
        const billingResult = await OrganizationService.activateBilling(newOrgId);
        console.log("   -> Billing Activation:", billingResult);

        const activeOrg = await new Promise(res => db.get("SELECT billing_status, organization_type, token_balance FROM organizations WHERE id = ?", [newOrgId], (e, r) => res(r)));
        console.log("   -> Active Org State:", activeOrg);
        if (activeOrg.billing_status !== 'ACTIVE') throw new Error("Billing Activation Failed");
        if (activeOrg.token_balance < 100000) throw new Error("Initial Tokens not credited");

        // 5. Test AI Token Deduction (Org Level)
        console.log("5. Testing AI Token Deduction (Org Level)...");
        const initialBalance = activeOrg.token_balance;

        // Simulate Token Deduction call (mocking AI Service call internal)
        await TokenBillingService.deductTokens(userId, 500, 'platform', {
            organizationId: newOrgId,
            llmProvider: 'test',
            modelUsed: 'test-model'
        });

        const postDeductionOrg = await new Promise(res => db.get("SELECT token_balance FROM organizations WHERE id = ?", [newOrgId], (e, r) => res(r)));
        console.log(`   -> Balance: ${initialBalance} -> ${postDeductionOrg.token_balance}`);

        if (postDeductionOrg.token_balance !== initialBalance - 500) {
            throw new Error(`Token Deduction Failed. Expected ${initialBalance - 500}, got ${postDeductionOrg.token_balance}`);
        }

        // 6. Test Consultant Invite & Linking
        console.log("6. Testing Consultant Invite & Linking...");
        // Register Consultant
        await db.run("INSERT INTO consultants (id, display_name, status) VALUES (?, 'Dr. Consultant', 'ACTIVE')", [consultantId]);

        // Create Invite
        const invite = await ConsultantService.createInvite({
            consultantId,
            type: 'ORG_ADD_CONSULTANT',
            targetCompanyName: newOrgName
        });
        console.log("   -> Invite Created:", invite.code);

        // Accept Invite (Passing newOrgId as targetOrganizationId)
        console.log("   -> Accepting Invite...");
        const acceptResult = await ConsultantService.acceptInvite(invite.code, userId, newOrgId);
        console.log("   -> Invite Accepted:", acceptResult);

        // Verify Link
        const links = await ConsultantService.getLinkedOrganizations(consultantId);
        console.log("   -> Linked Orgs:", links.map(l => l.name));

        const linkedOrg = links.find(l => l.id === newOrgId);
        if (!linkedOrg) throw new Error("Consultant Link NOT found after acceptInvite");
        if (linkedOrg.link_status !== 'ACTIVE') throw new Error("Link Status is not ACTIVE");

        console.log(">>> VERIFICATION SUCCESS (All Steps including Consultant) <<<");
        process.exit(0);

    } catch (e) {
        console.error("!!! VERIFICATION FAILED !!!");
        console.error(e);
        process.exit(1);
    }
}

runVerification();
