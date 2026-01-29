# Observability API Reference

## Overview

The Observability module provides comprehensive monitoring capabilities including metrics, structured logging, distributed tracing, health checks, and alerting.

## Classes

### ObservabilityManager

The main class for all observability features.

```typescript
import { ObservabilityManager, observability, logger } from "@moltbot/convergence-core/observability";

// Use singleton
observability.info("MyComponent", "Hello");

// Or create instance
const obs = new ObservabilityManager(options);
```

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debugMode` | `boolean` | `false` | Enable debug logging |
| `metricsRetentionHours` | `number` | `24` | Metrics retention period |
| `logRetentionCount` | `number` | `10000` | Max logs to retain |
| `anomalyDetection` | `boolean` | `true` | Enable anomaly alerting |
| `alertThresholds.errorRatePercent` | `number` | `5` | Error rate alert threshold |
| `alertThresholds.latencyMs` | `number` | `5000` | Latency alert threshold |
| `alertThresholds.memoryUsagePercent` | `number` | `90` | Memory alert threshold |
| `otlpEndpoint` | `string` | - | OpenTelemetry export endpoint |

## Metrics

### `incrementCounter(name, value?, labels?)`

Increment a counter metric.

```typescript
// Simple counter
observability.incrementCounter("requests_total");

// With value
observability.incrementCounter("bytes_processed", 1024);

// With labels
observability.incrementCounter("http_requests", 1, {
  method: "GET",
  status: "200",
  endpoint: "/api/users",
});
```

### `setGauge(name, value, labels?)`

Set a gauge metric value.

```typescript
// Simple gauge
observability.setGauge("active_connections", 42);

// With labels
observability.setGauge("queue_size", 15, { queue: "tasks" });
observability.setGauge("temperature", 65.5, { sensor: "cpu" });
```

### `recordHistogram(name, value, labels?)`

Record a histogram value.

```typescript
// Record latency
observability.recordHistogram("request_duration_ms", 145);

// With labels
observability.recordHistogram("task_duration_ms", 2500, {
  type: "research",
  agent: "poke",
});
```

### `recordLatency(name, startTime, labels?)`

Convenience method to record latency.

```typescript
const startTime = Date.now();

// ... do work ...

const latencyMs = observability.recordLatency("api_call", startTime, {
  endpoint: "/search",
});
console.log(`Call took ${latencyMs}ms`);
```

### `getMetricsInRange(startTime, endTime)`

Get metrics within a time range.

```typescript
const oneHourAgo = Date.now() - 60 * 60 * 1000;
const now = Date.now();

const metrics = observability.getMetricsInRange(oneHourAgo, now);
```

### `exportPrometheusMetrics()`

Export metrics in Prometheus format.

```typescript
const prometheusOutput = observability.exportPrometheusMetrics();
// # TYPE http_requests counter
// http_requests{method=GET,status=200} 1523
// # TYPE active_connections gauge
// active_connections 42
```

## Logging

### `debug(component, message, data?)`

Log debug message (only if debugMode is true).

```typescript
observability.debug("Parser", "Parsing token", { token: "abc123" });
```

### `info(component, message, data?)`

Log info message.

```typescript
observability.info("Server", "Server started", { port: 3000 });
```

### `warn(component, message, data?)`

Log warning message.

```typescript
observability.warn("Auth", "Token expiring soon", { expiresIn: "5m" });
```

### `error(component, message, data?)`

Log error message.

```typescript
observability.error("Database", "Connection failed", { 
  error: err.message,
  host: "db.example.com",
});
```

### `fatal(component, message, data?)`

Log fatal error and create critical alert.

```typescript
observability.fatal("Core", "Unrecoverable error", { 
  error: err.message,
  stack: err.stack,
});
```

### Logger Convenience Export

```typescript
import { logger } from "@moltbot/convergence-core/observability";

logger.info("MyApp", "Starting up");
logger.warn("MyApp", "Low memory");
logger.error("MyApp", "Failed to connect");
```

### `getLogsForComponent(component, limit?)`

Get logs filtered by component.

```typescript
const authLogs = observability.getLogsForComponent("Auth", 50);
```

## Tracing

### `startSpan(name, attributes?)`

Start a new trace span.

```typescript
const span = observability.startSpan("processOrder", {
  orderId: "12345",
  userId: "user-789",
});

// span.traceId - unique trace identifier
// span.spanId - unique span identifier
```

### `endSpan(spanId, status?)`

End a trace span.

```typescript
try {
  // ... do work ...
  observability.endSpan(span.spanId, "ok");
} catch (error) {
  observability.endSpan(span.spanId, "error");
  throw error;
}
```

### `addSpanEvent(spanId, name, attributes?)`

Add an event to a span.

```typescript
const span = observability.startSpan("processPayment");

observability.addSpanEvent(span.spanId, "validation_started");
// ... validate ...
observability.addSpanEvent(span.spanId, "validation_complete", { valid: true });

observability.addSpanEvent(span.spanId, "charging_started");
// ... charge ...
observability.addSpanEvent(span.spanId, "charging_complete", { amount: 99.99 });

observability.endSpan(span.spanId, "ok");
```

### `getCurrentSpan()`

Get the current active span.

```typescript
const current = observability.getCurrentSpan();
if (current) {
  console.log(`In trace: ${current.traceId}`);
}
```

### Nested Spans

```typescript
const parentSpan = observability.startSpan("handleRequest");

// Child span automatically linked to parent
const childSpan = observability.startSpan("queryDatabase");
// ... query ...
observability.endSpan(childSpan.spanId, "ok");

const childSpan2 = observability.startSpan("sendResponse");
// ... send ...
observability.endSpan(childSpan2.spanId, "ok");

observability.endSpan(parentSpan.spanId, "ok");
```

## Health Checks

### `registerHealthCheck(name, checkFn)`

Register a health check function.

```typescript
observability.registerHealthCheck("database", async () => {
  try {
    await db.ping();
    return { healthy: true, message: "Connected" };
  } catch (error) {
    return { healthy: false, message: error.message };
  }
});

observability.registerHealthCheck("redis", async () => {
  const latency = await redis.ping();
  return {
    healthy: latency < 100,
    message: `Latency: ${latency}ms`,
  };
});
```

### `getHealthStatus()`

Get all health check results.

```typescript
const health = observability.getHealthStatus();
// [
//   { name: "database", status: "healthy", latencyMs: 5, message: "Connected", lastCheck: 1234567890 },
//   { name: "redis", status: "degraded", latencyMs: 150, message: "Latency: 150ms", lastCheck: 1234567890 }
// ]
```

### `isHealthy()`

Check if all health checks pass.

```typescript
if (observability.isHealthy()) {
  console.log("All systems operational");
} else {
  console.log("System degraded");
}
```

## Alerts

### `createAlert(severity, title, message, source)`

Create an alert.

```typescript
const alert = observability.createAlert(
  "warning",           // "info" | "warning" | "critical"
  "High Memory Usage",
  "Memory usage is at 85%",
  "MemoryMonitor"
);
```

### `acknowledgeAlert(alertId)`

Acknowledge an alert.

```typescript
observability.acknowledgeAlert(alert.id);
```

### `resolveAlert(alertId)`

Resolve an alert.

```typescript
observability.resolveAlert(alert.id);
```

### `getActiveAlerts()`

Get unresolved alerts.

```typescript
const alerts = observability.getActiveAlerts();
for (const alert of alerts) {
  console.log(`[${alert.severity}] ${alert.title}`);
}
```

## Dashboard

### `getDashboardData()`

Get comprehensive dashboard data.

```typescript
const dashboard = observability.getDashboardData();
// {
//   metrics: {
//     counters: { "requests_total": 15234 },
//     gauges: { "active_connections": 42 }
//   },
//   health: [{ name: "database", status: "healthy", ... }],
//   alerts: { active: 2, critical: 1, warning: 1 },
//   logs: { recent: [...], errorCount: 5 },
//   traces: { activeSpans: 3, recentTraces: ["trace-1", "trace-2"] }
// }
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `metric` | `MetricPoint` | Metric recorded |
| `log` | `LogEntry` | Log message |
| `span_start` | `Span` | Span started |
| `span_end` | `Span` | Span ended |
| `alert` | `Alert` | Alert created |
| `alert_acknowledged` | `Alert` | Alert acknowledged |
| `alert_resolved` | `Alert` | Alert resolved |
| `summary` | Dashboard data | Periodic summary (every 60s) |

## Types

### MetricPoint

```typescript
interface MetricPoint {
  name: string;
  value: number;
  type: "counter" | "gauge" | "histogram";
  labels?: Record<string, string>;
  timestamp: number;
}
```

### LogEntry

```typescript
interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  component: string;
  message: string;
  traceId?: string;
  spanId?: string;
  data?: Record<string, unknown>;
}
```

### Span

```typescript
interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: "ok" | "error" | "unset";
  attributes: Record<string, unknown>;
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
  }>;
}
```

### HealthCheck

```typescript
interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  message?: string;
  lastCheck: number;
}
```

### Alert

```typescript
interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  source: string;
  timestamp: number;
  acknowledged: boolean;
  resolvedAt?: number;
}
```

## Integration Examples

### Express.js Middleware

```typescript
app.use((req, res, next) => {
  const span = observability.startSpan(`${req.method} ${req.path}`);
  const startTime = Date.now();

  res.on("finish", () => {
    observability.endSpan(span.spanId, res.statusCode < 400 ? "ok" : "error");
    observability.recordLatency("http_request", startTime, {
      method: req.method,
      path: req.path,
      status: String(res.statusCode),
    });
    observability.incrementCounter("http_requests_total", 1, {
      method: req.method,
      status: String(res.statusCode),
    });
  });

  next();
});
```

### Prometheus Endpoint

```typescript
app.get("/metrics", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send(observability.exportPrometheusMetrics());
});
```

### Health Endpoint

```typescript
app.get("/health", async (req, res) => {
  const health = observability.getHealthStatus();
  const isHealthy = observability.isHealthy();
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    checks: health,
  });
});
```
