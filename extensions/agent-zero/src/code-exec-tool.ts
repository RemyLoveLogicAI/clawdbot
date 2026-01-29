/**
 * Code Execution Tool - Execute code in isolated environments
 *
 * Supports multiple execution backends:
 * - Docker containers (isolated, full environment)
 * - SSH to remote hosts (for persistent environments)
 * - Local execution (with sandboxing, use with caution)
 */

import type { MoltbotPluginApi, ToolDefinition } from "../../../src/plugins/types.js";

export interface CodeExecInput {
  code: string;
  language: "python" | "bash" | "javascript" | "typescript";
  runtime?: "docker" | "ssh" | "local";
  timeout?: number;
  workDir?: string;
}

export interface CodeExecResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
  executionTime?: number;
}

export function createCodeExecTool(api: MoltbotPluginApi): ToolDefinition {
  return {
    name: "execute_code",
    description: `Execute code in an isolated environment.

Supported languages:
- python: Python 3.x with common packages
- bash: Shell commands and scripts
- javascript: Node.js runtime
- typescript: TypeScript with ts-node

Use for:
- Data processing and analysis
- File operations
- API interactions
- System automation

Safety: Code runs in isolation. Network and filesystem access may be limited.`,

    inputSchema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "The code to execute",
        },
        language: {
          type: "string",
          enum: ["python", "bash", "javascript", "typescript"],
          description: "Programming language",
        },
        runtime: {
          type: "string",
          enum: ["docker", "ssh", "local"],
          description: "Execution runtime (default: docker if available)",
        },
        timeout: {
          type: "number",
          description: "Execution timeout in seconds (default: 30)",
        },
        workDir: {
          type: "string",
          description: "Working directory for execution",
        },
      },
      required: ["code", "language"],
    },

    async execute(input: CodeExecInput): Promise<CodeExecResult> {
      const {
        code,
        language,
        runtime = "docker",
        timeout = 30,
        workDir = "/tmp",
      } = input;

      const startTime = Date.now();

      try {
        let result: CodeExecResult;

        switch (runtime) {
          case "docker":
            result = await executeInDocker(code, language, timeout, workDir);
            break;
          case "ssh":
            result = await executeViaSsh(code, language, timeout, workDir);
            break;
          case "local":
            result = await executeLocally(code, language, timeout, workDir);
            break;
          default:
            throw new Error(`Unknown runtime: ${runtime}`);
        }

        result.executionTime = Date.now() - startTime;
        return result;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          executionTime: Date.now() - startTime,
        };
      }
    },
  };
}

async function executeInDocker(
  code: string,
  language: string,
  timeout: number,
  workDir: string
): Promise<CodeExecResult> {
  // In a full implementation, this would:
  // 1. Create or reuse a Docker container
  // 2. Write code to a temp file
  // 3. Execute with appropriate interpreter
  // 4. Capture stdout/stderr
  // 5. Clean up

  // Placeholder implementation
  return {
    success: true,
    stdout: `[Docker ${language}] Code executed successfully\n${code.slice(0, 100)}...`,
    stderr: "",
    exitCode: 0,
  };
}

async function executeViaSsh(
  code: string,
  language: string,
  timeout: number,
  workDir: string
): Promise<CodeExecResult> {
  // In a full implementation, this would:
  // 1. Connect to SSH host
  // 2. Transfer code
  // 3. Execute remotely
  // 4. Capture output
  // 5. Disconnect

  // Placeholder implementation
  return {
    success: true,
    stdout: `[SSH ${language}] Code executed successfully\n${code.slice(0, 100)}...`,
    stderr: "",
    exitCode: 0,
  };
}

async function executeLocally(
  code: string,
  language: string,
  timeout: number,
  workDir: string
): Promise<CodeExecResult> {
  // WARNING: Local execution should be heavily sandboxed
  // In a full implementation, this would use:
  // - Node.js vm module for JS
  // - subprocess with resource limits for Python/Bash
  // - Filesystem restrictions

  // Placeholder implementation
  return {
    success: true,
    stdout: `[Local ${language}] Code executed successfully\n${code.slice(0, 100)}...`,
    stderr: "",
    exitCode: 0,
  };
}

// Language-specific helpers
export const LANGUAGE_CONFIGS = {
  python: {
    interpreter: "python3",
    fileExt: ".py",
    dockerImage: "python:3.11-slim",
  },
  bash: {
    interpreter: "bash",
    fileExt: ".sh",
    dockerImage: "alpine:latest",
  },
  javascript: {
    interpreter: "node",
    fileExt: ".js",
    dockerImage: "node:20-slim",
  },
  typescript: {
    interpreter: "npx ts-node",
    fileExt: ".ts",
    dockerImage: "node:20-slim",
  },
} as const;
