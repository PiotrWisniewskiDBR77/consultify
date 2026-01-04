import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 run scripts/load-tests/load-test-10k.js

export const options = {
    stages: [
        { duration: '30s', target: 20 }, // Wrap up to 20 users
        { duration: '1m', target: 20 },  // Stay at 20 users
        { duration: '30s', target: 50 }, // Ramp up to 50 users
        { duration: '1m', target: 50 },  // Stay at 50 users
        { duration: '30s', target: 0 },  // Scale down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
        http_req_failed: ['rate<0.01'],   // http errors should be less than 1%
    },
};

export default function () {
    // 1. Health Check (Lightweight)
    const resHealth = http.get('http://localhost:3000/api/health');
    check(resHealth, {
        'status is 200': (r) => r.status === 200,
    });

    // 2. Organization List (Simulates DB Access)
    // Note: Ensure the server is running with the test DB or appropriate seed
    const resOrgs = http.get('http://localhost:3000/api/organizations');
    check(resOrgs, {
        'status is 200 or 401': (r) => r.status === 200 || r.status === 401, // 401 expected if no auth token
    });

    sleep(1);
}
