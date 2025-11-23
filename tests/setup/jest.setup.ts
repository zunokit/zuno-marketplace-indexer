/**
 * Jest Setup File
 * Runs before each test file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.WEBHOOK_ENABLED = 'false';
process.env.WEBHOOK_URL = 'http://localhost:8081/api/webhooks/indexer';
process.env.WEBHOOK_SECRET = 'test-secret';
process.env.WEBHOOK_EVENTS = 'collection.created,collection.minted';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
