/**
 * @fileoverview Auto-Configuration Tests
 * @module convergence-core/test/auto-config
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AutoConfigManager, ServiceEndpoint } from "../src/auto-config.js";

describe("AutoConfigManager", () => {
  let manager: AutoConfigManager;

  beforeEach(() => {
    manager = new AutoConfigManager({
      autoDiscover: false,
      autoConnect: false,
      autoHeal: false,
      healthCheckIntervalMs: 100000, // Disable for tests
    });
  });

  afterEach(async () => {
    await manager.stop();
  });

  describe("Service Registration", () => {
    it("should register a service", () => {
      manager.registerService({
        id: "test-service",
        name: "Test Service",
        type: "personaplex",
        url: "http://localhost:8998",
      });

      const services = manager.getServices();
      expect(services).toHaveLength(1);
      expect(services[0].id).toBe("test-service");
      expect(services[0].status).toBe("unknown");
    });

    it("should register multiple services", () => {
      manager.registerService({
        id: "service-1",
        name: "Service 1",
        type: "personaplex",
        url: "http://localhost:8998",
      });

      manager.registerService({
        id: "service-2",
        name: "Service 2",
        type: "agent-zero",
        url: "http://localhost:8080",
      });

      const services = manager.getServices();
      expect(services).toHaveLength(2);
    });

    it("should update existing service", () => {
      manager.registerService({
        id: "test-service",
        name: "Test Service",
        type: "personaplex",
        url: "http://localhost:8998",
      });

      manager.registerService({
        id: "test-service",
        name: "Updated Service",
        type: "personaplex",
        url: "http://localhost:9999",
      });

      const services = manager.getServices();
      expect(services).toHaveLength(1);
      expect(services[0].name).toBe("Updated Service");
      expect(services[0].url).toBe("http://localhost:9999");
    });
  });

  describe("Service Filtering", () => {
    beforeEach(() => {
      manager.registerService({
        id: "pp-1",
        name: "PersonaPlex 1",
        type: "personaplex",
        url: "http://localhost:8998",
      });

      manager.registerService({
        id: "az-1",
        name: "Agent Zero 1",
        type: "agent-zero",
        url: "http://localhost:8080",
      });

      manager.registerService({
        id: "poke-1",
        name: "Poke 1",
        type: "poke",
        url: "http://localhost:8000",
      });
    });

    it("should filter services by type", () => {
      const personaplex = manager.getServicesByType("personaplex");
      expect(personaplex).toHaveLength(1);
      expect(personaplex[0].id).toBe("pp-1");

      const agentZero = manager.getServicesByType("agent-zero");
      expect(agentZero).toHaveLength(1);
      expect(agentZero[0].id).toBe("az-1");
    });

    it("should get healthy services", () => {
      // All services start as unknown, so none are healthy
      const healthy = manager.getHealthyServices();
      expect(healthy).toHaveLength(0);
    });
  });

  describe("Status", () => {
    it("should return status summary", () => {
      manager.registerService({
        id: "test",
        name: "Test",
        type: "personaplex",
        url: "http://localhost:8998",
      });

      const status = manager.getStatus();
      expect(status.running).toBe(false);
      expect(status.services.total).toBe(1);
      expect(status.services.healthy).toBe(0);
      expect(status.autonomousMode).toBe(true);
    });
  });

  describe("Autonomous Mode", () => {
    it("should toggle autonomous mode", () => {
      expect(manager.getConfig().autonomousMode).toBe(true);

      manager.setAutonomousMode(false);
      expect(manager.getConfig().autonomousMode).toBe(false);

      manager.setAutonomousMode(true);
      expect(manager.getConfig().autonomousMode).toBe(true);
    });

    it("should toggle unrestricted mode", () => {
      expect(manager.getConfig().unrestrictedMode).toBe(false);

      manager.setUnrestrictedMode(true);
      expect(manager.getConfig().unrestrictedMode).toBe(true);
    });
  });

  describe("Events", () => {
    it("should emit config_event on service registration", async () => {
      const eventPromise = new Promise<any>((resolve) => {
        manager.on("config_event", resolve);
      });

      manager.registerService({
        id: "test",
        name: "Test",
        type: "personaplex",
        url: "http://localhost:8998",
      });

      const event = await eventPromise;
      expect(event.type).toBe("config_changed");
      expect(event.service.id).toBe("test");
    });
  });

  describe("Decisions", () => {
    it("should track decisions", async () => {
      await manager.start();

      // Decisions are made internally during operations
      const decisions = manager.getDecisions();
      expect(Array.isArray(decisions)).toBe(true);
    });
  });
});
