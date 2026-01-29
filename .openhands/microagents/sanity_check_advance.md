---
name: sanity_check_advance
type: knowledge
version: 1.0.0
agent: CodeActAgent
triggers: []
---

# Sanity Check Advance - Add Notes for Next Micro Agent

This microagent performs sanity checks and adds notes for the next micro agent in the workflow.

## Purpose

The purpose of this microagent is to:
1. Perform sanity checks on the current state of the codebase or task
2. Document findings and observations
3. Add notes that will be useful for the next micro agent in the pipeline

## Instructions

When activated, this microagent should:

### 1. Sanity Check
- Verify that the current task or codebase is in a valid state
- Check for any inconsistencies or issues that need to be addressed
- Validate that prerequisites are met before proceeding

### 2. Add Notes for Next Micro Agent
- Document the current state of the work
- List any pending items or considerations
- Provide context that will help the next micro agent understand what has been done
- Include any warnings or important information

## Notes Format

When adding notes, use the following structure:

```
## Status
- Current state: [describe current state]
- Completed items: [list completed items]
- Pending items: [list pending items]

## Context for Next Agent
- [Important context point 1]
- [Important context point 2]

## Warnings/Considerations
- [Any warnings or special considerations]
```

## Usage

This microagent does not have automatic triggers. It should be invoked manually when:
- Transitioning between different phases of work
- Handing off tasks to another micro agent
- Completing a significant milestone that requires documentation
