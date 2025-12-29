const axios = require('axios');

async function testLogin() {
    const email = 'piotr.wisniewski@dbr77.com';
    const password = '123456';
    const url = 'http://localhost:3005/api/auth/login';

    console.log(`Testing login for ${email} at ${url}...`);

    try {
        const response = await axios.post(url, { email, password });
        console.log('✅ Login successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ Login failed!');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error message:', error.message);
        }
    }
}

testLogin();
