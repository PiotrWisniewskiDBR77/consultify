const axios = require('axios');

async function testAssessmentDetails() {
    const email = 'piotr.wisniewski@dbr77.com';
    const password = '123456';
    const loginUrl = 'http://localhost:3005/api/auth/login';
    const baseUrl = 'http://localhost:3005/api';

    try {
        const loginRes = await axios.post(loginUrl, { email, password });
        const token = loginRes.data.token;
        console.log('✅ Logged in');

        // Get assessments list first
        const listRes = await axios.get(baseUrl + '/assessments', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (listRes.data.assessments.length === 0) {
            console.log('No assessments found');
            return;
        }

        const firstId = listRes.data.assessments[0].id;
        console.log(`Fetching details for assessment: ${firstId}`);

        const detailRes = await axios.get(`${baseUrl}/assessments/${firstId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('✅ Details fetched');
        console.log(JSON.stringify(detailRes.data, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

testAssessmentDetails();
