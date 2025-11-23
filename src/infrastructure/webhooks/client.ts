/**
 * Webhook Client for HTTP delivery
 */

import { createHmac } from 'crypto';
import type { WebhookConfig } from './config';
import { webhookConfig } from './config';

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  event: string;
  chainId: number;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Webhook delivery result
 */
export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
}

/**
 * WebhookClient handles HTTP delivery of webhook events
 */
export class WebhookClient {
  private config: WebhookConfig;

  constructor(config?: WebhookConfig) {
    this.config = config || webhookConfig;
  }

  /**
   * Send webhook with retry logic
   */
  async sendWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    if (!this.config.enabled) {
      return {
        success: true,
        attempts: 0,
      };
    }

    let lastError: Error | null = null;
    let attempts = 0;

    for (let i = 0; i <= this.config.retryAttempts; i++) {
      attempts = i + 1;

      try {
        const result = await this.deliverWebhook(payload);
        return {
          success: true,
          statusCode: result.status,
          attempts,
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx)
        if (error instanceof Error && 'statusCode' in error) {
          const statusCode = (error as any).statusCode;
          if (statusCode >= 400 && statusCode < 500) {
            break;
          }
        }

        // Wait before retry (exponential backoff)
        if (i < this.config.retryAttempts) {
          const delay = Math.min(1000 * Math.pow(2, i), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      attempts,
    };
  }

  /**
   * Deliver webhook (single attempt)
   */
  private async deliverWebhook(payload: WebhookPayload): Promise<Response> {
    const signature = this.generateSignature(payload);
    const body = JSON.stringify(payload);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.event,
          'User-Agent': 'Zuno-Indexer-Webhook/1.0',
          ...this.config.headers,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error: any = new Error(`Webhook failed with status ${response.status}`);
        error.statusCode = response.status;
        throw error;
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Generate HMAC signature for payload
   */
  private generateSignature(payload: WebhookPayload): string {
    const hmac = createHmac('sha256', this.config.secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Check if event should trigger webhook
   */
  shouldTriggerWebhook(eventName: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (this.config.events.includes('*')) {
      return true;
    }

    return this.config.events.includes(eventName);
  }
}

/**
 * Singleton webhook client instance
 */
export const webhookClient = new WebhookClient();
