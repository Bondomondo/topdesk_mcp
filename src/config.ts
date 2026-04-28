import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface TopdeskConfig {
  baseUrl: string;
  username: string;
  applicationPassword: string;
  timeoutMs: number;
}

function parseEnvValue(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if ((quote === `"` || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFile(filePath = resolve(process.cwd(), ".env")): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = parseEnvValue(trimmed.slice(separatorIndex + 1));

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
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

loadEnvFile();
