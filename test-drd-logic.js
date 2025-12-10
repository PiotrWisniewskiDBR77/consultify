import { strict as assert } from 'assert';

const API_URL = 'http://localhost:3001/api';

async function run() {
    console.log("Starting DRD Logic Verification...");

    // 1. Login
    console.log("1. Logging in...");
    const email = 'piotr.wisniewski@dbr77.com';
    const password = '123456';
    let token;
    let userId;

    try {
        // Skip Register, try Login directly with seeded user
        // Login
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!loginRes.ok) {
            const err = await loginRes.json();
            throw new Error(`Login failed: ${JSON.stringify(err)}`);
        }

        const loginData = await loginRes.json();
        token = loginData.token;
        userId = loginData.user.id;
        console.log("   Logged in as", email);
    } catch (e) {
        console.error("   Login failed - Ensure DB is seeded properly.", e.message);
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // 2. Create Initiative
    console.log("2. Creating Initiative...");
    let initiativeId;
    try {
        const res = await fetch(`${API_URL}/initiatives`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: "DRD Test Initiative",
                axis: "processes",
                summary: "Testing DRD Logic",
                startDate: new Date().toISOString(),
                ownerBusinessId: userId
            })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Create Init Failed: ${JSON.stringify(err)}`);
        }
        const data = await res.json();
        initiativeId = data.id;
        console.log("   Initiative Created:", initiativeId);
    } catch (e) {
        console.error("   Create Initiative failed", e.message);
        return;
    }

    // 3. Create Design Task
    console.log("3. Creating Design Task...");
    let designTaskId;
    try {
        const res = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                initiativeId,
                title: "Design Specs",
                stepPhase: "design",
                status: "not_started"
            })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Create Design Task Failed: ${JSON.stringify(err)}`);
        }
        const data = await res.json();
        designTaskId = data.id;
        console.log("   Design Task Created:", designTaskId);
    } catch (e) {
        console.error("   Create Design Task failed", e.message);
        return;
    }

    // 4. Create Pilot Task
    console.log("4. Creating Pilot Task...");
    let pilotTaskId;
    try {
        const res = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                initiativeId,
                title: "Run Pilot",
                stepPhase: "pilot",
                status: "not_started"
            })
        });
        if (!res.ok) throw new Error(`Create Pilot Task Failed: ${res.statusText}`);
        const data = await res.json();
        pilotTaskId = data.id;
        console.log("   Pilot Task Created:", pilotTaskId);
    } catch (e) {
        console.error("   Create Pilot Task failed", e.message);
        return;
    }

    // 5. Try to Start Pilot (Should Fail)
    console.log("5. Attempting to Start Pilot Task (Should Fail)...");
    try {
        const res = await fetch(`${API_URL}/tasks/${pilotTaskId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: "in_progress" })
        });

        if (res.ok) {
            console.error("   ERROR: Start Pilot succeeded, but should have failed!");
        } else if (res.status === 400) {
            const err = await res.json();
            console.log("   Success: Start Pilot failed as expected with 400:", err.error);
        } else {
            const err = await res.json();
            console.error("   ERROR: Unexpected error", res.status, err);
        }
    } catch (e) {
        console.error("   ERROR: Request failed", e.message);
    }

    // 6. Complete Design Task
    console.log("6. Completing Design Task...");
    try {
        const res = await fetch(`${API_URL}/tasks/${designTaskId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: "completed" })
        });
        if (!res.ok) throw new Error(`Complete Design Task Failed: ${res.statusText}`);
        console.log("   Design Task Completed.");
    } catch (e) {
        console.error("   Complete Design Task failed", e.message);
        return;
    }

    // 7. Try to Start Pilot (Should Succeed)
    console.log("7. Attempting to Start Pilot Task (Should Succeed)...");
    try {
        const res = await fetch(`${API_URL}/tasks/${pilotTaskId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: "in_progress" })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Start Pilot Failed: ${JSON.stringify(err)}`);
        }
        console.log("   Success: Pilot Task Started.");
    } catch (e) {
        console.error("   ERROR: Start Pilot failed", e.message);
    }

    console.log("Verification Complete.");
}

run();
