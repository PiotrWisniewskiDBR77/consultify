const axios = require('axios');

async function testAllData() {
    const email = 'piotr.wisniewski@dbr77.com';
    const password = '123456';
    const loginUrl = 'http://localhost:3005/api/auth/login';
    const baseUrl = 'http://localhost:3005/api';

    try {
        const loginRes = await axios.post(loginUrl, { email, password });
        const token = loginRes.data.token;
        console.log('✅ Logged in');
        console.log('User ID:', loginRes.data.user.id);
        console.log('Org ID:', loginRes.data.user.organizationId);

        const endpoints = [
            '/assessments',
            '/assessment-reports',
            '/projects',
            '/initiatives',
            '/tasks',
            '/teams'
        ];

        for (const endpoint of endpoints) {
            try {
                const res = await axios.get(baseUrl + endpoint, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const count = res.data.total !== undefined ? res.data.total : (Array.isArray(res.data) ? res.data.length : 'N/A');
                console.log(`✅ ${endpoint}: ${count} records`);
            } catch (err) {
                console.log(`❌ ${endpoint}: ${err.response ? err.response.status : err.message}`);
            }
        }
    } catch (error) {
        console.error('❌ Login Error:', error.response ? error.response.data : error.message);
    }
}

testAllData();
