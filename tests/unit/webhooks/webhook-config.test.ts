/**
 * Webhook Config Tests
 * 
 * Note: Config is hardcoded due to Ponder env caching issues.
 * Tests verify the hardcoded values are correct.
 */

import { loadWebhookConfig, validateWebhookConfig, WebhookConfig } from '@/infrastructure/webhooks/config';

describe('WebhookConfig', () => {
  describe('loadWebhookConfig', () => {
    it('should load hardcoded config values', () => {
      const config = loadWebhookConfig();

      // Hardcoded values for local development
      expect(config.enabled).toBe(true);
      expect(config.url).toBe('http://localhost:4000/webhook');
      expect(config.secret).toBe('test-webhook-secret-min-32-chars!!');
      expect(config.events).toEqual(['*']);
      expect(config.retryAttempts).toBe(3);
      expect(config.timeout).toBe(5000);
    });

    it('should return consistent config on multiple calls', () => {
      const config1 = loadWebhookConfig();
      const config2 = loadWebhookConfig();

      expect(config1.url).toBe(config2.url);
      expect(config1.enabled).toBe(config2.enabled);
      expect(config1.events).toEqual(config2.events);
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
