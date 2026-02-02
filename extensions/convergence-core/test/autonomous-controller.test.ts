/**
 * @fileoverview Autonomous Controller Tests
 * @module convergence-core/test/autonomous-controller
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AutonomousController, Task, OperationMode } from "../src/autonomous-controller.js";

describe("AutonomousController", () => {
  let controller: AutonomousController;

  beforeEach(() => {
    controller = new AutonomousController({
      mode: "autonomous",
      verboseLogging: false,
      maxConcurrentTasks: 5,
      taskTimeoutMs: 5000,
      maxRetries: 2,
    });
  });

  afterEach(async () => {
    await controller.stop();
  });

  describe("Lifecycle", () => {
    it("should start and stop", async () => {
      let status = controller.getStatus();
      expect(status.running).toBe(false);

      await controller.start();
      status = controller.getStatus();
      expect(status.running).toBe(true);

      await controller.stop();
      status = controller.getStatus();
      expect(status.running).toBe(false);
    });
  });

  describe("Operation Modes", () => {
    it("should start in autonomous mode", () => {
      const status = controller.getStatus();
      expect(status.mode).toBe("autonomous");
    });

    it("should switch to supervised mode", () => {
      controller.setMode("supervised");
      const config = controller.getConfig();
      expect(config.mode).toBe("supervised");
      expect(config.contentFiltering).toBe(true);
      expect(config.safetyGuardrails).toBe(true);
    });

    it("should switch to unrestricted mode", () => {
      controller.setMode("unrestricted");
      const config = controller.getConfig();
      expect(config.mode).toBe("unrestricted");
      expect(config.contentFiltering).toBe(false);
      expect(config.safetyGuardrails).toBe(false);
    });

    it("should enable unrestricted mode via method", () => {
      controller.enableUnrestrictedMode();
      const config = controller.getConfig();
      expect(config.mode).toBe("unrestricted");
    });

    it("should disable guardrails", () => {
      controller.disableGuardrails();
      const config = controller.getConfig();
      expect(config.contentFiltering).toBe(false);
      expect(config.safetyGuardrails).toBe(false);
    });
  });

  describe("Task Submission", () => {
    beforeEach(async () => {
      await controller.start();
    });

    it("should submit a task", async () => {
      const task = await controller.submitTask("text", { message: "Hello" });

      expect(task.id).toBeDefined();
      expect(task.type).toBe("text");
      expect(task.input).toEqual({ message: "Hello" });
      expect(task.status).toBe("queued");
      expect(task.priority).toBe("normal");
    });

    it("should submit task with priority", async () => {
      const task = await controller.submitTask(
        "code",
        { code: "console.log('hi')" },
        { priority: "high" }
      );

      expect(task.priority).toBe("high");
    });

    it("should submit task with custom retries", async () => {
      const task = await controller.submitTask(
        "research",
        { query: "AI trends" },
        { maxRetries: 5 }
      );

      expect(task.maxRetries).toBe(5);
    });

    it("should get task by id", async () => {
      const task = await controller.submitTask("text", { message: "Test" });
      const retrieved = controller.getTask(task.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(task.id);
    });

    it("should cancel task", async () => {
      const task = await controller.submitTask("text", { message: "Test" });
      const cancelled = controller.cancelTask(task.id);

      expect(cancelled).toBe(true);
      const retrieved = controller.getTask(task.id);
      expect(retrieved?.status).toBe("cancelled");
    });

    it("should not cancel non-existent task", () => {
      const cancelled = controller.cancelTask("non-existent-id");
      expect(cancelled).toBe(false);
    });
  });

  describe("Capabilities", () => {
    it("should have default capabilities", () => {
      const capabilities = controller.getCapabilities();

      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities.some((c) => c.type === "personaplex")).toBe(true);
      expect(capabilities.some((c) => c.type === "agent-zero")).toBe(true);
      expect(capabilities.some((c) => c.type === "poke")).toBe(true);
    });

    it("should register new capability", () => {
      controller.registerCapability({
        id: "custom-agent",
        name: "Custom Agent",
        type: "custom",
        priority: 5,
        enabled: true,
        maxConcurrent: 3,
        currentLoad: 0,
        successRate: 1.0,
        avgLatencyMs: 100,
        tags: ["custom", "test"],
      });

      const capabilities = controller.getCapabilities();
      expect(capabilities.some((c) => c.id === "custom-agent")).toBe(true);
    });
  });

  describe("Decisions", () => {
    beforeEach(async () => {
      await controller.start();
    });

    it("should track decisions", async () => {
      // Submit a task to generate decisions
      await controller.submitTask("text", { message: "Test" });

      const decisions = controller.getDecisions();
      expect(Array.isArray(decisions)).toBe(true);
    });

    it("should emit decision events", async () => {
      const decisionPromise = new Promise<any>((resolve) => {
        controller.on("decision", resolve);
      });

      controller.setMode("supervised");

      const decision = await decisionPromise;
      expect(decision.type).toBe("route");
      expect(decision.reason).toContain("Mode changed");
    });
  });

  describe("Status", () => {
    it("should return comprehensive status", async () => {
      await controller.start();
      await controller.submitTask("text", { message: "Test" });

      const status = controller.getStatus();

      expect(status.running).toBe(true);
      expect(status.mode).toBeDefined();
      expect(status.tasks).toBeDefined();
      expect(status.tasks.queued).toBeGreaterThanOrEqual(0);
      expect(status.capabilities).toBeDefined();
      expect(status.capabilities.total).toBeGreaterThan(0);
      expect(status.config).toBeDefined();
    });
  });

  describe("Configuration", () => {
    it("should get config", () => {
      const config = controller.getConfig();

      expect(config.mode).toBeDefined();
      expect(config.selfHealing).toBeDefined();
      expect(config.maxConcurrentTasks).toBeDefined();
    });

    it("should update config", () => {
      controller.updateConfig({
        maxConcurrentTasks: 20,
        taskTimeoutMs: 10000,
      });

      const config = controller.getConfig();
      expect(config.maxConcurrentTasks).toBe(20);
      expect(config.taskTimeoutMs).toBe(10000);
    });
  });

  describe("Events", () => {
    beforeEach(async () => {
      await controller.start();
    });

    it("should emit task_queued event", async () => {
      const eventPromise = new Promise<Task>((resolve) => {
        controller.on("task_queued", resolve);
      });

      await controller.submitTask("text", { message: "Test" });
      const task = await eventPromise;

      expect(task.type).toBe("text");
      expect(task.status).toBe("queued");
    });

    it("should emit task_cancelled event", async () => {
      const task = await controller.submitTask("text", { message: "Test" });

      const eventPromise = new Promise<Task>((resolve) => {
        controller.on("task_cancelled", resolve);
      });

      controller.cancelTask(task.id);
      const cancelled = await eventPromise;

      expect(cancelled.id).toBe(task.id);
      expect(cancelled.status).toBe("cancelled");
    });

    it("should emit mode_changed event", async () => {
      const eventPromise = new Promise<any>((resolve) => {
        controller.on("mode_changed", resolve);
      });

      controller.setMode("unrestricted");
      const event = await eventPromise;

      expect(event.previousMode).toBe("autonomous");
      expect(event.newMode).toBe("unrestricted");
    });
  });

  describe("Unrestricted Mode Behavior", () => {
    beforeEach(async () => {
      controller.setMode("unrestricted");
      await controller.start();
    });

    it("should not filter content in unrestricted mode", async () => {
      // In unrestricted mode, any content should be accepted
      const task = await controller.submitTask("text", {
        message: "Any content should be accepted",
      });

      expect(task.status).not.toBe("cancelled");
      expect(task.error).toBeUndefined();
    });

    it("should make decisions without approval in unrestricted mode", async () => {
      controller.setMode("unrestricted");

      const decisionPromise = new Promise<any>((resolve) => {
        controller.on("decision", resolve);
      });

      await controller.submitTask("autonomous", { goal: "test" });
      const decision = await decisionPromise;

      expect(decision.requiresApproval).toBe(false);
      expect(decision.executed).toBe(true);
    });
  });
});
