/**
 * Webhook Configuration
 * 
 * HARDCODED VALUES - Ponder has env caching issues
 * Change values here directly for webhook configuration
 */

const WEBHOOK_CONFIG = {
  enabled: true,
  url: 'http://localhost:4000/webhook',
  secret: 'test-webhook-secret-min-32-chars!!',
  events: ['*'],
  retryAttempts: 3,
  timeout: 5000,
};

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
 * Load webhook configuration (hardcoded values)
 */
export function loadWebhookConfig(): WebhookConfig {
  return {
    enabled: WEBHOOK_CONFIG.enabled,
    url: WEBHOOK_CONFIG.url,
    secret: WEBHOOK_CONFIG.secret,
    events: WEBHOOK_CONFIG.events,
    retryAttempts: WEBHOOK_CONFIG.retryAttempts,
    timeout: WEBHOOK_CONFIG.timeout,
    headers: {},
  };
}

/**
 * Singleton webhook config instance
 */
export const webhookConfig = loadWebhookConfig();

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
