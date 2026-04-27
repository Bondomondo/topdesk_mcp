# topdesk_mcp

MCP server that allows AI agents to read incident/ticket data from TOPdesk.

## Features

- `topdesk_get_ticket`: fetch one incident by ticket number or id
- `topdesk_get_ticket_status`: compact status summary for one incident
- `topdesk_list_tickets`: list incidents with paging/query options
- `topdesk_list_statuses`: list available incident statuses

## Requirements

- Node.js 20+
- A TOPdesk operator/person with API permissions
- An application password for that API account

## Configuration

Set these environment variables before starting the server:

- `TOPDESK_BASE_URL` (example: `https://yourcompany.topdesk.net`)
- `TOPDESK_API_USERNAME`
- `TOPDESK_APPLICATION_PASSWORD`
- `TOPDESK_TIMEOUT_MS` (optional, defaults to `15000`)

## Install & run

```bash
npm install
npm run build
npm start
```

For local development:

```bash
npm run dev
```

## MCP client configuration example

Example for a local MCP client config (adapt to your client):

```json
{
  "mcpServers": {
    "topdesk": {
      "command": "node",
      "args": ["/absolute/path/to/topdesk_mcp/dist/index.js"],
      "env": {
        "TOPDESK_BASE_URL": "https://yourcompany.topdesk.net",
        "TOPDESK_API_USERNAME": "api-user",
        "TOPDESK_APPLICATION_PASSWORD": "your-app-password"
      }
    }
  }
}
```

## Notes

- This server currently implements read-only incident endpoints.
- The API uses HTTP Basic Auth with username + application password.
- Confirm field names in your tenant and extend the tools as needed.
