import { TopdeskConfig } from "./config.js";

export interface TopdeskIncident {
  id: string;
  number: string;
  status?: { id?: string; name?: string };
  processingStatus?: { id?: string; name?: string };
  briefDescription?: string;
  caller?: { dynamicName?: string; id?: string };
  operator?: { dynamicName?: string; id?: string };
  operatorGroup?: { name?: string; id?: string };
  category?: { name?: string; id?: string };
  subcategory?: { name?: string; id?: string };
  impact?: { name?: string; id?: string };
  priority?: { name?: string; id?: string };
  completed?: boolean;
  closed?: boolean;
  creationDate?: string;
  modificationDate?: string;
  [key: string]: unknown;
}

export interface IncidentListParams {
  pageStart?: number;
  pageSize?: number;
  query?: string;
  fields?: string[];
}

export interface TopdeskChange {
  id: string;
  number: string;
  briefDescription?: string;
  status?: { id?: string; name?: string };
  changeType?: { id?: string; name?: string };
  category?: { name?: string; id?: string };
  subcategory?: { name?: string; id?: string };
  requester?: { id?: string; dynamicName?: string };
  operator?: { id?: string; dynamicName?: string };
  operatorGroup?: { id?: string; name?: string };
  creationDate?: string;
  implementationDate?: string;
  completionDate?: string;
  [key: string]: unknown;
}

export interface TopdeskChangeActivity {
  id: string;
  number?: string;
  briefDescription?: string;
  status?: { id?: string; name?: string };
  operator?: { id?: string; dynamicName?: string };
  plannedStartDate?: string;
  plannedFinalDate?: string;
  [key: string]: unknown;
}

export interface ChangeListParams {
  pageStart?: number;
  pageSize?: number;
  query?: string;
  operatorGroup?: string;
  fields?: string[];
}

export class TopdeskClient {
  private readonly authHeader: string;

  constructor(private readonly config: TopdeskConfig) {
    this.authHeader = `Basic ${Buffer.from(`${config.username}:${config.applicationPassword}`).toString("base64")}`;
  }

  async listIncidents(params: IncidentListParams = {}): Promise<TopdeskIncident[]> {
    const search = new URLSearchParams();
    if (params.pageStart !== undefined) search.set("pageStart", String(params.pageStart));
    if (params.pageSize !== undefined) search.set("pageSize", String(params.pageSize));
    if (params.query) search.set("query", params.query);
    if (params.fields?.length) search.set("fields", params.fields.join(","));

    const path = `/tas/api/incidents${search.toString() ? `?${search}` : ""}`;
    return this.request<TopdeskIncident[]>(path);
  }

  async getIncidentById(id: string): Promise<TopdeskIncident> {
    return this.request<TopdeskIncident>(`/tas/api/incidents/id/${encodeURIComponent(id)}`);
  }

  async getIncidentByNumber(number: string): Promise<TopdeskIncident> {
    return this.request<TopdeskIncident>(`/tas/api/incidents/number/${encodeURIComponent(number)}`);
  }

  async listIncidentStatuses(): Promise<Array<{ id: string; name: string }>> {
    return this.request<Array<{ id: string; name: string }>>(`/tas/api/incidents/statuses`);
  }

  async listChanges(params: ChangeListParams = {}): Promise<TopdeskChange[]> {
    const search = new URLSearchParams();
    if (params.pageStart !== undefined) search.set("page_start", String(params.pageStart));
    if (params.pageSize !== undefined) search.set("page_size", String(params.pageSize));
    if (params.fields?.length) search.set("fields", params.fields.join(","));

    const clauses: string[] = [];
    if (params.operatorGroup) clauses.push(`operatorGroup.name=="${params.operatorGroup}"`);
    if (params.query) clauses.push(params.query);
    if (clauses.length) search.set("query", clauses.join(";"));

    const path = `/tas/api/operatorChanges${search.toString() ? `?${search}` : ""}`;
    return this.request<TopdeskChange[]>(path);
  }

  async getChangeById(id: string): Promise<TopdeskChange> {
    const encoded = encodeURIComponent(id);
    const simple = await this.requestOrNull<TopdeskChange>(`/tas/api/operatorChanges/simple/${encoded}`);
    if (simple) return simple;

    const extensive = await this.requestOrNull<TopdeskChange>(`/tas/api/operatorChanges/extensive/${encoded}`);
    if (extensive) return extensive;

    throw new Error(`TOPdesk change not found: ${id}`);
  }

  async getChangeByNumber(number: string): Promise<TopdeskChange> {
    const results = await this.listChanges({ query: `number==${number}`, pageSize: 1 });
    if (!results.length) {
      throw new Error(`TOPdesk change not found: ${number}`);
    }
    return results[0];
  }

  async listChangeActivities(changeId: string): Promise<TopdeskChangeActivity[]> {
    return this.request<TopdeskChangeActivity[]>(`/tas/api/operatorChanges/${encodeURIComponent(changeId)}/activities`);
  }

  private async requestOrNull<T>(path: string): Promise<T | null> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: this.authHeader, Accept: "application/json" },
        signal: controller.signal,
      });

      if (response.status === 404) return null;

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`TOPdesk API error ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`TOPdesk API error ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
