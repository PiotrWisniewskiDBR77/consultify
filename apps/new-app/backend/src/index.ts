/**
 * New Application Fork - Backend Entry Point
 *
 * This is a skeleton for the new application fork.
 * Use @consultinity/shared for common functionality.
 */

import express from 'express';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'new-app',
    version: '0.0.1',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to New App API',
    docs: '/api/docs',
    health: '/health',
  });
});

// Start server
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`[New App Backend] Server running on port ${PORT}`);
  });
}

export { app };
