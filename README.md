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

Set these environment variables before starting the server, or put them in a `.env` file in the project root:

- `TOPDESK_BASE_URL` (example: `https://yourcompany.topdesk.net`)
- `TOPDESK_API_USERNAME`
- `TOPDESK_APPLICATION_PASSWORD`
- `TOPDESK_TIMEOUT_MS` (optional, defaults to `15000`)
- `MCP_TRANSPORT` (optional, `stdio` or `sse`, defaults to `stdio`)
- `MCP_SSE_HOST` (optional, defaults to `127.0.0.1`)
- `MCP_SSE_PORT` (optional, defaults to `3000`)
- `MCP_SSE_PATH` (optional, defaults to `/sse`)
- `MCP_SSE_MESSAGE_PATH` (optional, defaults to `/messages`)

Example `.env`:

```dotenv
TOPDESK_BASE_URL=https://yourcompany.topdesk.net
TOPDESK_API_USERNAME=api-user
TOPDESK_APPLICATION_PASSWORD=your-app-password
TOPDESK_TIMEOUT_MS=15000

MCP_TRANSPORT=sse
MCP_SSE_HOST=127.0.0.1
MCP_SSE_PORT=3000
MCP_SSE_PATH=/sse
MCP_SSE_MESSAGE_PATH=/messages
```

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

To run with server-sent events transport:

```bash
MCP_TRANSPORT=sse npm start
```

Or set `MCP_TRANSPORT=sse` in `.env` and run:

```bash
npm start
```

The SSE endpoint defaults to `http://127.0.0.1:3000/sse`.

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
