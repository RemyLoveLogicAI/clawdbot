# 📝 Notion Integration for Moltbot

Complete Notion integration providing:
- **API Client** - Full CRUD operations for pages, databases, blocks
- **MCP Tools** - AI agent tools for Notion manipulation
- **Channel Adapter** - Two-way sync between Notion and Moltbot
- **Notifications** - Send alerts to Notion pages/databases
- **Doc Export** - Export markdown documentation to Notion

## Quick Start

### 1. Get Notion API Token

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the Internal Integration Token

### 2. Configure

```bash
# Environment variable
export NOTION_API_TOKEN=secret_xxx

# Or in moltbot.yml
notion:
  apiToken: secret_xxx
```

### 3. Share Pages with Integration

In Notion:
1. Open the page/database you want to access
2. Click "Share" → "Invite"
3. Select your integration

## Configuration

```yaml
# moltbot.yml
notion:
  # Required
  apiToken: secret_xxx  # Or use NOTION_API_TOKEN env var

  # Channel (optional) - for task queue
  taskDatabaseId: abc123...  # Database to watch for tasks
  inboxPageId: def456...     # Page to watch for comments
  pollIntervalMs: 30000      # Poll interval (default: 30s)
  statusProperty: Status     # Task status property name
  newTaskStatus: New         # Status for new tasks
  completedTaskStatus: Done  # Status for completed tasks

  # Notifications (optional)
  logDatabaseId: ghi789...           # Database for notification log
  logPageId: jkl012...               # Page to append notifications
  createNotificationPages: false     # Create pages per notification
  notificationParentPageId: mno345...# Parent for notification pages

  # API settings
  timeoutMs: 30000  # Request timeout
  maxRetries: 3     # Retry attempts
```

## MCP Tools

### Page Operations

| Tool | Description |
|------|-------------|
| `notion_get_page` | Get page by ID |
| `notion_create_page` | Create new page |
| `notion_update_page` | Update page properties |
| `notion_get_page_content` | Get page as markdown |
| `notion_append_to_page` | Append content to page |

### Database Operations

| Tool | Description |
|------|-------------|
| `notion_get_database` | Get database schema |
| `notion_query_database` | Query with filters/sorts |
| `notion_create_database` | Create new database |
| `notion_add_database_item` | Add item to database |

### Search & Blocks

| Tool | Description |
|------|-------------|
| `notion_search` | Search pages and databases |
| `notion_get_block` | Get block by ID |
| `notion_delete_block` | Delete a block |
| `notion_get_block_children` | Get child blocks |

### Comments

| Tool | Description |
|------|-------------|
| `notion_add_comment` | Add comment to page |
| `notion_get_comments` | Get page comments |

### Export & Notifications

| Tool | Description |
|------|-------------|
| `notion_export_docs` | Export docs directory to Notion |
| `notion_send_notification` | Send notification to Notion |
| `notion_channel_status` | Get channel status |

## CLI Commands

```bash
# Check status
moltbot notion status

# Search Notion
moltbot notion search "project docs" --type page --limit 10

# Export documentation
moltbot notion export ./docs abc123-page-id --no-toc

# Send notification
moltbot notion notify "Alert" "Something happened" --priority high
```

## Channel Usage

The Notion channel enables two-way communication:

### Task Queue (Database)

1. Create a database with a "Status" property
2. Configure `taskDatabaseId` in settings
3. New items with status "New" become messages
4. Agent responses are appended to the page
5. Completed tasks are marked "Done"

### Inbox (Page Comments)

1. Create an inbox page
2. Configure `inboxPageId` in settings
3. Comments on the page become messages
4. Agent responses are added as comments

### Example Workflow

```
User creates task in Notion database
        ↓
Moltbot detects new task (polling)
        ↓
Task becomes message in Moltbot
        ↓
AI agent processes and responds
        ↓
Response appended to Notion page
        ↓
Task marked as "Done"
```

## API Examples

### Using the Client Directly

```typescript
import { createNotionClient } from "@moltbot/notion/client";

const client = createNotionClient({
  apiToken: process.env.NOTION_API_TOKEN!,
});

// Search
const results = await client.search({ query: "project" });

// Create page
const page = await client.createPage({
  parent: { type: "page_id", page_id: "parent-id" },
  properties: {
    title: { title: [{ type: "text", text: { content: "New Page" } }] },
  },
});

// Query database
const items = await client.queryDatabase("database-id", {
  filter: {
    property: "Status",
    status: { equals: "In Progress" },
  },
  sorts: [{ property: "Due Date", direction: "ascending" }],
});

// Convert page to markdown
const markdown = await client.pageToMarkdown("page-id");
```

### Using MCP Tools

```typescript
// In AI agent context
const page = await callTool("notion_get_page", {
  page_id: "abc123",
});

await callTool("notion_append_to_page", {
  page_id: "abc123",
  content: "## New Section\n\nThis is new content.",
});

const results = await callTool("notion_search", {
  query: "meeting notes",
  filter_type: "page",
  limit: 5,
});
```

### Exporting Documentation

```typescript
import { createNotionDocExporter } from "@moltbot/notion/export";

const exporter = createNotionDocExporter({
  client,
  parentPageId: "docs-page-id",
  createToc: true,
});

const result = await exporter.exportDirectory("./docs");
console.log(`Exported ${result.created} pages`);
```

### Sending Notifications

```typescript
import { createNotionNotificationProvider } from "@moltbot/notion/notifications";

const notifications = createNotionNotificationProvider({
  client,
  logDatabaseId: "notifications-db-id",
});

await notifications.send({
  title: "Build Complete",
  body: "Version 1.2.3 deployed successfully",
  priority: "normal",
});
```

## HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/notion/status` | GET | Integration status |
| `/notion/webhook` | POST | Webhook receiver |

## Gateway Methods

```typescript
// Via gateway client
await gateway.call("notion.search", { query: "docs" });
await gateway.call("notion.getPage", { pageId: "abc123" });
await gateway.call("notion.createPage", { parent: {...}, properties: {...} });
await gateway.call("notion.notify", { title: "...", body: "..." });
```

## Supported Block Types

The integration supports converting these Notion block types to/from markdown:

| Block Type | Markdown |
|------------|----------|
| Heading 1 | `# Heading` |
| Heading 2 | `## Heading` |
| Heading 3 | `### Heading` |
| Paragraph | Plain text |
| Bulleted List | `- Item` |
| Numbered List | `1. Item` |
| To-do | `- [ ] Task` / `- [x] Done` |
| Quote | `> Quote` |
| Code | ` ```lang ``` ` |
| Divider | `---` |
| Image | `![alt](url)` |
| Bookmark | `[title](url)` |
| Table | `| col | col |` |
| Callout | `> 💡 Note` |

## Rate Limiting

The client automatically handles Notion's rate limits:
- ~3 requests per second default
- Automatic retry on 429 responses
- Exponential backoff on failures

## Troubleshooting

### "Could not find page"
- Ensure the page is shared with your integration
- Check the page ID format (UUID with dashes)

### "Rate limited"
- Reduce request frequency
- The client handles this automatically with retries

### Channel not receiving messages
- Verify database/page IDs
- Check that the integration has access
- Ensure status property name matches config

## License

MIT
