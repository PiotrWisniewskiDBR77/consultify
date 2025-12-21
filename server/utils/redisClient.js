// Try to load redis module, fallback to mock if not available
let createClient;
let redisAvailable = false;

try {
    ({ createClient } = require('redis'));
    redisAvailable = true;
    console.log('[Redis] Module loaded successfully');
} catch (err) {
    console.log('[Redis] Module not available, using mock client');
    redisAvailable = false;
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

console.log('[Redis] Initializing client...');

let client;

// Create mock client
const createMockClient = () => ({
    on: () => { },
    connect: async () => { },
    isOpen: true,
    get: async () => null,
    set: async () => 'OK',
    del: async () => 1,
    incr: async () => 1,
    decr: async () => 0,
    expire: async () => 1,
    duplicate: () => client, // Return self or copy
    quit: async () => { },
    // Add other used methods as needed, or use Proxy for catch-all
});

if (process.env.MOCK_REDIS === 'true' || !redisAvailable) {
    console.log('[Redis] Using Mock Client');
    client = createMockClient();
} else {
    client = createClient({
        url: redisUrl
    });

    client.on('error', (err) => console.error('[Redis] Client Error', err));
    client.on('connect', () => console.log('[Redis] Connected'));

    // Connect immediately
    (async () => {
        try {
            if (!client.isOpen) {
                await client.connect();
            }
        } catch (err) {
            console.error('[Redis] Connection Failed:', err);
        }
    })();
}

module.exports = client;
