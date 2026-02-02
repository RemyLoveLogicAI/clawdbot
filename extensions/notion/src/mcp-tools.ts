/**
 * @fileoverview Notion MCP Tools
 * @module notion/mcp-tools
 * @version 1.0.0
 *
 * @description
 * Model Context Protocol tools for Notion integration.
 * Provides AI agents with full Notion capabilities.
 *
 * @ai-context
 * - These tools allow AI agents to interact with Notion
 * - Full CRUD operations on pages, databases, and blocks
 * - Search and query capabilities
 * - Markdown conversion for easy content manipulation
 */

import type { NotionClient, NotionRichText, NotionParent, DatabaseQueryFilter, DatabaseQuerySort } from "./client.js";

// ============================================================================
// Tool Definitions
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

// ============================================================================
// Page Tools
// ============================================================================

export function createNotionPageTools(client: NotionClient): ToolDefinition[] {
  return [
    {
      name: "notion_get_page",
      description: "Get a Notion page by ID. Returns the page metadata and properties.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The ID of the page to retrieve (UUID format, with or without dashes)",
          },
        },
        required: ["page_id"],
      },
      execute: async (input) => {
        const pageId = normalizeId(input.page_id as string);
        const page = await client.getPage(pageId);
        return {
          id: page.id,
          url: page.url,
          title: extractTitle(page.properties),
          created: page.created_time,
          updated: page.last_edited_time,
          archived: page.archived,
          properties: page.properties,
        };
      },
    },

    {
      name: "notion_create_page",
      description: "Create a new Notion page. Can be created in a database or as a child of another page.",
      parameters: {
        type: "object",
        properties: {
          parent_type: {
            type: "string",
            enum: ["database", "page"],
            description: "Type of parent: 'database' or 'page'",
          },
          parent_id: {
            type: "string",
            description: "ID of the parent database or page",
          },
          title: {
            type: "string",
            description: "Title of the new page",
          },
          properties: {
            type: "object",
            description: "Additional properties for the page (for database pages)",
          },
          content: {
            type: "string",
            description: "Markdown content to add to the page body",
          },
          icon: {
            type: "string",
            description: "Emoji icon for the page (e.g., '📝')",
          },
        },
        required: ["parent_type", "parent_id", "title"],
      },
      execute: async (input) => {
        const parentId = normalizeId(input.parent_id as string);
        const parent: NotionParent =
          input.parent_type === "database"
            ? { type: "database_id", database_id: parentId }
            : { type: "page_id", page_id: parentId };

        const properties: Record<string, unknown> =
          input.parent_type === "database"
            ? {
                ...(input.properties as Record<string, unknown>),
                title: { title: client.createRichText(input.title as string) },
              }
            : { title: { title: client.createRichText(input.title as string) } };

        const children = input.content ? markdownToBlocks(input.content as string) : undefined;

        const page = await client.createPage({
          parent,
          properties,
          children,
          icon: input.icon ? { type: "emoji", emoji: input.icon as string } : undefined,
        });

        return {
          id: page.id,
          url: page.url,
          title: input.title,
          created: page.created_time,
        };
      },
    },

    {
      name: "notion_update_page",
      description: "Update a Notion page's properties, icon, or archive status.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The ID of the page to update",
          },
          properties: {
            type: "object",
            description: "Properties to update",
          },
          icon: {
            type: "string",
            description: "New emoji icon (or null to remove)",
          },
          archived: {
            type: "boolean",
            description: "Set to true to archive the page",
          },
        },
        required: ["page_id"],
      },
      execute: async (input) => {
        const pageId = normalizeId(input.page_id as string);
        const page = await client.updatePage(pageId, {
          properties: input.properties as Record<string, unknown>,
          icon: input.icon ? { type: "emoji", emoji: input.icon as string } : undefined,
          archived: input.archived as boolean,
        });
        return { id: page.id, url: page.url, updated: page.last_edited_time };
      },
    },

    {
      name: "notion_get_page_content",
      description: "Get the content of a Notion page as markdown.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The ID of the page",
          },
        },
        required: ["page_id"],
      },
      execute: async (input) => {
        const pageId = normalizeId(input.page_id as string);
        const page = await client.getPage(pageId);
        const markdown = await client.pageToMarkdown(pageId);
        return {
          id: page.id,
          url: page.url,
          title: extractTitle(page.properties),
          content: markdown,
        };
      },
    },

    {
      name: "notion_append_to_page",
      description: "Append content to a Notion page.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The ID of the page",
          },
          content: {
            type: "string",
            description: "Markdown content to append",
          },
        },
        required: ["page_id", "content"],
      },
      execute: async (input) => {
        const pageId = normalizeId(input.page_id as string);
        const blocks = markdownToBlocks(input.content as string);
        await client.appendBlockChildren(pageId, blocks);
        return { success: true, page_id: pageId, blocks_added: blocks.length };
      },
    },
  ];
}

// ============================================================================
// Database Tools
// ============================================================================

export function createNotionDatabaseTools(client: NotionClient): ToolDefinition[] {
  return [
    {
      name: "notion_get_database",
      description: "Get a Notion database schema and metadata.",
      parameters: {
        type: "object",
        properties: {
          database_id: {
            type: "string",
            description: "The ID of the database",
          },
        },
        required: ["database_id"],
      },
      execute: async (input) => {
        const dbId = normalizeId(input.database_id as string);
        const db = await client.getDatabase(dbId);
        return {
          id: db.id,
          url: db.url,
          title: db.title.map((t) => t.plain_text).join(""),
          description: db.description.map((t) => t.plain_text).join(""),
          properties: Object.entries(db.properties).map(([name, prop]) => ({
            name,
            type: prop.type,
            id: prop.id,
          })),
        };
      },
    },

    {
      name: "notion_query_database",
      description: "Query a Notion database with optional filters and sorting.",
      parameters: {
        type: "object",
        properties: {
          database_id: {
            type: "string",
            description: "The ID of the database to query",
          },
          filter: {
            type: "object",
            description: "Filter object (see Notion API docs)",
          },
          sorts: {
            type: "array",
            description: "Array of sort objects",
            items: {
              type: "object",
              properties: {
                property: { type: "string" },
                direction: { type: "string", enum: ["ascending", "descending"] },
              },
            },
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 100)",
          },
        },
        required: ["database_id"],
      },
      execute: async (input) => {
        const dbId = normalizeId(input.database_id as string);
        const result = await client.queryDatabase(dbId, {
          filter: input.filter as DatabaseQueryFilter,
          sorts: input.sorts as DatabaseQuerySort[],
          page_size: Math.min((input.limit as number) || 100, 100),
        });

        return {
          total: result.results.length,
          has_more: result.has_more,
          pages: result.results.map((page) => ({
            id: page.id,
            url: page.url,
            title: extractTitle(page.properties),
            properties: simplifyProperties(page.properties),
          })),
        };
      },
    },

    {
      name: "notion_create_database",
      description: "Create a new Notion database.",
      parameters: {
        type: "object",
        properties: {
          parent_id: {
            type: "string",
            description: "ID of the parent page",
          },
          title: {
            type: "string",
            description: "Title of the database",
          },
          properties: {
            type: "object",
            description: "Database schema - property names mapped to types",
            additionalProperties: {
              type: "string",
              enum: ["title", "rich_text", "number", "select", "multi_select", "date", "checkbox", "url", "email", "phone_number"],
            },
          },
          is_inline: {
            type: "boolean",
            description: "Create as inline database (default: false)",
          },
        },
        required: ["parent_id", "title", "properties"],
      },
      execute: async (input) => {
        const parentId = normalizeId(input.parent_id as string);
        const properties: Record<string, unknown> = {};

        for (const [name, type] of Object.entries(input.properties as Record<string, string>)) {
          if (type === "title") {
            properties[name] = { title: {} };
          } else if (type === "rich_text") {
            properties[name] = { rich_text: {} };
          } else if (type === "number") {
            properties[name] = { number: {} };
          } else if (type === "select") {
            properties[name] = { select: { options: [] } };
          } else if (type === "multi_select") {
            properties[name] = { multi_select: { options: [] } };
          } else if (type === "date") {
            properties[name] = { date: {} };
          } else if (type === "checkbox") {
            properties[name] = { checkbox: {} };
          } else if (type === "url") {
            properties[name] = { url: {} };
          } else if (type === "email") {
            properties[name] = { email: {} };
          } else if (type === "phone_number") {
            properties[name] = { phone_number: {} };
          }
        }

        const db = await client.createDatabase({
          parent: { type: "page_id", page_id: parentId },
          title: client.createRichText(input.title as string),
          properties: properties as Record<string, any>,
          is_inline: input.is_inline as boolean,
        });

        return { id: db.id, url: db.url, title: input.title };
      },
    },

    {
      name: "notion_add_database_item",
      description: "Add a new item (page) to a Notion database.",
      parameters: {
        type: "object",
        properties: {
          database_id: {
            type: "string",
            description: "The ID of the database",
          },
          properties: {
            type: "object",
            description: "Property values for the new item",
          },
          content: {
            type: "string",
            description: "Optional markdown content for the page body",
          },
        },
        required: ["database_id", "properties"],
      },
      execute: async (input) => {
        const dbId = normalizeId(input.database_id as string);
        const db = await client.getDatabase(dbId);

        // Convert simple property values to Notion format
        const properties = convertPropertiesToNotion(
          input.properties as Record<string, unknown>,
          db.properties
        );

        const children = input.content ? markdownToBlocks(input.content as string) : undefined;

        const page = await client.createPage({
          parent: { type: "database_id", database_id: dbId },
          properties,
          children,
        });

        return { id: page.id, url: page.url };
      },
    },
  ];
}

// ============================================================================
// Search Tools
// ============================================================================

export function createNotionSearchTools(client: NotionClient): ToolDefinition[] {
  return [
    {
      name: "notion_search",
      description: "Search for pages and databases in Notion.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query text",
          },
          filter_type: {
            type: "string",
            enum: ["page", "database"],
            description: "Filter to only pages or only databases",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 20)",
          },
        },
      },
      execute: async (input) => {
        const result = await client.search({
          query: input.query as string,
          filter: input.filter_type
            ? { property: "object", value: input.filter_type as "page" | "database" }
            : undefined,
          page_size: Math.min((input.limit as number) || 20, 100),
        });

        return {
          total: result.results.length,
          has_more: result.has_more,
          results: result.results.map((item) => ({
            id: item.id,
            type: item.object,
            url: item.url,
            title:
              item.object === "page"
                ? extractTitle((item as any).properties)
                : (item as any).title?.map((t: NotionRichText) => t.plain_text).join(""),
          })),
        };
      },
    },
  ];
}

// ============================================================================
// Block Tools
// ============================================================================

export function createNotionBlockTools(client: NotionClient): ToolDefinition[] {
  return [
    {
      name: "notion_get_block",
      description: "Get a specific block by ID.",
      parameters: {
        type: "object",
        properties: {
          block_id: {
            type: "string",
            description: "The ID of the block",
          },
        },
        required: ["block_id"],
      },
      execute: async (input) => {
        const blockId = normalizeId(input.block_id as string);
        return client.getBlock(blockId);
      },
    },

    {
      name: "notion_delete_block",
      description: "Delete a block (moves to trash).",
      parameters: {
        type: "object",
        properties: {
          block_id: {
            type: "string",
            description: "The ID of the block to delete",
          },
        },
        required: ["block_id"],
      },
      execute: async (input) => {
        const blockId = normalizeId(input.block_id as string);
        await client.deleteBlock(blockId);
        return { success: true, deleted: blockId };
      },
    },

    {
      name: "notion_get_block_children",
      description: "Get all child blocks of a block or page.",
      parameters: {
        type: "object",
        properties: {
          block_id: {
            type: "string",
            description: "The ID of the parent block or page",
          },
          recursive: {
            type: "boolean",
            description: "Fetch nested children recursively (default: false)",
          },
        },
        required: ["block_id"],
      },
      execute: async (input) => {
        const blockId = normalizeId(input.block_id as string);
        if (input.recursive) {
          const blocks = await client.getAllPageBlocks(blockId, true);
          return { total: blocks.length, blocks };
        } else {
          const result = await client.getBlockChildren(blockId);
          return { total: result.results.length, has_more: result.has_more, blocks: result.results };
        }
      },
    },
  ];
}

// ============================================================================
// Comment Tools
// ============================================================================

export function createNotionCommentTools(client: NotionClient): ToolDefinition[] {
  return [
    {
      name: "notion_add_comment",
      description: "Add a comment to a Notion page.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The ID of the page to comment on",
          },
          comment: {
            type: "string",
            description: "The comment text",
          },
        },
        required: ["page_id", "comment"],
      },
      execute: async (input) => {
        const pageId = normalizeId(input.page_id as string);
        await client.addComment({
          parent: { page_id: pageId },
          rich_text: client.createRichText(input.comment as string),
        });
        return { success: true, page_id: pageId };
      },
    },

    {
      name: "notion_get_comments",
      description: "Get comments on a Notion page.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The ID of the page",
          },
        },
        required: ["page_id"],
      },
      execute: async (input) => {
        const pageId = normalizeId(input.page_id as string);
        return client.getComments(pageId);
      },
    },
  ];
}

// ============================================================================
// Export All Tools
// ============================================================================

export function createAllNotionTools(client: NotionClient): ToolDefinition[] {
  return [
    ...createNotionPageTools(client),
    ...createNotionDatabaseTools(client),
    ...createNotionSearchTools(client),
    ...createNotionBlockTools(client),
    ...createNotionCommentTools(client),
  ];
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeId(id: string): string {
  // Remove dashes and normalize UUID format
  return id.replace(/-/g, "").replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
}

function extractTitle(properties: Record<string, any>): string {
  const titleProp = Object.values(properties).find((p) => p.type === "title");
  if (titleProp?.title) {
    return titleProp.title.map((t: NotionRichText) => t.plain_text).join("");
  }
  return "Untitled";
}

function simplifyProperties(properties: Record<string, any>): Record<string, unknown> {
  const simplified: Record<string, unknown> = {};

  for (const [name, prop] of Object.entries(properties)) {
    switch (prop.type) {
      case "title":
        simplified[name] = prop.title?.map((t: NotionRichText) => t.plain_text).join("");
        break;
      case "rich_text":
        simplified[name] = prop.rich_text?.map((t: NotionRichText) => t.plain_text).join("");
        break;
      case "number":
        simplified[name] = prop.number;
        break;
      case "select":
        simplified[name] = prop.select?.name;
        break;
      case "multi_select":
        simplified[name] = prop.multi_select?.map((s: any) => s.name);
        break;
      case "date":
        simplified[name] = prop.date?.start;
        break;
      case "checkbox":
        simplified[name] = prop.checkbox;
        break;
      case "url":
        simplified[name] = prop.url;
        break;
      case "email":
        simplified[name] = prop.email;
        break;
      case "phone_number":
        simplified[name] = prop.phone_number;
        break;
      case "status":
        simplified[name] = prop.status?.name;
        break;
      default:
        simplified[name] = prop[prop.type];
    }
  }

  return simplified;
}

function convertPropertiesToNotion(
  values: Record<string, unknown>,
  schema: Record<string, any>
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(values)) {
    const propSchema = schema[name];
    if (!propSchema) continue;

    switch (propSchema.type) {
      case "title":
        properties[name] = { title: [{ type: "text", text: { content: String(value) } }] };
        break;
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
      case "email":
        properties[name] = { email: String(value) };
        break;
      case "phone_number":
        properties[name] = { phone_number: String(value) };
        break;
      case "status":
        properties[name] = { status: { name: String(value) } };
        break;
    }
  }

  return properties;
}

function markdownToBlocks(markdown: string): Record<string, unknown>[] {
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
    } else if (line.startsWith("- [ ] ")) {
      blocks.push({
        object: "block",
        type: "to_do",
        to_do: { rich_text: [{ type: "text", text: { content: line.slice(6) } }], checked: false },
      });
    } else if (line.startsWith("- [x] ")) {
      blocks.push({
        object: "block",
        type: "to_do",
        to_do: { rich_text: [{ type: "text", text: { content: line.slice(6) } }], checked: true },
      });
    } else if (line.startsWith("- ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ type: "text", text: { content: line.slice(2) } }] },
      });
    } else if (/^\d+\. /.test(line)) {
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: { rich_text: [{ type: "text", text: { content: line.replace(/^\d+\. /, "") } }] },
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
