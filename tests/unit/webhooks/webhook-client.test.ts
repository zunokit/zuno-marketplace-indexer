/**
 * Webhook Client Tests
 */

import { WebhookClient, WebhookPayload } from '@/infrastructure/webhooks/client';
import { WebhookConfig } from '@/infrastructure/webhooks/config';

// Mock fetch
global.fetch = jest.fn();

describe('WebhookClient', () => {
  let client: WebhookClient;
  let mockConfig: WebhookConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      enabled: true,
      url: 'http://localhost:8081/api/webhooks/indexer',
      secret: 'test-secret-123',
      events: ['collection.created', 'collection.minted'],
      retryAttempts: 3,
      timeout: 5000,
    };

    client = new WebhookClient(mockConfig);
  });

  describe('sendWebhook', () => {
    const testPayload: WebhookPayload = {
      event: 'collection.created',
      chainId: 31337,
      timestamp: Date.now(),
      data: {
        collectionAddress: '0x1234567890abcdef1234567890abcdef12345678',
        creator: '0xCreatorAddress',
        blockNumber: 12345,
        txHash: '0xTxHash',
      },
    };

    it('should return success when webhook is disabled', async () => {
      const disabledClient = new WebhookClient({ ...mockConfig, enabled: false });

      const result = await disabledClient.sendWebhook(testPayload);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(0);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should send webhook successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await client.sendWebhook(testPayload);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.attempts).toBe(1);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Verify request details
      const [url, options] = (fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(mockConfig.url);
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['X-Webhook-Signature']).toBeDefined();
      expect(options.headers['X-Webhook-Event']).toBe('collection.created');
    });

    it('should retry on server error', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const result = await client.sendWebhook(testPayload);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client error (4xx)', async () => {
      const error: any = new Error('Bad Request');
      error.statusCode = 400;

      (fetch as jest.Mock).mockRejectedValueOnce(error);

      const result = await client.sendWebhook(testPayload);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await client.sendWebhook(testPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.attempts).toBe(4); // initial + 3 retries
    });
  });

  describe('shouldTriggerWebhook', () => {
    it('should return false when disabled', () => {
      const disabledClient = new WebhookClient({ ...mockConfig, enabled: false });

      expect(disabledClient.shouldTriggerWebhook('collection.created')).toBe(false);
    });

    it('should return true for configured events', () => {
      expect(client.shouldTriggerWebhook('collection.created')).toBe(true);
      expect(client.shouldTriggerWebhook('collection.minted')).toBe(true);
    });

    it('should return false for non-configured events', () => {
      expect(client.shouldTriggerWebhook('unknown.event')).toBe(false);
    });

    it('should return true for all events when wildcard is used', () => {
      const wildcardClient = new WebhookClient({ ...mockConfig, events: ['*'] });

      expect(wildcardClient.shouldTriggerWebhook('any.event')).toBe(true);
      expect(wildcardClient.shouldTriggerWebhook('collection.created')).toBe(true);
    });
  });
});
