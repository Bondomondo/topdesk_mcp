export interface TopdeskConfig {
  baseUrl: string;
  username: string;
  applicationPassword: string;
  timeoutMs: number;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): TopdeskConfig {
  const baseUrl = requireEnv("TOPDESK_BASE_URL").replace(/\/$/, "");

  return {
    baseUrl,
    username: requireEnv("TOPDESK_API_USERNAME"),
    applicationPassword: requireEnv("TOPDESK_APPLICATION_PASSWORD"),
    timeoutMs: Number(process.env.TOPDESK_TIMEOUT_MS ?? 15000)
  };
}
