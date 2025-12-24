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
        url: redisUrl,
        socket: {
            connectTimeout: 2000, // 2 second timeout
            reconnectStrategy: false // Don't reconnect - fail fast
        }
    });

    client.on('error', (err) => console.error('[Redis] Client Error', err.message));
    client.on('connect', () => console.log('[Redis] Connected'));

    // Connect immediately with timeout
    (async () => {
        try {
            if (!client.isOpen) {
                // Add timeout to prevent hanging
                const connectPromise = client.connect();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Redis connection timeout')), 2000)
                );
                await Promise.race([connectPromise, timeoutPromise]);
                console.log('[Redis] Successfully connected');
            }
        } catch (err) {
            console.error('[Redis] Connection Failed:', err.message);
            // Fallback to mock on connection failure
            console.log('[Redis] Falling back to Mock Client');
            const mockClient = createMockClient();
            // Replace the broken client with mock
            Object.keys(mockClient).forEach(key => {
                client[key] = mockClient[key];
            });
        }
    })();
}

module.exports = client;
