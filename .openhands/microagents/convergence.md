# Convergence Microagent

This microagent provides context for AI agents working on the Open-Poke + PersonaPlex + Agent Zero convergence.

## Quick Reference

### Key Files

| Component | Location | Purpose |
|-----------|----------|---------|
| PersonaPlex Provider | `extensions/voice-call/src/providers/personaplex.ts` | Voice-first full-duplex |
| Agent Zero Extension | `extensions/agent-zero/` | Autonomous task execution |
| Poke Skill | `skills/poke-onboard/SKILL.md` | Gmail-based onboarding |
| Convergence Docs | `docs/convergence/README.md` | Architecture guide |
| CI Workflow | `.github/workflows/convergence-ci.yml` | Automated testing |

### Commands

```bash
# Validate convergence code
pnpm lint extensions/agent-zero extensions/voice-call/src/providers/personaplex.ts

# Run convergence tests
pnpm vitest run extensions/agent-zero
pnpm vitest run extensions/voice-call/src/providers/personaplex

# Build with convergence
pnpm build

# Start gateway with convergence features
moltbot gateway --verbose
```

### Environment Variables

```bash
# PersonaPlex
PERSONAPLEX_SERVER_URL=wss://localhost:8998
HF_TOKEN=your_huggingface_token
PERSONAPLEX_MOCK_MODE=true  # For testing without GPU

# Poke Onboarding
COMPOSIO_API_KEY=your_composio_key
OPENAI_API_KEY=your_openai_key

# Agent Zero
AGENT_ZERO_ENABLED=true
AGENT_ZERO_DOCKER_ENABLED=false  # Enable for code execution
```

## Architecture

```
User → Channel (WhatsApp/Telegram/etc)
         ↓
    Moltbot Gateway
         ↓
    ┌────┴────┐
    ↓         ↓
PersonaPlex  Agent Zero
(Voice)      (Tasks)
    ↓         ↓
    └────┬────┘
         ↓
    Poke Onboard
    (Research)
```

## Development Tasks

### Adding a new PersonaPlex voice
1. Add voice constant to `PERSONAPLEX_VOICES` in `personaplex.ts`
2. Update README with voice description
3. Add test for new voice

### Adding a new Agent Zero tool
1. Create tool file in `extensions/agent-zero/src/`
2. Export from `index.ts`
3. Add tool to `clawdbot.plugin.json` schema
4. Write tests
5. Update README

### Adding Poke research source
1. Add Composio tool to `SKILL.md`
2. Update research strategy in documentation
3. Test with sample users

## Testing Guidelines

### Unit Tests
- Use mock providers (no external services)
- Test tool input/output schemas
- Test error handling

### Integration Tests
- Require running services (mark as e2e)
- Use test credentials
- Clean up after tests

### CI Behavior
- Convergence CI runs on convergence/* branches
- Main CI runs on all PRs
- Tests use mock mode by default

## Common Issues

### PersonaPlex "Connection refused"
- Ensure PersonaPlex server is running
- Check `PERSONAPLEX_SERVER_URL`
- Verify SSL certificates

### Agent Zero "Timeout"
- Increase `timeoutMs` in config
- Check task complexity
- Review iteration count

### Poke "No tools"
- Verify Composio API key
- Check Gmail OAuth connection
- Review Composio dashboard

## Related PRs and Issues

When working on convergence, reference:
- Branch: `convergence/open-poke-personaplex-agent-zero`
- Original repos:
  - https://github.com/RemyLoveLogicAI/open-poke
  - https://github.com/RemyLoveLogicAI/personaplex
  - https://github.com/RemyLoveLogicAI/agent-zero

## Autonomous Work Guidelines

### For AI Agents

1. **Before making changes:**
   - Read this file and `docs/convergence/README.md`
   - Check existing tests pass
   - Review related code files

2. **When implementing:**
   - Follow existing code patterns
   - Add JSDoc comments with @ai-context
   - Include examples in documentation

3. **After changes:**
   - Run lint and type-check
   - Add or update tests
   - Update documentation
   - Commit with descriptive message

4. **For PR review:**
   - Ensure CI passes
   - Request review from maintainers
   - Address feedback promptly

### Commit Message Format

```
type(scope): description

- bullet points for details
- reference issues/PRs

Co-authored-by: openhands <openhands@all-hands.dev>
```

Types: feat, fix, docs, test, refactor, chore
Scopes: agent-zero, personaplex, poke, convergence
