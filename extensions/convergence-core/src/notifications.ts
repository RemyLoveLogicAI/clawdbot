/**
 * @fileoverview Auto-Notification System
 * @module convergence-core/notifications
 * @version 1.0.0
 *
 * @description
 * Event-driven notification system that automatically sends alerts
 * through multiple channels. Supports Telegram, Discord, Slack,
 * webhooks, and email.
 *
 * @ai-context
 * - Central notification hub for all convergence events
 * - Multi-channel delivery with fallback
 * - Rate limiting and deduplication
 * - Priority-based routing
 */

import { EventEmitter } from "events";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type NotificationChannel = "telegram" | "discord" | "slack" | "webhook" | "email" | "console";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface NotificationMessage {
  id: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  channel?: NotificationChannel;
  channels?: NotificationChannel[];
  data?: Record<string, unknown>;
  timestamp: number;
  delivered?: boolean;
  deliveredAt?: number;
  error?: string;
}

export interface ChannelConfig {
  telegram?: {
    botToken: string;
    chatId: string;
  };
  discord?: {
    webhookUrl: string;
  };
  slack?: {
    webhookUrl: string;
    channel?: string;
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
  email?: {
    smtpHost: string;
    smtpPort: number;
    from: string;
    to: string[];
  };
}

export interface NotificationRule {
  id: string;
  name: string;
  /** Event patterns to match (supports wildcards) */
  eventPatterns: string[];
  /** Channels to notify */
  channels: NotificationChannel[];
  /** Minimum priority to notify */
  minPriority?: NotificationPriority;
  /** Rate limit: max notifications per minute */
  rateLimit?: number;
  /** Template for notification message */
  template?: {
    title: string;
    body: string;
  };
  enabled: boolean;
}

export interface NotificationConfig {
  /** Channel configurations */
  channels: ChannelConfig;
  /** Notification rules */
  rules: NotificationRule[];
  /** Default channels if none specified */
  defaultChannels: NotificationChannel[];
  /** Enable rate limiting */
  rateLimitEnabled?: boolean;
  /** Global rate limit per minute */
  globalRateLimitPerMinute?: number;
  /** Deduplication window in ms */
  deduplicationWindowMs?: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_RULES: NotificationRule[] = [
  {
    id: "service-down",
    name: "Service Down Alerts",
    eventPatterns: ["service.down", "service.unhealthy"],
    channels: ["telegram", "discord", "console"],
    minPriority: "high",
    template: {
      title: "🚨 Service Down",
      body: "Service {{service}} is down. URL: {{url}}",
    },
    enabled: true,
  },
  {
    id: "service-recovered",
    name: "Service Recovered",
    eventPatterns: ["service.recovered", "service.healed"],
    channels: ["telegram", "console"],
    minPriority: "normal",
    template: {
      title: "✅ Service Recovered",
      body: "Service {{service}} is back online.",
    },
    enabled: true,
  },
  {
    id: "autonomous-decision",
    name: "Autonomous Decision Made",
    eventPatterns: ["decision.*"],
    channels: ["console"],
    minPriority: "normal",
    template: {
      title: "🤖 Autonomous Decision",
      body: "{{type}}: {{reason}}",
    },
    enabled: true,
  },
  {
    id: "critical-errors",
    name: "Critical Errors",
    eventPatterns: ["error.critical", "error.fatal"],
    channels: ["telegram", "discord", "slack"],
    minPriority: "urgent",
    rateLimit: 5,
    template: {
      title: "🔥 Critical Error",
      body: "{{message}}\n\nComponent: {{component}}",
    },
    enabled: true,
  },
  {
    id: "new-user",
    name: "New User Onboarded",
    eventPatterns: ["user.onboarded", "poke.greeting"],
    channels: ["telegram", "console"],
    minPriority: "low",
    template: {
      title: "👋 New User",
      body: "{{username}} has been onboarded.\n\nProfile: {{profile}}",
    },
    enabled: true,
  },
  {
    id: "agent-task-complete",
    name: "Agent Task Complete",
    eventPatterns: ["agent.task.complete"],
    channels: ["console"],
    minPriority: "low",
    template: {
      title: "✅ Task Complete",
      body: "Agent completed: {{task}}\n\nResult: {{result}}",
    },
    enabled: true,
  },
];

// ============================================================================
// Notification Manager
// ============================================================================

export class NotificationManager extends EventEmitter {
  private config: NotificationConfig;
  private history: NotificationMessage[] = [];
  private rateLimitBuckets: Map<string, number[]> = new Map();
  private recentHashes: Set<string> = new Set();

  constructor(config: Partial<NotificationConfig> = {}) {
    super();
    this.config = {
      channels: config.channels || {},
      rules: config.rules || DEFAULT_RULES,
      defaultChannels: config.defaultChannels || ["console"],
      rateLimitEnabled: config.rateLimitEnabled ?? true,
      globalRateLimitPerMinute: config.globalRateLimitPerMinute ?? 60,
      deduplicationWindowMs: config.deduplicationWindowMs ?? 60000,
    };

    // Clean up old rate limit data periodically
    setInterval(() => this.cleanupRateLimits(), 60000);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * @ai-context Send a notification
   */
  async notify(
    title: string,
    body: string,
    options: {
      priority?: NotificationPriority;
      channels?: NotificationChannel[];
      data?: Record<string, unknown>;
    } = {}
  ): Promise<NotificationMessage> {
    const _message: NotificationMessage = {
      id: this.generateId(),
      title,
      body,
      priority: options.priority || "normal",
      channels: options.channels || this.config.defaultChannels,
      data: options.data,
      timestamp: Date.now(),
    };

    // Check for duplicates
    if (this.isDuplicate(message)) {
      this.emit("duplicate", message);
      return message;
    }

    // Check rate limits
    if (this.config.rateLimitEnabled && !this.checkRateLimit(message)) {
      this.emit("rate_limited", message);
      return message;
    }

    // Deliver to all channels
    const results = await Promise.all(
      (message.channels || []).map((channel) => this.deliverToChannel(message, channel))
    );

    message.delivered = results.some((r) => r);
    message.deliveredAt = Date.now();

    this.history.push(message);
    this.emit("sent", message);

    return message;
  }

  /**
   * @ai-context Trigger notification based on event
   */
  async triggerEvent(
    eventName: string,
    data: Record<string, unknown> = {}
  ): Promise<NotificationMessage[]> {
    const matchingRules = this.config.rules.filter(
      (rule) => rule.enabled && this.matchesPattern(eventName, rule.eventPatterns)
    );

    const notifications: NotificationMessage[] = [];

    for (const rule of matchingRules) {
      const title = this.interpolateTemplate(rule.template?.title || eventName, data);
      const body = this.interpolateTemplate(rule.template?.body || JSON.stringify(data), data);

      const message = await this.notify(title, body, {
        priority: this.eventToPriority(eventName, rule.minPriority),
        channels: rule.channels,
        data: { eventName, ruleId: rule.id, ...data },
      });

      notifications.push(message);
    }

    return notifications;
  }

  /**
   * @ai-context Add a notification rule
   */
  addRule(rule: NotificationRule): void {
    this.config.rules.push(rule);
    this.emit("rule_added", rule);
  }

  /**
   * @ai-context Remove a notification rule
   */
  removeRule(ruleId: string): void {
    this.config.rules = this.config.rules.filter((r) => r.id !== ruleId);
    this.emit("rule_removed", ruleId);
  }

  /**
   * @ai-context Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.config.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * @ai-context Configure a channel
   */
  configureChannel(channel: NotificationChannel, config: Record<string, unknown>): void {
    (this.config.channels as Record<string, unknown>)[channel] = config;
    this.emit("channel_configured", { channel, config });
  }

  /**
   * @ai-context Get notification history
   */
  getHistory(limit = 100): NotificationMessage[] {
    return this.history.slice(-limit);
  }

  /**
   * @ai-context Get active rules
   */
  getRules(): NotificationRule[] {
    return [...this.config.rules];
  }

  // ============================================================================
  // Channel Delivery
  // ============================================================================

  private async deliverToChannel(
    _message: NotificationMessage,
    channel: NotificationChannel
  ): Promise<boolean> {
    try {
      switch (channel) {
        case "telegram":
          return await this.sendTelegram(message);
        case "discord":
          return await this.sendDiscord(message);
        case "slack":
          return await this.sendSlack(message);
        case "webhook":
          return await this.sendWebhook(message);
        case "console":
          return this.sendConsole(message);
        default:
          return false;
      }
    } catch (error) {
      message.error = String(error);
      this.emit("delivery_error", { message, channel, error });
      return false;
    }
  }

  private async sendTelegram(_message: NotificationMessage): Promise<boolean> {
    const config = this.config.channels.telegram;
    if (!config?.botToken || !config?.chatId) {
      // Try environment variables
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) return false;

      return this.sendTelegramRequest(botToken, chatId, message);
    }

    return this.sendTelegramRequest(config.botToken, config.chatId, message);
  }

  private async sendTelegramRequest(
    botToken: string,
    chatId: string,
    _message: NotificationMessage
  ): Promise<boolean> {
    const emoji = this.getPriorityEmoji(message.priority);
    const text = `${emoji} *${this.escapeMarkdown(message.title)}*\n\n${this.escapeMarkdown(message.body)}`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    return response.ok;
  }

  private async sendDiscord(_message: NotificationMessage): Promise<boolean> {
    const config = this.config.channels.discord;
    const webhookUrl = config?.webhookUrl || process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return false;

    const color = this.getPriorityColor(message.priority);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: message.title,
            description: message.body,
            color,
            timestamp: new Date(message.timestamp).toISOString(),
            footer: { text: `Priority: ${message.priority}` },
          },
        ],
      }),
    });

    return response.ok;
  }

  private async sendSlack(_message: NotificationMessage): Promise<boolean> {
    const config = this.config.channels.slack;
    const webhookUrl = config?.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return false;

    const emoji = this.getPriorityEmoji(message.priority);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${emoji} *${message.title}*`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: `${emoji} ${message.title}` },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: message.body },
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: `Priority: ${message.priority} | ${new Date(message.timestamp).toISOString()}` },
            ],
          },
        ],
      }),
    });

    return response.ok;
  }

  private async sendWebhook(_message: NotificationMessage): Promise<boolean> {
    const config = this.config.channels.webhook;
    const url = config?.url || process.env.NOTIFICATION_WEBHOOK_URL;
    if (!url) return false;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config?.headers,
      },
      body: JSON.stringify({
        id: message.id,
        title: message.title,
        body: message.body,
        priority: message.priority,
        data: message.data,
        timestamp: message.timestamp,
      }),
    });

    return response.ok;
  }

  private sendConsole(_message: NotificationMessage): boolean {
    const emoji = this.getPriorityEmoji(message.priority);
    const colors: Record<NotificationPriority, string> = {
      low: "\x1b[37m",
      normal: "\x1b[36m",
      high: "\x1b[33m",
      urgent: "\x1b[31m",
    };
    const reset = "\x1b[0m";

    console.log(
      `${colors[message.priority]}[NOTIFY] ${emoji} ${message.title}${reset}\n${message.body}\n`
    );
    return true;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private matchesPattern(eventName: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return regex.test(eventName);
    });
  }

  private interpolateTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = data[key];
      if (value === undefined) return `{{${key}}}`;
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    });
  }

  private isDuplicate(_message: NotificationMessage): boolean {
    const hash = this.hashMessage(message);
    if (this.recentHashes.has(hash)) {
      return true;
    }

    this.recentHashes.add(hash);
    setTimeout(() => {
      this.recentHashes.delete(hash);
    }, this.config.deduplicationWindowMs);

    return false;
  }

  private hashMessage(_message: NotificationMessage): string {
    return `${message.title}:${message.body}:${message.priority}`;
  }

  private checkRateLimit(_message: NotificationMessage): boolean {
    const key = "global";
    const now = Date.now();
    const windowMs = 60000;

    let bucket = this.rateLimitBuckets.get(key) || [];
    bucket = bucket.filter((t) => t > now - windowMs);

    if (bucket.length >= (this.config.globalRateLimitPerMinute || 60)) {
      return false;
    }

    bucket.push(now);
    this.rateLimitBuckets.set(key, bucket);
    return true;
  }

  private cleanupRateLimits(): void {
    const now = Date.now();
    const windowMs = 60000;

    for (const [key, bucket] of this.rateLimitBuckets) {
      const filtered = bucket.filter((t) => t > now - windowMs);
      if (filtered.length === 0) {
        this.rateLimitBuckets.delete(key);
      } else {
        this.rateLimitBuckets.set(key, filtered);
      }
    }
  }

  private eventToPriority(
    eventName: string,
    defaultPriority?: NotificationPriority
  ): NotificationPriority {
    if (eventName.includes("critical") || eventName.includes("fatal")) return "urgent";
    if (eventName.includes("error") || eventName.includes("down")) return "high";
    if (eventName.includes("warning") || eventName.includes("degraded")) return "normal";
    return defaultPriority || "low";
  }

  private getPriorityEmoji(priority: NotificationPriority): string {
    const emojis: Record<NotificationPriority, string> = {
      low: "ℹ️",
      normal: "📢",
      high: "⚠️",
      urgent: "🚨",
    };
    return emojis[priority];
  }

  private getPriorityColor(priority: NotificationPriority): number {
    const colors: Record<NotificationPriority, number> = {
      low: 0x808080,
      normal: 0x3498db,
      high: 0xf39c12,
      urgent: 0xe74c3c,
    };
    return colors[priority];
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
  }

  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

// Export singleton instance
export const notifications = new NotificationManager();
