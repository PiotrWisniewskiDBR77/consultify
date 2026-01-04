import axios from 'axios';

async function testAssessments() {
    const email = 'piotr.wisniewski@dbr77.com';
    const password = '123456';
    const loginUrl = 'http://localhost:3005/api/auth/login';
    const assessmentsUrl = 'http://localhost:3005/api/assessments';

    try {
        const loginRes = await axios.post(loginUrl, { email, password });
        const token = loginRes.data.token;
        console.log('✅ Logged in');
        console.log('User ID:', loginRes.data.user.id);
        console.log('Org ID:', loginRes.data.user.organizationId);
        console.log('Last selected Org:', loginRes.data.user.lastSelectedOrganizationId);
        console.log('Is Superadmin:', loginRes.data.user.role === 'SUPERADMIN');

        const assessRes = await axios.get(assessmentsUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Assessments fetched');
        console.log('Count:', assessRes.data.total);
        console.log('First assessment:', JSON.stringify(assessRes.data.assessments[0], null, 2));
    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

testAssessments();
