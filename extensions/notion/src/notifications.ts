/**
 * @fileoverview Notion Notification Provider
 * @module notion/notifications
 * @version 1.0.0
 *
 * @description
 * Notion notification provider for the convergence notification system.
 * Sends notifications to Notion pages, databases, and comments.
 *
 * @ai-context
 * - Integrates with convergence-core notification system
 * - Creates pages for notifications
 * - Adds database items for tracking
 * - Appends to log pages
 */

import type { NotionClient, NotionPage } from "./client.js";

// ============================================================================
// Types
// ============================================================================

export interface NotionNotificationConfig {
  /** Notion client instance */
  client: NotionClient;
  /** Database ID for notification log */
  logDatabaseId?: string;
  /** Page ID to append notifications to */
  logPageId?: string;
  /** Create separate pages for each notification */
  createPages?: boolean;
  /** Parent page ID for created pages */
  parentPageId?: string;
  /** Include timestamp in notifications */
  includeTimestamp?: boolean;
  /** Emoji icons for priority levels */
  priorityIcons?: {
    low?: string;
    normal?: string;
    high?: string;
    urgent?: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  priority?: "low" | "normal" | "high" | "urgent";
  data?: Record<string, unknown>;
  timestamp?: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_PRIORITY_ICONS = {
  low: "ℹ️",
  normal: "📢",
  high: "⚠️",
  urgent: "🚨",
};

// ============================================================================
// Notion Notification Provider
// ============================================================================

export class NotionNotificationProvider {
  private client: NotionClient;
  private config: NotionNotificationConfig;

  constructor(config: NotionNotificationConfig) {
    this.client = config.client;
    this.config = {
      ...config,
      includeTimestamp: config.includeTimestamp ?? true,
      priorityIcons: { ...DEFAULT_PRIORITY_ICONS, ...config.priorityIcons },
    };
  }

  /**
   * @ai-context Send a notification to Notion
   */
  async send(notification: NotificationPayload): Promise<{ success: boolean; pageId?: string; url?: string }> {
    const priority = notification.priority || "normal";
    const icon = this.config.priorityIcons?.[priority] || "📢";
    const timestamp = notification.timestamp || Date.now();

    try {
      // Method 1: Create a page for the notification
      if (this.config.createPages && this.config.parentPageId) {
        return await this.createNotificationPage(notification, icon, timestamp);
      }

      // Method 2: Add to notification database
      if (this.config.logDatabaseId) {
        return await this.addToDatabaseLog(notification, icon, timestamp);
      }

      // Method 3: Append to log page
      if (this.config.logPageId) {
        return await this.appendToLogPage(notification, icon, timestamp);
      }

      throw new Error("No notification destination configured");
    } catch (error) {
      console.error("[Notion Notifications] Error sending notification:", error);
      return { success: false };
    }
  }

  /**
   * @ai-context Create a dedicated page for the notification
   */
  private async createNotificationPage(
    notification: NotificationPayload,
    icon: string,
    timestamp: number
  ): Promise<{ success: boolean; pageId?: string; url?: string }> {
    const title = `${icon} ${notification.title}`;
    const content = this.formatNotificationContent(notification, timestamp);

    const page = await this.client.createPage({
      parent: { type: "page_id", page_id: this.config.parentPageId! },
      properties: {
        title: { title: [{ type: "text", text: { content: title } }] },
      },
      children: this.markdownToBlocks(content),
      icon: { type: "emoji", emoji: icon },
    });

    console.log(`[Notion Notifications] Created notification page: ${page.url}`);
    return { success: true, pageId: page.id, url: page.url };
  }

  /**
   * @ai-context Add notification as database entry
   */
  private async addToDatabaseLog(
    notification: NotificationPayload,
    icon: string,
    timestamp: number
  ): Promise<{ success: boolean; pageId?: string; url?: string }> {
    const db = await this.client.getDatabase(this.config.logDatabaseId!);

    // Build properties based on database schema
    const properties: Record<string, unknown> = {};

    // Find title property
    const titleProp = Object.entries(db.properties).find(([_, p]) => p.type === "title");
    if (titleProp) {
      properties[titleProp[0]] = {
        title: [{ type: "text", text: { content: `${icon} ${notification.title}` } }],
      };
    }

    // Add other properties if they exist in schema
    if (db.properties["Body"] || db.properties["Description"] || db.properties["Content"]) {
      const bodyProp = db.properties["Body"] || db.properties["Description"] || db.properties["Content"];
      const propName = Object.entries(db.properties).find(([_, p]) => p === bodyProp)?.[0];
      if (propName) {
        properties[propName] = {
          rich_text: [{ type: "text", text: { content: notification.body } }],
        };
      }
    }

    if (db.properties["Priority"]) {
      properties["Priority"] = { select: { name: notification.priority || "normal" } };
    }

    if (db.properties["Status"]) {
      properties["Status"] = { status: { name: "New" } };
    }

    if (db.properties["Date"] || db.properties["Timestamp"]) {
      const dateProp = db.properties["Date"] || db.properties["Timestamp"];
      const propName = Object.entries(db.properties).find(([_, p]) => p === dateProp)?.[0];
      if (propName) {
        properties[propName] = { date: { start: new Date(timestamp).toISOString() } };
      }
    }

    const page = await this.client.createPage({
      parent: { type: "database_id", database_id: this.config.logDatabaseId! },
      properties,
    });

    console.log(`[Notion Notifications] Added to database: ${page.url}`);
    return { success: true, pageId: page.id, url: page.url };
  }

  /**
   * @ai-context Append notification to log page
   */
  private async appendToLogPage(
    notification: NotificationPayload,
    icon: string,
    timestamp: number
  ): Promise<{ success: boolean; pageId?: string; url?: string }> {
    const content = this.formatNotificationBlock(notification, icon, timestamp);
    const blocks = this.markdownToBlocks(content);

    await this.client.appendBlockChildren(this.config.logPageId!, blocks);

    console.log(`[Notion Notifications] Appended to log page`);
    return { success: true, pageId: this.config.logPageId };
  }

  /**
   * @ai-context Format notification as markdown content
   */
  private formatNotificationContent(notification: NotificationPayload, timestamp: number): string {
    const lines: string[] = [];

    lines.push(notification.body);
    lines.push("");

    if (this.config.includeTimestamp) {
      lines.push(`**Time:** ${new Date(timestamp).toISOString()}`);
    }

    if (notification.priority) {
      lines.push(`**Priority:** ${notification.priority}`);
    }

    if (notification.data && Object.keys(notification.data).length > 0) {
      lines.push("");
      lines.push("### Details");
      lines.push("```json");
      lines.push(JSON.stringify(notification.data, null, 2));
      lines.push("```");
    }

    return lines.join("\n");
  }

  /**
   * @ai-context Format notification as a callout block
   */
  private formatNotificationBlock(notification: NotificationPayload, icon: string, timestamp: number): string {
    const time = this.config.includeTimestamp ? ` (${new Date(timestamp).toLocaleString()})` : "";
    return `> ${icon} **${notification.title}**${time}\n> ${notification.body}\n\n---\n`;
  }

  /**
   * @ai-context Convert markdown to Notion blocks
   */
  private markdownToBlocks(markdown: string): Record<string, unknown>[] {
    const blocks: Record<string, unknown>[] = [];
    const lines = markdown.split("\n");
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeLanguage = "";

    for (const line of lines) {
      if (line.startsWith("```")) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.slice(3) || "plain text";
          codeContent = [];
        } else {
          inCodeBlock = false;
          blocks.push({
            object: "block",
            type: "code",
            code: {
              rich_text: [{ type: "text", text: { content: codeContent.join("\n") } }],
              language: codeLanguage,
            },
          });
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      if (!line.trim()) continue;

      if (line.startsWith("### ")) {
        blocks.push({
          object: "block",
          type: "heading_3",
          heading_3: { rich_text: [{ type: "text", text: { content: line.slice(4) } }] },
        });
      } else if (line.startsWith("> ")) {
        blocks.push({
          object: "block",
          type: "callout",
          callout: {
            rich_text: [{ type: "text", text: { content: line.slice(2) } }],
            icon: { type: "emoji", emoji: "💡" },
          },
        });
      } else if (line === "---") {
        blocks.push({ object: "block", type: "divider", divider: {} });
      } else if (line.startsWith("**") && line.includes(":**")) {
        // Key-value pair
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: this.parseRichText(line) },
        });
      } else {
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: line } }] },
        });
      }
    }

    return blocks;
  }

  /**
   * @ai-context Parse markdown formatting to rich text
   */
  private parseRichText(text: string): Record<string, unknown>[] {
    const parts: Record<string, unknown>[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
      if (boldMatch) {
        parts.push({
          type: "text",
          text: { content: boldMatch[1] },
          annotations: { bold: true },
        });
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      const italicMatch = remaining.match(/^\*(.+?)\*/);
      if (italicMatch) {
        parts.push({
          type: "text",
          text: { content: italicMatch[1] },
          annotations: { italic: true },
        });
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      const codeMatch = remaining.match(/^`(.+?)`/);
      if (codeMatch) {
        parts.push({
          type: "text",
          text: { content: codeMatch[1] },
          annotations: { code: true },
        });
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Find next special character
      const nextSpecial = remaining.search(/[*`]/);
      if (nextSpecial === -1) {
        parts.push({ type: "text", text: { content: remaining } });
        break;
      } else if (nextSpecial > 0) {
        parts.push({ type: "text", text: { content: remaining.slice(0, nextSpecial) } });
        remaining = remaining.slice(nextSpecial);
      } else {
        // No match found, take one character and continue
        parts.push({ type: "text", text: { content: remaining[0] } });
        remaining = remaining.slice(1);
      }
    }

    return parts;
  }

  /**
   * @ai-context Send bulk notifications
   */
  async sendBulk(notifications: NotificationPayload[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const notification of notifications) {
      const result = await this.send(notification);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }
}

// Export factory function
export function createNotionNotificationProvider(config: NotionNotificationConfig): NotionNotificationProvider {
  return new NotionNotificationProvider(config);
}
