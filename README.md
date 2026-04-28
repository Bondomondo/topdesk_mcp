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

### TOPdesk

| Variable | Required | Default | Description |
|---|---|---|---|
| `TOPDESK_BASE_URL` | yes | — | e.g. `https://yourcompany.topdesk.net` |
| `TOPDESK_API_USERNAME` | yes | — | API account username |
| `TOPDESK_APPLICATION_PASSWORD` | yes | — | Application password for the API account |
| `TOPDESK_TIMEOUT_MS` | no | `15000` | Request timeout in ms |

### Transport

| Variable | Required | Default | Description |
|---|---|---|---|
| `MCP_TRANSPORT` | no | `stdio` | `stdio` or `sse` |
| `MCP_SSE_HOST` | no | `127.0.0.1` | Bind host. Use `0.0.0.0` on Azure App Service |
| `MCP_SSE_PORT` | no | `3000` | HTTP port |
| `MCP_SSE_PATH` | no | `/sse` | SSE endpoint path |
| `MCP_SSE_MESSAGE_PATH` | no | `/messages` | POST message path |

### OAuth 2.1 (optional — required for hosted deployments)

| Variable | Required | Default | Description |
|---|---|---|---|
| `OAUTH_ENABLED` | no | `false` | Set to `true` to enforce Bearer token auth |
| `AZURE_TENANT_ID` | if enabled | — | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | if enabled | — | App registration client ID |
| `OAUTH_AUDIENCE` | no | `api://<clientId>` | Expected `aud` claim; override if your app uses a custom audience |
| `OAUTH_ISSUER` | no | `https://login.microsoftonline.com/<tenantId>/v2.0` | Override the expected token issuer |
| `MCP_SERVER_URL` | no | `http://localhost:<port>` | Public URL of this server (used in OAuth metadata) |

Example `.env` for local development:

```dotenv
TOPDESK_BASE_URL=https://yourcompany.topdesk.net
TOPDESK_API_USERNAME=api-user
TOPDESK_APPLICATION_PASSWORD=your-app-password

MCP_TRANSPORT=sse
MCP_SSE_HOST=127.0.0.1
MCP_SSE_PORT=3000
```

Example `.env` for Azure App Service with OAuth:

```dotenv
TOPDESK_BASE_URL=https://yourcompany.topdesk.net
TOPDESK_API_USERNAME=api-user
TOPDESK_APPLICATION_PASSWORD=your-app-password

MCP_TRANSPORT=sse
MCP_SSE_HOST=0.0.0.0
MCP_SSE_PORT=8080

OAUTH_ENABLED=true
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MCP_SERVER_URL=https://your-app.azurewebsites.net
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

## Azure App Service deployment

1. **Create an App Registration** in Azure Entra ID:
   - Go to Azure Portal → Entra ID → App registrations → New registration
   - Set the Redirect URI to `https://your-app.azurewebsites.net` (Web)
   - Under **Expose an API**, add a scope (e.g. `mcp.access`) — this creates the `api://<clientId>` audience automatically

2. **Set App Service environment variables** (Application settings in the portal) using the values from the table above.
   - Use `MCP_SSE_HOST=0.0.0.0` so the server binds to all interfaces
   - Use `MCP_SSE_PORT=8080` (Azure App Service routes port 80/443 → 8080 by default)

3. **Startup command**: `node dist/index.js`

4. **Token acquisition for clients** — direct clients to acquire a token from Azure AD:
   - Authorization endpoint: `https://login.microsoftonline.com/<tenantId>/oauth2/v2.0/authorize`
   - Token endpoint: `https://login.microsoftonline.com/<tenantId>/oauth2/v2.0/token`
   - Scope: `api://<clientId>/mcp.access`

5. **Discovery endpoint** — once running, clients can auto-discover the authorization server via:
   `GET https://your-app.azurewebsites.net/.well-known/oauth-protected-resource`

6. **Health check** — Azure App Service health probes can use:
   `GET https://your-app.azurewebsites.net/health`

## Notes

- This server currently implements read-only incident endpoints.
- The TOPdesk API uses HTTP Basic Auth with username + application password; this is server-to-server and never exposed to clients.
- OAuth 2.1 is enforced at the MCP transport layer; all token validation uses Azure AD's JWKS endpoint.
- Confirm field names in your tenant and extend the tools as needed.
