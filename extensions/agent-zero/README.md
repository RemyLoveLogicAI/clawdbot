# Agent Zero Extension for Moltbot

Integrates [Agent Zero](https://github.com/frdel/agent-zero)'s autonomous AI agent capabilities into Moltbot, enabling complex task execution with planning, reflection, and hierarchical agent organization.

## Features

- **Autonomous Task Execution**: Break down complex tasks, execute steps, reflect on results
- **Subordinate Agents**: Spawn child agents for parallel task handling
- **Code Execution**: Run Python, Bash, JavaScript, TypeScript in isolated environments
- **Persistent Memory**: Store and retrieve information across conversations
- **Tool Integration**: Extensible tool system for specialized capabilities

## Installation

The extension is included in Moltbot. Enable it in your config:

```yaml
plugins:
  agent-zero:
    enabled: true
```

## Tools

### `agent_zero_task`

Execute autonomous tasks with planning and reflection:

```
Use agent_zero_task to research and summarize the latest AI developments
```

Options:
- `task`: The task to execute
- `context`: Additional context
- `maxIterations`: Max steps (default: 10)
- `memory`: Use persistent memory (default: true)

### `spawn_subordinate`

Delegate subtasks to child agents:

```
Use spawn_subordinate to analyze the codebase while I continue with documentation
```

Options:
- `task`: Subtask for the subordinate
- `name`: Optional agent name
- `waitForResult`: Wait for completion (default: true)

### `execute_code`

Run code in isolated environments:

```
Use execute_code to run this Python script:
import requests
response = requests.get('https://api.example.com/data')
print(response.json())
```

Options:
- `code`: Code to execute
- `language`: python, bash, javascript, typescript
- `runtime`: docker, ssh, local
- `timeout`: Seconds (default: 30)

### `agent_memory`

Persistent memory operations:

```
Use agent_memory to store: User prefers dark mode and verbose output
Use agent_memory to recall: user preferences
```

Operations:
- `store`: Save new memory
- `recall`: Search memories
- `forget`: Remove memory
- `list`: View all memories

## Configuration

```yaml
plugins:
  agent-zero:
    enabled: true
    
    # Model configuration
    chatModel:
      provider: anthropic
      name: claude-sonnet-4-20250514
      ctxLength: 128000
    
    utilityModel:
      provider: openai
      name: gpt-4o-mini
    
    embeddingsModel:
      provider: openai
      name: text-embedding-3-small
    
    # Code execution
    codeExecution:
      enabled: true
      dockerEnabled: true
      dockerImage: frdel/agent-zero-run:development
    
    # Memory
    memory:
      enabled: true
    
    # Limits
    maxSubordinateDepth: 3
    timeoutMs: 300000
```

## Use Cases

### Complex Research
```
Research the competitive landscape for AI coding assistants, 
analyzing at least 5 competitors and their key differentiators.
```

### Code Analysis
```
Analyze this repository's test coverage and suggest improvements
for the modules with lowest coverage.
```

### Multi-step Workflows
```
1. Fetch the latest sales data from the API
2. Process and clean the data
3. Generate a summary report
4. Email the report to stakeholders
```

### Parallel Processing
```
Spawn subordinates to analyze each of these documents simultaneously,
then synthesize findings into a unified report.
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Moltbot Gateway                      │
├─────────────────────────────────────────────────────────┤
│                    Agent Zero Extension                  │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Task Tool     │  │ Subordinate Tool│              │
│  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                        │
│  ┌────────▼────────────────────▼────────┐              │
│  │           Agent Context               │              │
│  │  • History  • Memory  • Subordinates  │              │
│  └────────────────────────────┬─────────┘              │
│                               │                        │
│  ┌────────────────────────────▼─────────┐              │
│  │           Tool Registry               │              │
│  │  • Code Exec  • Memory  • Browser    │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

## Credits

Based on [Agent Zero](https://github.com/frdel/agent-zero) by frdel.

## License

MIT License - see LICENSE file.
