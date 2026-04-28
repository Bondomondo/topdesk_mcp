import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from "jose";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface OAuthConfig {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  audience: string;
  issuer: string;
  serverUrl: string;
}

// jose caches keys internally per RemoteJWKSet instance; we keep one per JWKS URI
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}

/**
 * Validates the Bearer token on the request.
 * Returns true if valid; writes a 401 and returns false otherwise.
 */
export async function authenticateRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: OAuthConfig
): Promise<boolean> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendUnauthorized(res, config, "invalid_token", "Bearer token required");
    return false;
  }

  const token = authHeader.slice(7);
  const jwksUri = `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`;

  try {
    await jwtVerify(token, getJWKS(jwksUri), {
      issuer: config.issuer,
      audience: config.audience,
    });
    return true;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      sendUnauthorized(res, config, "invalid_token", "Token has expired");
    } else if (err instanceof joseErrors.JWTClaimValidationFailed) {
      sendUnauthorized(res, config, "invalid_token", "Token claim validation failed");
    } else {
      sendUnauthorized(res, config, "invalid_token", "Invalid token");
    }
    return false;
  }
}

function sendUnauthorized(
  res: ServerResponse,
  config: OAuthConfig,
  error: string,
  description: string
): void {
  // RFC 6750 §3 – WWW-Authenticate header for Bearer token errors
  const wwwAuth = [
    `Bearer realm="${config.serverUrl}"`,
    `error="${error}"`,
    `error_description="${description}"`,
  ].join(", ");

  res.writeHead(401, {
    "WWW-Authenticate": wwwAuth,
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify({ error, error_description: description }));
}

/**
 * Writes the RFC 9728 OAuth 2.0 Protected Resource Metadata response.
 * MCP clients use this to discover which authorization server issues tokens.
 */
export function sendProtectedResourceMetadata(
  res: ServerResponse,
  config: OAuthConfig
): void {
  const metadata = {
    resource: config.serverUrl,
    authorization_servers: [config.issuer],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://github.com/bondomondo/topdesk_mcp",
  };

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600",
  });
  res.end(JSON.stringify(metadata, null, 2));
}
