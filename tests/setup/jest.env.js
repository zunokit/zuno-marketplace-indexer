/**
 * Jest Environment Variables
 * Loaded before tests run
 */

module.exports = {
  NODE_ENV: 'test',
  WEBHOOK_ENABLED: 'true',
  WEBHOOK_URL: 'http://localhost:8081/api/webhooks/indexer',
  WEBHOOK_SECRET: 'test-webhook-secret-123',
  WEBHOOK_EVENTS: 'collection.created,collection.minted,collection.batch_minted',
  WEBHOOK_RETRY_ATTEMPTS: '3',
  WEBHOOK_TIMEOUT: '5000',
  ZUNO_API_URL: 'https://zuno-marketplace-abis.vercel.app/api',
  ZUNO_API_KEY: 'test-api-key',
};
