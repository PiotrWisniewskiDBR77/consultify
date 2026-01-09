/**
 * Pact Configuration
 * Consumer-driven contract testing with Pact.io
 */

module.exports = {
  consumer: {
    name: 'consultinity-frontend',
  },
  provider: {
    name: 'consultinity-backend',
  },
  pactDir: './tests/contracts/pacts',
  logDir: './tests/contracts/logs',
  logLevel: 'INFO',
  spec: 2, // Pact specification version
  cors: true,
  pactfileWriteMode: 'update', // 'overwrite' or 'update'
  dir: './tests/contracts',
  format: 'json',
  // Consumer version
  consumerVersion: process.env.GIT_COMMIT || '1.0.0',
  // Provider version
  providerVersion: process.env.GIT_COMMIT || '1.0.0',
  // Publish to Pact Broker (if configured)
  publishVerificationResult: process.env.CI === 'true',
  // Pact Broker configuration
  pactBrokerUrl: process.env.PACT_BROKER_URL || '',
  pactBrokerUsername: process.env.PACT_BROKER_USERNAME || '',
  pactBrokerPassword: process.env.PACT_BROKER_PASSWORD || '',
  // Tags for consumer/provider versions
  tags: [process.env.GIT_BRANCH || 'main'],
};










