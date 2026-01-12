import axios from 'axios';
import jwt from 'jsonwebtoken';

async function testTokenPayload() {
    const email = 'piotr.wisniewski@dbr77.com';
    const password = '123456';
    const loginUrl = 'http://localhost:3005/api/auth/login';

    try {
        const loginRes = await axios.post(loginUrl, { email, password });
        const token = loginRes.data.token;
        console.log('✅ Logged in');

        const decoded = jwt.decode(token);
        console.log('Token Payload:', JSON.stringify(decoded, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

testTokenPayload();
