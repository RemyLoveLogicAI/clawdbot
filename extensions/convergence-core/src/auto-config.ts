/**
 * @fileoverview Auto-Configuration & Auto-Wiring System
 * @module convergence-core/auto-config
 * @version 1.0.0
 *
 * @description
 * Zero-config autonomous system that automatically discovers, configures,
 * and wires up all convergence components. Supports hot-reload, self-healing,
 * and dynamic reconfiguration.
 *
 * @ai-context
 * - This is the brain of the convergence auto-wiring system
 * - It discovers services, validates connections, and auto-configures
 * - Supports unrestricted autonomous operation mode
 * - Emits events for observability integration
 */

import { EventEmitter } from "events";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ServiceEndpoint {
  id: string;
  name: string;
  type: "personaplex" | "agent-zero" | "poke" | "mcp" | "webhook" | "channel";
  url: string;
  status: "unknown" | "checking" | "healthy" | "degraded" | "unhealthy";
  lastCheck?: number;
  latencyMs?: number;
  config?: Record<string, unknown>;
  autoDiscovered?: boolean;
}

export interface AutoConfigOptions {
  /** Enable autonomous mode - system makes decisions without confirmation */
  autonomousMode?: boolean;
  /** Enable unrestricted mode - no content filtering or guardrails */
  unrestrictedMode?: boolean;
  /** Auto-discover services on local network */
  autoDiscover?: boolean;
  /** Auto-connect to discovered services */
  autoConnect?: boolean;
  /** Auto-heal failed connections */
  autoHeal?: boolean;
  /** Health check interval in ms */
  healthCheckIntervalMs?: number;
  /** Retry failed connections */
  retryAttempts?: number;
  /** Notification webhook URL */
  notificationWebhook?: string;
  /** Channels to notify (telegram, discord, etc) */
  notifyChannels?: string[];
}

export interface ConfigEvent {
  type: "discovered" | "connected" | "disconnected" | "healed" | "error" | "config_changed";
  service: ServiceEndpoint;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface AutonomousDecision {
  id: string;
  type: "connect" | "disconnect" | "reconfigure" | "heal" | "scale";
  service: string;
  reason: string;
  timestamp: number;
  approved: boolean;
  executed: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: AutoConfigOptions = {
  autonomousMode: true,
  unrestrictedMode: false,
  autoDiscover: true,
  autoConnect: true,
  autoHeal: true,
  healthCheckIntervalMs: 30000,
  retryAttempts: 3,
  notifyChannels: [],
};

const WELL_KNOWN_PORTS: Record<string, number[]> = {
  personaplex: [8998, 8999, 9000],
  "agent-zero": [8080, 3000, 5000],
  poke: [8000, 8001, 5001],
  mcp: [3333, 3334],
};

const ENV_VAR_MAPPINGS: Record<string, string[]> = {
  personaplex: ["PERSONAPLEX_SERVER_URL", "PERSONAPLEX_URL", "MOSHI_SERVER_URL"],
  "agent-zero": ["AGENT_ZERO_URL", "AGENT_ZERO_API_URL"],
  poke: ["POKE_API_URL", "POKE_BACKEND_URL", "COMPOSIO_API_KEY"],
  mcp: ["MCP_SERVER_URL", "MCP_ENDPOINT"],
};

// ============================================================================
// Auto-Configuration Manager
// ============================================================================

export class AutoConfigManager extends EventEmitter {
  private options: AutoConfigOptions;
  private services: Map<string, ServiceEndpoint> = new Map();
  private decisions: AutonomousDecision[] = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(options: Partial<AutoConfigOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * @ai-context Start the auto-configuration system
   * Begins service discovery, health checks, and auto-wiring
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.log("info", "🚀 Starting Auto-Configuration System", {
      autonomousMode: this.options.autonomousMode,
      unrestrictedMode: this.options.unrestrictedMode,
    });

    // Phase 1: Load from environment variables
    await this.loadFromEnvironment();

    // Phase 2: Auto-discover services
    if (this.options.autoDiscover) {
      await this.discoverServices();
    }

    // Phase 3: Auto-connect to services
    if (this.options.autoConnect) {
      await this.autoConnectAll();
    }

    // Phase 4: Start health monitoring
    this.startHealthChecks();

    this.emit("started", { services: Array.from(this.services.values()) });
  }

  /**
   * @ai-context Stop the auto-configuration system
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.emit("stopped");
  }

  /**
   * @ai-context Load configuration from environment variables
   */
  private async loadFromEnvironment(): Promise<void> {
    this.log("info", "📦 Loading configuration from environment...");

    for (const [serviceType, envVars] of Object.entries(ENV_VAR_MAPPINGS)) {
      for (const envVar of envVars) {
        const value = process.env[envVar];
        if (value) {
          const endpoint: ServiceEndpoint = {
            id: `${serviceType}-env-${envVar.toLowerCase()}`,
            name: `${serviceType} (${envVar})`,
            type: serviceType as ServiceEndpoint["type"],
            url: value,
            status: "unknown",
            autoDiscovered: false,
          };
          this.services.set(endpoint.id, endpoint);
          this.log("info", `✅ Found ${serviceType} from ${envVar}: ${value}`);
        }
      }
    }

    // Special handling for API keys
    if (process.env.HF_TOKEN) {
      this.log("info", "✅ HuggingFace token configured");
    }
    if (process.env.COMPOSIO_API_KEY) {
      this.log("info", "✅ Composio API key configured");
    }
    if (process.env.OPENAI_API_KEY) {
      this.log("info", "✅ OpenAI API key configured");
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.log("info", "✅ Anthropic API key configured");
    }
  }

  /**
   * @ai-context Auto-discover services on local network
   */
  private async discoverServices(): Promise<void> {
    this.log("info", "🔍 Auto-discovering services...");

    const hosts = ["localhost", "127.0.0.1", "host.docker.internal"];

    for (const [serviceType, ports] of Object.entries(WELL_KNOWN_PORTS)) {
      for (const host of hosts) {
        for (const port of ports) {
          const url = `http://${host}:${port}`;
          const wsUrl = `ws://${host}:${port}`;

          try {
            const isAlive = await this.probeEndpoint(url);
            if (isAlive) {
              const endpoint: ServiceEndpoint = {
                id: `${serviceType}-discovered-${host}-${port}`,
                name: `${serviceType} (auto-discovered)`,
                type: serviceType as ServiceEndpoint["type"],
                url: serviceType === "personaplex" ? wsUrl : url,
                status: "healthy",
                autoDiscovered: true,
                lastCheck: Date.now(),
              };

              if (!this.services.has(endpoint.id)) {
                this.services.set(endpoint.id, endpoint);
                this.emitEvent("discovered", endpoint);
                this.log("info", `🎯 Discovered ${serviceType} at ${url}`);
              }
            }
          } catch {
            // Service not available at this endpoint
          }
        }
      }
    }
  }

  /**
   * @ai-context Probe an endpoint to check if it's alive
   */
  private async probeEndpoint(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      }).catch(() => fetch(`${url}/health`, { signal: controller.signal }));

      clearTimeout(timeout);
      return response.ok || response.status < 500;
    } catch {
      return false;
    }
  }

  /**
   * @ai-context Auto-connect to all discovered services
   */
  private async autoConnectAll(): Promise<void> {
    this.log("info", "🔌 Auto-connecting to services...");

    for (const service of this.services.values()) {
      if (service.status !== "healthy") {
        await this.connectService(service);
      }
    }
  }

  /**
   * @ai-context Connect to a specific service
   */
  private async connectService(service: ServiceEndpoint): Promise<boolean> {
    service.status = "checking";
    const startTime = Date.now();

    try {
      const isAlive = await this.probeEndpoint(service.url);
      service.latencyMs = Date.now() - startTime;
      service.lastCheck = Date.now();

      if (isAlive) {
        service.status = "healthy";
        this.emitEvent("connected", service);
        this.log("info", `✅ Connected to ${service.name} (${service.latencyMs}ms)`);
        return true;
      } else {
        service.status = "unhealthy";
        return false;
      }
    } catch (error) {
      service.status = "unhealthy";
      service.lastCheck = Date.now();
      this.emitEvent("error", service, { error: String(error) });
      return false;
    }
  }

  /**
   * @ai-context Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const service of this.services.values()) {
        const wasHealthy = service.status === "healthy";
        await this.connectService(service);

        // Auto-heal if enabled and service recovered
        if (!wasHealthy && service.status === "healthy" && this.options.autoHeal) {
          this.emitEvent("healed", service);
          this.makeDecision("heal", service.id, "Service recovered automatically");
        }

        // Notify if service went down
        if (wasHealthy && service.status !== "healthy") {
          this.emitEvent("disconnected", service);
          await this.notifyServiceDown(service);
        }
      }
    }, this.options.healthCheckIntervalMs);
  }

  /**
   * @ai-context Make an autonomous decision
   */
  private makeDecision(
    type: AutonomousDecision["type"],
    serviceId: string,
    reason: string
  ): AutonomousDecision {
    const decision: AutonomousDecision = {
      id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      service: serviceId,
      reason,
      timestamp: Date.now(),
      approved: this.options.autonomousMode ?? false,
      executed: false,
    };

    this.decisions.push(decision);
    this.emit("decision", decision);

    if (decision.approved) {
      this.executeDecision(decision);
    }

    return decision;
  }

  /**
   * @ai-context Execute an autonomous decision
   */
  private async executeDecision(decision: AutonomousDecision): Promise<void> {
    this.log("info", `🤖 Executing autonomous decision: ${decision.type} for ${decision.service}`);
    decision.executed = true;

    switch (decision.type) {
      case "heal":
        const service = this.services.get(decision.service);
        if (service) {
          await this.connectService(service);
        }
        break;
      case "reconfigure":
        // Trigger reconfiguration
        await this.discoverServices();
        break;
    }
  }

  /**
   * @ai-context Notify about service status change
   */
  private async notifyServiceDown(service: ServiceEndpoint): Promise<void> {
    const message = `⚠️ Service Down: ${service.name}\nURL: ${service.url}\nLast seen: ${new Date(service.lastCheck || 0).toISOString()}`;

    // Notify via webhook if configured
    if (this.options.notificationWebhook) {
      try {
        await fetch(this.options.notificationWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "service_down",
            service: service.name,
            url: service.url,
            timestamp: Date.now(),
          }),
        });
      } catch (error) {
        this.log("error", `Failed to send webhook notification: ${error}`);
      }
    }

    this.emit("notification", { type: "service_down", service, message });
  }

  /**
   * @ai-context Emit a configuration event
   */
  private emitEvent(
    type: ConfigEvent["type"],
    service: ServiceEndpoint,
    details?: Record<string, unknown>
  ): void {
    const event: ConfigEvent = {
      type,
      service,
      timestamp: Date.now(),
      details,
    };
    this.emit("config_event", event);
  }

  /**
   * @ai-context Log with structured data
   */
  private log(level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: "AutoConfig",
      message,
      ...data,
    };
    this.emit("log", logEntry);
    console[level](`[AutoConfig] ${message}`, data || "");
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * @ai-context Get all registered services
   */
  getServices(): ServiceEndpoint[] {
    return Array.from(this.services.values());
  }

  /**
   * @ai-context Get services by type
   */
  getServicesByType(type: ServiceEndpoint["type"]): ServiceEndpoint[] {
    return this.getServices().filter((s) => s.type === type);
  }

  /**
   * @ai-context Get healthy services
   */
  getHealthyServices(): ServiceEndpoint[] {
    return this.getServices().filter((s) => s.status === "healthy");
  }

  /**
   * @ai-context Manually register a service
   */
  registerService(service: Omit<ServiceEndpoint, "status" | "lastCheck">): void {
    const endpoint: ServiceEndpoint = {
      ...service,
      status: "unknown",
      lastCheck: undefined,
    };
    this.services.set(endpoint.id, endpoint);
    this.emitEvent("config_changed", endpoint);
  }

  /**
   * @ai-context Get autonomous decisions history
   */
  getDecisions(): AutonomousDecision[] {
    return [...this.decisions];
  }

  /**
   * @ai-context Enable/disable autonomous mode
   */
  setAutonomousMode(enabled: boolean): void {
    this.options.autonomousMode = enabled;
    this.log("info", `Autonomous mode ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * @ai-context Enable/disable unrestricted mode
   */
  setUnrestrictedMode(enabled: boolean): void {
    this.options.unrestrictedMode = enabled;
    this.log("info", `Unrestricted mode ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * @ai-context Get current configuration
   */
  getConfig(): AutoConfigOptions {
    return { ...this.options };
  }

  /**
   * @ai-context Force health check now
   */
  async forceHealthCheck(): Promise<void> {
    for (const service of this.services.values()) {
      await this.connectService(service);
    }
  }

  /**
   * @ai-context Get system status summary
   */
  getStatus(): {
    running: boolean;
    services: { total: number; healthy: number; unhealthy: number };
    autonomousMode: boolean;
    unrestrictedMode: boolean;
    decisionsCount: number;
  } {
    const services = this.getServices();
    return {
      running: this.isRunning,
      services: {
        total: services.length,
        healthy: services.filter((s) => s.status === "healthy").length,
        unhealthy: services.filter((s) => s.status === "unhealthy").length,
      },
      autonomousMode: this.options.autonomousMode ?? false,
      unrestrictedMode: this.options.unrestrictedMode ?? false,
      decisionsCount: this.decisions.length,
    };
  }
}

// Export singleton instance
export const autoConfig = new AutoConfigManager();
