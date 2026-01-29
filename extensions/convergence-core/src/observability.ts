/**
 * @fileoverview Observability Layer - Metrics, Logs, Traces
 * @module convergence-core/observability
 * @version 1.0.0
 *
 * @description
 * Comprehensive observability system for convergence components.
 * Provides structured logging, metrics collection, distributed tracing,
 * and real-time dashboards.
 *
 * @ai-context
 * - Central observability hub for all convergence components
 * - Supports OpenTelemetry-compatible exports
 * - Real-time metrics and health dashboards
 * - Automatic anomaly detection and alerting
 */

import { EventEmitter } from "events";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MetricPoint {
  name: string;
  value: number;
  type: "counter" | "gauge" | "histogram";
  labels?: Record<string, string>;
  timestamp: number;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  component: string;
  message: string;
  traceId?: string;
  spanId?: string;
  data?: Record<string, unknown>;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: "ok" | "error" | "unset";
  attributes: Record<string, unknown>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
}

export interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  message?: string;
  lastCheck: number;
}

export interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  source: string;
  timestamp: number;
  acknowledged: boolean;
  resolvedAt?: number;
}

export interface ObservabilityConfig {
  /** Enable detailed debug logging */
  debugMode?: boolean;
  /** Metrics retention period in hours */
  metricsRetentionHours?: number;
  /** Log retention count */
  logRetentionCount?: number;
  /** Enable anomaly detection */
  anomalyDetection?: boolean;
  /** Alert thresholds */
  alertThresholds?: {
    errorRatePercent?: number;
    latencyMs?: number;
    memoryUsagePercent?: number;
  };
  /** Export endpoint for OpenTelemetry */
  otlpEndpoint?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ObservabilityConfig = {
  debugMode: false,
  metricsRetentionHours: 24,
  logRetentionCount: 10000,
  anomalyDetection: true,
  alertThresholds: {
    errorRatePercent: 5,
    latencyMs: 5000,
    memoryUsagePercent: 90,
  },
};

// ============================================================================
// Observability Manager
// ============================================================================

export class ObservabilityManager extends EventEmitter {
  private config: ObservabilityConfig;
  private metrics: MetricPoint[] = [];
  private logs: LogEntry[] = [];
  private spans: Map<string, Span> = new Map();
  private activeSpans: Map<string, Span> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Alert[] = [];
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  constructor(config: Partial<ObservabilityConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startPeriodicTasks();
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  /**
   * @ai-context Increment a counter metric
   */
  incrementCounter(name: string, value = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    this.recordMetric({
      name,
      value: current + value,
      type: "counter",
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * @ai-context Set a gauge metric
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);

    this.recordMetric({
      name,
      value,
      type: "gauge",
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * @ai-context Record a histogram value
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      type: "histogram",
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * @ai-context Record latency measurement
   */
  recordLatency(name: string, startTime: number, labels?: Record<string, string>): number {
    const latency = Date.now() - startTime;
    this.recordHistogram(`${name}_latency_ms`, latency, labels);
    return latency;
  }

  private recordMetric(metric: MetricPoint): void {
    this.metrics.push(metric);
    this.emit("metric", metric);

    // Trim old metrics
    const cutoff = Date.now() - (this.config.metricsRetentionHours || 24) * 60 * 60 * 1000;
    this.metrics = this.metrics.filter((m) => m.timestamp > cutoff);

    // Check thresholds for alerting
    if (this.config.anomalyDetection) {
      this.checkMetricThresholds(metric);
    }
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return `${name}{${labelStr}}`;
  }

  // ============================================================================
  // Logging
  // ============================================================================

  /**
   * @ai-context Log a debug message
   */
  debug(component: string, message: string, data?: Record<string, unknown>): void {
    if (this.config.debugMode) {
      this.log("debug", component, message, data);
    }
  }

  /**
   * @ai-context Log an info message
   */
  info(component: string, message: string, data?: Record<string, unknown>): void {
    this.log("info", component, message, data);
  }

  /**
   * @ai-context Log a warning message
   */
  warn(component: string, message: string, data?: Record<string, unknown>): void {
    this.log("warn", component, message, data);
    this.incrementCounter("log_warnings_total", 1, { component });
  }

  /**
   * @ai-context Log an error message
   */
  error(component: string, message: string, data?: Record<string, unknown>): void {
    this.log("error", component, message, data);
    this.incrementCounter("log_errors_total", 1, { component });
  }

  /**
   * @ai-context Log a fatal message
   */
  fatal(component: string, message: string, data?: Record<string, unknown>): void {
    this.log("fatal", component, message, data);
    this.createAlert("critical", `Fatal error in ${component}`, message, component);
  }

  private log(
    level: LogEntry["level"],
    component: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const activeSpan = this.getCurrentSpan();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      traceId: activeSpan?.traceId,
      spanId: activeSpan?.spanId,
      data,
    };

    this.logs.push(entry);
    this.emit("log", entry);

    // Trim old logs
    if (this.logs.length > (this.config.logRetentionCount || 10000)) {
      this.logs = this.logs.slice(-this.config.logRetentionCount!);
    }

    // Console output with color
    const colors: Record<string, string> = {
      debug: "\x1b[36m",
      info: "\x1b[32m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
      fatal: "\x1b[35m",
    };
    const reset = "\x1b[0m";
    console.log(
      `${colors[level]}[${entry.timestamp}] [${level.toUpperCase()}] [${component}]${reset} ${message}`,
      data ? JSON.stringify(data) : ""
    );
  }

  // ============================================================================
  // Tracing
  // ============================================================================

  /**
   * @ai-context Start a new trace span
   */
  startSpan(name: string, attributes?: Record<string, unknown>): Span {
    const parentSpan = this.getCurrentSpan();
    const span: Span = {
      traceId: parentSpan?.traceId || this.generateId(),
      spanId: this.generateId(),
      parentSpanId: parentSpan?.spanId,
      name,
      startTime: Date.now(),
      status: "unset",
      attributes: attributes || {},
      events: [],
    };

    this.spans.set(span.spanId, span);
    this.activeSpans.set(span.spanId, span);
    this.emit("span_start", span);

    return span;
  }

  /**
   * @ai-context End a trace span
   */
  endSpan(spanId: string, status: Span["status"] = "ok"): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.status = status;
      this.activeSpans.delete(spanId);
      this.emit("span_end", span);

      // Record latency metric
      const duration = span.endTime - span.startTime;
      this.recordHistogram("span_duration_ms", duration, { name: span.name });
    }
  }

  /**
   * @ai-context Add event to current span
   */
  addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({ name, timestamp: Date.now(), attributes });
    }
  }

  /**
   * @ai-context Get current active span
   */
  getCurrentSpan(): Span | undefined {
    const spans = Array.from(this.activeSpans.values());
    return spans[spans.length - 1];
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ============================================================================
  // Health Checks
  // ============================================================================

  /**
   * @ai-context Register a health check
   */
  registerHealthCheck(name: string, check: () => Promise<{ healthy: boolean; message?: string }>): void {
    this.healthChecks.set(name, {
      name,
      status: "healthy",
      latencyMs: 0,
      lastCheck: 0,
    });

    // Run check periodically
    setInterval(async () => {
      const startTime = Date.now();
      try {
        const result = await check();
        const latency = Date.now() - startTime;

        this.healthChecks.set(name, {
          name,
          status: result.healthy ? "healthy" : "unhealthy",
          latencyMs: latency,
          message: result.message,
          lastCheck: Date.now(),
        });

        this.setGauge(`health_check_${name}`, result.healthy ? 1 : 0);
        this.recordHistogram(`health_check_${name}_latency_ms`, latency);
      } catch (error) {
        this.healthChecks.set(name, {
          name,
          status: "unhealthy",
          latencyMs: Date.now() - startTime,
          message: String(error),
          lastCheck: Date.now(),
        });
        this.setGauge(`health_check_${name}`, 0);
      }
    }, 30000);
  }

  /**
   * @ai-context Get all health check statuses
   */
  getHealthStatus(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * @ai-context Check if system is healthy
   */
  isHealthy(): boolean {
    const checks = this.getHealthStatus();
    return checks.every((c) => c.status === "healthy");
  }

  // ============================================================================
  // Alerts
  // ============================================================================

  /**
   * @ai-context Create an alert
   */
  createAlert(severity: Alert["severity"], title: string, message: string, source: string): Alert {
    const alert: Alert = {
      id: this.generateId(),
      severity,
      title,
      message,
      source,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.push(alert);
    this.emit("alert", alert);
    this.incrementCounter("alerts_total", 1, { severity, source });

    return alert;
  }

  /**
   * @ai-context Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit("alert_acknowledged", alert);
    }
  }

  /**
   * @ai-context Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolvedAt = Date.now();
      this.emit("alert_resolved", alert);
    }
  }

  /**
   * @ai-context Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter((a) => !a.resolvedAt);
  }

  private checkMetricThresholds(metric: MetricPoint): void {
    const thresholds = this.config.alertThresholds;
    if (!thresholds) return;

    if (metric.name.includes("error_rate") && metric.value > (thresholds.errorRatePercent || 5)) {
      this.createAlert(
        "warning",
        "High Error Rate",
        `Error rate is ${metric.value}% (threshold: ${thresholds.errorRatePercent}%)`,
        metric.name
      );
    }

    if (metric.name.includes("latency") && metric.value > (thresholds.latencyMs || 5000)) {
      this.createAlert(
        "warning",
        "High Latency",
        `Latency is ${metric.value}ms (threshold: ${thresholds.latencyMs}ms)`,
        metric.name
      );
    }
  }

  // ============================================================================
  // Dashboard Data
  // ============================================================================

  /**
   * @ai-context Get dashboard summary data
   */
  getDashboardData(): {
    metrics: { counters: Record<string, number>; gauges: Record<string, number> };
    health: HealthCheck[];
    alerts: { active: number; critical: number; warning: number };
    logs: { recent: LogEntry[]; errorCount: number };
    traces: { activeSpans: number; recentTraces: string[] };
  } {
    const activeAlerts = this.getActiveAlerts();
    const recentLogs = this.logs.slice(-100);

    return {
      metrics: {
        counters: Object.fromEntries(this.counters),
        gauges: Object.fromEntries(this.gauges),
      },
      health: this.getHealthStatus(),
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter((a) => a.severity === "critical").length,
        warning: activeAlerts.filter((a) => a.severity === "warning").length,
      },
      logs: {
        recent: recentLogs,
        errorCount: recentLogs.filter((l) => l.level === "error" || l.level === "fatal").length,
      },
      traces: {
        activeSpans: this.activeSpans.size,
        recentTraces: Array.from(new Set(Array.from(this.spans.values()).map((s) => s.traceId))).slice(-10),
      },
    };
  }

  /**
   * @ai-context Get metrics for a time range
   */
  getMetricsInRange(startTime: number, endTime: number): MetricPoint[] {
    return this.metrics.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime);
  }

  /**
   * @ai-context Get logs for a component
   */
  getLogsForComponent(component: string, limit = 100): LogEntry[] {
    return this.logs.filter((l) => l.component === component).slice(-limit);
  }

  // ============================================================================
  // Periodic Tasks
  // ============================================================================

  private startPeriodicTasks(): void {
    // Record system metrics every 10 seconds
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.setGauge("memory_heap_used_bytes", memUsage.heapUsed);
      this.setGauge("memory_heap_total_bytes", memUsage.heapTotal);
      this.setGauge("memory_rss_bytes", memUsage.rss);

      // Check memory threshold
      const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      if (memPercent > (this.config.alertThresholds?.memoryUsagePercent || 90)) {
        this.createAlert(
          "warning",
          "High Memory Usage",
          `Memory usage is ${memPercent.toFixed(1)}%`,
          "system"
        );
      }
    }, 10000);

    // Emit periodic summary
    setInterval(() => {
      this.emit("summary", this.getDashboardData());
    }, 60000);
  }

  /**
   * @ai-context Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const [key, value] of this.counters) {
      lines.push(`# TYPE ${key.split("{")[0]} counter`);
      lines.push(`${key} ${value}`);
    }

    for (const [key, value] of this.gauges) {
      lines.push(`# TYPE ${key.split("{")[0]} gauge`);
      lines.push(`${key} ${value}`);
    }

    return lines.join("\n");
  }
}

// Export singleton instance
export const observability = new ObservabilityManager();

// Convenience logging functions
export const logger = {
  debug: (component: string, message: string, data?: Record<string, unknown>) =>
    observability.debug(component, message, data),
  info: (component: string, message: string, data?: Record<string, unknown>) =>
    observability.info(component, message, data),
  warn: (component: string, message: string, data?: Record<string, unknown>) =>
    observability.warn(component, message, data),
  error: (component: string, message: string, data?: Record<string, unknown>) =>
    observability.error(component, message, data),
};
