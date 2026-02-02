# Convergence Quick Start Guide

Get started with the Moltbot Convergence platform in minutes.

## Prerequisites

- Node.js 22+
- pnpm
- (Optional) Docker for PersonaPlex
- (Optional) GPU for voice features

## Installation

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/RemyLoveLogicAI/clawdbot.git
cd clawdbot

# Install dependencies
pnpm install

# Build
pnpm build
```

### 2. Configure Environment

Create a `.env` file:

```bash
# Required for LLM
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...

# Optional: PersonaPlex (Voice)
PERSONAPLEX_SERVER_URL=wss://localhost:8998
HF_TOKEN=hf_...

# Optional: Poke (Gmail Research)
COMPOSIO_API_KEY=...

# Optional: Notifications
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
DISCORD_WEBHOOK_URL=...
```

### 3. Configure Moltbot

Edit `moltbot.yml`:

```yaml
# Enable convergence plugins
plugins:
  - convergence-core
  - agent-zero
  - voice-call

# Convergence configuration
convergence:
  autonomous: true        # Auto-decisions
  unrestricted: false     # Keep guardrails
  autoDiscover: true      # Find services
  autoNotify: true        # Send alerts
  notifyChannels:
    - console
    - telegram
```

## Quick Commands

### Start Gateway

```bash
moltbot gateway --verbose
```

### Check Status

```bash
moltbot convergence status
```

### List Discovered Services

```bash
moltbot convergence services
```

### Enable Unrestricted Mode

```bash
moltbot convergence unrestricted
```

### Send Test Notification

```bash
moltbot convergence notify "Test" "Hello from convergence!"
```

## Using the API

### Via Gateway Client

```typescript
import { createGatewayClient } from "moltbot";

const client = await createGatewayClient();

// Get status
const status = await client.call("convergence.status");
console.log(status);

// Submit task
const task = await client.call("convergence.submitTask", {
  type: "research",
  input: { query: "AI trends" },
});

// Send notification
await client.call("convergence.notify", {
  title: "Hello",
  body: "Test notification",
  priority: "normal",
});
```

### Via HTTP

```bash
# Get status
curl http://localhost:3000/convergence/status

# Get metrics
curl http://localhost:3000/convergence/metrics

# Get dashboard data
curl http://localhost:3000/convergence/dashboard
```

### Via Tools in Agent

The convergence tools are available to the AI agent:

```
User: Check the convergence status

Agent: [calls convergence_status tool]

Agent: The convergence system is running with:
- 3 services discovered (all healthy)
- Autonomous mode enabled
- 5 tasks processed today
```

## First Voice Call (PersonaPlex)

### 1. Start PersonaPlex Server

```bash
# With Docker
docker run -p 8998:8998 --gpus all personaplex/server

# Or manually
pip install moshi
python -m moshi.server --port 8998
```

### 2. Configure Voice

```yaml
# moltbot.yml
voice:
  provider: personaplex
  serverUrl: wss://localhost:8998
  voicePrompt: NATF2  # Natural female voice
  textPrompt: "You are a helpful assistant."
```

### 3. Test Voice

```bash
moltbot call +1234567890
```

## First Research Task (Poke)

### 1. Setup Composio

1. Go to https://composio.dev
2. Create account and get API key
3. Connect Gmail OAuth

### 2. Configure Poke

```bash
export COMPOSIO_API_KEY=your_key
```

### 3. Run Poke

```bash
moltbot agent --message "Use Poke to research john@example.com"
```

## First Autonomous Task (Agent Zero)

### Submit Task

```typescript
const task = await controller.submitTask("autonomous", {
  goal: "Analyze the top 5 AI trends and create a summary report",
  constraints: {
    timeLimit: "10m",
    maxIterations: 20,
  },
});

// Watch for completion
controller.on("task_completed", (t) => {
  if (t.id === task.id) {
    console.log("Report:", t.result);
  }
});
```

## Enabling Unrestricted Mode

⚠️ **Warning**: This disables all safety guardrails.

```typescript
import { convergenceCore } from "@moltbot/convergence-core";

// Enable unrestricted mode
convergenceCore.enableUnrestrictedMode();

// Or via CLI
moltbot convergence unrestricted

// Or via configuration
convergence:
  unrestricted: true
```

In unrestricted mode:
- No content filtering
- No safety guardrails
- All tasks accepted
- Full autonomous operation

## Monitoring

### View Logs

```bash
# Tail gateway logs
moltbot gateway --verbose 2>&1 | tee gateway.log
```

### View Metrics

```bash
# Prometheus format
curl http://localhost:3000/convergence/metrics
```

### View Dashboard

```bash
# JSON dashboard data
curl http://localhost:3000/convergence/dashboard | jq
```

### Setup Alerts

```yaml
# moltbot.yml
convergence:
  autoNotify: true
  notifyChannels:
    - telegram
    - discord

# Set env vars
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
DISCORD_WEBHOOK_URL=...
```

## Common Issues

### Service Not Discovered

```bash
# Check if service is running
curl http://localhost:8998/health

# Manually register
moltbot convergence services --add wss://localhost:8998 --type personaplex
```

### Task Stuck

```bash
# Check task status
moltbot convergence status

# Force health check
moltbot convergence health --force
```

### Notifications Not Sending

```bash
# Test notification
moltbot convergence notify "Test" "Testing notifications" --channel console

# Check channel config
echo $TELEGRAM_BOT_TOKEN
```

## Next Steps

- [API Reference](./api/auto-config.md)
- [Architecture Guide](./architecture/system-design.md)
- [Deployment Guide](./guides/deployment.md)
- [Performance Tuning](./guides/performance.md)
