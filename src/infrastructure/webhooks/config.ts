/**
 * Webhook Configuration
 */

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  secret: string;
  events: string[];
  retryAttempts: number;
  timeout: number;
  headers?: Record<string, string>;
}

/**
 * Load webhook configuration from environment variables
 */
export function loadWebhookConfig(): WebhookConfig {
  return {
    enabled: process.env.WEBHOOK_ENABLED === 'true',
    url: process.env.WEBHOOK_URL || '',
    secret: process.env.WEBHOOK_SECRET || '',
    events: process.env.WEBHOOK_EVENTS?.split(',').map((e) => e.trim()) || [],
    retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3', 10),
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '5000', 10),
    headers: process.env.WEBHOOK_HEADERS
      ? JSON.parse(process.env.WEBHOOK_HEADERS)
      : {},
  };
}

/**
 * Singleton webhook config instance
 */
export const webhookConfig = loadWebhookConfig();

// Debug log webhook config on load
console.log('[WEBHOOK CONFIG]', {
  enabled: webhookConfig.enabled,
  url: webhookConfig.url,
  events: webhookConfig.events,
  secret: webhookConfig.secret ? '***' : 'MISSING',
});

/**
 * Validate webhook configuration
 */
export function validateWebhookConfig(config: WebhookConfig): void {
  if (config.enabled) {
    if (!config.url) {
      throw new Error('WEBHOOK_URL is required when webhooks are enabled');
    }
    if (!config.secret) {
      throw new Error('WEBHOOK_SECRET is required when webhooks are enabled');
    }
    if (config.events.length === 0) {
      throw new Error('WEBHOOK_EVENTS must include at least one event');
    }
  }
}

// Validate config on load
if (webhookConfig.enabled) {
  validateWebhookConfig(webhookConfig);
}
