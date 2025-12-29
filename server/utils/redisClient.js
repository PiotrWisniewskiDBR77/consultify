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

let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Check if Railway variable expansion didn't work (still contains ${{)
if (redisUrl && redisUrl.includes('${{')) {
    console.warn('[Redis] REDIS_URL appears to contain unexpanded Railway variable:', redisUrl);
    console.warn('[Redis] Falling back to individual REDIS_* variables or mock client');
    redisUrl = null; // Force fallback
}

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

if (process.env.MOCK_REDIS === 'true' || !redisAvailable || !redisUrl) {
    if (!redisUrl) {
        console.log('[Redis] No REDIS_URL configured, using Mock Client');
    } else {
        console.log('[Redis] Using Mock Client');
    }
    client = createMockClient();
} else {
    const connectTimeout = parseInt(process.env.REDIS_CONNECT_TIMEOUT || '30000', 10); // 30 seconds default for Railway
    const commandTimeout = parseInt(process.env.REDIS_COMMAND_TIMEOUT || '10000', 10); // 10 seconds for commands
    
    console.log(`[Redis] Connecting to: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password in logs
    
    client = createClient({
        url: redisUrl,
        socket: {
            connectTimeout: connectTimeout,
            commandTimeout: commandTimeout,
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    console.error('[Redis] Max reconnection attempts exceeded');
                    return new Error('Max reconnection attempts exceeded');
                }
                const delay = Math.min(1000 * Math.pow(2, retries), 30000);
                console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${retries})`);
                return delay;
            }
        }
    });

    client.on('error', (err) => console.error('[Redis] Client Error', err.message));
    client.on('connect', () => console.log('[Redis] Connecting...'));
    client.on('ready', () => console.log('[Redis] Connected and ready'));

    // Connect immediately with timeout
    (async () => {
        try {
            if (!client.isOpen) {
                // Add timeout to prevent hanging
                const connectPromise = client.connect();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Redis connection timeout')), connectTimeout)
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
