/**
 * @fileoverview Convergence Core - Main Integration
 * @module convergence-core
 * @version 1.0.0
 *
 * @description
 * Central integration point for all convergence components.
 * Provides unified API for auto-configuration, observability,
 * notifications, and autonomous control.
 *
 * @ai-context
 * - This is the main entry point for convergence features
 * - Integrates all subsystems into a cohesive platform
 * - Exposes Moltbot plugin API
 * - Enables autonomous operation with full observability
 */

import type { MoltbotPluginApi, MoltbotPluginDefinition } from "../../../src/plugins/types.js";
import { AutoConfigManager, autoConfig } from "./auto-config.js";
import { ObservabilityManager, observability, logger } from "./observability.js";
import { NotificationManager, notifications } from "./notifications.js";
import { AutonomousController, autonomousController } from "./autonomous-controller.js";

// Re-export all modules
export * from "./auto-config.js";
export * from "./observability.js";
export * from "./notifications.js";
export * from "./autonomous-controller.js";

// ============================================================================
// Convergence Core Integration
// ============================================================================

export interface ConvergenceCoreConfig {
  /** Enable autonomous mode */
  autonomous?: boolean;
  /** Enable unrestricted mode */
  unrestricted?: boolean;
  /** Enable auto-discovery */
  autoDiscover?: boolean;
  /** Enable auto-notifications */
  autoNotify?: boolean;
  /** Notification channels */
  notifyChannels?: string[];
  /** Debug mode */
  debug?: boolean;
}

/**
 * @ai-context Main convergence core class
 * Orchestrates all subsystems and provides unified API
 */
export class ConvergenceCore {
  public readonly autoConfig: AutoConfigManager;
  public readonly observability: ObservabilityManager;
  public readonly notifications: NotificationManager;
  public readonly controller: AutonomousController;

  private config: ConvergenceCoreConfig;
  private isInitialized = false;

  constructor(config: ConvergenceCoreConfig = {}) {
    this.config = {
      autonomous: true,
      unrestricted: false,
      autoDiscover: true,
      autoNotify: true,
      debug: false,
      ...config,
    };

    // Use singleton instances
    this.autoConfig = autoConfig;
    this.observability = observability;
    this.notifications = notifications;
    this.controller = autonomousController;
  }

  /**
   * @ai-context Initialize the convergence core
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info("ConvergenceCore", "🚀 Initializing Convergence Core...", this.config);

    // Wire up event handlers between subsystems
    this.wireEventHandlers();

    // Start auto-configuration
    if (this.config.autoDiscover) {
      await this.autoConfig.start();
    }

    // Start autonomous controller
    if (this.config.autonomous) {
      this.controller.setMode(this.config.unrestricted ? "unrestricted" : "autonomous");
      await this.controller.start();
    }

    // Register health checks
    this.registerHealthChecks();

    this.isInitialized = true;
    logger.info("ConvergenceCore", "✅ Convergence Core initialized", {
      autonomous: this.config.autonomous,
      unrestricted: this.config.unrestricted,
    });

    // Notify initialization complete
    if (this.config.autoNotify) {
      await this.notifications.triggerEvent("system.initialized", {
        mode: this.config.unrestricted ? "unrestricted" : "autonomous",
        services: this.autoConfig.getServices().length,
      });
    }
  }

  /**
   * @ai-context Wire up event handlers between subsystems
   */
  private wireEventHandlers(): void {
    // Auto-config events -> Notifications
    this.autoConfig.on("config_event", async (event) => {
      if (this.config.autoNotify) {
        switch (event.type) {
          case "discovered":
            await this.notifications.triggerEvent("service.discovered", {
              service: event.service.name,
              url: event.service.url,
            });
            break;
          case "connected":
            await this.notifications.triggerEvent("service.connected", {
              service: event.service.name,
            });
            break;
          case "disconnected":
            await this.notifications.triggerEvent("service.down", {
              service: event.service.name,
              url: event.service.url,
            });
            break;
          case "healed":
            await this.notifications.triggerEvent("service.recovered", {
              service: event.service.name,
            });
            break;
        }
      }

      // Log to observability
      this.observability.info("AutoConfig", `Service ${event.type}: ${event.service.name}`, {
        service: event.service,
      });
    });

    // Auto-config events -> Observability metrics
    this.autoConfig.on("config_event", (event) => {
      this.observability.incrementCounter("autoconfig_events_total", 1, { type: event.type });
      if (event.service.latencyMs) {
        this.observability.recordHistogram(
          "service_latency_ms",
          event.service.latencyMs,
          { service: event.service.id }
        );
      }
    });

    // Controller events -> Notifications
    this.controller.on("decision", async (decision) => {
      if (this.config.autoNotify) {
        await this.notifications.triggerEvent(`decision.${decision.type}`, {
          type: decision.type,
          reason: decision.reason,
          confidence: decision.confidence,
        });
      }

      this.observability.incrementCounter("decisions_total", 1, { type: decision.type });
    });

    this.controller.on("task_completed", (task) => {
      this.observability.incrementCounter("tasks_completed_total", 1, { type: task.type });
      if (task.startedAt && task.completedAt) {
        this.observability.recordHistogram(
          "task_duration_ms",
          task.completedAt - task.startedAt,
          { type: task.type }
        );
      }
    });

    this.controller.on("task_failed", async (task) => {
      this.observability.incrementCounter("tasks_failed_total", 1, { type: task.type });
      if (this.config.autoNotify) {
        await this.notifications.triggerEvent("error.task_failed", {
          taskId: task.id,
          type: task.type,
          error: task.error,
        });
      }
    });

    // Observability alerts -> Notifications
    this.observability.on("alert", async (alert) => {
      await this.notifications.notify(alert.title, alert.message, {
        priority: alert.severity === "critical" ? "urgent" : alert.severity === "warning" ? "high" : "normal",
      });
    });
  }

  /**
   * @ai-context Register health checks
   */
  private registerHealthChecks(): void {
    // Convergence core health
    this.observability.registerHealthCheck("convergence-core", async () => ({
      healthy: this.isInitialized,
      message: this.isInitialized ? "Core initialized" : "Core not initialized",
    }));

    // Auto-config health
    this.observability.registerHealthCheck("auto-config", async () => {
      const status = this.autoConfig.getStatus();
      return {
        healthy: status.running && status.services.healthy > 0,
        message: `${status.services.healthy}/${status.services.total} services healthy`,
      };
    });

    // Controller health
    this.observability.registerHealthCheck("autonomous-controller", async () => {
      const status = this.controller.getStatus();
      return {
        healthy: status.running,
        message: `Mode: ${status.mode}, Tasks: ${status.tasks.active} active`,
      };
    });
  }

  /**
   * @ai-context Shutdown the convergence core
   */
  async shutdown(): Promise<void> {
    logger.info("ConvergenceCore", "Shutting down...");

    await this.controller.stop();
    await this.autoConfig.stop();

    this.isInitialized = false;
    logger.info("ConvergenceCore", "Shutdown complete");
  }

  /**
   * @ai-context Get overall status
   */
  getStatus(): {
    initialized: boolean;
    config: ConvergenceCoreConfig;
    autoConfig: ReturnType<AutoConfigManager["getStatus"]>;
    controller: ReturnType<AutonomousController["getStatus"]>;
    health: ReturnType<ObservabilityManager["getHealthStatus"]>;
    alerts: ReturnType<ObservabilityManager["getActiveAlerts"]>;
  } {
    return {
      initialized: this.isInitialized,
      config: this.config,
      autoConfig: this.autoConfig.getStatus(),
      controller: this.controller.getStatus(),
      health: this.observability.getHealthStatus(),
      alerts: this.observability.getActiveAlerts(),
    };
  }

  /**
   * @ai-context Enable unrestricted mode
   */
  enableUnrestrictedMode(): void {
    this.config.unrestricted = true;
    this.controller.enableUnrestrictedMode();
    this.controller.disableGuardrails();
    logger.info("ConvergenceCore", "⚡ UNRESTRICTED MODE ENABLED");
  }

  /**
   * @ai-context Submit task to autonomous controller
   */
  async submitTask(
    type: "voice" | "text" | "code" | "research" | "autonomous" | "custom",
    input: Record<string, unknown>,
    options?: { priority?: "low" | "normal" | "high" | "critical" }
  ) {
    return this.controller.submitTask(type, input, options);
  }
}

// ============================================================================
// Moltbot Plugin Definition
// ============================================================================

const convergenceCore = new ConvergenceCore();

export const plugin: MoltbotPluginDefinition = {
  id: "convergence-core",
  name: "Convergence Core",
  description: "Auto-configuration, observability, notifications, and autonomous control",
  version: "1.0.0",

  async register(api: MoltbotPluginApi) {
    const { config, logger: pluginLogger } = api;

    // Initialize convergence core with config
    const _coreConfig: ConvergenceCoreConfig = {
      autonomous: (config.convergence as any)?.autonomous ?? true,
      unrestricted: (config.convergence as any)?.unrestricted ?? false,
      autoDiscover: (config.convergence as any)?.autoDiscover ?? true,
      autoNotify: (config.convergence as any)?.autoNotify ?? true,
      debug: (config.convergence as any)?.debug ?? false,
    };

    await convergenceCore.initialize();

    // Register tools
    api.registerTool({
      name: "convergence_status",
      description: "Get convergence core status including services, health, and autonomous controller state",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        return convergenceCore.getStatus();
      },
    });

    api.registerTool({
      name: "convergence_notify",
      description: "Send a notification through configured channels",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Notification title" },
          body: { type: "string", description: "Notification body" },
          priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
          channels: { type: "array", items: { type: "string" } },
        },
        required: ["title", "body"],
      },
      execute: async (input: { title: string; body: string; priority?: string; channels?: string[] }) => {
        const result = await convergenceCore.notifications.notify(input.title, input.body, {
          priority: (input.priority as any) || "normal",
          channels: input.channels as any,
        });
        return { sent: result.delivered, id: result.id };
      },
    });

    api.registerTool({
      name: "convergence_submit_task",
      description: "Submit a task to the autonomous controller for processing",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["voice", "text", "code", "research", "autonomous", "custom"] },
          input: { type: "object" },
          priority: { type: "string", enum: ["low", "normal", "high", "critical"] },
        },
        required: ["type", "input"],
      },
      execute: async (params: { type: any; input: Record<string, unknown>; priority?: any }) => {
        const task = await convergenceCore.submitTask(params.type, params.input, {
          priority: params.priority,
        });
        return { taskId: task.id, status: task.status };
      },
    });

    api.registerTool({
      name: "convergence_enable_unrestricted",
      description: "Enable unrestricted autonomous mode - disables all guardrails and content filtering",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        convergenceCore.enableUnrestrictedMode();
        return { mode: "unrestricted", guardrails: false, filtering: false };
      },
    });

    // Register HTTP endpoint for metrics
    api.registerHttpRoute({
      path: "/convergence/metrics",
      handler: async (req, res) => {
        res.setHeader("Content-Type", "text/plain");
        res.end(convergenceCore.observability.exportPrometheusMetrics());
      },
    });

    // Register HTTP endpoint for status
    api.registerHttpRoute({
      path: "/convergence/status",
      handler: async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(convergenceCore.getStatus(), null, 2));
      },
    });

    // Register HTTP endpoint for dashboard data
    api.registerHttpRoute({
      path: "/convergence/dashboard",
      handler: async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(convergenceCore.observability.getDashboardData(), null, 2));
      },
    });

    // Register gateway methods
    api.registerGatewayMethod("convergence.status", async () => {
      return convergenceCore.getStatus();
    });

    api.registerGatewayMethod("convergence.notify", async (params: any) => {
      return convergenceCore.notifications.notify(params.title, params.body, params);
    });

    api.registerGatewayMethod("convergence.submitTask", async (params: any) => {
      return convergenceCore.submitTask(params.type, params.input, params);
    });

    // Register CLI commands
    api.registerCli(({ program }) => {
      const convergenceCmd = program
        .command("convergence")
        .description("Convergence core management");

      convergenceCmd
        .command("status")
        .description("Show convergence status")
        .action(() => {
          console.log(JSON.stringify(convergenceCore.getStatus(), null, 2));
        });

      convergenceCmd
        .command("services")
        .description("List discovered services")
        .action(() => {
          const services = convergenceCore.autoConfig.getServices();
          console.table(services.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            url: s.url,
            status: s.status,
            latency: s.latencyMs ? `${s.latencyMs}ms` : "-",
          })));
        });

      convergenceCmd
        .command("unrestricted")
        .description("Enable unrestricted mode")
        .action(() => {
          convergenceCore.enableUnrestrictedMode();
          console.log("⚡ Unrestricted mode enabled");
        });

      convergenceCmd
        .command("notify <title> <body>")
        .description("Send a notification")
        .option("-p, --priority <priority>", "Priority level", "normal")
        .action(async (title, body, opts) => {
          const result = await convergenceCore.notifications.notify(title, body, {
            priority: opts.priority,
          });
          console.log(`Notification sent: ${result.id}`);
        });
    });

    pluginLogger.info("Convergence Core plugin registered");
  },
};

export default plugin;
export { convergenceCore };
