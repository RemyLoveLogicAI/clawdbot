/**
 * @fileoverview Documentation Export to Notion
 * @module notion/export
 * @version 1.0.0
 *
 * @description
 * Export markdown documentation to Notion pages and databases.
 * Supports batch export with hierarchical structure preservation.
 *
 * @ai-context
 * - Converts markdown files to Notion pages
 * - Preserves directory structure as page hierarchy
 * - Creates TOC and navigation
 * - Supports incremental updates
 */

import type { NotionClient, NotionPage, NotionRichText } from "./client.js";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

export interface ExportConfig {
  /** Notion client instance */
  client: NotionClient;
  /** Parent page ID for exported docs */
  parentPageId: string;
  /** Create table of contents */
  createToc?: boolean;
  /** Update existing pages instead of creating new */
  updateExisting?: boolean;
  /** Icon for documentation pages */
  defaultIcon?: string;
  /** Mapping of file extensions to page icons */
  iconMapping?: Record<string, string>;
}

export interface ExportResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  pages: Array<{ path: string; pageId: string; url: string }>;
  errors: Array<{ path: string; error: string }>;
}

export interface DocFile {
  path: string;
  name: string;
  content: string;
  isDirectory: boolean;
  children?: DocFile[];
}

// ============================================================================
// Documentation Exporter
// ============================================================================

export class NotionDocExporter {
  private client: NotionClient;
  private config: ExportConfig;
  private existingPages: Map<string, NotionPage> = new Map();

  constructor(config: ExportConfig) {
    this.client = config.client;
    this.config = {
      ...config,
      createToc: config.createToc ?? true,
      updateExisting: config.updateExisting ?? true,
      defaultIcon: config.defaultIcon || "📄",
      iconMapping: {
        ".md": "📝",
        ".ts": "🔷",
        ".js": "🟨",
        ".json": "📋",
        ".yml": "⚙️",
        ".yaml": "⚙️",
        ...config.iconMapping,
      },
    };
  }

  /**
   * @ai-context Export a directory of documentation to Notion
   */
  async exportDirectory(dirPath: string): Promise<ExportResult> {
    const result: ExportResult = {
      total: 0,
      created: 0,
      updated: 0,
      failed: 0,
      pages: [],
      errors: [],
    };

    // Load existing pages if updating
    if (this.config.updateExisting) {
      await this.loadExistingPages();
    }

    // Scan directory
    const docs = this.scanDirectory(dirPath);
    result.total = this.countFiles(docs);

    // Export root TOC if enabled
    if (this.config.createToc) {
      await this.createTableOfContents(docs, this.config.parentPageId);
    }

    // Export all files
    await this.exportFiles(docs, this.config.parentPageId, result);

    return result;
  }

  /**
   * @ai-context Export a single markdown file to Notion
   */
  async exportFile(filePath: string, parentPageId?: string): Promise<{ pageId: string; url: string }> {
    const content = fs.readFileSync(filePath, "utf-8");
    const fileName = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);
    const icon = this.config.iconMapping?.[ext] || this.config.defaultIcon!;

    // Extract title from first heading or use filename
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : fileName;

    // Convert markdown to blocks
    const blocks = this.markdownToBlocks(content);

    // Create page
    const page = await this.client.createPage({
      parent: { type: "page_id", page_id: parentPageId || this.config.parentPageId },
      properties: {
        title: { title: [{ type: "text", text: { content: title } }] },
      },
      children: blocks,
      icon: { type: "emoji", emoji: icon },
    });

    return { pageId: page.id, url: page.url };
  }

  /**
   * @ai-context Export markdown string directly to Notion
   */
  async exportMarkdown(
    markdown: string,
    title: string,
    parentPageId?: string
  ): Promise<{ pageId: string; url: string }> {
    const blocks = this.markdownToBlocks(markdown);

    const page = await this.client.createPage({
      parent: { type: "page_id", page_id: parentPageId || this.config.parentPageId },
      properties: {
        title: { title: [{ type: "text", text: { content: title } }] },
      },
      children: blocks,
      icon: { type: "emoji", emoji: this.config.defaultIcon! },
    });

    return { pageId: page.id, url: page.url };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async loadExistingPages(): Promise<void> {
    const blocks = await this.client.getBlockChildren(this.config.parentPageId);

    for (const block of blocks.results) {
      if (block.type === "child_page") {
        const pageId = block.id;
        try {
          const page = await this.client.getPage(pageId);
          const title = this.extractTitle(page.properties);
          this.existingPages.set(title.toLowerCase(), page);
        } catch {
          // Page might be inaccessible
        }
      }
    }
  }

  private scanDirectory(dirPath: string, relativePath = ""): DocFile[] {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const docs: DocFile[] = [];

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const itemRelativePath = path.join(relativePath, item.name);

      if (item.isDirectory()) {
        // Skip hidden directories and common non-doc folders
        if (item.name.startsWith(".") || item.name === "node_modules") continue;

        docs.push({
          path: itemRelativePath,
          name: item.name,
          content: "",
          isDirectory: true,
          children: this.scanDirectory(fullPath, itemRelativePath),
        });
      } else if (item.name.endsWith(".md")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        docs.push({
          path: itemRelativePath,
          name: item.name.replace(".md", ""),
          content,
          isDirectory: false,
        });
      }
    }

    // Sort: directories first, then files alphabetically
    return docs.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  private countFiles(docs: DocFile[]): number {
    let count = 0;
    for (const doc of docs) {
      if (doc.isDirectory && doc.children) {
        count += this.countFiles(doc.children);
      } else {
        count++;
      }
    }
    return count;
  }

  private async exportFiles(docs: DocFile[], parentPageId: string, result: ExportResult): Promise<void> {
    for (const doc of docs) {
      try {
        if (doc.isDirectory) {
          // Create section page
          const sectionPage = await this.createSectionPage(doc.name, parentPageId);
          result.created++;
          result.pages.push({ path: doc.path, pageId: sectionPage.id, url: sectionPage.url });

          // Export children
          if (doc.children) {
            await this.exportFiles(doc.children, sectionPage.id, result);
          }
        } else {
          // Check for existing page
          const existingPage = this.existingPages.get(doc.name.toLowerCase());

          if (existingPage && this.config.updateExisting) {
            // Update existing page
            await this.updatePage(existingPage.id, doc.content);
            result.updated++;
            result.pages.push({ path: doc.path, pageId: existingPage.id, url: existingPage.url });
          } else {
            // Create new page
            const { pageId, url } = await this.exportMarkdown(doc.content, doc.name, parentPageId);
            result.created++;
            result.pages.push({ path: doc.path, pageId, url });
          }
        }
      } catch (error) {
        result.failed++;
        result.errors.push({ path: doc.path, error: String(error) });
      }
    }
  }

  private async createSectionPage(name: string, parentPageId: string): Promise<NotionPage> {
    return this.client.createPage({
      parent: { type: "page_id", page_id: parentPageId },
      properties: {
        title: { title: [{ type: "text", text: { content: name } }] },
      },
      icon: { type: "emoji", emoji: "📁" },
    });
  }

  private async createTableOfContents(docs: DocFile[], parentPageId: string): Promise<void> {
    const tocContent = this.generateTocMarkdown(docs);

    await this.client.appendBlockChildren(parentPageId, [
      {
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ type: "text", text: { content: "📚 Table of Contents" } }] },
      },
      ...this.markdownToBlocks(tocContent),
      { object: "block", type: "divider", divider: {} },
    ]);
  }

  private generateTocMarkdown(docs: DocFile[], indent = 0): string {
    const lines: string[] = [];
    const prefix = "  ".repeat(indent);

    for (const doc of docs) {
      if (doc.isDirectory) {
        lines.push(`${prefix}- 📁 **${doc.name}**`);
        if (doc.children) {
          lines.push(this.generateTocMarkdown(doc.children, indent + 1));
        }
      } else {
        lines.push(`${prefix}- 📄 ${doc.name}`);
      }
    }

    return lines.join("\n");
  }

  private async updatePage(pageId: string, content: string): Promise<void> {
    // Delete existing content
    const existingBlocks = await this.client.getBlockChildren(pageId);
    for (const block of existingBlocks.results) {
      await this.client.deleteBlock(block.id);
    }

    // Add new content
    const blocks = this.markdownToBlocks(content);
    await this.client.appendBlockChildren(pageId, blocks);
  }

  private extractTitle(properties: Record<string, any>): string {
    const titleProp = Object.values(properties).find((p) => p.type === "title");
    if (titleProp?.title) {
      return titleProp.title.map((t: NotionRichText) => t.plain_text).join("");
    }
    return "Untitled";
  }

  private markdownToBlocks(markdown: string): Record<string, unknown>[] {
    const blocks: Record<string, unknown>[] = [];
    const lines = markdown.split("\n");
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeLanguage = "";
    let inTable = false;
    let tableRows: string[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.startsWith("```")) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.slice(3) || "plain text";
          codeContent = [];
        } else {
          inCodeBlock = false;
          blocks.push({
            object: "block",
            type: "code",
            code: {
              rich_text: [{ type: "text", text: { content: codeContent.join("\n") } }],
              language: this.normalizeLanguage(codeLanguage),
            },
          });
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // Table detection
      if (line.includes("|") && line.trim().startsWith("|")) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        // Skip separator rows
        if (!/^\|[\s-:|]+\|$/.test(line.trim())) {
          const cells = line
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        inTable = false;
        blocks.push(this.createTableBlock(tableRows));
        tableRows = [];
      }

      // Skip empty lines
      if (!line.trim()) continue;

      // Headings
      if (line.startsWith("# ")) {
        blocks.push({
          object: "block",
          type: "heading_1",
          heading_1: { rich_text: this.parseInlineFormatting(line.slice(2)) },
        });
      } else if (line.startsWith("## ")) {
        blocks.push({
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: this.parseInlineFormatting(line.slice(3)) },
        });
      } else if (line.startsWith("### ")) {
        blocks.push({
          object: "block",
          type: "heading_3",
          heading_3: { rich_text: this.parseInlineFormatting(line.slice(4)) },
        });
      }
      // Lists
      else if (line.match(/^- \[[ x]\] /)) {
        const checked = line.includes("[x]");
        blocks.push({
          object: "block",
          type: "to_do",
          to_do: {
            rich_text: this.parseInlineFormatting(line.replace(/^- \[[ x]\] /, "")),
            checked,
          },
        });
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        blocks.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: this.parseInlineFormatting(line.slice(2)) },
        });
      } else if (/^\d+\. /.test(line)) {
        blocks.push({
          object: "block",
          type: "numbered_list_item",
          numbered_list_item: { rich_text: this.parseInlineFormatting(line.replace(/^\d+\. /, "")) },
        });
      }
      // Quotes
      else if (line.startsWith("> ")) {
        blocks.push({
          object: "block",
          type: "quote",
          quote: { rich_text: this.parseInlineFormatting(line.slice(2)) },
        });
      }
      // Dividers
      else if (line === "---" || line === "***" || line === "___") {
        blocks.push({ object: "block", type: "divider", divider: {} });
      }
      // Images
      else if (line.match(/^!\[.*\]\(.*\)$/)) {
        const match = line.match(/^!\[(.*)\]\((.*)\)$/);
        if (match) {
          blocks.push({
            object: "block",
            type: "image",
            image: {
              type: "external",
              external: { url: match[2] },
            },
          });
        }
      }
      // Links as bookmarks
      else if (line.match(/^\[.*\]\(https?:\/\/.*\)$/)) {
        const match = line.match(/^\[.*\]\((https?:\/\/.*)\)$/);
        if (match) {
          blocks.push({
            object: "block",
            type: "bookmark",
            bookmark: { url: match[1] },
          });
        }
      }
      // Regular paragraph
      else {
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: this.parseInlineFormatting(line) },
        });
      }
    }

    // Handle remaining table
    if (inTable && tableRows.length > 0) {
      blocks.push(this.createTableBlock(tableRows));
    }

    return blocks;
  }

  private createTableBlock(rows: string[][]): Record<string, unknown> {
    const width = Math.max(...rows.map((r) => r.length));

    return {
      object: "block",
      type: "table",
      table: {
        table_width: width,
        has_column_header: true,
        has_row_header: false,
        children: rows.map((row) => ({
          object: "block",
          type: "table_row",
          table_row: {
            cells: row.map((cell) => this.parseInlineFormatting(cell)),
          },
        })),
      },
    };
  }

  private parseInlineFormatting(text: string): Record<string, unknown>[] {
    const parts: Record<string, unknown>[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
      if (boldMatch) {
        parts.push({
          type: "text",
          text: { content: boldMatch[1] },
          annotations: { bold: true },
        });
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic
      const italicMatch = remaining.match(/^\*([^*]+?)\*/);
      if (italicMatch) {
        parts.push({
          type: "text",
          text: { content: italicMatch[1] },
          annotations: { italic: true },
        });
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Inline code
      const codeMatch = remaining.match(/^`([^`]+?)`/);
      if (codeMatch) {
        parts.push({
          type: "text",
          text: { content: codeMatch[1] },
          annotations: { code: true },
        });
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Links
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push({
          type: "text",
          text: { content: linkMatch[1], link: { url: linkMatch[2] } },
        });
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      // Find next special character
      const nextSpecial = remaining.search(/[*`\[]/);
      if (nextSpecial === -1) {
        parts.push({ type: "text", text: { content: remaining } });
        break;
      } else if (nextSpecial > 0) {
        parts.push({ type: "text", text: { content: remaining.slice(0, nextSpecial) } });
        remaining = remaining.slice(nextSpecial);
      } else {
        parts.push({ type: "text", text: { content: remaining[0] } });
        remaining = remaining.slice(1);
      }
    }

    return parts.length > 0 ? parts : [{ type: "text", text: { content: "" } }];
  }

  private normalizeLanguage(lang: string): string {
    const mapping: Record<string, string> = {
      ts: "typescript",
      js: "javascript",
      py: "python",
      rb: "ruby",
      sh: "bash",
      yml: "yaml",
      md: "markdown",
    };
    return mapping[lang.toLowerCase()] || lang.toLowerCase() || "plain text";
  }
}

// Export factory function
export function createNotionDocExporter(config: ExportConfig): NotionDocExporter {
  return new NotionDocExporter(config);
}
