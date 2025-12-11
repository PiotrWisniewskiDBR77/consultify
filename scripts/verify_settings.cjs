const http = require('http');

// Helper to make requests
function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3006,
            path: '/api/settings' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, body: json });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('--- Verifying Settings API ---');

    // 1. Get Notification Preferences (should fail without userId)
    console.log('\n1. Test GET /notifications (No ID)');
    const res1 = await request('GET', '/notifications');
    console.log(`Status: ${res1.status}, Error: ${res1.body.error}`);

    // 2. Update Notification Preferences
    console.log('\n2. Test POST /notifications');
    const userId = 'user-dbr77-admin'; // Using seeded user
    const prefs = {
        taskAssignment: { email: false, inApp: true },
        test: true
    };
    const res2 = await request('POST', '/notifications', { userId, preferences: prefs });
    console.log(`Status: ${res2.status}, Success: ${res2.body.success}`);

    // 3. Get Notification Preferences (should have updated values)
    console.log('\n3. Test GET /notifications (With ID)');
    const res3 = await request('GET', `/notifications?userId=${userId}`);
    console.log(`Status: ${res3.status}`);
    console.log('Prefs:', JSON.stringify(res3.body, null, 2));

    // 4. Test Integrations (Add)
    console.log('\n4. Test POST /integrations');
    const orgId = 'org-dbr77-test';
    const integration = {
        organizationId: orgId,
        provider: 'slack',
        config: { webhook_url: 'https://hooks.slack.com/services/T123/B456/789', api_token: 'secret-token' }
    };
    const res4 = await request('POST', '/integrations', integration);
    console.log(`Status: ${res4.status}, ID: ${res4.body.id}`);
    const intId = res4.body.id;

    // 5. Test Integrations (List)
    console.log('\n5. Test GET /integrations');
    const res5 = await request('GET', `/integrations?organizationId=${orgId}`);
    console.log(`Status: ${res5.status}`);
    const addedInt = res5.body.find(i => i.id === intId);
    console.log('Found Integration:', addedInt ? 'Yes' : 'No');
    if (addedInt) {
        console.log('Masked Token:', addedInt.config.api_token);
        console.log('Masked URL:', addedInt.config.webhook_url);
    }

    // 6. Test Integrations (Delete)
    console.log('\n6. Test DELETE /integrations');
    if (intId) {
        const res6 = await request('DELETE', `/integrations/${intId}`);
        console.log(`Status: ${res6.status}, Success: ${res6.body.success}`);

        // Verify deleted
        const res7 = await request('GET', `/integrations?organizationId=${orgId}`);
        const deletedInt = res7.body.find(i => i.id === intId);
        console.log('Integration still exists:', deletedInt ? 'Yes' : 'No');
    }

    console.log('\n--- Verification Complete ---');
}

runTests().catch(console.error);
