/**
 * @fileoverview Notion Channel Adapter
 * @module notion/channel
 * @version 1.0.0
 *
 * @description
 * Notion channel adapter for Moltbot. Enables two-way sync between
 * Notion pages/databases and Moltbot conversations.
 *
 * @ai-context
 * - Treats Notion pages as conversation threads
 * - Comments on pages become messages
 * - Agent responses are appended to pages
 * - Supports database items as task queues
 */

import { EventEmitter } from "events";
import type { NotionClient, NotionPage, NotionRichText } from "./client.js";

// ============================================================================
// Types
// ============================================================================

export interface NotionChannelConfig {
  /** Notion client instance */
  client: NotionClient;
  /** Database ID to watch for new items (task queue) */
  taskDatabaseId?: string;
  /** Page ID to use as inbox */
  inboxPageId?: string;
  /** Poll interval in ms */
  pollIntervalMs?: number;
  /** Status property name for task database */
  statusProperty?: string;
  /** Status value for new tasks */
  newTaskStatus?: string;
  /** Status value for completed tasks */
  completedTaskStatus?: string;
}

export interface NotionMessage {
  id: string;
  pageId: string;
  pageUrl: string;
  pageTitle: string;
  content: string;
  author?: string;
  timestamp: number;
  type: "page_created" | "page_updated" | "comment" | "task";
  metadata?: Record<string, unknown>;
}

export interface NotionChannelEvents {
  message: (message: NotionMessage) => void;
  error: (error: Error) => void;
  connected: () => void;
  disconnected: () => void;
}

// ============================================================================
// Notion Channel
// ============================================================================

export class NotionChannel extends EventEmitter {
  private config: Required<NotionChannelConfig>;
  private client: NotionClient;
  private isRunning = false;
  private pollInterval?: NodeJS.Timeout;
  private lastCheckTime: number = Date.now();
  private processedIds = new Set<string>();

  constructor(config: NotionChannelConfig) {
    super();
    this.client = config.client;
    this.config = {
      client: config.client,
      taskDatabaseId: config.taskDatabaseId || "",
      inboxPageId: config.inboxPageId || "",
      pollIntervalMs: config.pollIntervalMs || 30000,
      statusProperty: config.statusProperty || "Status",
      newTaskStatus: config.newTaskStatus || "New",
      completedTaskStatus: config.completedTaskStatus || "Done",
    };
  }

  /**
   * @ai-context Start the channel - begin polling for new messages
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("[Notion Channel] Starting...");

    // Initial sync
    await this.syncMessages();

    // Start polling
    this.pollInterval = setInterval(async () => {
      try {
        await this.syncMessages();
      } catch (error) {
        this.emit("error", error);
      }
    }, this.config.pollIntervalMs);

    this.emit("connected");
    console.log("[Notion Channel] Connected");
  }

  /**
   * @ai-context Stop the channel
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.emit("disconnected");
    console.log("[Notion Channel] Disconnected");
  }

  /**
   * @ai-context Sync messages from Notion
   */
  private async syncMessages(): Promise<void> {
    // Sync from task database
    if (this.config.taskDatabaseId) {
      await this.syncTaskDatabase();
    }

    // Sync from inbox page (comments)
    if (this.config.inboxPageId) {
      await this.syncInboxComments();
    }

    this.lastCheckTime = Date.now();
  }

  /**
   * @ai-context Sync tasks from database
   */
  private async syncTaskDatabase(): Promise<void> {
    try {
      const result = await this.client.queryDatabase(this.config.taskDatabaseId, {
        filter: {
          property: this.config.statusProperty,
          status: { equals: this.config.newTaskStatus },
        },
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
      });

      for (const page of result.results) {
        if (this.processedIds.has(page.id)) continue;

        const message = await this.pageToMessage(page, "task");
        this.processedIds.add(page.id);
        this.emit("message", message);
      }
    } catch (error) {
      console.error("[Notion Channel] Error syncing task database:", error);
    }
  }

  /**
   * @ai-context Sync comments from inbox page
   */
  private async syncInboxComments(): Promise<void> {
    try {
      const comments = await this.client.getComments(this.config.inboxPageId);

      for (const comment of comments.results as any[]) {
        if (this.processedIds.has(comment.id)) continue;

        const createdTime = new Date(comment.created_time).getTime();
        if (createdTime < this.lastCheckTime - 60000) continue; // Skip old comments

        const message: NotionMessage = {
          id: comment.id,
          pageId: this.config.inboxPageId,
          pageUrl: `https://notion.so/${this.config.inboxPageId.replace(/-/g, "")}`,
          pageTitle: "Inbox",
          content: comment.rich_text?.map((rt: NotionRichText) => rt.plain_text).join("") || "",
          author: comment.created_by?.name,
          timestamp: createdTime,
          type: "comment",
        };

        this.processedIds.add(comment.id);
        this.emit("message", message);
      }
    } catch (error) {
      console.error("[Notion Channel] Error syncing inbox comments:", error);
    }
  }

  /**
   * @ai-context Convert a Notion page to a message
   */
  private async pageToMessage(page: NotionPage, type: NotionMessage["type"]): Promise<NotionMessage> {
    const title = this.extractTitle(page.properties);
    const content = await this.client.pageToMarkdown(page.id);

    return {
      id: page.id,
      pageId: page.id,
      pageUrl: page.url,
      pageTitle: title,
      content: content || title,
      timestamp: new Date(page.created_time).getTime(),
      type,
      metadata: this.extractProperties(page.properties),
    };
  }

  /**
   * @ai-context Send a response to Notion
   */
  async sendResponse(pageId: string, response: string): Promise<void> {
    // Append response as blocks to the page
    const blocks = this.markdownToBlocks(response);
    await this.client.appendBlockChildren(pageId, blocks);

    console.log(`[Notion Channel] Response sent to page ${pageId}`);
  }

  /**
   * @ai-context Update task status
   */
  async completeTask(pageId: string): Promise<void> {
    await this.client.updatePage(pageId, {
      properties: {
        [this.config.statusProperty]: {
          status: { name: this.config.completedTaskStatus },
        },
      },
    });

    console.log(`[Notion Channel] Task ${pageId} marked as complete`);
  }

  /**
   * @ai-context Add a comment to a page
   */
  async addComment(pageId: string, comment: string): Promise<void> {
    await this.client.addComment({
      parent: { page_id: pageId },
      rich_text: this.client.createRichText(comment),
    });

    console.log(`[Notion Channel] Comment added to page ${pageId}`);
  }

  /**
   * @ai-context Create a new task in the database
   */
  async createTask(title: string, content?: string, properties?: Record<string, unknown>): Promise<NotionPage> {
    if (!this.config.taskDatabaseId) {
      throw new Error("Task database not configured");
    }

    const db = await this.client.getDatabase(this.config.taskDatabaseId);
    const pageProperties: Record<string, unknown> = {
      ...this.convertPropertiesToNotion(properties || {}, db.properties),
    };

    // Find title property
    const titleProp = Object.entries(db.properties).find(([_, p]) => p.type === "title");
    if (titleProp) {
      pageProperties[titleProp[0]] = {
        title: [{ type: "text", text: { content: title } }],
      };
    }

    // Set status to new
    if (db.properties[this.config.statusProperty]) {
      pageProperties[this.config.statusProperty] = {
        status: { name: this.config.newTaskStatus },
      };
    }

    const children = content ? this.markdownToBlocks(content) : undefined;

    const page = await this.client.createPage({
      parent: { type: "database_id", database_id: this.config.taskDatabaseId },
      properties: pageProperties,
      children,
    });

    console.log(`[Notion Channel] Task created: ${page.id}`);
    return page;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private extractTitle(properties: Record<string, any>): string {
    const titleProp = Object.values(properties).find((p) => p.type === "title");
    if (titleProp?.title) {
      return titleProp.title.map((t: NotionRichText) => t.plain_text).join("");
    }
    return "Untitled";
  }

  private extractProperties(properties: Record<string, any>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, prop] of Object.entries(properties)) {
      switch (prop.type) {
        case "title":
          result[name] = prop.title?.map((t: NotionRichText) => t.plain_text).join("");
          break;
        case "rich_text":
          result[name] = prop.rich_text?.map((t: NotionRichText) => t.plain_text).join("");
          break;
        case "number":
          result[name] = prop.number;
          break;
        case "select":
          result[name] = prop.select?.name;
          break;
        case "multi_select":
          result[name] = prop.multi_select?.map((s: any) => s.name);
          break;
        case "date":
          result[name] = prop.date?.start;
          break;
        case "checkbox":
          result[name] = prop.checkbox;
          break;
        case "url":
          result[name] = prop.url;
          break;
        case "status":
          result[name] = prop.status?.name;
          break;
      }
    }

    return result;
  }

  private convertPropertiesToNotion(
    values: Record<string, unknown>,
    schema: Record<string, any>
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(values)) {
      const propSchema = schema[name];
      if (!propSchema) continue;

      switch (propSchema.type) {
        case "rich_text":
          properties[name] = { rich_text: [{ type: "text", text: { content: String(value) } }] };
          break;
        case "number":
          properties[name] = { number: Number(value) };
          break;
        case "select":
          properties[name] = { select: { name: String(value) } };
          break;
        case "multi_select":
          const selectValues = Array.isArray(value) ? value : [value];
          properties[name] = { multi_select: selectValues.map((v) => ({ name: String(v) })) };
          break;
        case "date":
          properties[name] = { date: { start: String(value) } };
          break;
        case "checkbox":
          properties[name] = { checkbox: Boolean(value) };
          break;
        case "url":
          properties[name] = { url: String(value) };
          break;
        case "status":
          properties[name] = { status: { name: String(value) } };
          break;
      }
    }

    return properties;
  }

  private markdownToBlocks(markdown: string): Record<string, unknown>[] {
    const blocks: Record<string, unknown>[] = [];
    const lines = markdown.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      if (line.startsWith("# ")) {
        blocks.push({
          object: "block",
          type: "heading_1",
          heading_1: { rich_text: [{ type: "text", text: { content: line.slice(2) } }] },
        });
      } else if (line.startsWith("## ")) {
        blocks.push({
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: [{ type: "text", text: { content: line.slice(3) } }] },
        });
      } else if (line.startsWith("### ")) {
        blocks.push({
          object: "block",
          type: "heading_3",
          heading_3: { rich_text: [{ type: "text", text: { content: line.slice(4) } }] },
        });
      } else if (line.startsWith("- ")) {
        blocks.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ type: "text", text: { content: line.slice(2) } }] },
        });
      } else if (line.startsWith("> ")) {
        blocks.push({
          object: "block",
          type: "quote",
          quote: { rich_text: [{ type: "text", text: { content: line.slice(2) } }] },
        });
      } else if (line === "---") {
        blocks.push({ object: "block", type: "divider", divider: {} });
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
   * @ai-context Get channel status
   */
  getStatus(): {
    running: boolean;
    taskDatabase: string | null;
    inboxPage: string | null;
    processedCount: number;
  } {
    return {
      running: this.isRunning,
      taskDatabase: this.config.taskDatabaseId || null,
      inboxPage: this.config.inboxPageId || null,
      processedCount: this.processedIds.size,
    };
  }
}

// Export factory function
export function createNotionChannel(config: NotionChannelConfig): NotionChannel {
  return new NotionChannel(config);
}
