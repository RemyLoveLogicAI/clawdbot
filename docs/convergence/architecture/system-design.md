# Convergence System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACES                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │Telegram │ │ Discord │ │  Slack  │ │WhatsApp │ │ iMessage│ │  Voice  │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
│       └──────────┬┴──────────┬┴──────────┬┴──────────┬┴──────────┬┘       │
└──────────────────┼───────────┼───────────┼───────────┼───────────┼────────┘
                   │           │           │           │           │
                   ▼           ▼           ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MOLTBOT GATEWAY                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Channel Router                                    │  │
│  │   • Message normalization     • Session management                    │  │
│  │   • Auth & rate limiting      • Message queuing                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     CONVERGENCE CORE                                   │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │ Auto-Config │  │ Observability│  │ Notifications│  │ Autonomous │ │  │
│  │  │             │  │              │  │              │  │ Controller │ │  │
│  │  │ • Discovery │  │ • Metrics    │  │ • Telegram   │  │            │ │  │
│  │  │ • Wiring    │  │ • Logs       │  │ • Discord    │  │ • Tasks    │ │  │
│  │  │ • Health    │  │ • Traces     │  │ • Slack      │  │ • Routing  │ │  │
│  │  │ • Healing   │  │ • Alerts     │  │ • Webhooks   │  │ • Decisions│ │  │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └──────┬─────┘ │  │
│  │         └────────────────┴─────────────────┴─────────────────┘       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAPABILITY LAYER                                     │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐         │
│  │    PersonaPlex    │ │    Agent Zero     │ │       Poke        │         │
│  │                   │ │                   │ │                   │         │
│  │  • Full-duplex    │ │  • Task execution │ │  • Gmail research │         │
│  │  • Voice-first    │ │  • Code running   │ │  • Onboarding     │         │
│  │  • Persona control│ │  • Subordinates   │ │  • Profile build  │         │
│  │  • NVIDIA Moshi   │ │  • Memory         │ │  • Composio       │         │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ OpenAI  │ │Anthropic│ │ Google  │ │Composio │ │HuggingFc│ │  MCP    │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Convergence Core

The central orchestration layer that manages all convergence functionality.

#### Auto-Configuration Module

```
┌─────────────────────────────────────────────────┐
│              Auto-Configuration                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐    ┌──────────────┐           │
│  │  Environment │───▶│   Service    │           │
│  │   Detection  │    │   Registry   │           │
│  └──────────────┘    └──────┬───────┘           │
│                             │                    │
│  ┌──────────────┐    ┌──────▼───────┐           │
│  │   Network    │───▶│   Health     │           │
│  │  Discovery   │    │   Monitor    │           │
│  └──────────────┘    └──────┬───────┘           │
│                             │                    │
│  ┌──────────────┐    ┌──────▼───────┐           │
│  │   Decision   │◀───│    Event     │           │
│  │    Engine    │    │   Emitter    │           │
│  └──────────────┘    └──────────────┘           │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Responsibilities:**
- Environment variable detection
- Service auto-discovery on network
- Health monitoring and alerting
- Self-healing and reconnection
- Autonomous decision making

#### Observability Module

```
┌─────────────────────────────────────────────────┐
│                Observability                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Counters │  │  Gauges  │  │Histograms│      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       └─────────────┼─────────────┘             │
│                     ▼                            │
│            ┌────────────────┐                    │
│            │ Metrics Store  │                    │
│            └───────┬────────┘                    │
│                    │                             │
│  ┌─────────────────┼─────────────────┐          │
│  ▼                 ▼                 ▼          │
│ ┌────────┐   ┌──────────┐   ┌────────────┐     │
│ │Prometheus│ │ Dashboard│   │  Alerting  │     │
│ │ Export  │  │   Data   │   │   Engine   │     │
│ └─────────┘  └──────────┘   └────────────┘     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Logging │  │  Tracing │  │  Health  │      │
│  │  (JSON)  │  │ (Spans)  │  │  Checks  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Responsibilities:**
- Metrics collection (counters, gauges, histograms)
- Structured JSON logging with trace correlation
- Distributed tracing with spans
- Health check registration and monitoring
- Alert creation and management
- Prometheus-compatible export

#### Notification Module

```
┌─────────────────────────────────────────────────┐
│                Notifications                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │           Event Matcher              │       │
│  │   • Pattern matching (wildcards)     │       │
│  │   • Priority filtering               │       │
│  │   • Rule evaluation                  │       │
│  └─────────────────┬────────────────────┘       │
│                    │                             │
│  ┌─────────────────▼────────────────────┐       │
│  │          Rate Limiter                │       │
│  │   • Per-rule limits                  │       │
│  │   • Global rate limit                │       │
│  │   • Deduplication                    │       │
│  └─────────────────┬────────────────────┘       │
│                    │                             │
│  ┌─────┬─────┬─────┼─────┬─────┬─────┐         │
│  ▼     ▼     ▼     ▼     ▼     ▼     ▼         │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐    │
│ │TG │ │DC │ │SL │ │WH │ │EM │ │CS │ │...│    │
│ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘    │
│                                                  │
└─────────────────────────────────────────────────┘

TG = Telegram, DC = Discord, SL = Slack
WH = Webhook, EM = Email, CS = Console
```

**Responsibilities:**
- Multi-channel notification delivery
- Event-driven triggering with patterns
- Rate limiting and deduplication
- Priority-based routing
- Template interpolation

#### Autonomous Controller

```
┌─────────────────────────────────────────────────┐
│            Autonomous Controller                 │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │           Mode Controller            │       │
│  │   ┌──────────┐ ┌──────────┐ ┌─────┐ │       │
│  │   │Supervised│ │Autonomous│ │Unrestr│ │       │
│  │   └──────────┘ └──────────┘ └──────┘ │       │
│  └─────────────────┬────────────────────┘       │
│                    │                             │
│  ┌─────────────────▼────────────────────┐       │
│  │           Task Queue                  │       │
│  │   Priority: Critical > High > Normal │       │
│  └─────────────────┬────────────────────┘       │
│                    │                             │
│  ┌─────────────────▼────────────────────┐       │
│  │      Intelligent Router               │       │
│  │   • Capability matching               │       │
│  │   • Load balancing                    │       │
│  │   • Success rate optimization         │       │
│  └─────────────────┬────────────────────┘       │
│                    │                             │
│  ┌─────┬───────────┼───────────┬─────┐         │
│  ▼     ▼           ▼           ▼     ▼         │
│ ┌───┐ ┌───┐     ┌───┐       ┌───┐ ┌───┐       │
│ │PP │ │AZ │     │PK │       │MCP│ │CUS│       │
│ └───┘ └───┘     └───┘       └───┘ └───┘       │
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │         Decision Logger               │       │
│  │   • Route decisions                   │       │
│  │   • Self-healing actions              │       │
│  │   • Confidence scores                 │       │
│  └──────────────────────────────────────┘       │
│                                                  │
└─────────────────────────────────────────────────┘

PP = PersonaPlex, AZ = Agent Zero, PK = Poke
MCP = MCP Tools, CUS = Custom
```

**Responsibilities:**
- Task queue management
- Intelligent capability routing
- Self-healing and retry logic
- Decision logging for audit
- Mode management (supervised/autonomous/unrestricted)

### 2. Capability Layer

#### PersonaPlex Voice Provider

```
┌─────────────────────────────────────────────────┐
│              PersonaPlex Provider                │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │       WebSocket Connection           │       │
│  │   • Auto-reconnect                   │       │
│  │   • Binary audio streaming           │       │
│  │   • JSON control messages            │       │
│  └─────────────────┬────────────────────┘       │
│                    │                             │
│  ┌─────────────────▼────────────────────┐       │
│  │        Moshi Protocol Handler         │       │
│  │   • Full-duplex audio                 │       │
│  │   • Voice prompt injection            │       │
│  │   • Text prompt injection             │       │
│  └─────────────────┬────────────────────┘       │
│                    │                             │
│  ┌─────────────────▼────────────────────┐       │
│  │          Event Emitter                │       │
│  │   • Transcript events                 │       │
│  │   • Audio output events               │       │
│  │   • Connection state events           │       │
│  └──────────────────────────────────────┘       │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### Agent Zero Extension

```
┌─────────────────────────────────────────────────┐
│              Agent Zero Extension                │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Task     │  │Subordinate│  │   Code   │      │
│  │ Tool     │  │   Tool    │  │   Exec   │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │             │              │             │
│       └─────────────┼──────────────┘             │
│                     ▼                            │
│            ┌────────────────┐                    │
│            │  Agent Context │                    │
│            │  • History     │                    │
│            │  • Memory      │                    │
│            │  • Tools       │                    │
│            └───────┬────────┘                    │
│                    │                             │
│            ┌───────▼────────┐                    │
│            │  Memory Tool   │                    │
│            │  • Store       │                    │
│            │  • Query       │                    │
│            │  • Search      │                    │
│            └────────────────┘                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Data Flow

### Request Processing Flow

```
User Message
     │
     ▼
┌─────────────────┐
│ Channel Adapter │  ← Telegram/Discord/etc
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Message Router  │  ← Normalize, authenticate
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Convergence     │  ← Log, trace, decide
│ Core            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Autonomous      │  ← Route to capability
│ Controller      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ Plex  │ │ Agent │
│       │ │ Zero  │
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Response        │
│ Aggregator      │
└────────┬────────┘
         │
         ▼
   User Response
```

### Event Flow

```
Service Event
     │
     ├──────────────────────────────────────┐
     ▼                                      ▼
┌──────────────┐                    ┌──────────────┐
│ Observability│                    │ Notifications│
│ • Log event  │                    │ • Match rules│
│ • Record     │                    │ • Rate limit │
│   metric     │                    │ • Deliver    │
└──────────────┘                    └──────────────┘
     │                                      │
     ▼                                      ▼
┌──────────────┐                    ┌──────────────┐
│ Alert Check  │                    │ Channel      │
│ (if needed)  │                    │ Delivery     │
└──────────────┘                    └──────────────┘
```

## Deployment Architecture

### Single Instance

```
┌─────────────────────────────────────────┐
│              Host Machine                │
│  ┌─────────────────────────────────────┐│
│  │           Moltbot Process           ││
│  │  ┌──────────────────────────────┐   ││
│  │  │      Convergence Core        │   ││
│  │  └──────────────────────────────┘   ││
│  │  ┌──────┐ ┌──────┐ ┌──────┐        ││
│  │  │ PP   │ │ AZ   │ │ Poke │        ││
│  │  └──────┘ └──────┘ └──────┘        ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### Distributed (Docker)

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Network                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Moltbot    │  │  PersonaPlex │  │  Agent Zero  │      │
│  │   Gateway    │◀─│   Server     │  │   Backend    │      │
│  │   + Core     │  │   (GPU)      │  │              │      │
│  └──────┬───────┘  └──────────────┘  └──────────────┘      │
│         │                                                    │
│  ┌──────▼───────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Redis      │  │  PostgreSQL  │  │   Prometheus │      │
│  │   (Cache)    │  │   (Memory)   │  │   (Metrics)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Security Model

### Mode Security Matrix

| Feature | Supervised | Autonomous | Unrestricted |
|---------|------------|------------|--------------|
| Content Filtering | ✅ | ❌ | ❌ |
| Safety Guardrails | ✅ | ❌ | ❌ |
| Decision Approval | ✅ | ❌ | ❌ |
| Rate Limiting | ✅ | ✅ | ✅ |
| Audit Logging | ✅ | ✅ | ✅ |
| Authentication | ✅ | ✅ | ✅ |

### API Security

- All HTTP endpoints require authentication
- Rate limiting on all endpoints
- Input validation on all inputs
- Audit logging for all operations

## Performance Characteristics

### Expected Latencies

| Operation | P50 | P95 | P99 |
|-----------|-----|-----|-----|
| Metric increment | <0.01ms | <0.05ms | <0.1ms |
| Log write | <0.1ms | <0.5ms | <1ms |
| Task submit | <1ms | <5ms | <10ms |
| Task route | <1ms | <5ms | <10ms |
| Health check | <10ms | <50ms | <100ms |

### Scalability

| Component | Max Throughput |
|-----------|---------------|
| Metrics/sec | 100,000+ |
| Logs/sec | 10,000+ |
| Tasks/sec | 1,000+ |
| Notifications/min | 60 (configurable) |

## Failure Modes

### Self-Healing Scenarios

1. **Service Disconnect**
   - Auto-reconnect with exponential backoff
   - Route tasks to alternative capability
   - Alert after max retries

2. **Task Failure**
   - Retry with same capability
   - Retry with different capability
   - Mark as failed and alert

3. **Memory Pressure**
   - Metrics pruning
   - Log rotation
   - Alert when threshold exceeded

4. **Capability Degradation**
   - Temporarily disable capability
   - Re-enable after cooldown
   - Log decision for audit
