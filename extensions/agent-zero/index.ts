/**
 * Agent Zero Extension for Moltbot
 *
 * Integrates Agent Zero's autonomous AI agent capabilities:
 * - Tool execution with extensible tool system
 * - Persistent memory with vector embeddings
 * - Code execution (Docker or SSH)
 * - Hierarchical subordinate agents
 * - Knowledge base integration
 */

import type { MoltbotPluginApi } from "../../src/plugins/types.js";

import { createAgentZeroTool } from "./src/agent-zero-tool.js";
import { createSubordinateTool } from "./src/subordinate-tool.js";
import { createCodeExecTool } from "./src/code-exec-tool.js";
import { createMemoryTool } from "./src/memory-tool.js";

export default function register(api: MoltbotPluginApi) {
  // Register the main Agent Zero autonomous task tool
  api.registerTool(createAgentZeroTool(api), { optional: true });

  // Register subordinate agent spawning tool
  api.registerTool(createSubordinateTool(api), { optional: true });

  // Register code execution tool (if enabled)
  api.registerTool(createCodeExecTool(api), { optional: true });

  // Register memory management tool
  api.registerTool(createMemoryTool(api), { optional: true });
}
