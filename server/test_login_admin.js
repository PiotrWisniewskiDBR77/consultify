const axios = require('axios');

async function testLogin() {
    const email = 'admin@dbr77.com';
    const password = '123456';
    const url = 'http://localhost:3005/api/auth/login';

    console.log(`Testing login for ${email} at ${url}...`);

    try {
        const response = await axios.post(url, { email, password });
        console.log('✅ Login successful!');
    } catch (error) {
        console.log('❌ Login failed!');
    }
}

testLogin();
