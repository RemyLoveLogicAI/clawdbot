/**
 * @fileoverview Observability Tests
 * @module convergence-core/test/observability
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ObservabilityManager } from "../src/observability.js";

describe("ObservabilityManager", () => {
  let obs: ObservabilityManager;

  beforeEach(() => {
    obs = new ObservabilityManager({
      debugMode: false,
      metricsRetentionHours: 1,
      logRetentionCount: 100,
      anomalyDetection: false,
    });
  });

  describe("Metrics", () => {
    it("should increment counter", () => {
      obs.incrementCounter("test_counter", 1);
      obs.incrementCounter("test_counter", 2);

      const dashboard = obs.getDashboardData();
      expect(dashboard.metrics.counters["test_counter"]).toBe(3);
    });

    it("should increment counter with labels", () => {
      obs.incrementCounter("requests", 1, { method: "GET" });
      obs.incrementCounter("requests", 1, { method: "POST" });
      obs.incrementCounter("requests", 1, { method: "GET" });

      const dashboard = obs.getDashboardData();
      expect(dashboard.metrics.counters["requests{method=GET}"]).toBe(2);
      expect(dashboard.metrics.counters["requests{method=POST}"]).toBe(1);
    });

    it("should set gauge", () => {
      obs.setGauge("temperature", 25);
      obs.setGauge("temperature", 30);

      const dashboard = obs.getDashboardData();
      expect(dashboard.metrics.gauges["temperature"]).toBe(30);
    });

    it("should record histogram", () => {
      obs.recordHistogram("latency", 100);
      obs.recordHistogram("latency", 200);
      obs.recordHistogram("latency", 150);

      // Histograms are stored in metrics array
      const metrics = obs.getMetricsInRange(Date.now() - 10000, Date.now());
      const latencyMetrics = metrics.filter((m) => m.name === "latency");
      expect(latencyMetrics).toHaveLength(3);
    });

    it("should record latency", () => {
      const startTime = Date.now() - 100;
      const latency = obs.recordLatency("api_call", startTime);

      expect(latency).toBeGreaterThanOrEqual(100);
    });
  });

  describe("Logging", () => {
    it("should log info messages", () => {
      const logPromise = new Promise<any>((resolve) => {
        obs.on("log", resolve);
      });

      obs.info("TestComponent", "Test message", { key: "value" });

      return logPromise.then((log) => {
        expect(log.level).toBe("info");
        expect(log.component).toBe("TestComponent");
        expect(log.message).toBe("Test message");
        expect(log.data).toEqual({ key: "value" });
      });
    });

    it("should log warnings and increment counter", () => {
      obs.warn("TestComponent", "Warning message");

      const dashboard = obs.getDashboardData();
      expect(dashboard.metrics.counters["log_warnings_total{component=TestComponent}"]).toBe(1);
    });

    it("should log errors and increment counter", () => {
      obs.error("TestComponent", "Error message");

      const dashboard = obs.getDashboardData();
      expect(dashboard.metrics.counters["log_errors_total{component=TestComponent}"]).toBe(1);
    });

    it("should respect debug mode", () => {
      // Debug mode is off
      let logCalled = false;
      obs.on("log", () => {
        logCalled = true;
      });

      obs.debug("TestComponent", "Debug message");
      expect(logCalled).toBe(false);
    });

    it("should get logs for component", () => {
      obs.info("ComponentA", "Message 1");
      obs.info("ComponentB", "Message 2");
      obs.info("ComponentA", "Message 3");

      const logsA = obs.getLogsForComponent("ComponentA");
      expect(logsA).toHaveLength(2);
      expect(logsA.every((l) => l.component === "ComponentA")).toBe(true);
    });
  });

  describe("Tracing", () => {
    it("should start and end span", () => {
      const span = obs.startSpan("test_operation", { userId: "123" });

      expect(span.traceId).toBeDefined();
      expect(span.spanId).toBeDefined();
      expect(span.name).toBe("test_operation");
      expect(span.status).toBe("unset");

      obs.endSpan(span.spanId, "ok");

      // Verify span ended
      const current = obs.getCurrentSpan();
      expect(current).toBeUndefined();
    });

    it("should track parent-child spans", () => {
      const parentSpan = obs.startSpan("parent_operation");
      const childSpan = obs.startSpan("child_operation");

      expect(childSpan.parentSpanId).toBe(parentSpan.spanId);
      expect(childSpan.traceId).toBe(parentSpan.traceId);

      obs.endSpan(childSpan.spanId);
      obs.endSpan(parentSpan.spanId);
    });

    it("should add events to span", () => {
      const span = obs.startSpan("test_operation");
      obs.addSpanEvent(span.spanId, "checkpoint_1", { data: "test" });
      obs.addSpanEvent(span.spanId, "checkpoint_2");

      // Events are stored in the span
      obs.endSpan(span.spanId);
    });
  });

  describe("Health Checks", () => {
    it("should register and run health check", async () => {
      obs.registerHealthCheck("test_service", async () => ({
        healthy: true,
        message: "Service is running",
      }));

      // Wait for first check
      await new Promise((resolve) => setTimeout(resolve, 100));

      const health = obs.getHealthStatus();
      expect(health.some((h) => h.name === "test_service")).toBe(true);
    });

    it("should report overall health", () => {
      // Initially healthy (no checks registered)
      expect(obs.isHealthy()).toBe(true);
    });
  });

  describe("Alerts", () => {
    it("should create alert", () => {
      const alert = obs.createAlert("warning", "Test Alert", "This is a test", "TestSource");

      expect(alert.id).toBeDefined();
      expect(alert.severity).toBe("warning");
      expect(alert.title).toBe("Test Alert");
      expect(alert.acknowledged).toBe(false);
    });

    it("should acknowledge alert", () => {
      const alert = obs.createAlert("warning", "Test Alert", "Message", "Source");
      obs.acknowledgeAlert(alert.id);

      const activeAlerts = obs.getActiveAlerts();
      const acknowledgedAlert = activeAlerts.find((a) => a.id === alert.id);
      expect(acknowledgedAlert?.acknowledged).toBe(true);
    });

    it("should resolve alert", () => {
      const alert = obs.createAlert("warning", "Test Alert", "Message", "Source");
      obs.resolveAlert(alert.id);

      const activeAlerts = obs.getActiveAlerts();
      expect(activeAlerts.find((a) => a.id === alert.id)).toBeUndefined();
    });
  });

  describe("Dashboard Data", () => {
    it("should return dashboard summary", () => {
      obs.incrementCounter("test", 1);
      obs.setGauge("temp", 25);
      obs.info("Test", "Message");

      const dashboard = obs.getDashboardData();

      expect(dashboard.metrics.counters).toBeDefined();
      expect(dashboard.metrics.gauges).toBeDefined();
      expect(dashboard.health).toBeDefined();
      expect(dashboard.alerts).toBeDefined();
      expect(dashboard.logs.recent).toBeDefined();
      expect(dashboard.traces).toBeDefined();
    });
  });

  describe("Prometheus Export", () => {
    it("should export metrics in Prometheus format", () => {
      obs.incrementCounter("http_requests", 100);
      obs.setGauge("active_connections", 5);

      const output = obs.exportPrometheusMetrics();

      expect(output).toContain("http_requests");
      expect(output).toContain("active_connections");
      expect(output).toContain("counter");
      expect(output).toContain("gauge");
    });
  });
});
