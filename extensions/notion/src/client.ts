/**
 * @fileoverview Notion API Client
 * @module notion/client
 * @version 1.0.0
 *
 * @description
 * Comprehensive Notion API client with full CRUD operations for pages,
 * databases, blocks, users, and search. Supports both read and write operations.
 *
 * @ai-context
 * - Central client for all Notion API operations
 * - Handles authentication, rate limiting, and retries
 * - Provides typed interfaces for all Notion objects
 * - Used by MCP tools, channel adapter, and notifications
 */

import { EventEmitter } from "events";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface NotionConfig {
  /** Notion API token (integration token or OAuth token) */
  apiToken: string;
  /** API version (default: 2022-06-28) */
  apiVersion?: string;
  /** Base URL (default: https://api.notion.com/v1) */
  baseUrl?: string;
  /** Request timeout in ms */
  timeoutMs?: number;
  /** Max retries on failure */
  maxRetries?: number;
  /** Rate limit delay in ms */
  rateLimitDelayMs?: number;
}

export interface NotionUser {
  id: string;
  type: "person" | "bot";
  name?: string;
  avatar_url?: string;
  person?: { email: string };
  bot?: { owner: { type: string } };
}

export interface NotionPage {
  id: string;
  object: "page";
  created_time: string;
  last_edited_time: string;
  created_by: { id: string };
  last_edited_by: { id: string };
  parent: NotionParent;
  archived: boolean;
  properties: Record<string, NotionProperty>;
  url: string;
  icon?: NotionIcon;
  cover?: NotionFile;
}

export interface NotionDatabase {
  id: string;
  object: "database";
  created_time: string;
  last_edited_time: string;
  title: NotionRichText[];
  description: NotionRichText[];
  properties: Record<string, NotionPropertySchema>;
  parent: NotionParent;
  url: string;
  archived: boolean;
  is_inline: boolean;
  icon?: NotionIcon;
  cover?: NotionFile;
}

export interface NotionBlock {
  id: string;
  object: "block";
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  parent: NotionParent;
  [key: string]: unknown;
}

export interface NotionRichText {
  type: "text" | "mention" | "equation";
  text?: { content: string; link?: { url: string } };
  mention?: { type: string; [key: string]: unknown };
  equation?: { expression: string };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  plain_text: string;
  href?: string;
}

export interface NotionProperty {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface NotionPropertySchema {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

export interface NotionParent {
  type: "database_id" | "page_id" | "workspace" | "block_id";
  database_id?: string;
  page_id?: string;
  block_id?: string;
  workspace?: boolean;
}

export interface NotionIcon {
  type: "emoji" | "external" | "file";
  emoji?: string;
  external?: { url: string };
  file?: { url: string; expiry_time: string };
}

export interface NotionFile {
  type: "external" | "file";
  external?: { url: string };
  file?: { url: string; expiry_time: string };
}

export interface NotionSearchResult {
  object: "list";
  results: (NotionPage | NotionDatabase)[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface NotionQueryResult {
  object: "list";
  results: NotionPage[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface NotionBlockChildren {
  object: "list";
  results: NotionBlock[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface DatabaseQueryFilter {
  property?: string;
  checkbox?: { equals?: boolean; does_not_equal?: boolean };
  date?: { equals?: string; before?: string; after?: string; on_or_before?: string; on_or_after?: string; is_empty?: boolean; is_not_empty?: boolean };
  files?: { is_empty?: boolean; is_not_empty?: boolean };
  multi_select?: { contains?: string; does_not_contain?: string; is_empty?: boolean; is_not_empty?: boolean };
  number?: { equals?: number; does_not_equal?: number; greater_than?: number; less_than?: number; greater_than_or_equal_to?: number; less_than_or_equal_to?: number; is_empty?: boolean; is_not_empty?: boolean };
  people?: { contains?: string; does_not_contain?: string; is_empty?: boolean; is_not_empty?: boolean };
  rich_text?: { equals?: string; does_not_equal?: string; contains?: string; does_not_contain?: string; starts_with?: string; ends_with?: string; is_empty?: boolean; is_not_empty?: boolean };
  select?: { equals?: string; does_not_equal?: string; is_empty?: boolean; is_not_empty?: boolean };
  status?: { equals?: string; does_not_equal?: string; is_empty?: boolean; is_not_empty?: boolean };
  title?: { equals?: string; does_not_equal?: string; contains?: string; does_not_contain?: string; starts_with?: string; ends_with?: string; is_empty?: boolean; is_not_empty?: boolean };
  url?: { equals?: string; does_not_equal?: string; contains?: string; does_not_contain?: string; starts_with?: string; ends_with?: string; is_empty?: boolean; is_not_empty?: boolean };
  or?: DatabaseQueryFilter[];
  and?: DatabaseQueryFilter[];
}

export interface DatabaseQuerySort {
  property?: string;
  timestamp?: "created_time" | "last_edited_time";
  direction: "ascending" | "descending";
}

// ============================================================================
// Notion API Client
// ============================================================================

export class NotionClient extends EventEmitter {
  private config: Required<NotionConfig>;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(config: NotionConfig) {
    super();
    this.config = {
      apiToken: config.apiToken,
      apiVersion: config.apiVersion || "2022-06-28",
      baseUrl: config.baseUrl || "https://api.notion.com/v1",
      timeoutMs: config.timeoutMs || 30000,
      maxRetries: config.maxRetries || 3,
      rateLimitDelayMs: config.rateLimitDelayMs || 334, // ~3 requests per second
    };
  }

  // ============================================================================
  // HTTP Methods
  // ============================================================================

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.rateLimitDelayMs) {
      await this.sleep(this.config.rateLimitDelayMs - timeSinceLastRequest);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.config.apiToken}`,
            "Notion-Version": this.config.apiVersion,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        this.lastRequestTime = Date.now();
        this.requestCount++;

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: response.statusText }));
          
          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get("Retry-After") || "1", 10);
            await this.sleep(retryAfter * 1000);
            continue;
          }

          throw new Error(`Notion API error: ${error.message || response.statusText} (${response.status})`);
        }

        const data = await response.json();
        this.emit("request", { method, endpoint, status: response.status });
        return data as T;

      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.maxRetries - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Users
  // ============================================================================

  /**
   * Get current bot user
   */
  async getMe(): Promise<NotionUser> {
    return this.request<NotionUser>("GET", "/users/me");
  }

  /**
   * Get a user by ID
   */
  async getUser(userId: string): Promise<NotionUser> {
    return this.request<NotionUser>("GET", `/users/${userId}`);
  }

  /**
   * List all users
   */
  async listUsers(startCursor?: string, pageSize = 100): Promise<{ results: NotionUser[]; next_cursor: string | null; has_more: boolean }> {
    const params = new URLSearchParams();
    if (startCursor) params.set("start_cursor", startCursor);
    params.set("page_size", pageSize.toString());
    return this.request("GET", `/users?${params}`);
  }

  // ============================================================================
  // Pages
  // ============================================================================

  /**
   * Get a page by ID
   */
  async getPage(pageId: string): Promise<NotionPage> {
    return this.request<NotionPage>("GET", `/pages/${pageId}`);
  }

  /**
   * Create a new page
   */
  async createPage(params: {
    parent: NotionParent;
    properties: Record<string, unknown>;
    children?: NotionBlock[];
    icon?: NotionIcon;
    cover?: NotionFile;
  }): Promise<NotionPage> {
    return this.request<NotionPage>("POST", "/pages", params);
  }

  /**
   * Update a page
   */
  async updatePage(pageId: string, params: {
    properties?: Record<string, unknown>;
    icon?: NotionIcon | null;
    cover?: NotionFile | null;
    archived?: boolean;
  }): Promise<NotionPage> {
    return this.request<NotionPage>("PATCH", `/pages/${pageId}`, params);
  }

  /**
   * Archive a page
   */
  async archivePage(pageId: string): Promise<NotionPage> {
    return this.updatePage(pageId, { archived: true });
  }

  /**
   * Get page property value
   */
  async getPageProperty(pageId: string, propertyId: string): Promise<NotionProperty> {
    return this.request<NotionProperty>("GET", `/pages/${pageId}/properties/${propertyId}`);
  }

  // ============================================================================
  // Databases
  // ============================================================================

  /**
   * Get a database by ID
   */
  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    return this.request<NotionDatabase>("GET", `/databases/${databaseId}`);
  }

  /**
   * Create a new database
   */
  async createDatabase(params: {
    parent: NotionParent;
    title: NotionRichText[];
    properties: Record<string, NotionPropertySchema>;
    icon?: NotionIcon;
    cover?: NotionFile;
    is_inline?: boolean;
  }): Promise<NotionDatabase> {
    return this.request<NotionDatabase>("POST", "/databases", params);
  }

  /**
   * Update a database
   */
  async updateDatabase(databaseId: string, params: {
    title?: NotionRichText[];
    description?: NotionRichText[];
    properties?: Record<string, NotionPropertySchema | null>;
    icon?: NotionIcon | null;
    cover?: NotionFile | null;
    archived?: boolean;
  }): Promise<NotionDatabase> {
    return this.request<NotionDatabase>("PATCH", `/databases/${databaseId}`, params);
  }

  /**
   * Query a database
   */
  async queryDatabase(databaseId: string, params?: {
    filter?: DatabaseQueryFilter;
    sorts?: DatabaseQuerySort[];
    start_cursor?: string;
    page_size?: number;
  }): Promise<NotionQueryResult> {
    return this.request<NotionQueryResult>("POST", `/databases/${databaseId}/query`, params || {});
  }

  // ============================================================================
  // Blocks
  // ============================================================================

  /**
   * Get a block by ID
   */
  async getBlock(blockId: string): Promise<NotionBlock> {
    return this.request<NotionBlock>("GET", `/blocks/${blockId}`);
  }

  /**
   * Update a block
   */
  async updateBlock(blockId: string, params: Record<string, unknown>): Promise<NotionBlock> {
    return this.request<NotionBlock>("PATCH", `/blocks/${blockId}`, params);
  }

  /**
   * Delete a block
   */
  async deleteBlock(blockId: string): Promise<NotionBlock> {
    return this.request<NotionBlock>("DELETE", `/blocks/${blockId}`);
  }

  /**
   * Get block children
   */
  async getBlockChildren(blockId: string, startCursor?: string, pageSize = 100): Promise<NotionBlockChildren> {
    const params = new URLSearchParams();
    if (startCursor) params.set("start_cursor", startCursor);
    params.set("page_size", pageSize.toString());
    return this.request<NotionBlockChildren>("GET", `/blocks/${blockId}/children?${params}`);
  }

  /**
   * Append block children
   */
  async appendBlockChildren(blockId: string, children: Record<string, unknown>[]): Promise<NotionBlockChildren> {
    return this.request<NotionBlockChildren>("PATCH", `/blocks/${blockId}/children`, { children });
  }

  // ============================================================================
  // Search
  // ============================================================================

  /**
   * Search pages and databases
   */
  async search(params?: {
    query?: string;
    filter?: { property: "object"; value: "page" | "database" };
    sort?: { direction: "ascending" | "descending"; timestamp: "last_edited_time" };
    start_cursor?: string;
    page_size?: number;
  }): Promise<NotionSearchResult> {
    return this.request<NotionSearchResult>("POST", "/search", params || {});
  }

  // ============================================================================
  // Comments
  // ============================================================================

  /**
   * Get comments on a page or block
   */
  async getComments(blockId: string, startCursor?: string, pageSize = 100): Promise<{ results: unknown[]; next_cursor: string | null; has_more: boolean }> {
    const params = new URLSearchParams();
    params.set("block_id", blockId);
    if (startCursor) params.set("start_cursor", startCursor);
    params.set("page_size", pageSize.toString());
    return this.request("GET", `/comments?${params}`);
  }

  /**
   * Add a comment to a page
   */
  async addComment(params: {
    parent: { page_id: string };
    rich_text: NotionRichText[];
  }): Promise<unknown> {
    return this.request("POST", "/comments", params);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Get all pages from a database (handles pagination)
   */
  async getAllDatabasePages(databaseId: string, filter?: DatabaseQueryFilter): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.queryDatabase(databaseId, {
        filter,
        start_cursor: cursor,
        page_size: 100,
      });
      pages.push(...result.results);
      cursor = result.next_cursor || undefined;
    } while (cursor);

    return pages;
  }

  /**
   * Get all blocks from a page (handles pagination and nested blocks)
   */
  async getAllPageBlocks(pageId: string, recursive = true): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = [];

    const fetchBlocks = async (blockId: string): Promise<void> => {
      let cursor: string | undefined;

      do {
        const result = await this.getBlockChildren(blockId, cursor);
        for (const block of result.results) {
          blocks.push(block);
          if (recursive && block.has_children) {
            await fetchBlocks(block.id);
          }
        }
        cursor = result.next_cursor || undefined;
      } while (cursor);
    };

    await fetchBlocks(pageId);
    return blocks;
  }

  /**
   * Convert page to markdown
   */
  async pageToMarkdown(pageId: string): Promise<string> {
    const blocks = await this.getAllPageBlocks(pageId);
    return this.blocksToMarkdown(blocks);
  }

  /**
   * Convert blocks to markdown
   */
  blocksToMarkdown(blocks: NotionBlock[]): string {
    const lines: string[] = [];

    for (const block of blocks) {
      const line = this.blockToMarkdown(block);
      if (line !== null) {
        lines.push(line);
      }
    }

    return lines.join("\n");
  }

  private blockToMarkdown(block: NotionBlock): string | null {
    const type = block.type;
    const content = block[type] as Record<string, unknown>;

    switch (type) {
      case "paragraph":
        return this.richTextToMarkdown(content.rich_text as NotionRichText[]);
      case "heading_1":
        return `# ${this.richTextToMarkdown(content.rich_text as NotionRichText[])}`;
      case "heading_2":
        return `## ${this.richTextToMarkdown(content.rich_text as NotionRichText[])}`;
      case "heading_3":
        return `### ${this.richTextToMarkdown(content.rich_text as NotionRichText[])}`;
      case "bulleted_list_item":
        return `- ${this.richTextToMarkdown(content.rich_text as NotionRichText[])}`;
      case "numbered_list_item":
        return `1. ${this.richTextToMarkdown(content.rich_text as NotionRichText[])}`;
      case "to_do":
        const checked = content.checked ? "x" : " ";
        return `- [${checked}] ${this.richTextToMarkdown(content.rich_text as NotionRichText[])}`;
      case "toggle":
        return `<details><summary>${this.richTextToMarkdown(content.rich_text as NotionRichText[])}</summary></details>`;
      case "quote":
        return `> ${this.richTextToMarkdown(content.rich_text as NotionRichText[])}`;
      case "callout":
        const icon = (content.icon as NotionIcon)?.emoji || "💡";
        return `> ${icon} ${this.richTextToMarkdown(content.rich_text as NotionRichText[])}`;
      case "code":
        const lang = content.language || "";
        return `\`\`\`${lang}\n${this.richTextToMarkdown(content.rich_text as NotionRichText[])}\n\`\`\``;
      case "divider":
        return "---";
      case "image":
        const imageUrl = (content as NotionFile).external?.url || (content as NotionFile).file?.url || "";
        return `![image](${imageUrl})`;
      case "bookmark":
        return `[Bookmark](${content.url})`;
      case "link_preview":
        return `[Link](${content.url})`;
      case "table_of_contents":
        return "[TOC]";
      default:
        return null;
    }
  }

  private richTextToMarkdown(richText: NotionRichText[]): string {
    if (!richText) return "";
    return richText
      .map((rt) => {
        let text = rt.plain_text;
        if (rt.annotations?.bold) text = `**${text}**`;
        if (rt.annotations?.italic) text = `*${text}*`;
        if (rt.annotations?.strikethrough) text = `~~${text}~~`;
        if (rt.annotations?.code) text = `\`${text}\``;
        if (rt.href) text = `[${text}](${rt.href})`;
        return text;
      })
      .join("");
  }

  /**
   * Create rich text from plain string
   */
  createRichText(content: string): NotionRichText[] {
    return [
      {
        type: "text",
        text: { content },
        plain_text: content,
      },
    ];
  }

  /**
   * Get request statistics
   */
  getStats(): { requestCount: number } {
    return { requestCount: this.requestCount };
  }
}

// Export factory function
export function createNotionClient(config: NotionConfig): NotionClient {
  return new NotionClient(config);
}
