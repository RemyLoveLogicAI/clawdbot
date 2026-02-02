# Autonomous Controller API Reference

## Overview

The Autonomous Controller manages AI agent behavior, task routing, and autonomous decision-making. It supports three operation modes: supervised, autonomous, and unrestricted.

## Classes

### AutonomousController

The main class for autonomous task management.

```typescript
import { AutonomousController, autonomousController } from "@moltbot/convergence-core/autonomous-controller";

// Use singleton
autonomousController.submitTask("text", { message: "Hello" });

// Or create instance
const controller = new AutonomousController(options);
```

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `OperationMode` | `"autonomous"` | Operation mode |
| `selfHealing` | `boolean` | `true` | Auto-recover from failures |
| `autoScaling` | `boolean` | `true` | Scale based on load |
| `intelligentRouting` | `boolean` | `true` | Smart task routing |
| `maxConcurrentTasks` | `number` | `10` | Max parallel tasks |
| `taskTimeoutMs` | `number` | `300000` | Task timeout (5 min) |
| `maxRetries` | `number` | `3` | Max task retries |
| `decisionThreshold` | `number` | `0.7` | Decision confidence threshold |
| `contentFiltering` | `boolean` | `false` | Filter content |
| `safetyGuardrails` | `boolean` | `false` | Enable safety checks |
| `verboseLogging` | `boolean` | `true` | Detailed logging |

## Operation Modes

### Supervised Mode

```typescript
controller.setMode("supervised");
```

- Decisions require approval
- Content filtering enabled
- Safety guardrails enabled
- Human-in-the-loop

### Autonomous Mode

```typescript
controller.setMode("autonomous");
```

- Decisions executed automatically
- Self-healing enabled
- Intelligent routing
- No approval needed

### Unrestricted Mode

```typescript
controller.setMode("unrestricted");
// or
controller.enableUnrestrictedMode();
```

- **No content filtering**
- **No safety guardrails**
- Full autonomous operation
- All tasks accepted

⚠️ **Warning**: Unrestricted mode disables all safety mechanisms.

## Lifecycle

### `start(): Promise<void>`

Start the controller.

```typescript
await controller.start();
```

### `stop(): Promise<void>`

Stop the controller.

```typescript
await controller.stop();
```

## Task Management

### `submitTask(type, input, options?): Promise<Task>`

Submit a task for processing.

```typescript
// Basic task
const task = await controller.submitTask("text", {
  message: "Hello, how are you?",
});

// Voice task
const voiceTask = await controller.submitTask("voice", {
  audio: audioBuffer,
  language: "en",
});

// Code task
const codeTask = await controller.submitTask("code", {
  code: "console.log('Hello')",
  language: "javascript",
});

// Research task
const researchTask = await controller.submitTask("research", {
  query: "Latest AI developments",
  depth: "comprehensive",
});

// Autonomous task
const autoTask = await controller.submitTask("autonomous", {
  goal: "Analyze market trends",
  constraints: { timeLimit: "5m" },
});

// With priority
const urgentTask = await controller.submitTask("text", 
  { message: "Emergency!" },
  { priority: "critical" }
);

// With custom retries
const reliableTask = await controller.submitTask("code",
  { code: "..." },
  { maxRetries: 5 }
);
```

#### Task Types

| Type | Description | Primary Capability |
|------|-------------|-------------------|
| `voice` | Voice/audio processing | PersonaPlex |
| `text` | Text processing | Agent Zero |
| `code` | Code execution | Agent Zero |
| `research` | Information research | Poke |
| `autonomous` | Complex autonomous tasks | Agent Zero |
| `custom` | Custom tasks | Any available |

#### Priority Levels

| Priority | Description |
|----------|-------------|
| `low` | Background tasks |
| `normal` | Standard priority |
| `high` | Important tasks |
| `critical` | Urgent tasks (first in queue) |

### `getTask(taskId): Task | undefined`

Get task by ID.

```typescript
const task = controller.getTask("task-123");
if (task) {
  console.log(`Status: ${task.status}`);
}
```

### `cancelTask(taskId): boolean`

Cancel a task.

```typescript
const cancelled = controller.cancelTask("task-123");
if (cancelled) {
  console.log("Task cancelled");
}
```

## Mode Control

### `setMode(mode): void`

Set operation mode.

```typescript
controller.setMode("supervised");   // Requires approval
controller.setMode("autonomous");   // Auto-decides
controller.setMode("unrestricted"); // No restrictions
```

### `enableUnrestrictedMode(): void`

Enable unrestricted mode (convenience method).

```typescript
controller.enableUnrestrictedMode();
// Equivalent to:
// controller.setMode("unrestricted");
```

### `disableGuardrails(): void`

Disable all guardrails without changing mode.

```typescript
controller.disableGuardrails();
// contentFiltering = false
// safetyGuardrails = false
```

## Capabilities

### `getCapabilities(): AgentCapability[]`

Get all registered capabilities.

```typescript
const capabilities = controller.getCapabilities();
for (const cap of capabilities) {
  console.log(`${cap.name}: ${cap.enabled ? "enabled" : "disabled"}`);
  console.log(`  Load: ${cap.currentLoad}/${cap.maxConcurrent}`);
  console.log(`  Success rate: ${cap.successRate * 100}%`);
}
```

### `registerCapability(capability): void`

Register a new capability.

```typescript
controller.registerCapability({
  id: "my-custom-agent",
  name: "My Custom Agent",
  type: "custom",
  priority: 5,
  enabled: true,
  maxConcurrent: 3,
  currentLoad: 0,
  successRate: 1.0,
  avgLatencyMs: 100,
  tags: ["custom", "specialized"],
});
```

#### Default Capabilities

| ID | Name | Type | Tags |
|----|------|------|------|
| `personaplex-voice` | PersonaPlex Voice | personaplex | voice, speech, audio |
| `agent-zero-auto` | Agent Zero Autonomous | agent-zero | autonomous, code, planning |
| `poke-research` | Poke Research | poke | research, gmail, onboarding |

## Decisions

### `getDecisions(limit?): Decision[]`

Get decision history.

```typescript
const decisions = controller.getDecisions(100);
for (const d of decisions) {
  console.log(`[${d.timestamp}] ${d.type}: ${d.reason}`);
  console.log(`  Confidence: ${d.confidence}`);
  console.log(`  Executed: ${d.executed}`);
}
```

#### Decision Types

| Type | Description |
|------|-------------|
| `route` | Task routing decision |
| `scale` | Scaling decision |
| `heal` | Self-healing action |
| `optimize` | Optimization decision |
| `restrict` | Restriction applied |
| `unrestrict` | Restriction removed |

## Status & Configuration

### `getStatus(): ControllerStatus`

Get comprehensive status.

```typescript
const status = controller.getStatus();
console.log(`Running: ${status.running}`);
console.log(`Mode: ${status.mode}`);
console.log(`Tasks: ${status.tasks.active} active, ${status.tasks.queued} queued`);
console.log(`Capabilities: ${status.capabilities.enabled}/${status.capabilities.total}`);
```

### `getConfig(): ControllerConfig`

Get current configuration.

```typescript
const config = controller.getConfig();
console.log(`Mode: ${config.mode}`);
console.log(`Content filtering: ${config.contentFiltering}`);
console.log(`Max concurrent: ${config.maxConcurrentTasks}`);
```

### `updateConfig(updates): void`

Update configuration.

```typescript
controller.updateConfig({
  maxConcurrentTasks: 20,
  taskTimeoutMs: 600000,
  verboseLogging: false,
});
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `started` | `{ config }` | Controller started |
| `stopped` | - | Controller stopped |
| `task_queued` | `Task` | Task added to queue |
| `task_started` | `Task` | Task execution began |
| `task_completed` | `Task` | Task finished successfully |
| `task_failed` | `Task` | Task failed |
| `task_cancelled` | `Task` | Task was cancelled |
| `task_timeout` | `Task` | Task timed out |
| `decision` | `Decision` | Decision made |
| `mode_changed` | `{ previousMode, newMode }` | Mode changed |
| `config_updated` | `ControllerConfig` | Config updated |
| `capability_registered` | `AgentCapability` | New capability |
| `health_check` | Status | Periodic health |
| `log` | `{ message, data, timestamp }` | Log message |

### Event Examples

```typescript
// Task lifecycle
controller.on("task_queued", (task) => {
  console.log(`Task ${task.id} queued`);
});

controller.on("task_started", (task) => {
  console.log(`Task ${task.id} started, assigned to ${task.assignedTo}`);
});

controller.on("task_completed", (task) => {
  console.log(`Task ${task.id} completed`);
  console.log(`Result: ${JSON.stringify(task.result)}`);
});

controller.on("task_failed", (task) => {
  console.error(`Task ${task.id} failed: ${task.error}`);
});

// Decisions
controller.on("decision", (decision) => {
  console.log(`Decision: ${decision.type}`);
  console.log(`Reason: ${decision.reason}`);
  console.log(`Confidence: ${decision.confidence}`);
});

// Mode changes
controller.on("mode_changed", ({ previousMode, newMode }) => {
  console.log(`Mode changed: ${previousMode} -> ${newMode}`);
});
```

## Types

### Task

```typescript
interface Task {
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
```

### AgentCapability

```typescript
interface AgentCapability {
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
```

### Decision

```typescript
interface Decision {
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
```

### OperationMode

```typescript
type OperationMode = "supervised" | "autonomous" | "unrestricted";
```

## Usage Examples

### Basic Autonomous Operation

```typescript
const controller = new AutonomousController({
  mode: "autonomous",
});

await controller.start();

// Submit tasks - they'll be automatically routed
const result = await controller.submitTask("research", {
  query: "AI trends 2025",
});

console.log(result.status); // "queued" or "running"
```

### Unrestricted Mode

```typescript
const controller = new AutonomousController();
await controller.start();

// Enable unrestricted mode
controller.enableUnrestrictedMode();

// Now all content is accepted without filtering
await controller.submitTask("text", {
  message: "Any content is now accepted",
});
```

### Task Monitoring

```typescript
const controller = new AutonomousController();
await controller.start();

controller.on("task_completed", async (task) => {
  console.log(`✅ Task completed: ${task.id}`);
  
  // Process result
  if (task.type === "research") {
    await saveResearchResults(task.result);
  }
});

controller.on("task_failed", async (task) => {
  console.error(`❌ Task failed: ${task.id}`);
  console.error(`Error: ${task.error}`);
  
  // Send alert
  await notifyAdmin(`Task failed: ${task.error}`);
});
```

### Custom Capability

```typescript
controller.registerCapability({
  id: "llm-claude",
  name: "Claude LLM",
  type: "custom",
  priority: 10,
  enabled: true,
  maxConcurrent: 5,
  currentLoad: 0,
  successRate: 0.98,
  avgLatencyMs: 200,
  tags: ["llm", "text", "code", "analysis"],
});

// Task routing will now consider this capability
```

### Decision Auditing

```typescript
// Get all decisions for auditing
const decisions = controller.getDecisions();

// Export for analysis
const auditLog = decisions.map(d => ({
  timestamp: new Date(d.timestamp).toISOString(),
  type: d.type,
  reason: d.reason,
  confidence: d.confidence,
  executed: d.executed,
}));

await saveAuditLog(auditLog);
```
