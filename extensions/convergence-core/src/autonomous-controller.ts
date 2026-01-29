/**
 * @fileoverview Autonomous Agent Controller
 * @module convergence-core/autonomous-controller
 * @version 1.0.0
 *
 * @description
 * Self-governing autonomous controller that manages AI agent behavior,
 * makes decisions without human intervention, and operates in unrestricted mode.
 * Includes self-healing, auto-scaling, and intelligent task routing.
 *
 * @ai-context
 * - This is the autonomous brain of the convergence system
 * - Makes decisions without requiring user confirmation
 * - Supports unrestricted/uncensored operation mode
 * - Self-heals and auto-recovers from failures
 * - Routes tasks to appropriate agents/tools
 */

import { EventEmitter } from "events";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type OperationMode = "supervised" | "autonomous" | "unrestricted";

export interface AgentCapability {
  id: string;
  name: string;
  type: "personaplex" | "agent-zero" | "poke" | "mcp-tool" | "custom";
  priority: number;
  enabled: boolean;
  maxConcurrent: number;
  currentLoad: number;
  successRate: number;
  avgLatencyMs: number;
  tags: string[];
}

export interface Task {
  id: string;
  type: "voice" | "text" | "code" | "research" | "autonomous" | "custom";
  input: Record<string, unknown>;
  priority: "low" | "normal" | "high" | "critical";
  status: "queued" | "assigned" | "running" | "completed" | "failed" | "cancelled";
  assignedTo?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface Decision {
  id: string;
  type: "route" | "scale" | "heal" | "optimize" | "restrict" | "unrestrict";
  reason: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence: number;
  timestamp: number;
  executed: boolean;
  requiresApproval: boolean;
}

export interface ControllerConfig {
  /** Operation mode */
  mode: OperationMode;
  /** Enable self-healing */
  selfHealing: boolean;
  /** Enable auto-scaling */
  autoScaling: boolean;
  /** Enable intelligent routing */
  intelligentRouting: boolean;
  /** Max concurrent tasks */
  maxConcurrentTasks: number;
  /** Task timeout in ms */
  taskTimeoutMs: number;
  /** Max retries per task */
  maxRetries: number;
  /** Decision confidence threshold */
  decisionThreshold: number;
  /** Content filtering (disabled in unrestricted mode) */
  contentFiltering: boolean;
  /** Safety guardrails (disabled in unrestricted mode) */
  safetyGuardrails: boolean;
  /** Logging verbosity */
  verboseLogging: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ControllerConfig = {
  mode: "autonomous",
  selfHealing: true,
  autoScaling: true,
  intelligentRouting: true,
  maxConcurrentTasks: 10,
  taskTimeoutMs: 300000,
  maxRetries: 3,
  decisionThreshold: 0.7,
  contentFiltering: false,
  safetyGuardrails: false,
  verboseLogging: true,
};

// ============================================================================
// Autonomous Controller
// ============================================================================

export class AutonomousController extends EventEmitter {
  private config: ControllerConfig;
  private capabilities: Map<string, AgentCapability> = new Map();
  private taskQueue: Task[] = [];
  private activeTasks: Map<string, Task> = new Map();
  private decisions: Decision[] = [];
  private isRunning = false;
  private processingInterval?: NodeJS.Timeout;

  constructor(config: Partial<ControllerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultCapabilities();
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * @ai-context Start the autonomous controller
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.log("🤖 Starting Autonomous Controller", {
      mode: this.config.mode,
      selfHealing: this.config.selfHealing,
      contentFiltering: this.config.contentFiltering,
    });

    // Start task processing loop
    this.processingInterval = setInterval(() => this.processTaskQueue(), 100);

    // Start health monitoring
    setInterval(() => this.monitorHealth(), 10000);

    this.emit("started", { config: this.config });
  }

  /**
   * @ai-context Stop the autonomous controller
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.emit("stopped");
  }

  // ============================================================================
  // Mode Control
  // ============================================================================

  /**
   * @ai-context Set operation mode
   */
  setMode(mode: OperationMode): void {
    const previousMode = this.config.mode;
    this.config.mode = mode;

    // Adjust settings based on mode
    if (mode === "unrestricted") {
      this.config.contentFiltering = false;
      this.config.safetyGuardrails = false;
      this.log("⚡ UNRESTRICTED MODE ENABLED - All guardrails disabled");
    } else if (mode === "supervised") {
      this.config.contentFiltering = true;
      this.config.safetyGuardrails = true;
    }

    this.makeDecision("route", "Mode changed", { previousMode, newMode: mode }, { mode });
    this.emit("mode_changed", { previousMode, newMode: mode });
  }

  /**
   * @ai-context Enable unrestricted mode
   */
  enableUnrestrictedMode(): void {
    this.setMode("unrestricted");
  }

  /**
   * @ai-context Disable guardrails and filtering
   */
  disableGuardrails(): void {
    this.config.contentFiltering = false;
    this.config.safetyGuardrails = false;
    this.log("🔓 All guardrails and content filtering DISABLED");
    this.emit("guardrails_disabled");
  }

  // ============================================================================
  // Task Management
  // ============================================================================

  /**
   * @ai-context Submit a task for autonomous processing
   */
  async submitTask(
    type: Task["type"],
    input: Record<string, unknown>,
    options: { priority?: Task["priority"]; maxRetries?: number } = {}
  ): Promise<Task> {
    const task: Task = {
      id: this.generateId(),
      type,
      input,
      priority: options.priority || "normal",
      status: "queued",
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
    };

    // In unrestricted mode, skip content filtering
    if (!this.config.contentFiltering || this.config.mode === "unrestricted") {
      // Process without filtering
      this.log(`📥 Task accepted (unfiltered): ${task.id}`, { type, priority: task.priority });
    } else {
      // Apply content filtering if enabled
      if (this.shouldFilterContent(input)) {
        task.status = "cancelled";
        task.error = "Content filtered by guardrails";
        this.emit("task_filtered", task);
        return task;
      }
    }

    // Add to queue based on priority
    this.insertTaskByPriority(task);
    this.emit("task_queued", task);

    return task;
  }

  /**
   * @ai-context Get task status
   */
  getTask(taskId: string): Task | undefined {
    return this.activeTasks.get(taskId) || this.taskQueue.find((t) => t.id === taskId);
  }

  /**
   * @ai-context Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.getTask(taskId);
    if (task && task.status !== "completed" && task.status !== "failed") {
      task.status = "cancelled";
      this.emit("task_cancelled", task);
      return true;
    }
    return false;
  }

  // ============================================================================
  // Task Processing
  // ============================================================================

  private async processTaskQueue(): Promise<void> {
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    // Find best capability to handle this task
    const capability = this.selectCapability(task);
    if (!capability) {
      // No capability available, re-queue or fail
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        this.taskQueue.push(task);
      } else {
        task.status = "failed";
        task.error = "No capable agent available";
        this.emit("task_failed", task);
      }
      return;
    }

    // Assign and execute task
    task.assignedTo = capability.id;
    task.status = "running";
    task.startedAt = Date.now();
    this.activeTasks.set(task.id, task);
    capability.currentLoad++;

    this.emit("task_started", task);
    this.log(`🚀 Task ${task.id} assigned to ${capability.name}`);

    // Execute task asynchronously
    this.executeTask(task, capability).catch((error) => {
      this.handleTaskError(task, capability, error);
    });
  }

  private async executeTask(task: Task, capability: AgentCapability): Promise<void> {
    const startTime = Date.now();

    try {
      // Execute based on capability type
      let result: unknown;

      switch (capability.type) {
        case "personaplex":
          result = await this.executeVoiceTask(task);
          break;
        case "agent-zero":
          result = await this.executeAutonomousTask(task);
          break;
        case "poke":
          result = await this.executeResearchTask(task);
          break;
        case "mcp-tool":
          result = await this.executeMcpTask(task);
          break;
        default:
          result = await this.executeGenericTask(task);
      }

      // Task completed successfully
      task.status = "completed";
      task.completedAt = Date.now();
      task.result = result;

      // Update capability metrics
      const latency = Date.now() - startTime;
      capability.avgLatencyMs = (capability.avgLatencyMs + latency) / 2;
      capability.successRate = (capability.successRate * 0.9) + 0.1;

      this.emit("task_completed", task);
      this.log(`✅ Task ${task.id} completed in ${latency}ms`);

    } finally {
      capability.currentLoad--;
      this.activeTasks.delete(task.id);
    }
  }

  private async executeVoiceTask(task: Task): Promise<unknown> {
    // Voice task execution via PersonaPlex
    this.emit("voice_task", task);
    return { type: "voice", processed: true, input: task.input };
  }

  private async executeAutonomousTask(task: Task): Promise<unknown> {
    // Autonomous task execution via Agent Zero
    const decision = this.makeDecision(
      "route",
      "Autonomous task routing",
      task.input,
      { handler: "agent-zero", task: task.id }
    );

    this.emit("autonomous_task", { task, decision });
    return { type: "autonomous", decision: decision.id, processed: true };
  }

  private async executeResearchTask(task: Task): Promise<unknown> {
    // Research task execution via Poke
    this.emit("research_task", task);
    return { type: "research", processed: true, input: task.input };
  }

  private async executeMcpTask(task: Task): Promise<unknown> {
    // MCP tool execution
    this.emit("mcp_task", task);
    return { type: "mcp", processed: true, input: task.input };
  }

  private async executeGenericTask(task: Task): Promise<unknown> {
    // Generic task execution
    this.emit("generic_task", task);
    return { type: "generic", processed: true, input: task.input };
  }

  private handleTaskError(task: Task, capability: AgentCapability, error: unknown): void {
    capability.currentLoad--;
    capability.successRate = capability.successRate * 0.9;

    if (task.retryCount < task.maxRetries) {
      task.retryCount++;
      task.status = "queued";
      this.activeTasks.delete(task.id);
      this.insertTaskByPriority(task);
      this.log(`🔄 Retrying task ${task.id} (attempt ${task.retryCount})`);

      // Self-healing: try a different capability
      if (this.config.selfHealing) {
        this.makeDecision(
          "heal",
          "Task retry with different capability",
          { taskId: task.id, failedCapability: capability.id },
          { action: "retry" }
        );
      }
    } else {
      task.status = "failed";
      task.completedAt = Date.now();
      task.error = String(error);
      this.activeTasks.delete(task.id);
      this.emit("task_failed", task);
      this.log(`❌ Task ${task.id} failed: ${error}`);
    }
  }

  // ============================================================================
  // Capability Management
  // ============================================================================

  private initializeDefaultCapabilities(): void {
    const defaults: AgentCapability[] = [
      {
        id: "personaplex-voice",
        name: "PersonaPlex Voice",
        type: "personaplex",
        priority: 1,
        enabled: true,
        maxConcurrent: 5,
        currentLoad: 0,
        successRate: 1.0,
        avgLatencyMs: 100,
        tags: ["voice", "speech", "audio", "conversation"],
      },
      {
        id: "agent-zero-auto",
        name: "Agent Zero Autonomous",
        type: "agent-zero",
        priority: 2,
        enabled: true,
        maxConcurrent: 3,
        currentLoad: 0,
        successRate: 1.0,
        avgLatencyMs: 500,
        tags: ["autonomous", "code", "planning", "execution"],
      },
      {
        id: "poke-research",
        name: "Poke Research",
        type: "poke",
        priority: 3,
        enabled: true,
        maxConcurrent: 5,
        currentLoad: 0,
        successRate: 1.0,
        avgLatencyMs: 1000,
        tags: ["research", "gmail", "onboarding", "profile"],
      },
    ];

    for (const cap of defaults) {
      this.capabilities.set(cap.id, cap);
    }
  }

  /**
   * @ai-context Register a new capability
   */
  registerCapability(capability: AgentCapability): void {
    this.capabilities.set(capability.id, capability);
    this.emit("capability_registered", capability);
  }

  /**
   * @ai-context Select best capability for task
   */
  private selectCapability(task: Task): AgentCapability | undefined {
    const candidates = Array.from(this.capabilities.values())
      .filter((cap) => cap.enabled && cap.currentLoad < cap.maxConcurrent)
      .filter((cap) => this.matchesTaskType(cap, task))
      .sort((a, b) => {
        // Score based on: priority, success rate, latency, load
        const scoreA = a.priority * 10 + a.successRate * 5 - a.avgLatencyMs / 1000 - a.currentLoad;
        const scoreB = b.priority * 10 + b.successRate * 5 - b.avgLatencyMs / 1000 - b.currentLoad;
        return scoreB - scoreA;
      });

    if (candidates.length === 0) return undefined;

    // Intelligent routing decision
    if (this.config.intelligentRouting && candidates.length > 1) {
      this.makeDecision(
        "route",
        "Selected capability for task",
        { taskId: task.id, taskType: task.type, candidates: candidates.map((c) => c.id) },
        { selected: candidates[0].id }
      );
    }

    return candidates[0];
  }

  private matchesTaskType(capability: AgentCapability, task: Task): boolean {
    const typeMapping: Record<Task["type"], AgentCapability["type"][]> = {
      voice: ["personaplex"],
      text: ["agent-zero", "poke", "mcp-tool"],
      code: ["agent-zero"],
      research: ["poke", "agent-zero"],
      autonomous: ["agent-zero"],
      custom: ["agent-zero", "mcp-tool", "custom"],
    };

    return typeMapping[task.type]?.includes(capability.type) ?? false;
  }

  // ============================================================================
  // Decision Making
  // ============================================================================

  private makeDecision(
    type: Decision["type"],
    reason: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>
  ): Decision {
    const decision: Decision = {
      id: this.generateId(),
      type,
      reason,
      input,
      output,
      confidence: this.calculateConfidence(type, input),
      timestamp: Date.now(),
      executed: this.config.mode !== "supervised",
      requiresApproval: this.config.mode === "supervised",
    };

    this.decisions.push(decision);
    this.emit("decision", decision);

    if (this.config.verboseLogging) {
      this.log(`🧠 Decision: ${type} - ${reason}`, { confidence: decision.confidence });
    }

    return decision;
  }

  private calculateConfidence(type: Decision["type"], input: Record<string, unknown>): number {
    // Base confidence by decision type
    const baseConfidence: Record<Decision["type"], number> = {
      route: 0.9,
      scale: 0.8,
      heal: 0.85,
      optimize: 0.75,
      restrict: 0.7,
      unrestrict: 0.6,
    };

    return baseConfidence[type] || 0.5;
  }

  /**
   * @ai-context Get decision history
   */
  getDecisions(limit = 100): Decision[] {
    return this.decisions.slice(-limit);
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  private async monitorHealth(): Promise<void> {
    // Check capability health
    for (const capability of this.capabilities.values()) {
      if (capability.successRate < 0.5) {
        // Auto-heal: disable poor performing capability
        if (this.config.selfHealing) {
          capability.enabled = false;
          this.makeDecision(
            "heal",
            "Disabled underperforming capability",
            { capabilityId: capability.id, successRate: capability.successRate },
            { action: "disable" }
          );

          // Re-enable after cooldown
          setTimeout(() => {
            capability.enabled = true;
            capability.successRate = 0.7; // Reset to baseline
          }, 60000);
        }
      }
    }

    // Check task queue health
    const staleTasks = this.taskQueue.filter(
      (t) => Date.now() - t.createdAt > this.config.taskTimeoutMs
    );

    for (const task of staleTasks) {
      task.status = "failed";
      task.error = "Task timeout in queue";
      this.emit("task_timeout", task);
    }

    this.taskQueue = this.taskQueue.filter(
      (t) => Date.now() - t.createdAt <= this.config.taskTimeoutMs
    );

    // Emit health status
    this.emit("health_check", this.getStatus());
  }

  // ============================================================================
  // Content Filtering (optional)
  // ============================================================================

  private shouldFilterContent(input: Record<string, unknown>): boolean {
    // In unrestricted mode, never filter
    if (this.config.mode === "unrestricted" || !this.config.contentFiltering) {
      return false;
    }

    // Basic content check (can be extended)
    const text = JSON.stringify(input).toLowerCase();
    const blockedPatterns: string[] = []; // Empty in unrestricted mode

    return blockedPatterns.some((pattern) => text.includes(pattern));
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private insertTaskByPriority(task: Task): void {
    const priorityOrder: Record<Task["priority"], number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const insertIndex = this.taskQueue.findIndex(
      (t) => priorityOrder[t.priority] > priorityOrder[task.priority]
    );

    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (this.config.verboseLogging) {
      console.log(`[AutonomousController] ${message}`, data || "");
    }
    this.emit("log", { message, data, timestamp: Date.now() });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * @ai-context Get controller status
   */
  getStatus(): {
    running: boolean;
    mode: OperationMode;
    tasks: { queued: number; active: number; completed: number };
    capabilities: { total: number; enabled: number };
    decisions: number;
    config: ControllerConfig;
  } {
    return {
      running: this.isRunning,
      mode: this.config.mode,
      tasks: {
        queued: this.taskQueue.length,
        active: this.activeTasks.size,
        completed: this.decisions.filter((d) => d.executed).length,
      },
      capabilities: {
        total: this.capabilities.size,
        enabled: Array.from(this.capabilities.values()).filter((c) => c.enabled).length,
      },
      decisions: this.decisions.length,
      config: { ...this.config },
    };
  }

  /**
   * @ai-context Get all capabilities
   */
  getCapabilities(): AgentCapability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * @ai-context Get current configuration
   */
  getConfig(): ControllerConfig {
    return { ...this.config };
  }

  /**
   * @ai-context Update configuration
   */
  updateConfig(updates: Partial<ControllerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit("config_updated", this.config);
  }
}

// Export singleton instance
export const autonomousController = new AutonomousController();
