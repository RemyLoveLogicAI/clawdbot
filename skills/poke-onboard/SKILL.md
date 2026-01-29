---
name: poke-onboard
description: Personalized user onboarding via Gmail research and web presence analysis. Greets users with discovered insights.
homepage: https://github.com/RemyLoveLogicAI/open-poke
metadata: {"moltbot":{"emoji":"🌴","requires":{"env":["COMPOSIO_API_KEY","OPENAI_API_KEY"]}}}
---

# Poke Onboard 🌴

A personalized onboarding agent that researches users via their Gmail data and web presence, then engages in natural conversations with discovered insights.

## Overview

Poke acts as a "digital bouncer" who sizes people up before deciding if they're worth your time. It automatically:

1. **Researches the user** via Gmail profile and web searches
2. **Builds a professional profile** with verified information
3. **Greets with insights** - "So you are [Name], [what we found]..."
4. **Engages in personalized conversation** with context awareness

## Setup

### 1. Install Composio CLI

```bash
pip install composio-core composio-langchain
```

### 2. Configure Gmail Access

```bash
# Authenticate with Composio
composio login

# Add Gmail integration
composio add gmail
```

### 3. Set Environment Variables

```bash
export COMPOSIO_API_KEY="your_composio_api_key"
export OPENAI_API_KEY="your_openai_api_key"
```

## Usage

### Trigger Research Mode

Send a message containing "Hello Poke" to trigger automatic research:

```
User: Hello Poke
Poke: [Researches user via Gmail + web, then responds with insights]
```

### Direct Conversation

After initial research, Poke maintains context in normal conversation:

```
User: What can you help me with?
Poke: [Responds with awareness of user's background and interests]
```

## Research Strategy

### Phase 1: Gmail Profile Analysis
- Extract name and email domain
- Analyze email domain for company info (skip generic providers)
- Search for professional profiles using full name

### Phase 2: Web Research
- Search combinations: Name + Company + Skills
- Cross-reference LinkedIn, company pages, professional directories
- Gather personal projects, achievements, contributions

### Phase 3: Profile Assembly
- Cross-verify information from multiple sources
- Build comprehensive user profile
- Prepare personalized greeting

## Available Tools

When integrated with Composio, Poke has access to:

| Tool | Description |
|------|-------------|
| `GMAIL_GET_PROFILE` | Get user's Gmail profile information |
| `GMAIL_SEARCH_PEOPLE` | Search for professional profiles |
| `GMAIL_FETCH_EMAILS` | Analyze email patterns and signatures |
| `COMPOSIO_SEARCH` | Web search for additional context |

## Personality Modes

### Research Mode (Initial)
- Digital bouncer vibe
- Sizes people up before engaging
- Presents findings matter-of-factly
- Tests if they're "worth talking to"

### Conversation Mode (Ongoing)
- Still cool and measured
- References discovered context when relevant
- Matches user's energy
- Helpful but not eager

## Example Greetings

```
"So you are John Smith, software engineer at TechCorp, been coding for 5 years, 
recently moved to Austin. Seems like another dev chasing the startup dream. 
What makes you different from the thousand other engineers I've seen this week?"
```

```
"So you are Sarah Johnson, marketing director at SaaS company, MBA from Wharton, 
writes about growth hacking. Another marketing person who thinks they've cracked 
the code. Prove me wrong."
```

## Privacy & Security

- **Professional info only**: Sticks to publicly available information
- **No private email content**: Uses verified professional profiles
- **Work-focused**: Avoids personal relationships or sensitive details
- **Multi-source verification**: Confirms facts from 2+ sources

## Integration with Moltbot

Poke works across all Moltbot channels:

- **WhatsApp**: `/poke` command or "Hello Poke" message
- **Telegram**: Same triggers
- **Discord**: Use in DMs or mention bot
- **Slack**: Direct message or thread mention
- **iMessage**: Natural conversation
- **Voice**: Say "Hello Poke" to trigger research

## Configuration

Add to your `moltbot.config.yaml`:

```yaml
skills:
  poke-onboard:
    enabled: true
    composioApiKey: ${COMPOSIO_API_KEY}
    openaiApiKey: ${OPENAI_API_KEY}
    # Optional: Custom persona
    persona: "bouncer" # or "friendly", "professional"
    # Optional: Research depth
    researchDepth: "full" # or "quick", "minimal"
```

## Extending Poke

### Custom Personas

Create custom personas by modifying the system prompt:

```yaml
skills:
  poke-onboard:
    customPersona: |
      You are a professional assistant who researches users to provide
      personalized service. Greet them warmly with relevant insights.
```

### Additional Data Sources

Integrate more tools via Composio:

- LinkedIn (via `composio add linkedin`)
- Twitter/X (via `composio add twitter`)
- GitHub (via `composio add github`)

## Troubleshooting

### "No tools available"
- Check Composio API key is set
- Verify Gmail integration: `composio show-connections`

### "Research failed"
- User may have privacy settings blocking searches
- Try with just name (without email domain)

### Rate limits
- Composio and OpenAI have rate limits
- Space out research requests for multiple users

## Credits

Based on [Open-Poke](https://github.com/RemyLoveLogicAI/open-poke), built with [Composio](https://composio.dev).
