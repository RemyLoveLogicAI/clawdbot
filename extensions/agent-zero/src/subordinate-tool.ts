/**
 * Subordinate Agent Tool - Spawn child agents for parallel task execution
 *
 * Enables hierarchical agent organization where a parent agent can
 * delegate subtasks to subordinate agents that report back results.
 */

import type { MoltbotPluginApi, ToolDefinition } from "../../../src/plugins/types.js";

export interface SpawnSubordinateInput {
  task: string;
  name?: string;
  context?: string;
  waitForResult?: boolean;
}

export interface SubordinateResult {
  success: boolean;
  subordinateId: string;
  name: string;
  result?: string;
  error?: string;
}

// Track subordinate agents
const subordinateAgents = new Map<
  string,
  {
    id: string;
    name: string;
    parentId: string | null;
    task: string;
    status: "running" | "completed" | "failed";
    result?: string;
    error?: string;
    createdAt: Date;
  }
>();

export function createSubordinateTool(api: MoltbotPluginApi): ToolDefinition {
  return {
    name: "spawn_subordinate",
    description: `Spawn a subordinate agent to handle a subtask.

Use when:
- A task can be parallelized
- You need specialized handling for a subtask
- Work can be delegated while you continue with other steps

The subordinate will execute independently and return results.`,

    inputSchema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string",
          description: "The subtask for the subordinate to complete",
        },
        name: {
          type: "string",
          description: "Optional name for the subordinate agent",
        },
        context: {
          type: "string",
          description: "Context to pass to the subordinate",
        },
        waitForResult: {
          type: "boolean",
          description: "Wait for subordinate to complete (default: true)",
        },
      },
      required: ["task"],
    },

    async execute(input: SpawnSubordinateInput): Promise<SubordinateResult> {
      const { task, name, context, waitForResult = true } = input;

      // Create subordinate ID
      const subordinateId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const subordinateName = name || `Subordinate-${subordinateId.slice(4, 12)}`;

      // Register subordinate
      const subordinate = {
        id: subordinateId,
        name: subordinateName,
        parentId: null, // Would be set by parent context
        task,
        status: "running" as const,
        createdAt: new Date(),
      };
      subordinateAgents.set(subordinateId, subordinate);

      try {
        if (waitForResult) {
          // Execute synchronously
          const result = await executeSubordinateTask(task, context);
          subordinate.status = "completed";
          subordinate.result = result;

          return {
            success: true,
            subordinateId,
            name: subordinateName,
            result,
          };
        } else {
          // Execute asynchronously
          executeSubordinateTask(task, context)
            .then((result) => {
              subordinate.status = "completed";
              subordinate.result = result;
            })
            .catch((error) => {
              subordinate.status = "failed";
              subordinate.error =
                error instanceof Error ? error.message : String(error);
            });

          return {
            success: true,
            subordinateId,
            name: subordinateName,
            result: `Subordinate ${subordinateName} spawned and running`,
          };
        }
      } catch (error) {
        subordinate.status = "failed";
        subordinate.error =
          error instanceof Error ? error.message : String(error);

        return {
          success: false,
          subordinateId,
          name: subordinateName,
          error: subordinate.error,
        };
      }
    },
  };
}

async function executeSubordinateTask(
  task: string,
  context?: string
): Promise<string> {
  // In a full implementation, this would:
  // 1. Create a new Agent context
  // 2. Execute the task with its own monologue loop
  // 3. Return results to parent

  // Placeholder implementation
  return `Subordinate completed task: ${task.slice(0, 50)}...`;
}

// Tool to check subordinate status
export function createCheckSubordinateTool(
  api: MoltbotPluginApi
): ToolDefinition {
  return {
    name: "check_subordinate",
    description: "Check the status of a previously spawned subordinate agent",

    inputSchema: {
      type: "object" as const,
      properties: {
        subordinateId: {
          type: "string",
          description: "The ID of the subordinate to check",
        },
      },
      required: ["subordinateId"],
    },

    async execute(input: { subordinateId: string }): Promise<{
      found: boolean;
      status?: string;
      result?: string;
      error?: string;
    }> {
      const subordinate = subordinateAgents.get(input.subordinateId);

      if (!subordinate) {
        return { found: false };
      }

      return {
        found: true,
        status: subordinate.status,
        result: subordinate.result,
        error: subordinate.error,
      };
    },
  };
}

// Export for testing
export { subordinateAgents };
