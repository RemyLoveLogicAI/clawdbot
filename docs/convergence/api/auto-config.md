# Auto-Configuration API Reference

## Overview

The Auto-Configuration module provides zero-config service discovery, health monitoring, and automatic wiring for the convergence platform.

## Classes

### AutoConfigManager

The main class for managing service configuration and discovery.

```typescript
import { AutoConfigManager } from "@moltbot/convergence-core/auto-config";

const manager = new AutoConfigManager(options);
```

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autonomousMode` | `boolean` | `true` | Make decisions without confirmation |
| `unrestrictedMode` | `boolean` | `false` | Disable all guardrails |
| `autoDiscover` | `boolean` | `true` | Auto-discover services on network |
| `autoConnect` | `boolean` | `true` | Auto-connect to discovered services |
| `autoHeal` | `boolean` | `true` | Auto-reconnect failed services |
| `healthCheckIntervalMs` | `number` | `30000` | Health check interval |
| `retryAttempts` | `number` | `3` | Max reconnect attempts |
| `notificationWebhook` | `string` | - | Webhook for notifications |
| `notifyChannels` | `string[]` | `[]` | Channels to notify |

#### Methods

##### `start(): Promise<void>`

Start the auto-configuration system.

```typescript
await manager.start();
```

Phases:
1. Load from environment variables
2. Auto-discover services (if enabled)
3. Auto-connect to services (if enabled)
4. Start health monitoring

##### `stop(): Promise<void>`

Stop the auto-configuration system.

```typescript
await manager.stop();
```

##### `registerService(service): void`

Manually register a service.

```typescript
manager.registerService({
  id: "my-service",
  name: "My Custom Service",
  type: "personaplex", // or "agent-zero", "poke", "mcp", "webhook", "channel"
  url: "http://localhost:8000",
  config: { customOption: true },
});
```

##### `getServices(): ServiceEndpoint[]`

Get all registered services.

```typescript
const services = manager.getServices();
// [{ id, name, type, url, status, latencyMs, ... }, ...]
```

##### `getServicesByType(type): ServiceEndpoint[]`

Get services filtered by type.

```typescript
const personaplexServices = manager.getServicesByType("personaplex");
```

##### `getHealthyServices(): ServiceEndpoint[]`

Get only healthy services.

```typescript
const healthy = manager.getHealthyServices();
```

##### `getStatus(): StatusSummary`

Get system status summary.

```typescript
const status = manager.getStatus();
// {
//   running: true,
//   services: { total: 5, healthy: 4, unhealthy: 1 },
//   autonomousMode: true,
//   unrestrictedMode: false,
//   decisionsCount: 12
// }
```

##### `setAutonomousMode(enabled): void`

Enable or disable autonomous mode.

```typescript
manager.setAutonomousMode(true);  // System makes decisions without confirmation
manager.setAutonomousMode(false); // Requires manual approval
```

##### `setUnrestrictedMode(enabled): void`

Enable or disable unrestricted mode.

```typescript
manager.setUnrestrictedMode(true); // ⚠️ Disables all guardrails
```

##### `forceHealthCheck(): Promise<void>`

Force immediate health check of all services.

```typescript
await manager.forceHealthCheck();
```

##### `getDecisions(): AutonomousDecision[]`

Get history of autonomous decisions.

```typescript
const decisions = manager.getDecisions();
// [{ id, type, service, reason, timestamp, approved, executed }, ...]
```

##### `getConfig(): AutoConfigOptions`

Get current configuration.

```typescript
const config = manager.getConfig();
```

## Types

### ServiceEndpoint

```typescript
interface ServiceEndpoint {
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
```

### ConfigEvent

```typescript
interface ConfigEvent {
  type: "discovered" | "connected" | "disconnected" | "healed" | "error" | "config_changed";
  service: ServiceEndpoint;
  timestamp: number;
  details?: Record<string, unknown>;
}
```

### AutonomousDecision

```typescript
interface AutonomousDecision {
  id: string;
  type: "connect" | "disconnect" | "reconfigure" | "heal" | "scale";
  service: string;
  reason: string;
  timestamp: number;
  approved: boolean;
  executed: boolean;
}
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `started` | `{ services: ServiceEndpoint[] }` | System started |
| `stopped` | - | System stopped |
| `config_event` | `ConfigEvent` | Service status changed |
| `decision` | `AutonomousDecision` | Decision made |
| `notification` | `{ type, service, message }` | Notification sent |
| `log` | `LogEntry` | Log message |

### Event Examples

```typescript
manager.on("config_event", (event) => {
  console.log(`Service ${event.service.name} ${event.type}`);
});

manager.on("decision", (decision) => {
  console.log(`Decision: ${decision.type} - ${decision.reason}`);
});
```

## Environment Variables

The auto-config system automatically detects these environment variables:

| Variable | Service Type |
|----------|--------------|
| `PERSONAPLEX_SERVER_URL` | PersonaPlex |
| `PERSONAPLEX_URL` | PersonaPlex |
| `MOSHI_SERVER_URL` | PersonaPlex |
| `AGENT_ZERO_URL` | Agent Zero |
| `AGENT_ZERO_API_URL` | Agent Zero |
| `POKE_API_URL` | Poke |
| `POKE_BACKEND_URL` | Poke |
| `MCP_SERVER_URL` | MCP |
| `MCP_ENDPOINT` | MCP |

API Keys:
- `HF_TOKEN` - HuggingFace token
- `COMPOSIO_API_KEY` - Composio API
- `OPENAI_API_KEY` - OpenAI API
- `ANTHROPIC_API_KEY` - Anthropic API

## Auto-Discovery

The system probes these well-known ports:

| Service | Ports |
|---------|-------|
| PersonaPlex | 8998, 8999, 9000 |
| Agent Zero | 8080, 3000, 5000 |
| Poke | 8000, 8001, 5001 |
| MCP | 3333, 3334 |

Hosts probed: `localhost`, `127.0.0.1`, `host.docker.internal`

## Example Usage

### Basic Setup

```typescript
import { AutoConfigManager } from "@moltbot/convergence-core/auto-config";

const manager = new AutoConfigManager({
  autonomousMode: true,
  autoDiscover: true,
});

await manager.start();

// System automatically discovers and connects to services
console.log(manager.getStatus());
```

### Manual Service Registration

```typescript
const manager = new AutoConfigManager({
  autoDiscover: false, // Disable auto-discovery
});

// Register services manually
manager.registerService({
  id: "production-personaplex",
  name: "Production PersonaPlex",
  type: "personaplex",
  url: "wss://personaplex.example.com:8998",
});

await manager.start();
```

### Event-Driven Monitoring

```typescript
manager.on("config_event", async (event) => {
  if (event.type === "disconnected") {
    // Service went down
    await sendAlert(`Service ${event.service.name} is down!`);
  }
  
  if (event.type === "healed") {
    // Service recovered
    await sendAlert(`Service ${event.service.name} recovered`);
  }
});
```

### Unrestricted Mode

```typescript
const manager = new AutoConfigManager({
  autonomousMode: true,
  unrestrictedMode: true, // ⚠️ No guardrails
});

// System operates without any restrictions
await manager.start();
```
