/**
 * Memory Tool - Persistent memory with vector embeddings
 *
 * Provides agents with long-term memory capabilities:
 * - Store facts, insights, and learned information
 * - Retrieve relevant memories via semantic search
 * - Organize memories by topic and importance
 * - Clean up outdated or low-value memories
 */

import type { MoltbotPluginApi, ToolDefinition } from "../../../src/plugins/types.js";

export interface MemoryEntry {
  id: string;
  content: string;
  topic?: string;
  importance: number; // 0-1 scale
  embedding?: number[];
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  metadata?: Record<string, unknown>;
}

export interface StoreMemoryInput {
  content: string;
  topic?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface RecallMemoryInput {
  query: string;
  topic?: string;
  limit?: number;
  minImportance?: number;
}

export interface RecallMemoryResult {
  memories: Array<{
    id: string;
    content: string;
    topic?: string;
    importance: number;
    relevance: number;
    createdAt: string;
  }>;
  totalFound: number;
}

// In-memory storage (would be replaced with vector DB in production)
const memoryStore = new Map<string, MemoryEntry>();

export function createMemoryTool(_api: MoltbotPluginApi): ToolDefinition {
  return {
    name: "agent_memory",
    description: `Store and retrieve persistent memories across conversations.

Operations:
- store: Save new information for future recall
- recall: Search for relevant memories
- forget: Remove specific memories
- list: View all memories by topic

Use to:
- Remember user preferences and context
- Store learned facts and insights
- Build knowledge over time
- Maintain conversation continuity`,

    inputSchema: {
      type: "object" as const,
      properties: {
        operation: {
          type: "string",
          enum: ["store", "recall", "forget", "list"],
          description: "Memory operation to perform",
        },
        // Store operation
        content: {
          type: "string",
          description: "Content to store (for store operation)",
        },
        topic: {
          type: "string",
          description: "Topic category for organization",
        },
        importance: {
          type: "number",
          description: "Importance score 0-1 (default: 0.5)",
        },
        metadata: {
          type: "object",
          description: "Additional metadata to store",
        },
        // Recall operation
        query: {
          type: "string",
          description: "Search query for recall",
        },
        limit: {
          type: "number",
          description: "Max memories to return (default: 5)",
        },
        minImportance: {
          type: "number",
          description: "Minimum importance filter (0-1)",
        },
        // Forget operation
        memoryId: {
          type: "string",
          description: "ID of memory to forget",
        },
      },
      required: ["operation"],
    },

    async execute(
      input: {
        operation: "store" | "recall" | "forget" | "list";
      } & Partial<StoreMemoryInput & RecallMemoryInput & { memoryId: string }>
    ): Promise<
      | { success: boolean; memoryId?: string; error?: string }
      | RecallMemoryResult
      | { memories: MemoryEntry[] }
    > {
      switch (input.operation) {
        case "store":
          return storeMemory(input as StoreMemoryInput);
        case "recall":
          return recallMemory(input as RecallMemoryInput);
        case "forget":
          return forgetMemory(input.memoryId || "");
        case "list":
          return listMemories(input.topic);
        default:
          return { success: false, error: `Unknown operation: ${input.operation}` };
      }
    },
  };
}

function storeMemory(
  input: StoreMemoryInput
): { success: boolean; memoryId?: string; error?: string } {
  const { content, topic, importance = 0.5, metadata } = input;

  if (!content) {
    return { success: false, error: "Content is required" };
  }

  const memoryId = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const entry: MemoryEntry = {
    id: memoryId,
    content,
    topic,
    importance: Math.max(0, Math.min(1, importance)),
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 0,
    metadata,
    // In production, embedding would be generated here
    embedding: undefined,
  };

  memoryStore.set(memoryId, entry);

  return { success: true, memoryId };
}

function recallMemory(input: RecallMemoryInput): RecallMemoryResult {
  const { query, topic, limit = 5, minImportance = 0 } = input;

  // Validate query parameter before using it
  // Without a query, we cannot perform semantic search, so return empty results
  if (!query || query.trim() === "") {
    return {
      memories: [],
      totalFound: 0,
    };
  }

  // Filter and search memories
  const candidates = Array.from(memoryStore.values())
    .filter((m) => m.importance >= minImportance)
    .filter((m) => !topic || m.topic === topic);

  // Simple keyword matching (would be vector similarity in production)
  // Safe to call .toLowerCase() now since query is validated
  const queryWords = query.toLowerCase().split(/\s+/);
  const scored = candidates.map((m) => {
    const contentLower = m.content.toLowerCase();
    const matches = queryWords.filter((w) => contentLower.includes(w)).length;
    const relevance = matches / queryWords.length;
    return { memory: m, relevance };
  });

  // Sort by relevance and importance
  scored.sort(
    (a, b) =>
      b.relevance * b.memory.importance - a.relevance * a.memory.importance
  );

  // Take top results
  const results = scored.slice(0, limit);

  // Update access stats
  for (const { memory } of results) {
    memory.lastAccessedAt = new Date();
    memory.accessCount++;
  }

  return {
    memories: results.map(({ memory, relevance }) => ({
      id: memory.id,
      content: memory.content,
      topic: memory.topic,
      importance: memory.importance,
      relevance,
      createdAt: memory.createdAt.toISOString(),
    })),
    totalFound: results.length,
  };
}

function forgetMemory(
  memoryId: string
): { success: boolean; error?: string } {
  if (!memoryId) {
    return { success: false, error: "Memory ID is required" };
  }

  if (!memoryStore.has(memoryId)) {
    return { success: false, error: "Memory not found" };
  }

  memoryStore.delete(memoryId);
  return { success: true };
}

function listMemories(topic?: string): { memories: MemoryEntry[] } {
  const memories = Array.from(memoryStore.values())
    .filter((m) => !topic || m.topic === topic)
    .sort((a, b) => b.importance - a.importance);

  return { memories };
}

// Export for testing
export { memoryStore };
