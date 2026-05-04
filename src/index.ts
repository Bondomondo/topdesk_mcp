import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { z } from "zod";
import { authenticateRequest, sendProtectedResourceMetadata } from "./auth.js";
import { loadConfig, loadOAuthConfig } from "./config.js";
import { TopdeskClient } from "./topdesk-client.js";

const config = loadConfig();
const topdesk = new TopdeskClient(config);

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "topdesk-mcp",
    version: "0.1.0"
  });

  server.tool(
    "topdesk_get_ticket",
    "Get a TOPdesk incident by ticket number or incident id.",
    {
      ticketNumber: z.string().optional(),
      incidentId: z.string().optional()
    },
    async ({ ticketNumber, incidentId }) => {
      if (!ticketNumber && !incidentId) {
        throw new Error("Provide either ticketNumber or incidentId.");
      }

      const incident = ticketNumber
        ? await topdesk.getIncidentByNumber(ticketNumber)
        : await topdesk.getIncidentById(incidentId as string);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(incident, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    "topdesk_get_ticket_status",
    "Get a compact status summary for a TOPdesk incident.",
    {
      ticketNumber: z.string().optional(),
      incidentId: z.string().optional()
    },
    async ({ ticketNumber, incidentId }) => {
      if (!ticketNumber && !incidentId) {
        throw new Error("Provide either ticketNumber or incidentId.");
      }

      const incident = ticketNumber
        ? await topdesk.getIncidentByNumber(ticketNumber)
        : await topdesk.getIncidentById(incidentId as string);

      const summary = {
        id: incident.id,
        number: incident.number,
        status: incident.status?.name ?? incident.processingStatus?.name ?? null,
        operator: incident.operator?.dynamicName ?? null,
        operatorGroup: incident.operatorGroup?.name ?? null,
        priority: incident.priority?.name ?? null,
        completed: incident.completed ?? null,
        closed: incident.closed ?? null,
        creationDate: incident.creationDate ?? null,
        modificationDate: incident.modificationDate ?? null
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    "topdesk_list_tickets",
    "List TOPdesk incidents with optional paging, query filter, and fields projection.",
    {
      pageStart: z.number().int().nonnegative().optional(),
      pageSize: z.number().int().positive().max(10000).optional(),
      query: z.string().optional(),
      fields: z.array(z.string()).optional()
    },
    async ({ pageStart, pageSize, query, fields }) => {
      const incidents = await topdesk.listIncidents({
        pageStart,
        pageSize,
        query,
        fields
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(incidents, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    "topdesk_list_statuses",
    "List available TOPdesk incident statuses.",
    {},
    async () => {
      const statuses = await topdesk.listIncidentStatuses();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(statuses, null, 2)
          }
        ]
      };
    }
  );

  return server;
}

function sendText(res: ServerResponse, statusCode: number, body: string): void {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

async function startStdioServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await createMcpServer().connect(transport);
}

async function startSseServer(): Promise<void> {
  // Azure App Service injects PORT; fall back to MCP_SSE_PORT for local dev
  const host = process.env.MCP_SSE_HOST ?? "0.0.0.0";
  const port = Number(process.env.PORT ?? process.env.MCP_SSE_PORT ?? 3000);
  const ssePath = process.env.MCP_SSE_PATH ?? "/sse";
  const messagePath = process.env.MCP_SSE_MESSAGE_PATH ?? "/messages";
  const transports = new Map<string, SSEServerTransport>();
  const oauthConfig = loadOAuthConfig();

  if (oauthConfig.enabled) {
    console.error(
      `topdesk-mcp OAuth 2.1 enabled — issuer: ${oauthConfig.issuer}, audience: ${oauthConfig.audience}`
    );
  }

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

    // Unauthenticated: liveness probe for Azure App Service health checks
    if (req.method === "GET" && requestUrl.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Unauthenticated: RFC 9728 OAuth 2.0 Protected Resource Metadata
    if (req.method === "GET" && requestUrl.pathname === "/.well-known/oauth-protected-resource") {
      if (!oauthConfig.enabled) {
        sendText(res, 404, "Not found.");
        return;
      }
      sendProtectedResourceMetadata(res, oauthConfig);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === ssePath) {
      if (oauthConfig.enabled) {
        const ok = await authenticateRequest(req, res, oauthConfig);
        if (!ok) return;
      }

      const transport = new SSEServerTransport(messagePath, res);
      transports.set(transport.sessionId, transport);
      transport.onclose = () => {
        transports.delete(transport.sessionId);
      };

      await createMcpServer().connect(transport);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === messagePath) {
      if (oauthConfig.enabled) {
        const ok = await authenticateRequest(req, res, oauthConfig);
        if (!ok) return;
      }

      const sessionId = requestUrl.searchParams.get("sessionId");
      const transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        sendText(res, 404, "Unknown or missing SSE sessionId.");
        return;
      }

      await transport.handlePostMessage(req, res);
      return;
    }

    sendText(res, 404, "Not found.");
  });

  httpServer.listen(port, host, () => {
    console.error(`topdesk-mcp SSE transport listening at http://${host}:${port}${ssePath}`);
    if (oauthConfig.enabled) {
      console.error(
        `OAuth protected resource metadata: http://${host}:${port}/.well-known/oauth-protected-resource`
      );
    }
  });
}

async function main(): Promise<void> {
  const transport = process.env.MCP_TRANSPORT ?? "stdio";

  if (transport === "stdio") {
    await startStdioServer();
    return;
  }

  if (transport === "sse") {
    await startSseServer();
    return;
  }

  throw new Error(`Unsupported MCP_TRANSPORT "${transport}". Use "stdio" or "sse".`);
}

main().catch((error) => {
  console.error("Failed to start topdesk-mcp server", error);
  process.exit(1);
});
