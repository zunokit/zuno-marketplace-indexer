/**
 * Webhook Config Tests
 */

import { loadWebhookConfig, validateWebhookConfig, WebhookConfig } from '@/infrastructure/webhooks/config';

describe('WebhookConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadWebhookConfig', () => {
    it('should load config from environment variables', () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_URL = 'http://test.com/webhook';
      process.env.WEBHOOK_SECRET = 'test-secret';
      process.env.WEBHOOK_EVENTS = 'event1,event2,event3';
      process.env.WEBHOOK_RETRY_ATTEMPTS = '5';
      process.env.WEBHOOK_TIMEOUT = '10000';

      const config = loadWebhookConfig();

      expect(config.enabled).toBe(true);
      expect(config.url).toBe('http://test.com/webhook');
      expect(config.secret).toBe('test-secret');
      expect(config.events).toEqual(['event1', 'event2', 'event3']);
      expect(config.retryAttempts).toBe(5);
      expect(config.timeout).toBe(10000);
    });

    it('should use defaults when env vars not set', () => {
      delete process.env.WEBHOOK_ENABLED;
      delete process.env.WEBHOOK_URL;
      delete process.env.WEBHOOK_SECRET;
      delete process.env.WEBHOOK_EVENTS;
      delete process.env.WEBHOOK_RETRY_ATTEMPTS;
      delete process.env.WEBHOOK_TIMEOUT;

      const config = loadWebhookConfig();

      expect(config.enabled).toBe(false);
      expect(config.url).toBe('');
      expect(config.secret).toBe('');
      expect(config.events).toEqual([]);
      expect(config.retryAttempts).toBe(3);
      expect(config.timeout).toBe(5000);
    });

    it('should trim event names', () => {
      process.env.WEBHOOK_EVENTS = ' event1 , event2 , event3 ';

      const config = loadWebhookConfig();

      expect(config.events).toEqual(['event1', 'event2', 'event3']);
    });
  });

  describe('validateWebhookConfig', () => {
    it('should pass validation when disabled', () => {
      const config: WebhookConfig = {
        enabled: false,
        url: '',
        secret: '',
        events: [],
        retryAttempts: 3,
        timeout: 5000,
      };

      expect(() => validateWebhookConfig(config)).not.toThrow();
    });

    it('should throw error when enabled but no URL', () => {
      const config: WebhookConfig = {
        enabled: true,
        url: '',
        secret: 'secret',
        events: ['event'],
        retryAttempts: 3,
        timeout: 5000,
      };

      expect(() => validateWebhookConfig(config)).toThrow('WEBHOOK_URL is required');
    });

    it('should throw error when enabled but no secret', () => {
      const config: WebhookConfig = {
        enabled: true,
        url: 'http://test.com',
        secret: '',
        events: ['event'],
        retryAttempts: 3,
        timeout: 5000,
      };

      expect(() => validateWebhookConfig(config)).toThrow('WEBHOOK_SECRET is required');
    });

    it('should throw error when enabled but no events', () => {
      const config: WebhookConfig = {
        enabled: true,
        url: 'http://test.com',
        secret: 'secret',
        events: [],
        retryAttempts: 3,
        timeout: 5000,
      };

      expect(() => validateWebhookConfig(config)).toThrow('WEBHOOK_EVENTS must include at least one event');
    });

    it('should pass validation with valid config', () => {
      const config: WebhookConfig = {
        enabled: true,
        url: 'http://test.com/webhook',
        secret: 'super-secret',
        events: ['collection.created'],
        retryAttempts: 3,
        timeout: 5000,
      };

      expect(() => validateWebhookConfig(config)).not.toThrow();
    });
  });
});
