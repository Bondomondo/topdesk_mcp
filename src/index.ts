import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { TopdeskClient } from "./topdesk-client.js";

const server = new McpServer({
  name: "topdesk-mcp",
  version: "0.1.0"
});

const config = loadConfig();
const topdesk = new TopdeskClient(config);

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

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start topdesk-mcp server", error);
  process.exit(1);
});
