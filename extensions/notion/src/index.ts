/**
 * @fileoverview Notion Extension - Main Entry Point
 * @module notion
 * @version 1.0.0
 *
 * @description
 * Complete Notion integration for Moltbot including:
 * - API client for full CRUD operations
 * - MCP tools for AI agents
 * - Channel adapter for two-way sync
 * - Notification provider
 * - Documentation export
 *
 * @ai-context
 * - This is the main entry point for all Notion functionality
 * - Registers tools, channels, and notification providers
 * - Exposes CLI commands and HTTP endpoints
 */

import type { MoltbotPluginApi, MoltbotPluginDefinition } from "../../../src/plugins/types.js";
import { NotionClient, createNotionClient } from "./client.js";
import { createAllNotionTools } from "./mcp-tools.js";
import { NotionChannel, createNotionChannel } from "./channel.js";
import { NotionNotificationProvider, createNotionNotificationProvider } from "./notifications.js";
import { NotionDocExporter, createNotionDocExporter } from "./export.js";

// Re-export all modules
export * from "./client.js";
export * from "./mcp-tools.js";
export * from "./channel.js";
export * from "./notifications.js";
export * from "./export.js";

// ============================================================================
// Plugin State
// ============================================================================

let notionClient: NotionClient | null = null;
let notionChannel: NotionChannel | null = null;
let notionNotifications: NotionNotificationProvider | null = null;

// ============================================================================
// Plugin Definition
// ============================================================================

export const plugin: MoltbotPluginDefinition = {
  id: "notion",
  name: "Notion Integration",
  description: "Full Notion integration with API, MCP tools, channel, notifications, and export",
  version: "1.0.0",

  async register(api: MoltbotPluginApi) {
    const { config, logger } = api;

    // Get Notion configuration
    const notionConfig = (config as any).notion || {};
    const apiToken = notionConfig.apiToken || process.env.NOTION_API_TOKEN || process.env.NOTION_TOKEN;

    if (!apiToken) {
      logger.warn("Notion API token not configured. Set NOTION_API_TOKEN or configure notion.apiToken");
      return;
    }

    // Create Notion client
    notionClient = createNotionClient({
      apiToken,
      timeoutMs: notionConfig.timeoutMs,
      maxRetries: notionConfig.maxRetries,
    });

    logger.info("Notion client initialized");

    // Register all MCP tools
    const tools = createAllNotionTools(notionClient);
    for (const tool of tools) {
      api.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute,
      });
    }
    logger.info(`Registered ${tools.length} Notion tools`);

    // Register channel if configured
    if (notionConfig.taskDatabaseId || notionConfig.inboxPageId) {
      notionChannel = createNotionChannel({
        client: notionClient,
        taskDatabaseId: notionConfig.taskDatabaseId,
        inboxPageId: notionConfig.inboxPageId,
        pollIntervalMs: notionConfig.pollIntervalMs || 30000,
        statusProperty: notionConfig.statusProperty || "Status",
        newTaskStatus: notionConfig.newTaskStatus || "New",
        completedTaskStatus: notionConfig.completedTaskStatus || "Done",
      });

      // Start channel
      await notionChannel.start();

      // Forward messages to gateway
      notionChannel.on("message", (message) => {
        logger.info(`Notion message: ${message.pageTitle}`);
        api.runtime.emit?.("notion:message", message);
      });

      logger.info("Notion channel started");
    }

    // Register notification provider if configured
    if (notionConfig.logDatabaseId || notionConfig.logPageId || notionConfig.notificationParentPageId) {
      notionNotifications = createNotionNotificationProvider({
        client: notionClient,
        logDatabaseId: notionConfig.logDatabaseId,
        logPageId: notionConfig.logPageId,
        createPages: notionConfig.createNotificationPages,
        parentPageId: notionConfig.notificationParentPageId,
      });

      logger.info("Notion notification provider initialized");
    }

    // Register additional tools for channel and export
    api.registerTool({
      name: "notion_export_docs",
      description: "Export documentation directory to Notion",
      parameters: {
        type: "object",
        properties: {
          directory: {
            type: "string",
            description: "Path to documentation directory",
          },
          parent_page_id: {
            type: "string",
            description: "Notion page ID to export into",
          },
          create_toc: {
            type: "boolean",
            description: "Create table of contents (default: true)",
          },
        },
        required: ["directory", "parent_page_id"],
      },
      execute: async (input) => {
        if (!notionClient) throw new Error("Notion client not initialized");

        const exporter = createNotionDocExporter({
          client: notionClient,
          parentPageId: input.parent_page_id as string,
          createToc: input.create_toc as boolean ?? true,
        });

        const result = await exporter.exportDirectory(input.directory as string);
        return result;
      },
    });

    api.registerTool({
      name: "notion_send_notification",
      description: "Send a notification to Notion",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Notification title" },
          body: { type: "string", description: "Notification body" },
          priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
        },
        required: ["title", "body"],
      },
      execute: async (input) => {
        if (!notionNotifications) throw new Error("Notion notifications not configured");

        return notionNotifications.send({
          title: input.title as string,
          body: input.body as string,
          priority: input.priority as any,
        });
      },
    });

    api.registerTool({
      name: "notion_channel_status",
      description: "Get Notion channel status",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        return {
          channelRunning: notionChannel?.getStatus().running ?? false,
          notificationsConfigured: notionNotifications !== null,
          clientStats: notionClient?.getStats(),
        };
      },
    });

    // Register HTTP endpoints
    api.registerHttpRoute({
      path: "/notion/status",
      handler: async (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          client: notionClient ? "initialized" : "not configured",
          channel: notionChannel?.getStatus() ?? null,
          notifications: notionNotifications ? "configured" : "not configured",
        }));
      },
    });

    api.registerHttpRoute({
      path: "/notion/webhook",
      handler: async (req, res) => {
        // Handle Notion webhooks (for future use)
        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", () => {
            try {
              const payload = JSON.parse(body);
              api.runtime.emit?.("notion:webhook", payload);
              res.statusCode = 200;
              res.end("OK");
            } catch {
              res.statusCode = 400;
              res.end("Invalid JSON");
            }
          });
        } else {
          res.statusCode = 405;
          res.end("Method not allowed");
        }
      },
    });

    // Register CLI commands
    api.registerCli(({ program }) => {
      const notionCmd = program
        .command("notion")
        .description("Notion integration commands");

      notionCmd
        .command("status")
        .description("Show Notion integration status")
        .action(() => {
          console.log("Notion Integration Status:");
          console.log(`  Client: ${notionClient ? "✅ Initialized" : "❌ Not configured"}`);
          console.log(`  Channel: ${notionChannel ? "✅ Running" : "❌ Not configured"}`);
          console.log(`  Notifications: ${notionNotifications ? "✅ Configured" : "❌ Not configured"}`);
          if (notionClient) {
            console.log(`  API Requests: ${notionClient.getStats().requestCount}`);
          }
        });

      notionCmd
        .command("search <query>")
        .description("Search Notion pages and databases")
        .option("-t, --type <type>", "Filter by type (page/database)")
        .option("-l, --limit <limit>", "Max results", "10")
        .action(async (query, opts) => {
          if (!notionClient) {
            console.error("Notion client not initialized");
            return;
          }

          const result = await notionClient.search({
            query,
            filter: opts.type ? { property: "object", value: opts.type } : undefined,
            page_size: parseInt(opts.limit, 10),
          });

          console.log(`Found ${result.results.length} results:`);
          for (const item of result.results) {
            const title = item.object === "page"
              ? extractTitle((item as any).properties)
              : (item as any).title?.map((t: any) => t.plain_text).join("");
            console.log(`  [${item.object}] ${title}`);
            console.log(`    URL: ${item.url}`);
          }
        });

      notionCmd
        .command("export <directory> <page-id>")
        .description("Export documentation to Notion")
        .option("--no-toc", "Skip table of contents")
        .action(async (directory, pageId, opts) => {
          if (!notionClient) {
            console.error("Notion client not initialized");
            return;
          }

          const exporter = createNotionDocExporter({
            client: notionClient,
            parentPageId: pageId,
            createToc: opts.toc !== false,
          });

          console.log(`Exporting ${directory} to Notion...`);
          const result = await exporter.exportDirectory(directory);

          console.log(`Export complete:`);
          console.log(`  Created: ${result.created}`);
          console.log(`  Updated: ${result.updated}`);
          console.log(`  Failed: ${result.failed}`);

          if (result.errors.length > 0) {
            console.log("\nErrors:");
            for (const err of result.errors) {
              console.log(`  ${err.path}: ${err.error}`);
            }
          }
        });

      notionCmd
        .command("notify <title> <body>")
        .description("Send a notification to Notion")
        .option("-p, --priority <priority>", "Priority level", "normal")
        .action(async (title, body, opts) => {
          if (!notionNotifications) {
            console.error("Notion notifications not configured");
            return;
          }

          const result = await notionNotifications.send({
            title,
            body,
            priority: opts.priority,
          });

          if (result.success) {
            console.log(`Notification sent: ${result.url}`);
          } else {
            console.error("Failed to send notification");
          }
        });
    });

    // Register gateway methods
    api.registerGatewayMethod("notion.search", async (params: any) => {
      if (!notionClient) throw new Error("Notion client not initialized");
      return notionClient.search(params);
    });

    api.registerGatewayMethod("notion.getPage", async (params: any) => {
      if (!notionClient) throw new Error("Notion client not initialized");
      return notionClient.getPage(params.pageId);
    });

    api.registerGatewayMethod("notion.createPage", async (params: any) => {
      if (!notionClient) throw new Error("Notion client not initialized");
      return notionClient.createPage(params);
    });

    api.registerGatewayMethod("notion.notify", async (params: any) => {
      if (!notionNotifications) throw new Error("Notion notifications not configured");
      return notionNotifications.send(params);
    });

    logger.info("Notion extension registered successfully");
  },
};

// Helper function
function extractTitle(properties: Record<string, any>): string {
  const titleProp = Object.values(properties).find((p) => p.type === "title");
  if (titleProp?.title) {
    return titleProp.title.map((t: any) => t.plain_text).join("");
  }
  return "Untitled";
}

export default plugin;

// Export instances for direct access
export { notionClient, notionChannel, notionNotifications };
