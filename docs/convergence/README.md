# Convergence Platform Documentation

> **Unified AI Platform: Voice-First + Autonomous + Research**

## 📚 Documentation Index

| Category | Documents |
|----------|-----------|
| **Quick Start** | [Getting Started](./guides/quickstart.md) |
| **Architecture** | [System Design](./architecture/system-design.md) |
| **API Reference** | [Auto-Config](./api/auto-config.md) · [Observability](./api/observability.md) · [Autonomous Controller](./api/autonomous-controller.md) |
| **Extensions** | [Convergence Core](../../extensions/convergence-core/README.md) · [Agent Zero](../../extensions/agent-zero/README.md) · [PersonaPlex](../../extensions/voice-call/src/providers/personaplex.ts) |

---

# Convergence: Open-Poke + PersonaPlex + Agent Zero

This document describes the convergence of three powerful AI projects into Moltbot's unified platform.

## Overview

The convergence brings together:

| Project | Capability | Integration |
|---------|------------|-------------|
| **Open-Poke** | Personalized onboarding via Gmail research | Skill: `poke-onboard` |
| **PersonaPlex** | NVIDIA's full-duplex voice-first AI | Provider: `personaplex` |
| **Agent Zero** | Autonomous agent with code execution | Extension: `agent-zero` |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Moltbot Gateway                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Omni-Channel Layer                        ││
│  │  WhatsApp │ Telegram │ Discord │ Slack │ iMessage │ Signal  ││
│  │  MS Teams │ Matrix   │ Zalo    │ Line  │ WebChat  │ Voice   ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                     Agent Router                           │  │
│  │  • Multi-agent routing  • Session management              │  │
│  │  • Tool orchestration   • Context preservation            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────┬───────────────┼───────────────┬───────────────┐  │
│  │           │               │               │               │  │
│  ▼           ▼               ▼               ▼               ▼  │
│ ┌─────┐  ┌─────────┐  ┌───────────┐  ┌──────────┐  ┌───────┐ │
│ │Poke │  │Persona- │  │Agent Zero │  │ Memory   │  │ Tools │ │
│ │Onbrd│  │Plex     │  │Extension  │  │ (LanceDB)│  │ (MCP) │ │
│ └─────┘  └─────────┘  └───────────┘  └──────────┘  └───────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Voice-First Experience

### PersonaPlex Integration

PersonaPlex provides real-time, full-duplex speech-to-speech with persona control:

```yaml
voice:
  provider: personaplex
  config:
    serverUrl: wss://localhost:8998
    voicePrompt: NATF2  # Natural female voice 2
    textPrompt: "You are a wise and friendly teacher."
```

#### Available Voices

**Natural (conversational):**
- `NATF0-3`: Female voices
- `NATM0-3`: Male voices

**Variety (diverse):**
- `VARF0-4`: Female voices
- `VARM0-4`: Male voices

#### Persona Prompts

```yaml
# Assistant mode
textPrompt: "You are a wise and friendly teacher. Answer questions or provide advice in a clear and engaging way."

# Casual mode
textPrompt: "You enjoy having a good conversation."

# Service mode
textPrompt: "You work for TechCorp and your name is Alex. You help customers with technical support."
```

## Personalized Onboarding

### Poke Integration

Poke researches new users and greets them with personalized insights:

```
User: Hello Poke
Poke: So you are John Smith, software engineer at TechCorp, been coding 
      for 5 years, recently moved to Austin. What brings you here?
```

#### Research Process

1. **Gmail Profile Analysis** - Name, email domain, basic info
2. **Professional Search** - LinkedIn, company pages
3. **Web Research** - Projects, publications, achievements
4. **Profile Assembly** - Verified, cross-referenced insights

#### Configuration

```yaml
skills:
  poke-onboard:
    enabled: true
    composioApiKey: ${COMPOSIO_API_KEY}
    persona: bouncer  # or friendly, professional
    researchDepth: full  # or quick, minimal
```

## Autonomous Capabilities

### Agent Zero Integration

Agent Zero enables complex, multi-step task execution:

```
User: Research and summarize the top 5 AI coding assistants
Agent: [Plans task → Executes research → Reflects → Returns summary]
```

#### Capabilities

- **Task Planning**: Break down complex tasks
- **Tool Execution**: Use available tools
- **Code Execution**: Run Python, Bash, JS, TS
- **Subordinate Agents**: Parallel task delegation
- **Persistent Memory**: Long-term knowledge storage

#### Configuration

```yaml
plugins:
  agent-zero:
    enabled: true
    codeExecution:
      enabled: true
      dockerEnabled: true
    memory:
      enabled: true
    maxSubordinateDepth: 3
```

## Omni-Channel Support

All convergence features work across channels:

| Channel | Voice | Poke Onboard | Agent Zero |
|---------|-------|--------------|------------|
| WhatsApp | ✓ (via voice notes) | ✓ | ✓ |
| Telegram | ✓ (via voice messages) | ✓ | ✓ |
| Discord | ✓ (voice channels) | ✓ | ✓ |
| Slack | ✓ (huddles) | ✓ | ✓ |
| iMessage | ✓ (via macOS) | ✓ | ✓ |
| Voice Call | ✓ (PersonaPlex) | ✓ | ✓ |
| WebChat | ✓ (WebRTC) | ✓ | ✓ |

## Quick Start

### 1. Install Dependencies

```bash
# Moltbot
npm install -g moltbot@latest

# PersonaPlex (optional, for voice)
pip install moshi/.

# Composio (optional, for Poke)
pip install composio-core
```

### 2. Configure

```yaml
# moltbot.config.yaml
gateway:
  mode: local
  port: 18789

voice:
  provider: personaplex
  
skills:
  poke-onboard:
    enabled: true

plugins:
  agent-zero:
    enabled: true
```

### 3. Run

```bash
moltbot gateway --verbose

# In another terminal, start PersonaPlex server
python -m moshi.server --ssl /tmp
```

### 4. Test

```bash
# Text interaction
moltbot agent --message "Hello Poke"

# Voice call
moltbot voicecall --to +1234567890

# Autonomous task
moltbot agent --message "Use agent_zero_task to research AI trends"
```

## API Reference

### PersonaPlex Provider

```typescript
import { createPersonaPlexProvider } from '@moltbot/voice-call';

const provider = createPersonaPlexProvider({
  serverUrl: 'wss://localhost:8998',
  voicePrompt: 'NATF2.pt',
  textPrompt: 'You are a helpful assistant.',
});
```

### Agent Zero Tools

```typescript
// Execute autonomous task
api.callTool('agent_zero_task', {
  task: 'Research and summarize...',
  maxIterations: 10,
  memory: true,
});

// Spawn subordinate
api.callTool('spawn_subordinate', {
  task: 'Analyze this document...',
  waitForResult: false,
});

// Execute code
api.callTool('execute_code', {
  code: 'print("Hello, World!")',
  language: 'python',
  runtime: 'docker',
});

// Memory operations
api.callTool('agent_memory', {
  operation: 'store',
  content: 'User prefers dark mode',
  topic: 'preferences',
  importance: 0.8,
});
```

## Troubleshooting

### PersonaPlex Issues

- **"Connection refused"**: Ensure PersonaPlex server is running
- **"Model not found"**: Check HF_TOKEN is set and license accepted
- **"GPU memory"**: Use `--cpu-offload` flag

### Poke Issues

- **"No tools available"**: Check Composio API key
- **"Research failed"**: User may have privacy settings

### Agent Zero Issues

- **"Task timeout"**: Increase `timeoutMs` in config
- **"Code execution failed"**: Check Docker is running

## Credits

- [Open-Poke](https://github.com/RemyLoveLogicAI/open-poke) - Personalized onboarding
- [PersonaPlex](https://github.com/NVIDIA/personaplex) - NVIDIA voice-first AI
- [Agent Zero](https://github.com/frdel/agent-zero) - Autonomous agent framework
- [Moltbot](https://github.com/moltbot/moltbot) - Base platform

## License

MIT License
