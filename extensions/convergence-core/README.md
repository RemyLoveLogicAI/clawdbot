# 🧠 Convergence Core

**Auto-configuration, observability, notifications, and autonomous control for Moltbot.**

## Features

### 🔌 Auto-Configuration & Auto-Wiring
- **Zero-config setup** - Automatically discovers and connects to services
- **Environment variable detection** - Reads from `PERSONAPLEX_SERVER_URL`, `COMPOSIO_API_KEY`, etc.
- **Network discovery** - Probes well-known ports for PersonaPlex, Agent Zero, Poke
- **Auto-reconnect** - Reconnects on failures with exponential backoff
- **Self-healing** - Disables underperforming services and re-enables after cooldown

### 📊 Observability
- **Structured logging** - JSON logs with trace correlation
- **Metrics collection** - Counters, gauges, histograms
- **Distributed tracing** - Span-based request tracking
- **Health checks** - Periodic service health monitoring
- **Alerting** - Automatic alerts on anomalies
- **Prometheus export** - `/convergence/metrics` endpoint

### 🔔 Auto-Notifications
- **Multi-channel delivery** - Telegram, Discord, Slack, webhooks
- **Event-driven** - Triggers on service events, errors, decisions
- **Rate limiting** - Prevents notification spam
- **Deduplication** - No duplicate alerts within time window
- **Priority routing** - Critical alerts go to all channels

### 🤖 Autonomous Controller
- **Task queue** - Priority-based task scheduling
- **Intelligent routing** - Selects best capability for each task
- **Self-healing** - Retries with different agents on failure
- **Decision logging** - Records all autonomous decisions
- **Unrestricted mode** - Disables all guardrails

## Quick Start

### Enable in Configuration

```yaml
# moltbot.yml
plugins:
  - convergence-core

convergence:
  autonomous: true
  unrestricted: false
  autoDiscover: true
  autoNotify: true
  notifyChannels:
    - telegram
    - console
```

### Environment Variables

```bash
# Service URLs (auto-discovered if not set)
PERSONAPLEX_SERVER_URL=wss://localhost:8998
AGENT_ZERO_URL=http://localhost:8080
POKE_API_URL=http://localhost:8000

# API Keys
HF_TOKEN=your_huggingface_token
COMPOSIO_API_KEY=your_composio_key
OPENAI_API_KEY=your_openai_key

# Notifications
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## CLI Commands

```bash
# View status
moltbot convergence status

# List discovered services
moltbot convergence services

# Enable unrestricted mode
moltbot convergence unrestricted

# Send notification
moltbot convergence notify "Title" "Message body" --priority high
```

## Tools

### convergence_status
Get full system status.

```json
{
  "initialized": true,
  "config": { "autonomous": true, "unrestricted": false },
  "autoConfig": { "services": { "total": 3, "healthy": 3 } },
  "controller": { "mode": "autonomous", "tasks": { "active": 2 } },
  "health": [{ "name": "personaplex", "status": "healthy" }],
  "alerts": []
}
```

### convergence_notify
Send a notification.

```typescript
await callTool("convergence_notify", {
  title: "Alert",
  body: "Something happened",
  priority: "high",
  channels: ["telegram", "discord"]
});
```

### convergence_submit_task
Submit task for autonomous processing.

```typescript
await callTool("convergence_submit_task", {
  type: "research",
  input: { query: "AI trends 2025" },
  priority: "normal"
});
```

### convergence_enable_unrestricted
Enable unrestricted mode.

```typescript
await callTool("convergence_enable_unrestricted", {});
// Returns: { mode: "unrestricted", guardrails: false, filtering: false }
```

## HTTP Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /convergence/metrics` | Prometheus metrics |
| `GET /convergence/status` | JSON status |
| `GET /convergence/dashboard` | Dashboard data |

## Gateway Methods

```typescript
// Via gateway client
await gateway.call("convergence.status");
await gateway.call("convergence.notify", { title: "...", body: "..." });
await gateway.call("convergence.submitTask", { type: "code", input: {...} });
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Convergence Core                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auto-Config  │  │ Observability│  │ Notifications│          │
│  │              │  │              │  │              │          │
│  │ - Discovery  │  │ - Metrics    │  │ - Telegram   │          │
│  │ - Wiring     │  │ - Logs       │  │ - Discord    │          │
│  │ - Health     │  │ - Traces     │  │ - Slack      │          │
│  │ - Healing    │  │ - Alerts     │  │ - Webhooks   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └────────────┬────┴────────────────┘                   │
│                      │                                          │
│              ┌───────▼───────┐                                  │
│              │  Autonomous   │                                  │
│              │  Controller   │                                  │
│              │               │                                  │
│              │ - Task Queue  │                                  │
│              │ - Routing     │                                  │
│              │ - Decisions   │                                  │
│              │ - Unrestricted│                                  │
│              └───────────────┘                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │       Moltbot Gateway          │
              └───────────────────────────────┘
```

## Autonomous Mode

In autonomous mode, the system:
- Makes routing decisions without confirmation
- Auto-heals failed services
- Auto-scales based on load
- Records all decisions for audit

### Unrestricted Mode

⚠️ **Warning**: Unrestricted mode disables all safety guardrails.

```bash
moltbot convergence unrestricted
```

In unrestricted mode:
- Content filtering is disabled
- Safety guardrails are disabled
- All tasks are processed without restrictions
- Full autonomy is enabled

## Events

The system emits events for integration:

| Event | Description |
|-------|-------------|
| `service.discovered` | New service found |
| `service.connected` | Service connected |
| `service.down` | Service went down |
| `service.recovered` | Service recovered |
| `decision.*` | Autonomous decision made |
| `task.completed` | Task finished |
| `task.failed` | Task failed |
| `error.critical` | Critical error |

## Notification Rules

Default rules:
- **service-down**: Alert when service goes down (high priority)
- **service-recovered**: Notify when service recovers
- **autonomous-decision**: Log all decisions
- **critical-errors**: Alert on fatal errors (urgent)
- **new-user**: Notify on user onboarding
- **agent-task-complete**: Log task completions

## Metrics

Available metrics:
- `autoconfig_events_total{type}` - Configuration events
- `service_latency_ms{service}` - Service latency
- `decisions_total{type}` - Autonomous decisions
- `tasks_completed_total{type}` - Completed tasks
- `tasks_failed_total{type}` - Failed tasks
- `log_errors_total{component}` - Error count
- `memory_heap_used_bytes` - Memory usage

## Development

```bash
# Run tests
pnpm test extensions/convergence-core

# Lint
pnpm lint extensions/convergence-core

# Build
pnpm build
```

## License

MIT
